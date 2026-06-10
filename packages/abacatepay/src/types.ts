import type { RetryOptions } from 'paymesh';

/**
 * Options for the AbacatePay provider factory.
 */
export interface AbacatePayProviderOptions {
	/** API key used for authenticated requests. Defaults to `process.env.ABACATEPAY_API_KEY`. */
	apiKey?: string;
	/** Webhook secret for URL-based verification. Defaults to `process.env.ABACATEPAY_WEBHOOK_SECRET`. */
	webhookSecret?: string;
	/** Explicit sandbox override. Defaults to `false`. */
	sandbox?: boolean;
	/** Base API URL. Defaults to `https://api.abacatepay.com/v2`. */
	baseUrl?: string;
	/** Retry configuration for provider requests. */
	retry?: RetryOptions;
	/** Request timeout in milliseconds. */
	timeout?: number;
	/** Fetch implementation to use. */
	fetch?: typeof fetch;
}

/**
 * AbacatePay API response wrapper.
 */
export interface AbacatePayResponse<T> {
	data: T;
	success: boolean;
	error: string | null;
}

/**
 * AbacatePay checkout object.
 */
export interface AbacatePayCheckout {
	id: string;
	externalId?: string | null;
	url: string;
	amount: number;
	paidAmount?: number | null;
	platformFee?: number;
	frequency?: string;
	items?: Array<{ id: string; quantity: number }>;
	status: string;
	methods?: string[];
	customerId?: string | null;
	receiptUrl?: string | null;
	installmentsCount?: number | null;
	metadata?: Record<string, unknown>;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * AbacatePay transparent charge (PIX) object.
 */
export interface AbacatePayTransparentCharge {
	id: string;
	amount: number;
	status: string;
	devMode?: boolean;
	brCode?: string;
	brCodeBase64?: string;
	barCode?: string;
	url?: string;
	platformFee?: number;
	receiptUrl?: string | null;
	expiresAt?: string;
	metadata?: Record<string, unknown>;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * AbacatePay customer object.
 */
export interface AbacatePayCustomer {
	id: string;
	devMode?: boolean;
	email?: string | null;
	taxId?: string | null;
	country?: string;
	name?: string | null;
	cellphone?: string | null;
	zipCode?: string | null;
	metadata?: Record<string, unknown>;
}

/**
 * AbacatePay webhook event payload.
 */
export interface AbacatePayWebhookEvent {
	id: string;
	event: string;
	apiVersion?: number;
	devMode?: boolean;
	data: Record<string, unknown>;
}

/**
 * AbacatePay product object.
 */
export interface AbacatePayProduct {
	id: string;
	name?: string;
	description?: string | null;
	active?: boolean;
	price?: number;
	currency?: string;
	createdAt?: string;
	updatedAt?: string;
}
