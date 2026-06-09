import type { RetryOptions } from 'paymesh';

/**
 * Options for the Stripe provider factory.
 */
export interface StripeProviderOptions {
	/** API secret used for authenticated requests. Defaults to `process.env.STRIPE_API_KEY`. */
	secret?: string;
	/** Explicit sandbox override. When omitted, Stripe infers from the API secret when possible. */
	sandbox?: boolean;
	/** Signing secret used to verify webhooks. Defaults to `process.env.STRIPE_WEBHOOK_SECRET`. */
	webhookSecret?: string;
	/** Base API URL. Defaults to `https://api.stripe.com`. */
	baseUrl?: string;
	/** Retry configuration for provider requests. */
	retry?: RetryOptions;
	/** Request timeout in milliseconds. */
	timeout?: number;
	/** Fetch implementation to use. */
	fetch?: typeof fetch;
}

/**
 * Stripe Checkout Session payload subset used by Paymesh.
 */
export interface StripeCheckoutSession {
	id: string;
	object: 'checkout.session';
	livemode?: boolean;
	amount_total?: number | null;
	client_reference_id?: string | null;
	currency?: string | null;
	customer?: string | null;
	customer_email?: string | null;
	customer_details?: {
		email?: string | null;
		name?: string | null;
		phone?: string | null;
	} | null;
	metadata?: Record<string, string> | null;
	payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
	status?: 'open' | 'complete' | 'expired';
	url?: string | null;
}

/**
 * Stripe customer payload subset used by Paymesh.
 */
export interface StripeCustomer {
	id: string;
	object: 'customer';
	livemode?: boolean;
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	metadata?: Record<string, string> | null;
}

/**
 * Stripe deleted customer payload.
 */
export interface StripeDeletedCustomer {
	id: string;
	object: 'customer';
	livemode?: boolean;
	deleted: boolean;
}

/**
 * Stripe payment intent payload subset used by Paymesh.
 */
export interface StripePaymentIntent {
	id: string;
	object: 'payment_intent';
	livemode?: boolean;
	amount: number;
	currency: string;
	customer?: string | null;
	description?: string | null;
	metadata?: Record<string, string> | null;
	next_action?: {
		type?: string | null;
		pix_display_qr_code?: {
			data?: string | null;
			expires_at?: number | null;
			hosted_instructions_url?: string | null;
			image_url_png?: string | null;
			image_url_svg?: string | null;
		} | null;
	} | null;
	payment_method_options?: {
		pix?: {
			amount_includes_iof?: 'always' | 'never' | null;
			expires_after_seconds?: number | null;
			expires_at?: number | null;
			setup_future_usage?: string | null;
		} | null;
	} | null;
	payment_method_types?: string[] | null;
	receipt_email?: string | null;
	status: string;
}

/**
 * Stripe charge payload subset used by Paymesh.
 */
export interface StripeCharge {
	id: string;
	object: 'charge';
	livemode?: boolean;
	amount: number;
	currency: string;
	metadata?: Record<string, string> | null;
	refunded?: boolean;
	status: string;
}

/**
 * Stripe subscription payload subset used by Paymesh.
 */
export interface StripeSubscription {
	id: string;
	object: 'subscription';
	livemode?: boolean;
	amount?: number | null;
	cancel_at_period_end?: boolean;
	canceled_at?: number | null;
	current_period_end?: number | null;
	current_period_start?: number | null;
	customer?: string | null;
	currency?: string | null;
	items?: {
		data?: Array<{
			price?: {
				id?: string | null;
				product?: string | null;
			} | null;
		}>;
	} | null;
	metadata?: Record<string, string> | null;
	status?: string | null;
}

/**
 * Stripe balance amount payload subset used by Paymesh.
 */
export interface StripeBalanceAmount {
	amount: number;
	currency: string;
	source_types?: Record<string, number> | null;
}

/**
 * Stripe balance payload subset used by Paymesh.
 */
export interface StripeBalance {
	available: StripeBalanceAmount[];
	connect_reserved?: StripeBalanceAmount[] | null;
	livemode?: boolean;
	pending: StripeBalanceAmount[];
}

/**
 * Stripe event payload subset used by Paymesh.
 */
export interface StripeEvent {
	id: string;
	livemode?: boolean;
	type: string;
	data?: {
		object?:
			| StripeCheckoutSession
			| StripePaymentIntent
			| StripeCharge
			| StripeCustomer
			| StripeDeletedCustomer;
	};
}

/**
 * Stripe payment object payload handled by the provider.
 */
export type StripePaymentObject =
	| StripeCheckoutSession
	| StripePaymentIntent
	| StripeCharge;

/**
 * Generic Stripe list response wrapper.
 */
export interface StripeListResponse<T> {
	object: 'list' | 'search_result';
	data: T[];
	has_more: boolean;
}

/**
 * Stripe product payload subset used by Paymesh.
 */
export interface StripeProduct {
	id: string;
	object: 'product';
	livemode?: boolean;
	active?: boolean;
	description?: string | null;
	metadata?: Record<string, string> | null;
	name: string;
}

/**
 * Stripe price payload subset used by Paymesh.
 */
export interface StripePrice {
	id: string;
	object: 'price';
	livemode?: boolean;
	active?: boolean;
	currency?: string | null;
	metadata?: Record<string, string> | null;
	product?: string | null;
	recurring?: {
		interval?: string | null;
		interval_count?: number | null;
	} | null;
	type?: 'one_time' | 'recurring' | null;
	unit_amount?: number | null;
}
