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

export type PaymeshHook<Event = PaymeshEvent> = (
	event: Event,
) => void | Promise<void>;

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

export interface PaymeshHooks<IncludeRaw extends boolean = false> {
	onPaymentCreated?: PaymeshHook<PaymentEvent<'payment.created', IncludeRaw>>;
	onPaymentSucceeded?: PaymeshHook<
		PaymentEvent<'payment.succeeded', IncludeRaw>
	>;
	onPaymentFailed?: PaymeshHook<PaymentEvent<'payment.failed', IncludeRaw>>;
	onPaymentCanceled?: PaymeshHook<PaymentEvent<'payment.canceled', IncludeRaw>>;
	onPaymentRefunded?: PaymeshHook<PaymentEvent<'payment.refunded', IncludeRaw>>;
	onCustomerCreated?: PaymeshHook<
		CustomerEvent<'customer.created', IncludeRaw>
	>;
	onCustomerUpdated?: PaymeshHook<
		CustomerEvent<'customer.updated', IncludeRaw>
	>;
	onCustomerDeleted?: PaymeshHook<CustomerDeletedEvent<IncludeRaw>>;
	onSubscriptionCreated?: PaymeshHook<
		UnknownEvent<'subscription.created', IncludeRaw>
	>;
	onSubscriptionUpdated?: PaymeshHook<
		UnknownEvent<'subscription.updated', IncludeRaw>
	>;
	onSubscriptionCanceled?: PaymeshHook<
		UnknownEvent<'subscription.canceled', IncludeRaw>
	>;
	onCheckoutCompleted?: PaymeshHook<
		PaymentEvent<'checkout.completed', IncludeRaw>
	>;
}

export interface HandleWebhookOptions<IncludeRaw extends boolean = false> {
	request: Request;
	hooks?: PaymeshHooks<IncludeRaw>;
	includeRaw?: IncludeRaw;
	skipVerify?: boolean;
}

export interface HandleWebhookResult<IncludeRaw extends boolean = false> {
	status: 200 | 400 | 401 | 500 | 501;
	body: { received?: boolean; duplicate?: boolean; error?: string };
	event?: PaymeshEvent<unknown, IncludeRaw>;
}

export interface PaymeshWebhookHandler<IncludeRaw extends boolean = false> {
	handle(
		options: HandleWebhookOptions<IncludeRaw>,
	): Promise<HandleWebhookResult<IncludeRaw>>;
}

type Simplify<T> = { [K in keyof T]: T[K] } & {};

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
> {
	provider: Provider<string>;
	hooks?: PaymeshHooks<IncludeRaw>;
	includeRaw?: IncludeRaw;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	payments: PaymeshPaymentsClient<IncludeRaw, Schema>;
	customers: PaymeshCustomersClient<IncludeRaw, Schema>;
	webhooks: PaymeshWebhookHandler<IncludeRaw>;
	capabilities: ProviderCapabilities;
}

export interface ClientOptions<
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
> {
	provider: P;
	database?: PaymeshDatabaseDriver;
	schema?: Schema;
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	logger?: PaymeshLogger | boolean;
	includeRaw?: IncludeRaw;
	hooks?: PaymeshHooks<IncludeRaw>;
}

export interface PaymeshLogger {
	debug(message: string, context?: Record<string, unknown>): void;
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
}
