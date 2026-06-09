import { PaymeshError } from '../errors';
import { splitExtraFields } from '../shared/database/fields';
import type { PaymeshPix, PaymeshPixCreateData } from '../types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { Provider, ProviderRequestOptions } from '../types/providers';
import { getRequiredProviderFeature } from './helpers';

export function createPixClient<
	Schema extends DatabaseSchemaOptions,
	P extends Provider<string>,
	IncludeRaw extends boolean,
>({
	assertCapability,
	database,
	mergeOptions,
	provider,
	schema,
}: {
	assertCapability: (capability: 'pix') => void;
	database?: PaymeshDatabaseDriver;
	mergeOptions: <CallIncludeRaw extends boolean = false>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	) => ProviderRequestOptions<CallIncludeRaw>;
	provider: P;
	schema: ResolvedDatabaseSchema;
}) {
	return {
		create: async <CallIncludeRaw extends boolean = IncludeRaw>(
			data: PaymeshPixCreateData<Schema>,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('pix');

			const pixProvider = getRequiredProviderFeature(
				provider.pix,
				provider.id,
				'pix',
			);

			const { input, extra } = splitExtraFields(data, schema.tables.pix.fields);

			const pix = await pixProvider.create(
				input as Parameters<NonNullable<P['pix']>['create']>[0],
				mergeOptions(requestOptions),
			);

			const resolvedPix = Object.assign(pix, extra) as PaymeshPix<
				CallIncludeRaw,
				Schema
			>;

			if (database) {
				await database.repositories.pix.upsert(schema, resolvedPix);
			}

			return resolvedPix;
		},
		get: async <CallIncludeRaw extends boolean = IncludeRaw>(
			id: string,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('pix');

			const pixProvider = getRequiredProviderFeature(
				provider.pix,
				provider.id,
				'pix',
			);
			const mergedOptions = mergeOptions(requestOptions);

			if (database) {
				const pix = await database.repositories.pix.findByProviderId(
					schema,
					provider.id,
					provider.isSandbox(),
					id,
					{
						includeRaw: mergedOptions.includeRaw,
					},
				);

				if (pix) return pix as PaymeshPix<CallIncludeRaw, Schema>;

				throw new PaymeshError({
					code: 'provider_not_found',
					message: `Pix payment "${id}" was not found in the configured database`,
					provider: provider.id,
				});
			}

			return pixProvider.get(id, mergedOptions) as Promise<
				PaymeshPix<CallIncludeRaw, Schema>
			>;
		},
	};
}
