import { defineDatabaseAdapter } from './database/adapter';
import { resolveDatabaseSchema } from './database/schema';
import { handleClientWebhook } from './database/webhooks';
import { PaymeshError } from './errors';
import { bootstrapPlugins } from './plugins/runtime';
import { createRequestOptionsMerger } from './shared/client/request-options';
import { splitExtraFields } from './shared/database/fields';
import { resolveClientSchemaOptions } from './shared/database/schema';
import type {
	ClientOptions,
	HandleWebhookOptions,
	PaymeshClient,
	PaymeshCustomer,
	PaymeshCustomerList,
	PaymeshCustomerUpsertData,
	PaymeshPayment,
	PaymeshPaymentCreateData,
	PluginClientExtensions,
} from './types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshCustomerListOptions,
} from './types/database';
import type { AnyPaymeshPlugin } from './types/plugins';
import type {
	Provider,
	ProviderCapability,
	ProviderRequestOptions,
} from './types/providers';

export type * from './errors';
export { PaymeshError } from './errors';
export { definePlugin, event, lazy } from './plugins';
export { defineProvider } from './providers';
export { withRaw } from './shared/raw';
export type { RetryOptions } from './shared/request';
export { request } from './shared/request';
export type * from './types/client';
export type * from './types/database';
export type * from './types/plugins';
export type * from './types/providers';
export { defineDatabaseAdapter, resolveDatabaseSchema };
export const createClient = <
	const Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	P extends Provider<string> = Provider<string>,
	IncludeRaw extends boolean = false,
	const Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
>({
	provider,
	...options
}: ClientOptions<P, IncludeRaw, Schema, Plugins>): PaymeshClient<
	IncludeRaw,
	Schema,
	Plugins
> &
	PluginClientExtensions<Plugins> => {
	const {
		database,
		hooks: baseHooks,
		includeRaw: baseIncludeRaw,
		plugins = [] as unknown as Plugins,
	} = options;

	const schema = resolveDatabaseSchema(
		resolveClientSchemaOptions(options.schema, plugins),
	);

	const assertCapability = (capability: ProviderCapability) => {
		if (!provider.capabilities[capability])
			throw new PaymeshError({
				provider: provider.id,
				code: 'unsupported_capability',
				message: `Provider "${provider.id}" does not support "${capability}" capability`,
			});
	};

	const mergeOptions = createRequestOptionsMerger({
		baseUrl: options.baseUrl,
		timeout: options.timeout,
		retry: options.retry,
		fetch: options.fetch,
		includeRaw: options.includeRaw,
	});

	const client = {
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

				if (database)
					await database.repositories.checkouts.upsert(schema, resolvedPayment);

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

				if (database)
					await database.repositories.customers.upsert(
						schema,
						resolvedCustomer,
					);

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
			list: async <CallIncludeRaw extends boolean = IncludeRaw>(
				options?: PaymeshCustomerListOptions<CallIncludeRaw>,
			) => {
				if (!database)
					throw new PaymeshError({
						code: 'unsupported_capability',
						message: `Provider "${provider.id}" does not support "customers.list" without a configured database`,
						provider: provider.id,
					});

				const includeRaw = (options?.includeRaw ??
					baseIncludeRaw ??
					false) as CallIncludeRaw;

				const result = await database.repositories.customers.list(
					schema,
					provider.id,
					{
						includeRaw,
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

				if (database)
					await database.repositories.customers.markDeleted(schema, result);

				return result;
			},
		},
		webhooks: {
			handle: async <CallIncludeRaw extends boolean = IncludeRaw>(
				webhookOptions: HandleWebhookOptions<CallIncludeRaw, Plugins>,
			) =>
				handleClientWebhook({
					provider,
					database,
					schema,
					request: webhookOptions.request,
					dispatchHook: bootstrappedPlugins.createHookDispatcher(
						webhookOptions.hooks as never,
					),
					hasHook: (hook) =>
						bootstrappedPlugins.hasHook(hook, webhookOptions.hooks as never),
					includeRaw: (webhookOptions.includeRaw ??
						baseIncludeRaw ??
						false) as CallIncludeRaw,
					skipVerify: webhookOptions.skipVerify ?? false,
				}),
		},
		routes: {
			list: () => [],
			handle: async () =>
				Response.json({ error: 'route_not_found' }, { status: 404 }),
		},
		plugins: {
			byId: {},
			list: () => [],
		},
		capabilities: provider.capabilities,
	} as PaymeshClient<IncludeRaw, Schema, Plugins>;

	const bootstrappedPlugins = bootstrapPlugins({
		baseHooks: baseHooks as never,
		client,
		database,
		plugins,
		provider,
		schema,
	});

	client.routes = bootstrappedPlugins.routesClient;
	client.plugins = bootstrappedPlugins.pluginsClient;

	const extendedClient = Object.defineProperties(
		client,
		Object.getOwnPropertyDescriptors(bootstrappedPlugins.extensions),
	);

	return extendedClient as PaymeshClient<IncludeRaw, Schema, Plugins> &
		PluginClientExtensions<Plugins>;
};
