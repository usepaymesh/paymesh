import { defineDatabaseAdapter } from './database/adapter';
import { upsertCheckout, upsertCustomer } from './database/persistence';
import { resolveDatabaseSchema } from './database/schema';
import { handleClientWebhook } from './database/webhooks';
import { PaymeshError } from './errors';
import type {
	ClientOptions,
	HandleWebhookOptions,
	PaymeshHooks,
} from './types/client';
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
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
>({
	provider,
	...options
}: ClientOptions<P, IncludeRaw>) => {
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
				data: Parameters<P['payments']['create']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('checkout');

				const payment = await provider.payments.create(
					data,
					mergeOptions(requestOptions),
				);

				if (database) await upsertCheckout(database, schema, payment);

				return payment;
			},
		},
		customers: {
			create: async <CallIncludeRaw extends boolean = IncludeRaw>(
				data: Parameters<P['customers']['create']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				const customer = await provider.customers.create(
					data,
					mergeOptions(requestOptions),
				);

				if (database) await upsertCustomer(database, schema, customer);

				return customer;
			},
			get: async <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['get']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				const customer = await provider.customers.get(
					id,
					mergeOptions(requestOptions),
				);

				if (database) await upsertCustomer(database, schema, customer);

				return customer;
			},
			update: async <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['update']>[0],
				data: Parameters<P['customers']['update']>[1],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				const customer = await provider.customers.update(
					id,
					data,
					mergeOptions(requestOptions),
				);

				if (database) await upsertCustomer(database, schema, customer);

				return customer;
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

				if (database) await upsertCustomer(database, schema, result, true);

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
