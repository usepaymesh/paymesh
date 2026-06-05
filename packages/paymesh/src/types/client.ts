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
	Customer,
	CustomerDeleteResult,
	CustomerUpsertData,
	Payment,
	PaymentCreateData,
	PaymeshEvent,
	PaymeshEventType,
	Provider,
	ProviderCapabilities,
	ProviderRequestOptions,
} from './providers';

export type PaymeshHook<Event = PaymeshEvent> = {
	bivarianceHack(event: Event): unknown | Promise<unknown>;
}['bivarianceHack'];

export type PaymentEvent<
	Type extends PaymeshEventType,
	IncludeRaw extends boolean = false,
> = PaymeshEvent<Payment<IncludeRaw>, IncludeRaw> & { type: Type };

export type CustomerEvent<
	Type extends PaymeshEventType,
	IncludeRaw extends boolean = false,
> = PaymeshEvent<Customer<IncludeRaw>, IncludeRaw> & { type: Type };

export type CustomerDeletedEvent<IncludeRaw extends boolean = false> =
	PaymeshEvent<CustomerDeleteResult<IncludeRaw>, IncludeRaw> & {
		type: 'customer.deleted';
	};

export type UnknownEvent<
	Type extends PaymeshEventType,
	IncludeRaw extends boolean = false,
> = PaymeshEvent<unknown, IncludeRaw> & { type: Type };

export interface WebhookHookContext {
	request: Request;
	deliveryId: string;
	dispatchedAt: string;
	hook?: string;
}

export type WebhookHookEvent<TEvent> = Simplify<
	TEvent & {
		context: WebhookHookContext;
	}
>;

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

export interface BuiltInPaymeshHooks<IncludeRaw extends boolean = false> {
	onEvent?: PaymeshHook<WebhookHookEvent<AnyWebhookEvent<IncludeRaw>>>;
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

export type PaymeshHooks<
	IncludeRaw extends boolean = false,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> = Simplify<BuiltInPaymeshHooks<IncludeRaw> & PluginEventsFromList<Plugins>>;

export interface HandleWebhookOptions<
	IncludeRaw extends boolean = false,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	request: Request;
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
	includeRaw?: IncludeRaw;
	skipVerify?: boolean;
}

export interface HandleWebhookResult<IncludeRaw extends boolean = false> {
	status: 200 | 400 | 401 | 500 | 501;
	body: { received?: boolean; duplicate?: boolean; error?: string };
	event?: PaymeshEvent<unknown, IncludeRaw>;
}

export interface PaymeshWebhookHandler<
	IncludeRaw extends boolean = false,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	handle(
		options: HandleWebhookOptions<IncludeRaw, Plugins>,
	): Promise<HandleWebhookResult<IncludeRaw>>;
}

export type PaymeshPaymentCreateData<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	PaymentCreateData & DatabaseTableInputExtraFields<Schema, 'checkouts'>
>;

export type PaymeshPayment<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	Payment<IncludeRaw> & DatabaseTableOutputExtraFields<Schema, 'checkouts'>
>;

export type PaymeshCustomerUpsertData<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	CustomerUpsertData & DatabaseTableInputExtraFields<Schema, 'customers'>
>;

export type PaymeshCustomer<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	Customer<IncludeRaw> & DatabaseTableOutputExtraFields<Schema, 'customers'>
>;

export type PaymeshCustomerList<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> = Simplify<
	PaymeshCustomerListResult<IncludeRaw, PaymeshCustomer<IncludeRaw, Schema>>
>;

export interface PaymeshPaymentsClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> {
	create<CallIncludeRaw extends boolean = IncludeRaw>(
		data: PaymeshPaymentCreateData<Schema>,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshPayment<CallIncludeRaw, Schema>>;
}

export interface PaymeshCustomersClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> {
	upsert<CallIncludeRaw extends boolean = IncludeRaw>(
		data: PaymeshCustomerUpsertData<Schema>,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshCustomer<CallIncludeRaw, Schema>>;
	get<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<PaymeshCustomer<CallIncludeRaw, Schema>>;
	list<CallIncludeRaw extends boolean = IncludeRaw>(
		options?: PaymeshCustomerListOptions<CallIncludeRaw>,
	): Promise<PaymeshCustomerList<CallIncludeRaw, Schema>>;
	delete<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<CustomerDeleteResult<CallIncludeRaw>>;
}

export interface PaymeshClient<
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	provider: Provider<string>;
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
	includeRaw?: IncludeRaw;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	payments: PaymeshPaymentsClient<IncludeRaw, Schema>;
	customers: PaymeshCustomersClient<IncludeRaw, Schema>;
	webhooks: PaymeshWebhookHandler<IncludeRaw, Plugins>;
	routes: PaymeshRoutesClient<IncludeRaw, Plugins>;
	plugins: PaymeshPluginsClient<Plugins>;
	capabilities: ProviderCapabilities;
}

export interface ClientOptions<
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
> {
	provider: P;
	database?: PaymeshDatabaseDriver;
	schema?: Schema;
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	includeRaw?: IncludeRaw;
	hooks?: PaymeshHooks<IncludeRaw, Plugins>;
	plugins?: Plugins;
}
