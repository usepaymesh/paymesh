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

export type PluginSetupStatus = 'pending' | 'ready' | 'failed';

export type PluginSchema = Omit<DatabaseSchemaOptions, 'prefix'>;

export interface PluginEventDefinition<Payload = never> {
	description?: string;
	example?: Payload;
	async?: boolean;
	deprecated?: boolean | string;
	readonly __payload?: Payload;
}

export type PluginEventDefinitions = Record<string, PluginEventDefinition<Any>>;

export type PluginEventPayload<TDefinition> =
	TDefinition extends PluginEventDefinition<infer TPayload> ? TPayload : never;

export interface PluginHookEvent<
	Type extends string = string,
	Payload = never,
> {
	pluginId: string;
	type: Type;
	data: Payload;
	createdAt: string;
}

export interface LazyPluginExtension<TValue extends object> {
	readonly __type: 'paymesh.lazy_extension';
	load(): TValue;
}

export type PluginHook<TEvent = unknown> = {
	bivarianceHack(event: TEvent): void | Promise<void>;
}['bivarianceHack'];

export type PluginEventHooks<TEvents extends PluginEventDefinitions> = Partial<{
	[K in keyof TEvents]: PluginHook<
		PluginHookEvent<K & string, PluginEventPayload<TEvents[K]>>
	>;
}>;

export type PluginRouteMethod =
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'DELETE'
	| 'OPTIONS'
	| 'HEAD';

export type PluginRouteParams = Record<string, string>;
export type PluginRouteLocals = Record<string, unknown>;

export interface PluginConfigRequirements<TProviderId extends string = string> {
	database?: boolean;
	providers?: readonly TProviderId[];
	capabilities?: readonly ProviderCapability[];
}

export interface RegisteredPluginRoute<TPluginId extends string = string> {
	pluginId: TPluginId;
	method: PluginRouteMethod;
	path: string;
	description?: string;
}

export interface RegisteredPaymeshPlugin<
	TPluginId extends string = string,
	TEvents extends PluginEventDefinitions = Record<never, never>,
> {
	id: TPluginId;
	name?: string;
	version?: string;
	description?: string;
	status: PluginSetupStatus;
	error?: unknown;
	routes: RegisteredPluginRoute<TPluginId>[];
	eventHooks: readonly (keyof TEvents & string)[];
	customTables: ResolvedCustomDatabaseTable[];
}

export interface PluginRuntimeClient<TProviderId extends string = string> {
	provider: Provider<TProviderId>;
	hooks?: Record<string, unknown>;
	includeRaw?: boolean;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	payments: PaymeshPaymentsClient<boolean, DatabaseSchemaOptions>;
	customers: PaymeshCustomersClient<boolean, DatabaseSchemaOptions>;
	webhooks: {
		handle(options: {
			request: Request;
			hooks?: Record<string, unknown>;
			includeRaw?: boolean;
			skipVerify?: boolean;
		}): Promise<unknown>;
	};
	routes: {
		list(): RegisteredPluginRoute[];
		handle(
			request: Request,
			options?: {
				hooks?: Record<string, unknown>;
			},
		): Promise<Response>;
	};
	plugins: {
		byId: Record<string, RegisteredPaymeshPlugin | undefined>;
		list(): RegisteredPaymeshPlugin[];
	};
	capabilities: ProviderCapabilities;
}

export interface PluginSetupContext<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> {
	client: TClient;
	plugin: RegisteredPaymeshPlugin<TPluginId, TEvents>;
	provider: TClient extends {
		provider: infer TProvider;
	}
		? TProvider
		: Provider<string>;
	database?: TClient extends {
		database?: infer TDatabase;
	}
		? TDatabase
		: never;
	schema: TClient extends {
		schema: infer TSchema;
	}
		? TSchema
		: ResolvedDatabaseSchema;
	emit<TKey extends keyof TEvents & string>(
		hook: TKey,
		payload: PluginEventPayload<TEvents[TKey]>,
	): Promise<void>;
}

export type PluginExtensionContext<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> = PluginSetupContext<TClient, TEvents, TPluginId> & TClient;

export interface PluginRouteContext<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> extends PluginSetupContext<TClient, TEvents, TPluginId> {
	locals: PluginRouteLocals;
	params: PluginRouteParams;
	request: Request;
	route: RegisteredPluginRoute<TPluginId>;
}

export type PluginRouteHandler<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> = (
	context: PluginRouteContext<TClient, TEvents, TPluginId>,
) => Response | Promise<Response>;

export type PluginMiddleware<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> = (
	context: PluginRouteContext<TClient, TEvents, TPluginId>,
	next: () => Promise<Response>,
) => Response | Promise<Response>;

export interface PluginRouteDefinition<
	TClient extends PluginRuntimeClient = PluginRuntimeClient,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TPluginId extends string = string,
> {
	method: PluginRouteMethod;
	path: string;
	description?: string;
	middleware?: readonly PluginMiddleware<TClient, TEvents, TPluginId>[];
	handler: PluginRouteHandler<TClient, TEvents, TPluginId>;
}

export interface PaymeshPlugin<
	TId extends string = string,
	TEvents extends PluginEventDefinitions = Record<never, never>,
	TExtends extends Record<string, unknown> = Record<never, never>,
	TProviderId extends string = string,
> {
	id: TId;
	name?: string;
	version?: string;
	description?: string;
	options?: unknown;
	setup?(
		context: PluginSetupContext<PluginRuntimeClient<TProviderId>, TEvents, TId>,
	): void | Promise<void>;
	schema?: PluginSchema;
	routes?: readonly PluginRouteDefinition<
		PluginRuntimeClient<TProviderId>,
		TEvents,
		TId
	>[];
	hooks?: PluginEventHooks<TEvents> & BuiltInPaymeshHooks<boolean>;
	events?: TEvents;
	middleware?: readonly PluginMiddleware<
		PluginRuntimeClient<TProviderId>,
		TEvents,
		TId
	>[];
	config?: PluginConfigRequirements<TProviderId>;
	extends?(
		context: PluginExtensionContext<
			PluginRuntimeClient<TProviderId>,
			TEvents,
			TId
		>,
	): TExtends | LazyPluginExtension<TExtends>;
}

export type AnyPaymeshPlugin = Omit<
	PaymeshPlugin<Any, Any, Any, Any>,
	'hooks' | 'events'
> & {
	hooks?: unknown;
	events?: unknown;
};

export type PluginRouteHandleOptions<
	IncludeRaw extends boolean = boolean,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> = {
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
};

type RegisteredPluginFromDefinition<TPlugin extends AnyPaymeshPlugin> =
	TPlugin extends PaymeshPlugin<infer TId, infer TEvents, Any, Any>
		? RegisteredPaymeshPlugin<TId, TEvents>
		: never;

type PluginByIdMap<Plugins extends readonly AnyPaymeshPlugin[]> = {
	[K in Plugins[number] as K['id']]?: RegisteredPluginFromDefinition<K>;
};

export interface PaymeshPluginsClient<
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	byId: PluginByIdMap<Plugins>;
	list(): RegisteredPaymeshPlugin[];
}

export interface PaymeshRoutesClient<
	IncludeRaw extends boolean = boolean,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	list(): RegisteredPluginRoute<Plugins[number]['id']>[];
	handle(
		request: Request,
		options?: PluginRouteHandleOptions<IncludeRaw, Plugins>,
	): Promise<Response>;
}
