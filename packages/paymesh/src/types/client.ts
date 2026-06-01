import type { RetryOptions } from '../shared/request';
import type {
	DatabaseSchemaOptions,
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

export interface PaymeshPaymentsClient<IncludeRaw extends boolean = false> {
	create<CallIncludeRaw extends boolean = IncludeRaw>(
		data: PaymentCreateData,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<Payment<CallIncludeRaw>>;
}

export interface PaymeshCustomersClient<IncludeRaw extends boolean = false> {
	upsert<CallIncludeRaw extends boolean = IncludeRaw>(
		data: CustomerUpsertData,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<Customer<CallIncludeRaw>>;
	get<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<Customer<CallIncludeRaw>>;
	delete<CallIncludeRaw extends boolean = IncludeRaw>(
		id: string,
		options?: ProviderRequestOptions<CallIncludeRaw>,
	): Promise<CustomerDeleteResult<CallIncludeRaw>>;
}

export interface PaymeshClient<IncludeRaw extends boolean = false> {
	provider: Provider<string>;
	hooks?: PaymeshHooks<IncludeRaw>;
	includeRaw?: IncludeRaw;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	payments: PaymeshPaymentsClient<IncludeRaw>;
	customers: PaymeshCustomersClient<IncludeRaw>;
	webhooks: PaymeshWebhookHandler<IncludeRaw>;
	capabilities: ProviderCapabilities;
}

export interface ClientOptions<
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
> {
	provider: P;
	database?: PaymeshDatabaseDriver;
	schema?: DatabaseSchemaOptions;
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
