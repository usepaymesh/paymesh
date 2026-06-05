import { PaymeshError } from '../errors';
import type {
	PaymeshClient,
	PaymeshHooks,
	PluginClientExtensions,
} from '../types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type {
	AnyPaymeshPlugin,
	LazyPluginExtension,
	PaymeshPluginsClient,
	PaymeshRoutesClient,
	PluginHook,
	PluginRouteDefinition,
	RegisteredPaymeshPlugin,
	RegisteredPluginRoute,
} from '../types/plugins';
import type { Provider } from '../types/providers';

const BUILT_IN_HOOK_NAMES = [
	'onEvent',
	'onPaymentCreated',
	'onPaymentSucceeded',
	'onPaymentFailed',
	'onPaymentCanceled',
	'onPaymentRefunded',
	'onCustomerCreated',
	'onCustomerUpdated',
	'onCustomerDeleted',
	'onSubscriptionCreated',
	'onSubscriptionUpdated',
	'onSubscriptionCanceled',
	'onCheckoutCompleted',
];

type RuntimeHookHandler = PluginHook<unknown>;

type RuntimeHooks<
	IncludeRaw extends boolean,
	Plugins extends readonly AnyPaymeshPlugin[],
> = Partial<
	Record<keyof PaymeshHooks<IncludeRaw, Plugins> & string, RuntimeHookHandler>
>;

interface BootstrapPluginsOptions<
	IncludeRaw extends boolean,
	Schema extends DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[],
	TClient extends PaymeshClient<IncludeRaw, Schema, Plugins>,
> {
	baseHooks?: RuntimeHooks<IncludeRaw, Plugins>;
	client: TClient;
	database?: PaymeshDatabaseDriver;
	plugins: Plugins;
	provider: Provider<string>;
	schema: ResolvedDatabaseSchema;
}

interface BootstrappedPlugins<
	IncludeRaw extends boolean,
	Plugins extends readonly AnyPaymeshPlugin[],
> {
	createHookDispatcher(
		localHooks?: RuntimeHooks<IncludeRaw, Plugins>,
	): (hook: string, event: unknown) => Promise<void>;
	extensions: PluginClientExtensions<Plugins>;
	pluginsClient: PaymeshPluginsClient<Plugins>;
	routesClient: PaymeshRoutesClient<IncludeRaw, Plugins>;
}

interface RouteRegistration<
	TPlugin extends AnyPaymeshPlugin = AnyPaymeshPlugin,
> {
	matcher: RouteMatcher;
	definition: PluginRouteDefinition;
	metadata: RegisteredPluginRoute<TPlugin['id']>;
	plugin: TPlugin;
	pluginMetadata: RegisteredPaymeshPlugin<TPlugin['id']>;
}

interface RouteMatcher {
	path: string;
	paramNames: string[];
	pattern: RegExp;
}

export function bootstrapPlugins<
	IncludeRaw extends boolean,
	Schema extends DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[],
	TClient extends PaymeshClient<IncludeRaw, Schema, Plugins>,
>({
	baseHooks,
	client,
	database,
	plugins,
	provider,
	schema,
}: BootstrapPluginsOptions<
	IncludeRaw,
	Schema,
	Plugins,
	TClient
>): BootstrappedPlugins<IncludeRaw, Plugins> {
	const pluginsById = new Map<string, Plugins[number]>();
	const pluginMetadataById: Record<string, RegisteredPaymeshPlugin> = {};
	const pluginHooksByName = new Map<string, RuntimeHookHandler[]>();
	const pluginEventOwners = new Map<string, string>();
	const routeKeys = new Set<string>();
	const routeRegistrations: Array<RouteRegistration<Plugins[number]>> = [];

	for (const plugin of plugins) {
		if (pluginsById.has(plugin.id)) {
			throw new PaymeshError({
				code: 'plugin_configuration_error',
				message: `Plugin "${plugin.id}" is already registered.`,
				provider: provider.id,
			});
		}

		if (plugin.config?.database && !database) {
			throw new PaymeshError({
				code: 'plugin_configuration_error',
				message: `Plugin "${plugin.id}" requires a configured database.`,
				provider: provider.id,
			});
		}

		if (
			plugin.config?.providers &&
			!plugin.config.providers.includes(provider.id)
		) {
			throw new PaymeshError({
				code: 'plugin_configuration_error',
				message: `Plugin "${plugin.id}" requires one of the providers: ${plugin.config.providers.join(', ')}.`,
				provider: provider.id,
			});
		}

		for (const capability of plugin.config?.capabilities ?? []) {
			if (!provider.capabilities[capability]) {
				throw new PaymeshError({
					code: 'plugin_configuration_error',
					message: `Plugin "${plugin.id}" requires the provider capability "${capability}".`,
					provider: provider.id,
				});
			}
		}

		pluginsById.set(plugin.id, plugin);
		pluginMetadataById[plugin.id] = {
			id: plugin.id,
			name: plugin.name,
			version: plugin.version,
			description: plugin.description,
			status: 'pending',
			routes: [],
			eventHooks: Object.keys(plugin.events ?? {}) as Array<
				keyof NonNullable<typeof plugin.events> & string
			>,
			customTables: Object.values(schema.customTables).filter(
				(table) => table.pluginId === plugin.id,
			),
		} as never;
	}

	for (const plugin of plugins) {
		for (const hookName of Object.keys(plugin.events ?? {})) {
			if (BUILT_IN_HOOK_NAMES.includes(hookName))
				throw new PaymeshError({
					code: 'plugin_configuration_error',
					message: `Plugin "${plugin.id}" cannot reuse the built-in hook name "${hookName}".`,
					provider: provider.id,
				});

			const owner = pluginEventOwners.get(hookName);

			if (owner) {
				throw new PaymeshError({
					code: 'plugin_configuration_error',
					message: `Plugin event "${hookName}" is already registered by "${owner}".`,
					provider: provider.id,
				});
			}

			pluginEventOwners.set(hookName, plugin.id);
		}

		for (const [hookName, handler] of Object.entries(plugin.hooks ?? {})) {
			const handlers = pluginHooksByName.get(hookName) ?? [];
			handlers.push(handler as RuntimeHookHandler);
			pluginHooksByName.set(hookName, handlers);
		}

		for (const route of plugin.routes ?? []) {
			const routeKey = `${route.method}:${route.path}`;
			if (routeKeys.has(routeKey)) {
				throw new PaymeshError({
					code: 'plugin_configuration_error',
					message: `Route "${route.method} ${route.path}" is already registered by another plugin.`,
					provider: provider.id,
				});
			}

			const pluginMetadata = pluginMetadataById[plugin.id];
			if (!pluginMetadata) {
				throw new PaymeshError({
					code: 'plugin_error',
					message: `Plugin "${plugin.id}" metadata could not be resolved.`,
					provider: provider.id,
				});
			}

			const metadata = {
				pluginId: plugin.id,
				method: route.method,
				path: route.path,
				description: route.description,
			} satisfies RegisteredPluginRoute<typeof plugin.id>;

			routeKeys.add(routeKey);
			pluginMetadata.routes.push(metadata);
			routeRegistrations.push({
				matcher: compileRouteMatcher(route.path, provider.id),
				definition: route,
				metadata,
				plugin,
				pluginMetadata,
			});
		}
	}

	const createHookDispatcher = (
		localHooks?: RuntimeHooks<IncludeRaw, Plugins>,
	) => {
		return async (hook: string, event: unknown) => {
			for (const handler of pluginHooksByName.get(hook) ?? []) {
				await handler(event);
			}

			const selectedHook =
				(
					localHooks as
						| Record<string, RuntimeHookHandler | undefined>
						| undefined
				)?.[hook] ??
				(
					baseHooks as
						| Record<string, RuntimeHookHandler | undefined>
						| undefined
				)?.[hook];
			if (typeof selectedHook === 'function') {
				await selectedHook(event);
			}
		};
	};

	for (const plugin of plugins) {
		const pluginMetadata = pluginMetadataById[plugin.id];
		if (!pluginMetadata) {
			throw new PaymeshError({
				code: 'plugin_error',
				message: `Plugin "${plugin.id}" metadata could not be resolved.`,
				provider: provider.id,
			});
		}

		const emit = createPluginEmitter({
			dispatchHook: createHookDispatcher(),
			plugin,
			pluginEventOwners,
			providerId: provider.id,
		});

		try {
			const setupResult = plugin.setup?.({
				client: client as never,
				plugin: pluginMetadata as never,
				provider,
				database,
				schema,
				emit,
			});

			if (isPromiseLike(setupResult)) {
				setupResult
					.then(() => {
						pluginMetadata.status = 'ready';
					})
					.catch((error) => {
						pluginMetadata.status = 'failed';
						pluginMetadata.error = error;
					});
				continue;
			}

			pluginMetadata.status = 'ready';
		} catch (error) {
			pluginMetadata.status = 'failed';
			pluginMetadata.error = error;
			throw new PaymeshError({
				code: 'plugin_error',
				message: `Plugin "${plugin.id}" setup failed: ${getErrorMessage(error)}`,
				provider: provider.id,
				cause: error,
			});
		}
	}

	const routesClient: PaymeshRoutesClient<IncludeRaw, Plugins> = {
		list() {
			return routeRegistrations.map((route) => route.metadata);
		},
		async handle(request, options) {
			const pathname = new URL(request.url).pathname;
			const method = request.method.toUpperCase();
			const resolved = routeRegistrations.find(
				(candidate) =>
					candidate.metadata.method === method &&
					matchRoute(candidate.matcher, pathname) !== null,
			);

			if (!resolved) {
				return Response.json({ error: 'route_not_found' }, { status: 404 });
			}
			const params = matchRoute(resolved.matcher, pathname);
			if (!params) {
				return Response.json({ error: 'route_not_found' }, { status: 404 });
			}

			const dispatchHook = createHookDispatcher(
				options?.hooks as RuntimeHooks<IncludeRaw, Plugins> | undefined,
			);
			const emit = createPluginEmitter({
				dispatchHook,
				plugin: resolved.plugin,
				pluginEventOwners,
				providerId: provider.id,
			});
			const context = {
				locals: {},
				params,
				request,
				route: resolved.metadata,
				client: client as never,
				plugin: resolved.pluginMetadata as never,
				provider,
				database,
				schema,
				emit,
			};
			const middleware = [
				...(resolved.plugin.middleware ?? []),
				...(resolved.definition.middleware ?? []),
			] as RuntimeMiddleware<TClient>[];

			try {
				return await runMiddlewarePipeline(
					context,
					middleware,
					resolved.definition.handler as RuntimeRouteHandler<TClient>,
				);
			} catch (error) {
				if (error instanceof PaymeshError) {
					return Response.json(
						{
							error: error.code,
							message: error.message,
						},
						{ status: error.status ?? 400 },
					);
				}

				throw error;
			}
		},
	};

	return {
		createHookDispatcher,
		extensions: collectExtensions(
			plugins,
			client,
			provider,
			database,
			schema,
			pluginMetadataById,
			pluginEventOwners,
			() => createHookDispatcher(),
		),
		pluginsClient: {
			byId: pluginMetadataById as PaymeshPluginsClient<Plugins>['byId'],
			list() {
				return plugins
					.map((plugin) => pluginMetadataById[plugin.id])
					.filter((plugin): plugin is NonNullable<typeof plugin> =>
						Boolean(plugin),
					);
			},
		},
		routesClient,
	};
}

type RuntimeRouteContext<TClient> = {
	locals: Record<string, unknown>;
	params: Record<string, string>;
	request: Request;
	route: RegisteredPluginRoute;
	client: TClient;
	plugin: RegisteredPaymeshPlugin;
	provider: Provider<string>;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	emit(hook: string, payload: unknown): Promise<void>;
};

type RuntimeMiddleware<TClient> = (
	context: RuntimeRouteContext<TClient>,
	next: () => Promise<Response>,
) => Response | Promise<Response>;

type RuntimeRouteHandler<TClient> = (
	context: RuntimeRouteContext<TClient>,
) => Response | Promise<Response>;

async function runMiddlewarePipeline<TClient>(
	context: RuntimeRouteContext<TClient>,
	middleware: RuntimeMiddleware<TClient>[],
	handler: RuntimeRouteHandler<TClient>,
) {
	let index = -1;

	const dispatch = async (currentIndex: number): Promise<Response> => {
		if (currentIndex <= index)
			throw new PaymeshError({
				code: 'plugin_error',
				message: 'Middleware "next()" called multiple times',
			});

		index = currentIndex;
		const current = middleware[currentIndex];
		if (!current) {
			return handler(context);
		}

		return current(context, () => dispatch(currentIndex + 1));
	};

	return dispatch(0);
}

function collectExtensions<
	IncludeRaw extends boolean,
	Schema extends DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[],
	TClient extends PaymeshClient<IncludeRaw, Schema, Plugins>,
>(
	plugins: Plugins,
	client: TClient,
	provider: Provider<string>,
	database: PaymeshDatabaseDriver | undefined,
	schema: ResolvedDatabaseSchema,
	pluginMetadataById: Record<string, RegisteredPaymeshPlugin>,
	pluginEventOwners: Map<string, string>,
	createDispatcher: () => (hook: string, event: unknown) => Promise<void>,
) {
	const mergedExtensions: Record<string, unknown> = {};

	for (const plugin of plugins) {
		const pluginMetadata = pluginMetadataById[plugin.id];
		if (!pluginMetadata) {
			throw new PaymeshError({
				code: 'plugin_error',
				message: `Plugin "${plugin.id}" metadata could not be resolved.`,
				provider: provider.id,
			});
		}

		const emit = createPluginEmitter({
			dispatchHook: createDispatcher(),
			plugin,
			pluginEventOwners,
			providerId: provider.id,
		});
		const extension = plugin.extends?.(
			Object.assign({}, client, {
				client,
				plugin: pluginMetadata,
				provider,
				database,
				schema,
				emit,
			}) as never,
		);
		if (!extension) {
			continue;
		}

		if (!isExtensionContainer(extension)) {
			throw new PaymeshError({
				code: 'plugin_configuration_error',
				message: `Plugin "${plugin.id}" must return an object from extends().`,
				provider: provider.id,
			});
		}

		const pendingPairs = [
			{
				source: resolveLazyExtension(extension),
				target: mergedExtensions,
				path: [] as string[],
			},
		];
		for (const pair of pendingPairs) {
			for (const [key, value] of Object.entries(pair.source)) {
				const path = [...pair.path, key];
				const existingDescriptor = Object.getOwnPropertyDescriptor(
					pair.target,
					key,
				);
				const existingValue = existingDescriptor?.value ?? pair.target[key];
				if (existingValue === undefined) {
					if (isLazyExtension(value)) {
						defineLazyProperty(pair.target, key, value);
					} else {
						pair.target[key] = value;
					}
					continue;
				}

				if (isPlainObject(existingValue) && isPlainObject(value)) {
					pendingPairs.push({
						source: value,
						target: existingValue,
						path,
					});
					continue;
				}

				throw new PaymeshError({
					code: 'plugin_configuration_error',
					message: `Plugin extension cannot overwrite "${path.join('.')}".`,
					provider: provider.id,
				});
			}
		}
	}

	return mergedExtensions as PluginClientExtensions<Plugins>;
}

function createPluginEmitter({
	dispatchHook,
	plugin,
	pluginEventOwners,
	providerId,
}: {
	dispatchHook: (hook: string, event: unknown) => Promise<void>;
	plugin: AnyPaymeshPlugin;
	pluginEventOwners: Map<string, string>;
	providerId: string;
}) {
	return async (hook: string, payload: unknown) => {
		if (pluginEventOwners.get(hook) !== plugin.id) {
			throw new PaymeshError({
				code: 'plugin_error',
				message: `Plugin "${plugin.id}" cannot emit the event "${hook}".`,
				provider: providerId,
			});
		}

		await dispatchHook(hook, {
			pluginId: plugin.id,
			type: hook,
			data: payload,
			createdAt: new Date().toISOString(),
		});
	};
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLazyExtension(value: unknown): value is LazyPluginExtension<object> {
	return isPlainObject(value) && value.__type === 'paymesh.lazy_extension';
}

function isExtensionContainer(value: unknown) {
	return isPlainObject(value) || isLazyExtension(value);
}

function resolveLazyExtension(
	value: Record<string, unknown> | LazyPluginExtension<object>,
) {
	const resolvedValue = isLazyExtension(value) ? value.load() : value;
	if (!isPlainObject(resolvedValue)) {
		throw new PaymeshError({
			code: 'plugin_configuration_error',
			message: 'Lazy plugin extension must resolve to an object.',
		});
	}

	return resolvedValue;
}

function defineLazyProperty(
	target: Record<string, unknown>,
	key: string,
	value: LazyPluginExtension<object>,
) {
	let loaded = false;
	let cachedValue: object | undefined;

	Object.defineProperty(target, key, {
		configurable: true,
		enumerable: true,
		get() {
			if (!loaded) {
				const resolvedValue = value.load();
				if (!isPlainObject(resolvedValue)) {
					throw new PaymeshError({
						code: 'plugin_configuration_error',
						message: 'Lazy plugin extension must resolve to an object.',
					});
				}

				cachedValue = resolvedValue;
				loaded = true;
				Object.defineProperty(target, key, {
					configurable: true,
					enumerable: true,
					writable: false,
					value: cachedValue,
				});
			}

			return cachedValue;
		},
	});
}

function compileRouteMatcher(path: string, providerId: string): RouteMatcher {
	if (!path.startsWith('/')) {
		throw new PaymeshError({
			code: 'plugin_configuration_error',
			message: `Plugin route "${path}" must start with "/".`,
			provider: providerId,
		});
	}

	const paramNames: string[] = [];
	const escapedSegments = path.split('/').map((segment) => {
		if (!segment.startsWith(':')) {
			return escapeRegex(segment);
		}

		const name = segment.slice(1);
		if (!name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
			throw new PaymeshError({
				code: 'plugin_configuration_error',
				message: `Plugin route "${path}" contains an invalid parameter segment.`,
				provider: providerId,
			});
		}

		paramNames.push(name);
		return '([^/]+)';
	});

	return {
		path,
		paramNames,
		pattern: new RegExp(`^${escapedSegments.join('/')}$`),
	};
}

function matchRoute(matcher: RouteMatcher, pathname: string) {
	const matched = matcher.pattern.exec(pathname);
	if (!matched) {
		return null;
	}

	return Object.fromEntries(
		matcher.paramNames.map((name, index) => [
			name,
			decodeURIComponent(matched[index + 1] ?? ''),
		]),
	);
}

function escapeRegex(value: string) {
	return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'then' in value &&
		typeof value.then === 'function'
	);
}
