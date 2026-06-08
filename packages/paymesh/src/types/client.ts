import type { RetryOptions } from '../shared/request';
import type {
	DatabaseSchemaOptions,
	DatabaseTableInputExtraFields,
	DatabaseTableOutputExtraFields,
	PaymeshCustomerListOptions,
	PaymeshCustomerListResult,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from './database';
import type {
	AnyPaymeshPlugin,
	LazyPluginExtension,
	PaymeshPluginsClient,
	PaymeshRoutesClient,
	PluginEventDefinitions,
	PluginEventHooks,
} from './plugins';
import type {
	AnyPayment,
	Customer,
	CustomerDeleteResult,
	CustomerUpsertData,
	Payment,
	PaymentCreateData,
	PaymeshEvent,
	PaymeshEventType,
	Pix,
	PixCreateData,
	Provider,
	ProviderCapabilities,
	ProviderRequestOptions,
} from './providers';

/** Hook callback accepted by Paymesh clients. */
export type PaymeshHook<Event = PaymeshEvent> = {
	bivarianceHack(event: Event): unknown | Promise<unknown>;
}['bivarianceHack'];

/** Payment event narrowed to a specific event type. */
export type PaymentEvent<
	Type extends PaymeshEventType,
	IncludeRaw extends boolean = false,
> = PaymeshEvent<AnyPayment<IncludeRaw>, IncludeRaw> & { type: Type };

/** Customer event narrowed to a specific event type. */
export type CustomerEvent<
	Type extends PaymeshEventType,
	IncludeRaw extends boolean = false,
> = PaymeshEvent<Customer<IncludeRaw>, IncludeRaw> & { type: Type };

/** Customer deleted event with a normalized payload. */
export type CustomerDeletedEvent<IncludeRaw extends boolean = false> =
	PaymeshEvent<CustomerDeleteResult<IncludeRaw>, IncludeRaw> & {
		type: 'customer.deleted';
	};

/** Catch-all event type used when the payload is not strongly typed. */
export type UnknownEvent<
	Type extends PaymeshEventType,
	IncludeRaw extends boolean = false,
> = PaymeshEvent<unknown, IncludeRaw> & { type: Type };

/** Context object attached to webhook hook callbacks. */
export interface WebhookHookContext {
	/** Original request object. */
	request: Request;
	/** Delivery identifier used for idempotency. */
	deliveryId: string;
	/** Timestamp when the event was dispatched. */
	dispatchedAt: string;
	/** Specific hook name selected for the event, when applicable. */
	hook?: string;
}

/** Webhook event payload enriched with request context. */
export type WebhookHookEvent<TEvent> = Simplify<
	TEvent & {
		context: WebhookHookContext;
	}
>;

/** Union of all built-in webhook events emitted by Paymesh. */
export type AnyWebhookEvent<IncludeRaw extends boolean = false> =
	| PaymentEvent<'payment.created', IncludeRaw>
	| PaymentEvent<'payment.succeeded', IncludeRaw>
	| PaymentEvent<'payment.failed', IncludeRaw>
	| PaymentEvent<'payment.canceled', IncludeRaw>
	| PaymentEvent<'payment.refunded', IncludeRaw>
	| CustomerEvent<'customer.created', IncludeRaw>
	| CustomerEvent<'customer.updated', IncludeRaw>
	| CustomerDeletedEvent<IncludeRaw>
	| UnknownEvent<'subscription.created', IncludeRaw>
	| UnknownEvent<'subscription.updated', IncludeRaw>
	| UnknownEvent<'subscription.canceled', IncludeRaw>
	| PaymentEvent<'checkout.completed', IncludeRaw>;

/** Built-in hook callbacks available on every client. */
export interface BuiltInPaymeshHooks<IncludeRaw extends boolean = false> {
	onEvent?: PaymeshHook<WebhookHookEvent<AnyWebhookEvent<IncludeRaw>>>;
	onUnhandledEvent?: PaymeshHook<WebhookHookEvent<AnyWebhookEvent<IncludeRaw>>>;
	onPaymentCreated?: PaymeshHook<
		WebhookHookEvent<PaymentEvent<'payment.created', IncludeRaw>>
	>;
	onPaymentSucceeded?: PaymeshHook<
		WebhookHookEvent<PaymentEvent<'payment.succeeded', IncludeRaw>>
	>;
	onPaymentFailed?: PaymeshHook<
		WebhookHookEvent<PaymentEvent<'payment.failed', IncludeRaw>>
	>;
	onPaymentCanceled?: PaymeshHook<
		WebhookHookEvent<PaymentEvent<'payment.canceled', IncludeRaw>>
	>;
	onPaymentRefunded?: PaymeshHook<
		WebhookHookEvent<PaymentEvent<'payment.refunded', IncludeRaw>>
	>;
	onCustomerCreated?: PaymeshHook<
		WebhookHookEvent<CustomerEvent<'customer.created', IncludeRaw>>
	>;
	onCustomerUpdated?: PaymeshHook<
		WebhookHookEvent<CustomerEvent<'customer.updated', IncludeRaw>>
	>;
	onCustomerDeleted?: PaymeshHook<
		WebhookHookEvent<CustomerDeletedEvent<IncludeRaw>>
	>;
	onSubscriptionCreated?: PaymeshHook<
		WebhookHookEvent<UnknownEvent<'subscription.created', IncludeRaw>>
	>;
	onSubscriptionUpdated?: PaymeshHook<
		WebhookHookEvent<UnknownEvent<'subscription.updated', IncludeRaw>>
	>;
	onSubscriptionCanceled?: PaymeshHook<
		WebhookHookEvent<UnknownEvent<'subscription.canceled', IncludeRaw>>
	>;
	onCheckoutCompleted?: PaymeshHook<
		WebhookHookEvent<PaymentEvent<'checkout.completed', IncludeRaw>>
	>;
}

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type UnionToIntersection<T> = (
	T extends unknown
		? (value: T) => void
		: never
) extends (value: infer TResult) => void
	? TResult
	: never;

type UnwrapLazyExtensions<T> =
	T extends LazyPluginExtension<infer TValue>
		? UnwrapLazyExtensions<TValue>
		: T extends (...args: never[]) => unknown
			? T
			: T extends readonly unknown[]
				? T
				: T extends object
					? { [K in keyof T]: UnwrapLazyExtensions<T[K]> }
					: T;

type PluginEventHooksFromDefinition<TEvents> =
	TEvents extends PluginEventDefinitions
		? string extends keyof TEvents
			? Record<never, never>
			: PluginEventHooks<TEvents>
		: Record<never, never>;

/** Runtime client extensions contributed by plugins. */
export type PluginClientExtensions<
	Plugins extends readonly AnyPaymeshPlugin[],
> = Plugins[number] extends never
	? Record<never, never>
	: UnionToIntersection<
			Plugins[number] extends {
				extends?: (...args: never[]) => infer TExtension;
			}
				? UnwrapLazyExtensions<TExtension> extends Record<string, unknown>
					? UnwrapLazyExtensions<TExtension>
					: Record<never, never>
				: Record<never, never>
		>;

type PluginEventsFromList<Plugins extends readonly AnyPaymeshPlugin[]> =
	Plugins[number] extends never
		? Record<never, never>
		: UnionToIntersection<
				Plugins[number] extends {
					events?: infer TEvents;
				}
					? PluginEventHooksFromDefinition<NonNullable<TEvents>>
					: Record<never, never>
			>;

/** Full hook map accepted by a Paymesh client. */
export type PaymeshHooks<
	IncludeRaw extends boolean = false,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> = Simplify<BuiltInPaymeshHooks<IncludeRaw> & PluginEventsFromList<Plugins>>;

/** Options accepted when handling a webhook. */
export interface HandleWebhookOptions<
	IncludeRaw extends boolean = false,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	/** Incoming webhook request. */
	request: Request;
	/** Hook map used to dispatch normalized events. */
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
	/** Include raw provider payloads in the normalized event. Defaults to `false`. */
	includeRaw?: IncludeRaw;
	/** Skip provider signature verification. Defaults to `false`. */
	skipVerify?: boolean;
}

/** Result returned after handling a webhook. */
export interface HandleWebhookResult<IncludeRaw extends boolean = false> {
	/** HTTP status returned to the webhook caller. */
	status: 200 | 400 | 401 | 500 | 501;
	/** Body returned to the webhook caller. */
	body: { received?: boolean; duplicate?: boolean; error?: string };
	/** Normalized event when one was produced. */
	event?: PaymeshEvent<unknown, IncludeRaw>;
}

/** Webhook handler contract exposed by a Paymesh client. */
export interface PaymeshWebhookHandler<
	IncludeRaw extends boolean = false,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	/** Verifies and normalizes a webhook request. */
	handle(
		options: HandleWebhookOptions<IncludeRaw, Plugins>,
	): Promise<HandleWebhookResult<IncludeRaw>>;
}

/** Paymesh payment input with schema-derived extra fields. */
export type PaymeshPaymentCreateData<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	PaymentCreateData & DatabaseTableInputExtraFields<Schema, 'checkouts'>
>;

/** Paymesh payment output with schema-derived extra fields. */
export type PaymeshPayment<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	Payment<IncludeRaw> & DatabaseTableOutputExtraFields<Schema, 'checkouts'>
>;

/** Paymesh PIX input with schema-derived extra fields. */
export type PaymeshPixCreateData<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<PixCreateData & DatabaseTableInputExtraFields<Schema, 'pix'>>;

/** Paymesh PIX output with schema-derived extra fields. */
export type PaymeshPix<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<Pix<IncludeRaw> & DatabaseTableOutputExtraFields<Schema, 'pix'>>;

/** Paymesh customer input with schema-derived extra fields. */
export type PaymeshCustomerUpsertData<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	CustomerUpsertData & DatabaseTableInputExtraFields<Schema, 'customers'>
>;

/** Paymesh customer output with schema-derived extra fields. */
export type PaymeshCustomer<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	Customer<IncludeRaw> & DatabaseTableOutputExtraFields<Schema, 'customers'>
>;

/** Paginated customer list using the Paymesh customer shape. */
export type PaymeshCustomerList<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	PaymeshCustomerListResult<IncludeRaw, PaymeshCustomer<IncludeRaw, Schema>>
>;

/** Payments sub-client exposed by `createClient`. */
export interface PaymeshPaymentsClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> {
	/** Creates a payment through the configured provider. */
	create<CallIncludeRaw extends boolean = IncludeRaw>(
		data: PaymeshPaymentCreateData<Schema>,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshPayment<CallIncludeRaw, Schema>>;
}

/** PIX sub-client exposed by `createClient`. */
export interface PaymeshPixClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> {
	/** Creates a PIX payment through the configured provider. */
	create<CallIncludeRaw extends boolean = IncludeRaw>(
		data: PaymeshPixCreateData<Schema>,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshPix<CallIncludeRaw, Schema>>;
	/** Loads a PIX payment from the database or provider. */
	get<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshPix<CallIncludeRaw, Schema>>;
}

/** Customers sub-client exposed by `createClient`. */
export interface PaymeshCustomersClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> {
	/** Creates or updates a customer through the configured provider. */
	upsert<CallIncludeRaw extends boolean = IncludeRaw>(
		data: PaymeshCustomerUpsertData<Schema>,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshCustomer<CallIncludeRaw, Schema>>;
	/** Loads a customer from the database or provider. */
	get<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshCustomer<CallIncludeRaw, Schema>>;
	/** Lists customers for the configured provider. */
	list<CallIncludeRaw extends boolean = IncludeRaw>(
		options?: PaymeshCustomerListOptions<CallIncludeRaw>,
	): Promise<PaymeshCustomerList<CallIncludeRaw, Schema>>;
	/** Deletes a customer through the configured provider. */
	delete<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<CustomerDeleteResult<CallIncludeRaw>>;
}

/** Full Paymesh client returned by `createClient`. */
export interface PaymeshClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	/** Provider instance backing the client. */
	provider: Provider<string>;
	/** Hook map configured for the client. */
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
	/** Whether raw payloads are returned from client methods. */
	includeRaw?: IncludeRaw;
	/** Optional database driver used for persistence. */
	database?: PaymeshDatabaseDriver;
	/** Resolved schema used by the client. */
	schema: ResolvedDatabaseSchema;
	/** Payments sub-client. */
	payments: PaymeshPaymentsClient<IncludeRaw, Schema>;
	/** PIX sub-client. */
	pix: PaymeshPixClient<IncludeRaw, Schema>;
	/** Customers sub-client. */
	customers: PaymeshCustomersClient<IncludeRaw, Schema>;
	/** Webhook handler contract. */
	webhooks: PaymeshWebhookHandler<IncludeRaw, Plugins>;
	/** Plugin route dispatcher. */
	routes: PaymeshRoutesClient<IncludeRaw, Plugins>;
	/** Registered plugin metadata. */
	plugins: PaymeshPluginsClient<Plugins>;
	/** Provider capabilities exposed by the provider instance. */
	capabilities: ProviderCapabilities;
}

/** Options accepted by `createClient`. */
export interface ClientOptions<
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	/** Provider instance to wrap. */
	provider: P;
	/** Optional database driver used for persistence. */
	database?: PaymeshDatabaseDriver;
	/** Optional schema overrides. */
	schema?: Schema;
	/** Default base URL passed to provider requests. */
	baseUrl?: string;
	/** Default request timeout in milliseconds. */
	timeout?: number;
	/** Default retry configuration. */
	retry?: RetryOptions;
	/** Fetch implementation to use. */
	fetch?: typeof fetch;
	/** Include raw payloads in returned client values. Defaults to `false`. */
	includeRaw?: IncludeRaw;
	/** Hook map configured for the client. */
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
	/** Plugins to bootstrap alongside the client. */
	plugins?: Plugins;
}
