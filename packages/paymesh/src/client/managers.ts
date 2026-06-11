import { PaymeshError } from '../errors';
import { bootstrapPlugins } from '../plugins/runtime';
import { createRequestOptionsMerger } from '../shared/client/request-options';
import type {
	ClientOptions,
	PaymeshClient,
	PluginClientExtensions,
} from '../types/client';
import type {
	DatabaseSchemaOptions,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { AnyPaymeshPlugin } from '../types/plugins';
import type { Provider, ProviderCapability } from '../types/providers';
import { createCustomersClient } from './customers';
import type { RuntimeHookDispatcher } from './helpers';
import { createPaymentsClient } from './payments';
import { createPixClient } from './pix';
import { createWebhookClient } from './webhooks';

interface CreateClientManagersOptions<
	Schema extends DatabaseSchemaOptions,
	P extends Provider<string>,
	IncludeRaw extends boolean,
	Plugins extends readonly AnyPaymeshPlugin[],
> {
	provider: P;
	options: Omit<ClientOptions<P, IncludeRaw, Schema, Plugins>, 'provider'>;
	schema: ResolvedDatabaseSchema;
}

export function createClientManagers<
	Schema extends DatabaseSchemaOptions,
	P extends Provider<string>,
	IncludeRaw extends boolean,
	Plugins extends readonly AnyPaymeshPlugin[],
>({
	schema,
	provider,
	options: { mcp, ...options },
}: CreateClientManagersOptions<Schema, P, IncludeRaw, Plugins>): PaymeshClient<
	IncludeRaw,
	Schema,
	Plugins
> &
	PluginClientExtensions<Plugins> {
	const {
		database,
		hooks: baseHooks,
		includeRaw: baseIncludeRaw = false,
		plugins = [] as unknown as Plugins,
	} = options;

	const mergeOptions = createRequestOptionsMerger({
		baseUrl: options.baseUrl,
		timeout: options.timeout,
		retry: options.retry,
		fetch: options.fetch,
		includeRaw: options.includeRaw,
	});

	const assertCapability = (capability: ProviderCapability) => {
		if (!provider.capabilities[capability])
			throw new PaymeshError({
				provider: provider.id,
				code: 'unsupported_capability',
				message: `Provider "${provider.id}" does not support "${capability}" capability`,
			});
	};

	let createHookDispatcher: unknown;
	let hasHook: unknown;

	const client = {
		provider,
		isSandbox: provider.isSandbox,
		database,
		schema,
		hooks: options.hooks,
		includeRaw: options.includeRaw,
		payments: createPaymentsClient({
			assertCapability,
			database,
			mergeOptions,
			provider,
			schema,
		}),
		pix: createPixClient({
			assertCapability,
			database,
			mergeOptions,
			provider,
			schema,
		}),
		customers: createCustomersClient({
			assertCapability,
			baseIncludeRaw,
			database,
			mergeOptions,
			provider,
			schema,
		}),
		webhooks: createWebhookClient({
			baseIncludeRaw,
			database,
			provider,
			schema,
			getDispatchHook: (localHooks) => {
				const dispatcher = createHookDispatcher as
					| ((localHooks?: unknown) => RuntimeHookDispatcher)
					| undefined;

				return dispatcher?.(localHooks);
			},
			getHasHook: (localHooks) => {
				const detector = hasHook as
					| ((hook: string, localHooks?: unknown) => boolean)
					| undefined;

				return detector ? (hook) => detector(hook, localHooks) : undefined;
			},
		}),
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
		$mcp: {
			tools: {
				pix: mcp?.tools?.pix ?? true,
				payments: mcp?.tools?.payments ?? true,
				customers: mcp?.tools?.customers ?? true,
				subscriptions: mcp?.tools?.subscriptions ?? true,
			},
			enabled: mcp?.enabled ?? true,
			readonly: mcp?.readonly ?? false,
			includeRaw: mcp?.includeRaw ?? false,
			maxListLimit: mcp?.maxListLimit ?? 50,
			allowLiveMode: mcp?.allowLiveMode ?? false,
		},
	} as PaymeshClient<IncludeRaw, Schema, Plugins>;

	const bootstrappedPlugins = bootstrapPlugins({
		baseHooks: baseHooks as never,
		client,
		database,
		plugins,
		provider,
		schema,
	});

	createHookDispatcher = bootstrappedPlugins.createHookDispatcher as unknown;
	hasHook = bootstrappedPlugins.hasHook as unknown;

	client.routes = bootstrappedPlugins.routesClient;
	client.plugins = bootstrappedPlugins.pluginsClient;

	return Object.defineProperties(
		client,
		Object.getOwnPropertyDescriptors(bootstrappedPlugins.extensions),
	) as PaymeshClient<IncludeRaw, Schema, Plugins> &
		PluginClientExtensions<Plugins>;
}
