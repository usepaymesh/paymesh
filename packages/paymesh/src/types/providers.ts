import type { RetryOptions } from '../shared/request';

export type ProviderId = string;

export type ProviderCapability =
	| 'pix'
	| 'coupons'
	| 'checkout'
	| 'subscriptions'
	| 'webhooks'
	| 'refunds'
	| 'customerPortal';

export type ProviderCapabilities = Partial<Record<ProviderCapability, boolean>>;

export type PaymentStatus =
	| 'pending'
	| 'processing'
	| 'paid'
	| 'failed'
	| 'canceled'
	| 'refunded';

export interface PaymentCustomer {
	id?: string;
	name?: string;
	email?: string;
	document?: string;
	phone?: string;
}

export interface PaymentCreateData {
	amount: number;
	currency: string;

	customer?: PaymentCustomer;

	description?: string;
	metadata?: Record<string, string | number | boolean | null>;

	successUrl?: string;
	cancelUrl?: string;
	returnUrl?: string;
}

export interface Payment {
	id: string;
	provider: string;

	amount: number;
	currency: string;

	status: PaymentStatus;

	checkoutUrl?: string;
	customer?: PaymentCustomer;

	metadata?: Record<string, unknown>;

	raw?: unknown;
}

export interface ProviderRequestOptions {
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
}

export interface ProviderPayments {
	create(
		data: PaymentCreateData,
		options?: ProviderRequestOptions,
	): Promise<Payment>;
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
	| 'subscription.created'
	| 'subscription.updated'
	| 'subscription.canceled'
	| 'checkout.completed';

export interface PaymeshEvent<Data = unknown> {
	id: string;

	type: PaymeshEventType;
	provider: string;

	data: Data;

	raw: unknown;
}

export interface ProviderWebhooks {
	/**
	 * Verify if the incoming webhook request is valid.
	 */
	verify(context: ProviderVerifyWebhookContext): boolean | Promise<boolean>;

	/**
	 * Map the provider-specific webhook payload
	 * into a normalized Paymesh event.
	 */
	map(payload: Record<string, unknown>): PaymeshEvent | Promise<PaymeshEvent>;
}

export interface ProviderDefinition<Name extends string = string> {
	id: Name;

	payments: ProviderPayments;

	webhooks?: ProviderWebhooks;

	capabilities: ProviderCapabilities;
}

export interface Provider<Name extends string = string>
	extends ProviderDefinition<Name> {
	readonly type: 'provider';
}
