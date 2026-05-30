import type { RetryOptions } from '../shared/request';

export type ProviderId = string;

export type ProviderCapability =
	| 'pix'
	| 'coupons'
	| 'checkout'
	| 'subscriptions'
	| 'webhooks'
	| 'refunds'
	| 'customerPortal'
	| 'customers';

export type ProviderCapabilities = Partial<Record<ProviderCapability, boolean>>;

export type PaymentStatus =
	| 'pending'
	| 'processing'
	| 'paid'
	| 'failed'
	| 'canceled'
	| 'refunded';

export interface RawObject {
	raw: unknown;
}

export type WithRaw<
	TObject,
	IncludeRaw extends boolean,
> = IncludeRaw extends true ? TObject & RawObject : TObject & { raw: null };

export interface PaymentCustomer {
	id?: string;
	externalId?: string;
	name?: string;
	email?: string;
	document?: string;
	phone?: string;
}

export interface PaymentCreateData {
	amount: number;
	currency: string;
	productIds?: string[];

	customer?: PaymentCustomer;

	description?: string;
	metadata?: Record<string, string | number | boolean | null>;

	successUrl?: string;
	cancelUrl?: string;
	returnUrl?: string;
}

export interface BasePayment {
	id: string;
	provider: string;

	amount: number;
	currency: string;

	status: PaymentStatus;

	checkoutUrl?: string;
	customer?: PaymentCustomer;

	metadata?: Record<string, unknown>;
}

export type Payment<IncludeRaw extends boolean = false> = WithRaw<
	BasePayment,
	IncludeRaw
>;

export interface BaseCustomer {
	id: string;
	provider: string;
	externalId?: string;

	name?: string;
	email?: string;
	phone?: string;

	metadata?: Record<string, unknown>;
}

export type Customer<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomer,
	IncludeRaw
>;

export interface CustomerCreateData {
	externalId?: string;
	name?: string;
	email?: string;
	phone?: string;
	metadata?: Record<string, string | number | boolean | null>;
}

export interface CustomerUpdateData {
	name?: string;
	email?: string;
	phone?: string;
	metadata?: Record<string, string | number | boolean | null>;
}

export interface BaseCustomerDeleteResult {
	id: string;
	provider: string;
	deleted: boolean;
}

export type CustomerDeleteResult<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomerDeleteResult,
	IncludeRaw
>;

export interface ProviderRequestOptions<IncludeRaw extends boolean = false> {
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	includeRaw?: IncludeRaw;
}

export interface ProviderPayments {
	create<IncludeRaw extends boolean = false>(
		data: PaymentCreateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Payment<IncludeRaw>>;
}

export interface ProviderCustomers {
	create<IncludeRaw extends boolean = false>(
		data: CustomerCreateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	get<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	update<IncludeRaw extends boolean = false>(
		id: string,
		data: CustomerUpdateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	delete<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<CustomerDeleteResult<IncludeRaw>>;
}

export interface ProviderVerifyWebhookContext {
	request: Request;
}

export type PaymeshEventType =
	| 'payment.created'
	| 'payment.succeeded'
	| 'payment.failed'
	| 'payment.canceled'
	| 'payment.refunded'
	| 'customer.created'
	| 'customer.updated'
	| 'customer.deleted'
	| 'subscription.created'
	| 'subscription.updated'
	| 'subscription.canceled'
	| 'checkout.completed';

export interface BasePaymeshEvent<Data = unknown> {
	id: string;

	type: PaymeshEventType;
	provider: string;

	data: Data;
}

export type PaymeshEvent<
	Data = unknown,
	IncludeRaw extends boolean = false,
> = WithRaw<BasePaymeshEvent<Data>, IncludeRaw>;

export interface ProviderWebhookMapOptions<IncludeRaw extends boolean = false> {
	includeRaw?: IncludeRaw;
}

export interface ProviderWebhooks {
	/**
	 * Verify if the incoming webhook request is valid.
	 */
	verify(context: ProviderVerifyWebhookContext): boolean | Promise<boolean>;

	/**
	 * Parse the provider-specific webhook request
	 * into the payload used by map().
	 */
	parse(
		request: Request,
	): Record<string, unknown> | Promise<Record<string, unknown>>;

	/**
	 * Map the provider-specific webhook payload
	 * into a normalized Paymesh event.
	 */
	map<IncludeRaw extends boolean = false>(
		payload: Record<string, unknown>,
		options?: ProviderWebhookMapOptions<IncludeRaw>,
	):
		| PaymeshEvent<unknown, IncludeRaw>
		| Promise<PaymeshEvent<unknown, IncludeRaw>>;

	/**
	 * Return the hook key for a normalized Paymesh event.
	 */
	hook<IncludeRaw extends boolean = false>(
		event: PaymeshEvent<unknown, IncludeRaw>,
	): string | undefined;
}

export interface ProviderDefinition<Name extends string = string> {
	id: Name;

	payments: ProviderPayments;

	customers: ProviderCustomers;

	webhooks?: ProviderWebhooks;

	capabilities: ProviderCapabilities;
}

export interface Provider<Name extends string = string>
	extends ProviderDefinition<Name> {
	readonly type: 'provider';
}
