import type { RetryOptions } from 'paymesh';

/**
 * Options for the Polar provider factory.
 */
export interface PolarProviderOptions {
	/** API access token used for authenticated requests. Defaults to `process.env.POLAR_ACCESS_TOKEN`. */
	accessToken?: string;
	/** Signing secret used to verify webhooks. Defaults to `process.env.POLAR_WEBHOOK_SECRET`. */
	webhookSecret?: string;
	/** Base API URL. Defaults to `https://api.polar.sh`. */
	baseUrl?: string;
	/** Retry configuration for provider requests. */
	retry?: RetryOptions;
	/** Request timeout in milliseconds. */
	timeout?: number;
	/** Fetch implementation to use. */
	fetch?: typeof fetch;
}

/**
 * Polar checkout payload subset used by Paymesh.
 */
export interface PolarCheckout {
	id: string;
	status?: 'open' | 'expired' | 'confirmed' | 'failed' | 'succeeded' | null;
	url?: string | null;
	amount?: number | null;
	total_amount?: number | null;
	currency?: string | null;
	customer_id?: string | null;
	external_customer_id?: string | null;
	customer_name?: string | null;
	customer_email?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
}

/**
 * Polar customer payload subset used by Paymesh.
 */
export interface PolarCustomer {
	id: string;
	email: string;
	name?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
	external_id?: string | null;
	deleted_at?: string | null;
}

/**
 * Polar order payload subset used by Paymesh.
 */
export interface PolarOrder {
	id: string;
	status?: 'pending' | 'paid' | 'refunded' | 'partially_refunded' | 'void';
	paid?: boolean;
	total_amount?: number | null;
	refunded_amount?: number | null;
	currency?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
	customer_id?: string | null;
	checkout_id?: string | null;
	subscription_id?: string | null;
	customer?: PolarCustomer | null;
}

/**
 * Polar subscription payload subset used by Paymesh.
 */
export interface PolarSubscription {
	id: string;
	amount?: number | null;
	customer_id?: string | null;
	currency?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
	cancel_at_period_end?: boolean | null;
	canceled_at?: string | null;
	product_id?: string | null;
	price_id?: string | null;
	ends_at?: string | null;
	ended_at?: string | null;
	status?: string | null;
}

/**
 * Polar webhook event payload.
 */
export interface PolarWebhookEvent<TData = unknown> {
	type: string;
	timestamp: string;
	data: TData;
}

/**
 * Polar product price payload subset used by Paymesh.
 */
export interface PolarProductPrice {
	id: string;
	price_amount?: number | null;
	price_currency?: string | null;
	type?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
}

/**
 * Polar product payload subset used by Paymesh.
 */
export interface PolarProduct {
	id: string;
	name: string;
	description?: string | null;
	is_recurring?: boolean;
	is_archived?: boolean;
	recurring_interval?: string | null;
	recurring_interval_count?: number | null;
	metadata?: Record<string, string | number | boolean> | null;
	prices?: PolarProductPrice[];
}

/**
 * Polar product list response shape.
 */
export type PolarProductListResponse =
	| PolarProduct[]
	| {
			items?: PolarProduct[];
			data?: PolarProduct[];
			result?: PolarProduct[];
	  };
