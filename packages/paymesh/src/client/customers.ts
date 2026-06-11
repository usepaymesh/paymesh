import { PaymeshError } from '../errors';
import { splitExtraFields } from '../shared/database/fields';
import type {
	PaymeshCustomer,
	PaymeshCustomerList,
	PaymeshCustomerUpsertData,
} from '../types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshCustomerListOptions,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { Provider, ProviderRequestOptions } from '../types/providers';
import { resolveIncludeRaw } from './helpers';

export function createCustomersClient<
	Schema extends DatabaseSchemaOptions,
	P extends Provider<string>,
	IncludeRaw extends boolean,
>({
	assertCapability,
	baseIncludeRaw,
	database,
	mergeOptions,
	provider,
	schema,
}: {
	assertCapability: (capability: 'customers') => void;
	baseIncludeRaw: boolean;
	database?: PaymeshDatabaseDriver;
	mergeOptions: <CallIncludeRaw extends boolean = false>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	) => ProviderRequestOptions<CallIncludeRaw>;
	provider: P;
	schema: ResolvedDatabaseSchema;
}) {
	return {
		upsert: async <CallIncludeRaw extends boolean = IncludeRaw>(
			data: PaymeshCustomerUpsertData<Schema>,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('customers');

			const { input, extra } = splitExtraFields(
				data,
				schema.tables.customers.fields,
			);

			const customer = await provider.customers.upsert(
				input as Parameters<P['customers']['upsert']>[0],
				mergeOptions(requestOptions),
			);
			const resolvedCustomer = Object.assign(
				customer,
				extra,
			) as PaymeshCustomer<CallIncludeRaw, Schema>;

			if (database) {
				await database.repositories.customers.upsert(schema, resolvedCustomer);
			}

			return resolvedCustomer;
		},
		get: async <CallIncludeRaw extends boolean = IncludeRaw>(
			id: Parameters<P['customers']['get']>[0],
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('customers');
			const mergedOptions = mergeOptions(requestOptions);

			if (database) {
				const customer = await database.repositories.customers.findByProviderId(
					schema,
					provider.id,
					mergedOptions.sandbox ?? provider.isSandbox(),
					id,
					{
						includeRaw: mergedOptions.includeRaw,
					},
				);

				if (customer)
					return customer as PaymeshCustomer<CallIncludeRaw, Schema>;

				throw new PaymeshError({
					code: 'provider_not_found',
					message: `Customer "${id}" was not found in the configured database`,
					provider: provider.id,
				});
			}

			return provider.customers.get(id, mergedOptions) as Promise<
				PaymeshCustomer<CallIncludeRaw, Schema>
			>;
		},
		getByEmail: async <CallIncludeRaw extends boolean = IncludeRaw>(
			email: string,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('customers');
			if (!database) {
				throw new PaymeshError({
					code: 'unsupported_capability',
					message:
						'Customer lookup by email requires a configured database adapter.',
					provider: provider.id,
				});
			}

			const mergedOptions = mergeOptions(requestOptions);
			const sandbox = mergedOptions.sandbox ?? provider.isSandbox();
			const customer = database.repositories.customers.findByEmail
				? await database.repositories.customers.findByEmail(
						schema,
						provider.id,
						sandbox,
						email,
						{
							includeRaw: mergedOptions.includeRaw,
						},
					)
				: await findCustomerByField({
						includeRaw: mergedOptions.includeRaw,
						list: (options) =>
							database.repositories.customers.list(
								schema,
								provider.id,
								sandbox,
								options,
							) as unknown as Promise<{
								data: Array<Record<string, unknown>>;
								next: string | null;
							}>,
						field: 'email',
						value: email,
					});

			if (!customer) {
				throw new PaymeshError({
					code: 'provider_not_found',
					message: `Customer with email "${email}" was not found in the configured database`,
					provider: provider.id,
				});
			}

			return customer as PaymeshCustomer<CallIncludeRaw, Schema>;
		},
		getByExternalId: async <CallIncludeRaw extends boolean = IncludeRaw>(
			externalId: string,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('customers');
			if (!database) {
				throw new PaymeshError({
					code: 'unsupported_capability',
					message:
						'Customer lookup by external id requires a configured database adapter.',
					provider: provider.id,
				});
			}

			const mergedOptions = mergeOptions(requestOptions);
			const sandbox = mergedOptions.sandbox ?? provider.isSandbox();
			const customer = database.repositories.customers.findByExternalId
				? await database.repositories.customers.findByExternalId(
						schema,
						provider.id,
						sandbox,
						externalId,
						{
							includeRaw: mergedOptions.includeRaw,
						},
					)
				: await findCustomerByField({
						includeRaw: mergedOptions.includeRaw,
						list: (options) =>
							database.repositories.customers.list(
								schema,
								provider.id,
								sandbox,
								options,
							) as unknown as Promise<{
								data: Array<Record<string, unknown>>;
								next: string | null;
							}>,
						field: 'externalId',
						value: externalId,
					});

			if (!customer) {
				throw new PaymeshError({
					code: 'provider_not_found',
					message: `Customer with external id "${externalId}" was not found in the configured database`,
					provider: provider.id,
				});
			}

			return customer as PaymeshCustomer<CallIncludeRaw, Schema>;
		},
		list: async <CallIncludeRaw extends boolean = IncludeRaw>(
			options?: PaymeshCustomerListOptions<CallIncludeRaw>,
		) => {
			if (!database) {
				throw new PaymeshError({
					code: 'unsupported_capability',
					message: `Provider "${provider.id}" does not support "customers.list" without a configured database`,
					provider: provider.id,
				});
			}

			const result = await database.repositories.customers.list(
				schema,
				provider.id,
				options?.sandbox ?? provider.isSandbox(),
				{
					includeRaw: resolveIncludeRaw(
						options?.includeRaw,
						baseIncludeRaw,
					) as CallIncludeRaw,
					limit: options?.limit,
					after: options?.after,
					before: options?.before,
				},
			);

			return {
				...result,
				data: result.data as Array<PaymeshCustomer<CallIncludeRaw, Schema>>,
			} as PaymeshCustomerList<CallIncludeRaw, Schema>;
		},
		delete: async <CallIncludeRaw extends boolean = IncludeRaw>(
			id: Parameters<P['customers']['delete']>[0],
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('customers');

			const result = await provider.customers.delete(
				id,
				mergeOptions(requestOptions),
			);

			if (database) {
				await database.repositories.customers.markDeleted(schema, result);
			}

			return result;
		},
	};
}

async function findCustomerByField<IncludeRaw extends boolean>({
	includeRaw,
	list,
	field,
	value,
}: {
	includeRaw?: IncludeRaw;
	list: (options?: {
		limit?: number;
		after?: string;
		before?: string;
		includeRaw?: IncludeRaw;
	}) => Promise<{
		data: Array<Record<string, unknown>>;
		next: string | null;
	}>;
	field: 'email' | 'externalId';
	value: string;
}) {
	let after: string | undefined;
	const limit = 100;

	for (;;) {
		const page = await list({
			limit,
			after,
			includeRaw,
		});

		const match = page.data.find((customer) => customer[field] === value);
		if (match) return match;

		if (!page.next) return null;
		after = page.next;
	}
}
