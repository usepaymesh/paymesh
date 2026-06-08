import { splitExtraFields } from '../shared/database/fields';
import type { PaymeshPayment, PaymeshPaymentCreateData } from '../types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { Provider, ProviderRequestOptions } from '../types/providers';

export function createPaymentsClient<
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
	assertCapability: (capability: 'checkout') => void;
	database?: PaymeshDatabaseDriver;
	mergeOptions: <CallIncludeRaw extends boolean = false>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	) => ProviderRequestOptions<CallIncludeRaw>;
	provider: P;
	schema: ResolvedDatabaseSchema;
}) {
	return {
		create: async <CallIncludeRaw extends boolean = IncludeRaw>(
			data: PaymeshPaymentCreateData<Schema>,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('checkout');

			const { input, extra } = splitExtraFields(
				data,
				schema.tables.checkouts.fields,
			);

			const payment = await provider.payments.create(
				input as Parameters<P['payments']['create']>[0],
				mergeOptions(requestOptions),
			);
			const resolvedPayment = Object.assign(payment, extra) as PaymeshPayment<
				CallIncludeRaw,
				Schema
			>;

			if (database) {
				await database.repositories.checkouts.upsert(schema, resolvedPayment);
			}

			return resolvedPayment;
		},
	};
}
