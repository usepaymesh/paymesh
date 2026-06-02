import { defineDatabaseAdapter } from './database/adapter';
import { resolveDatabaseSchema } from './database/schema';
import { handleClientWebhook } from './database/webhooks';
import { PaymeshError } from './errors';
import type {
	ClientOptions,
	HandleWebhookOptions,
	PaymeshClient,
	PaymeshCustomer,
	PaymeshCustomerUpsertData,
	PaymeshHooks,
	PaymeshPayment,
	PaymeshPaymentCreateData,
} from './types/client';
import type {
	DatabaseSchemaOptions,
	ResolvedDatabaseExtraTableFields,
} from './types/database';
import type {
	Provider,
	ProviderCapability,
	ProviderRequestOptions,
} from './types/providers';

export type * from './errors';
export { PaymeshError } from './errors';
export { defineProvider } from './providers';
export { withRaw } from './shared/raw';
export type { RetryOptions } from './shared/request';
export { request } from './shared/request';
export type * from './types/client';
export type * from './types/database';
export type * from './types/providers';
export { defineDatabaseAdapter, resolveDatabaseSchema };

export const createClient = <
	const Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	P extends Provider<string> = Provider<string>,
	IncludeRaw extends boolean = false,
>({
	provider,
	...options
}: ClientOptions<P, IncludeRaw, Schema>): PaymeshClient<IncludeRaw, Schema> => {
	const database = options.database;
	const schema = resolveDatabaseSchema(options.schema);

	const assertCapability = (capability: ProviderCapability) => {
		if (!provider.capabilities[capability])
			throw new PaymeshError({
				provider: provider.id,
				code: 'unsupported_capability',
				message: `Provider "${provider.id}" does not support "${capability}" capability`,
			});
	};

	const mergeOptions = <CallIncludeRaw extends boolean = IncludeRaw>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	): ProviderRequestOptions<CallIncludeRaw> => ({
		baseUrl: requestOptions?.baseUrl ?? options.baseUrl,
		timeout: requestOptions?.timeout ?? options.timeout,
		retry: requestOptions?.retry ?? options.retry,
		fetch: requestOptions?.fetch ?? options.fetch,
		includeRaw: (requestOptions?.includeRaw ??
			options.includeRaw ??
			false) as CallIncludeRaw,
	});
	const baseHooks = options.hooks;
	const baseIncludeRaw = options.includeRaw;

	return {
		provider,
		database,
		schema,
		hooks: options.hooks,
		includeRaw: options.includeRaw,
		payments: {
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
		},
		customers: {
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
					await database.repositories.customers.upsert(
						schema,
						resolvedCustomer,
					);
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
					const customer =
						await database.repositories.customers.findByProviderId(
							schema,
							provider.id,
							id,
							{
								includeRaw: mergedOptions.includeRaw,
							},
						);

					if (customer) {
						return customer as PaymeshCustomer<CallIncludeRaw, Schema>;
					}

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
		},
		webhooks: {
			handle: <CallIncludeRaw extends boolean = IncludeRaw>(
				webhookOptions: HandleWebhookOptions<CallIncludeRaw>,
			) =>
				handleClientWebhook({
					provider,
					database,
					schema,
					request: webhookOptions.request,
					hooks: {
						...(baseHooks as PaymeshHooks<CallIncludeRaw> | undefined),
						...(webhookOptions.hooks as
							| PaymeshHooks<CallIncludeRaw>
							| undefined),
					},
					includeRaw: (webhookOptions.includeRaw ??
						baseIncludeRaw ??
						false) as CallIncludeRaw,
					skipVerify: webhookOptions.skipVerify ?? false,
				}),
		},
		capabilities: provider.capabilities,
	};
};

function splitExtraFields(
	value: unknown,
	fields: ResolvedDatabaseExtraTableFields,
) {
	const extra: Record<string, unknown> = {};
	if (typeof value !== 'object' || value === null) {
		return { input: value, extra };
	}

	const input = { ...(value as Record<string, unknown>) };

	for (const key of Object.keys(fields)) {
		if (!Object.hasOwn(input, key)) continue;
		extra[key] = input[key];
		delete input[key];
	}

	return { input, extra };
}
