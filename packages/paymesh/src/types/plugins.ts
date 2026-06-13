import type {
	BuiltInPaymeshHooks,
	PaymeshCustomersClient,
	PaymeshHooks,
	PaymeshPaymentsClient,
} from './client';
import type {
	DatabaseSchemaOptions,
	PaymeshDatabaseDriver,
	ResolvedCustomDatabaseTable,
	ResolvedDatabaseSchema,
} from './database';
import type {
	Provider,
	ProviderCapabilities,
	ProviderCapability,
} from './providers';
import type { Any } from './utils';

/** Lifecycle status for a registered plugin. */
export type PluginSetupStatus = 'pending' | 'ready' | 'failed';

/** Schema extensions contributed by a plugin. */
export type PluginSchema = Omit<DatabaseSchemaOptions, 'prefix'>;

/** Definition for a custom plugin event. */
export interface PluginEventDefinition<Payload = never> {
	/** Human-readable description of the event. */
	description?: string;
	/** Example payload used in docs or tooling. */
	example?: Payload;
	/** Marks the event handler as asynchronous. */
	async?: boolean;
	/** Marks the event as deprecated. */
	deprecated?: boolean | string;
	readonly __payload?: Payload;
}

/** Collection of custom plugin event definitions. */
export type PluginEventDefinitions = Record<string, PluginEventDefinition<Any>>;

/** Extracts the payload type from a plugin event definition. */
export type PluginEventPayload<TDefinition> =
	TDefinition extends PluginEventDefinition<infer TPayload> ? TPayload : never;

/** Event object emitted by a plugin hook. */
export interface PluginHookEvent<
	Type extends string = string,
	Payload = never,
> {
	/** Owning plugin id. */
	pluginId: string;
	/** Event name. */
	type: Type;
	/** Event payload. */
	data: Payload;
	/** Event creation timestamp. */
	createdAt: string;
}

/** Lazy extension handle used by plugins to defer expensive setup. */
export interface LazyPluginExtension<TValue extends object> {
	readonly __type: 'paymesh.lazy_extension';
	load(): TValue;
}

/** Hook callback used by plugin events and routes. */
export type PluginHook<TEvent = unknown> = {
	bivarianceHack(event: TEvent): void | Promise<void>;
}['bivarianceHack'];

/** Map of plugin event hooks keyed by event name. */
export type PluginEventHooks<TEvents extends PluginEventDefinitions> = Partial<{
	[K in keyof TEvents]: PluginHook<
		PluginHookEvent<K & string, PluginEventPayload<TEvents[K]>>
	>;
}>;

/** HTTP methods supported by plugin routes. */
export type PluginRouteMethod =
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'DELETE'
	| 'OPTIONS'
	| 'HEAD';

/** Route parameter bag exposed to plugin handlers. */
export type PluginRouteParams = Record<string, string>;
/** Locals bag exposed to plugin route middleware. */
export type PluginRouteLocals = Record<string, unknown>;

/** Runtime requirements declared by a plugin. */
export interface PluginConfigRequirements<TProviderId extends string = string> {
	/** Require a database driver. */
	database?: boolean;
	/** Restrict the plugin to specific providers. */
	providers?: readonly TProviderId[];
	/** Restrict the plugin to specific provider capabilities. */
	capabilities?: readonly ProviderCapability[];
}

/** Registered route metadata for introspection. */
export interface RegisteredPluginRoute<TPluginId extends string = string> {
	/** Owning plugin id. */
	pluginId: TPluginId;
	/** HTTP method. */
	method: PluginRouteMethod;
	/** Route path. */
	path: string;
	/** Optional route description. */
	description?: string;
}

/** Runtime state tracked for a registered plugin. */
export interface RegisteredPaymeshPlugin<
	TPluginId extends string = string,
	TEvents extends PluginEventDefinitions = Record<never, never>,
> {
	/** Plugin identifier. */
	id: TPluginId;
	/** Plugin display name. */
	name?: string;
	/** Plugin version. */
	version?: string;
	/** Plugin description. */
	description?: string;
	/** Setup status. */
	status: PluginSetupStatus;
	/** Setup error, when initialization fails. */
	error?: unknown;
	/** Registered routes. */
	routes: RegisteredPluginRoute<TPluginId>[];
	/** Registered custom event names. */
	eventHooks: readonly (keyof TEvents & string)[];
	/** Custom tables contributed by the plugin. */
	customTables: ResolvedCustomDatabaseTable[];
}

/** Client context exposed to plugin setup and extensions. */
export interface PluginRuntimeClient<TProviderId extends string = string> {
	/** Provider instance backing the runtime. */
	provider: Provider<TProviderId>;
	/** Hook map available during runtime. */
	hooks?: Record<string, unknown>;
	/** Whether raw payloads are included. */
	includeRaw?: boolean;
	/** Optional database driver. */
	database?: PaymeshDatabaseDriver;
	/** Resolved schema. */
	schema: ResolvedDatabaseSchema;
	/** Payments sub-client. */
	payments: PaymeshPaymentsClient<boolean, DatabaseSchemaOptions>;
	/** Customers sub-client. */
	customers: PaymeshCustomersClient<boolean, DatabaseSchemaOptions>;
	/** Webhook handler wrapper. */
	webhooks: {
		/** Handles an incoming webhook request. */
		handle(options: {
			request: Request;
			hooks?: Record<string, unknown>;
			includeRaw?: boolean;
			skipVerify?: boolean;
		}): Promise<unknown>;
	};
	/** Route dispatcher. */
	routes: {
		/** Lists registered routes. */
		list(): RegisteredPluginRoute[];
		/** Dispatches a request to a matching plugin route. */
		handle(
			request: Request,
			options?: {
				hooks?: Record<string, unknown>;
			},
		): Promise<Response>;
	};
	/** Registered plugins. */
	plugins: {
		byId: Record<string, RegisteredPaymeshPlugin | undefined>;
		/** Lists registered plugins. */
		list(): RegisteredPaymeshPlugin[];
	};
	/** Provider capabilities. */
	capabilities: ProviderCapabilities;
}

/** Setup context passed to plugin initialization hooks. */
export interface PluginSetupContext<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> {
	/** Client runtime passed to setup. */
	client: TClient;
	/** Registered plugin metadata. */
	plugin: RegisteredPaymeshPlugin<TPluginId, TEvents>;
	/** Active provider. */
	provider: TClient extends {
		provider: infer TProvider;
	}
		? TProvider
		: Provider<string>;
	/** Optional database driver. */
	database?: TClient extends {
		database?: infer TDatabase;
	}
		? TDatabase
		: never;
	/** Resolved schema. */
	schema: TClient extends {
		schema: infer TSchema;
	}
		? TSchema
		: ResolvedDatabaseSchema;
	/** Emits a plugin event. */
	emit<TKey extends keyof TEvents & string>(
		hook: TKey,
		payload: PluginEventPayload<TEvents[TKey]>,
	): Promise<void>;
}

/** Context exposed when a plugin extension is being resolved. */
export type PluginExtensionContext<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> = PluginSetupContext<TClient, TEvents, TPluginId> & TClient;

/** Context exposed to plugin route handlers. */
export interface PluginRouteContext<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> extends PluginSetupContext<TClient, TEvents, TPluginId> {
	/** Locals available to middleware and handlers. */
	locals: PluginRouteLocals;
	/** Parsed route params. */
	params: PluginRouteParams;
	/** Incoming request. */
	request: Request;
	/** Resolves and validates redirect URLs against the client trusted origin allowlist. */
	resolveTrustedUrl(url?: string): string | undefined;
	/** Route metadata. */
	route: RegisteredPluginRoute<TPluginId>;
}

/** Handler signature for plugin routes. */
export type PluginRouteHandler<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> = (
	context: PluginRouteContext<TClient, TEvents, TPluginId>,
) => Response | Promise<Response>;

/** Middleware signature for plugin routes. */
export type PluginMiddleware<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> = (
	context: PluginRouteContext<TClient, TEvents, TPluginId>,
	next: () => Promise<Response>,
) => Response | Promise<Response>;

/** Route definition accepted by a plugin. */
export interface PluginRouteDefinition<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> {
	/** HTTP method. */
	method: PluginRouteMethod;
	/** Route path. */
	path: string;
	/** Optional route description. */
	description?: string;
	/** Route middleware chain. */
	middleware?: readonly PluginMiddleware<TClient, TEvents, TPluginId>[];
	/** Route handler. */
	handler: PluginRouteHandler<TClient, TEvents, TPluginId>;
}

/** Full plugin definition accepted by `definePlugin`. */
export interface PaymeshPlugin<
	TId extends string = string,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TExtends extends Record<string, unknown> = Record<never, never>,
	TProviderId extends string = string,
> {
	/** Plugin identifier. */
	id: TId;
	/** Display name. */
	name?: string;
	/** Version string. */
	version?: string;
	/** Human-readable description. */
	description?: string;
	/** Arbitrary plugin options. */
	options?: unknown;
	setup?(
		context: PluginSetupContext<PluginRuntimeClient<TProviderId>, TEvents, TId>,
	): void | Promise<void>;
	/** Schema contributions. */
	schema?: PluginSchema;
	/** Route definitions. */
	routes?: readonly PluginRouteDefinition<
		PluginRuntimeClient<TProviderId>,
		TEvents,
		TId
	>[];
	/** Custom and built-in hook handlers. */
	hooks?: PluginEventHooks<TEvents> & BuiltInPaymeshHooks<boolean>;
	/** Custom event definitions. */
	events?: TEvents;
	/** Shared middleware applied to all routes. */
	middleware?: readonly PluginMiddleware<
		PluginRuntimeClient<TProviderId>,
		TEvents,
		TId
	>[];
	/** Runtime requirements for the plugin. */
	config?: PluginConfigRequirements<TProviderId>;
	/** Client extensions contributed by the plugin. */
	extends?(
		context: PluginExtensionContext<
			PluginRuntimeClient<TProviderId>,
			TEvents,
			TId
		>,
	): TExtends | LazyPluginExtension<TExtends>;
}

/** Broad plugin shape accepted throughout the runtime. */
export type AnyPaymeshPlugin = Omit<
	PaymeshPlugin<Any, Any, Any, Any>,
	'hooks' | 'events'
> & {
	/** Hook map stored as unknown to preserve structural compatibility. */
	hooks?: unknown;
	/** Event map stored as unknown to preserve structural compatibility. */
	events?: unknown;
};

/** Options accepted when dispatching plugin routes. */
export type PluginRouteHandleOptions<
	IncludeRaw extends boolean = boolean,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> = {
	/** Hook map used while handling a route. */
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
};

type RegisteredPluginFromDefinition<TPlugin extends AnyPaymeshPlugin> =
	TPlugin extends PaymeshPlugin<infer TId, infer TEvents, Any, Any>
		? RegisteredPaymeshPlugin<TId, TEvents>
		: never;

type PluginByIdMap<Plugins extends readonly AnyPaymeshPlugin[]> = {
	[K in Plugins[number] as K['id']]?: RegisteredPluginFromDefinition<K>;
};

/** Runtime client map keyed by plugin id. */
export interface PaymeshPluginsClient<
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	/** Registered plugins keyed by id. */
	byId: PluginByIdMap<Plugins>;
	/** Lists registered plugins. */
	list(): RegisteredPaymeshPlugin[];
}

/** Router interface exposed through the client runtime. */
export interface PaymeshRoutesClient<
	IncludeRaw extends boolean = boolean,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	/** Lists registered routes. */
	list(): RegisteredPluginRoute<Plugins[number]['id']>[];
	/** Dispatches a request to the matching plugin route. */
	handle(
		request: Request,
		options?: PluginRouteHandleOptions<IncludeRaw, Plugins>,
	): Promise<Response>;
}
