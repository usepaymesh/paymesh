import type { RetryOptions } from 'paymesh';

export interface StripeProviderOptions {
	secret?: string;
	webhookSecret?: string;
	baseUrl?: string;
	retry?: RetryOptions;
	timeout?: number;
	fetch?: typeof fetch;
}

export interface StripeCheckoutSession {
	id: string;
	object: 'checkout.session';
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

export interface StripeCustomer {
	id: string;
	object: 'customer';
	name?: string | null;
	email?: string | null;
	phone?: string | null;
	metadata?: Record<string, string> | null;
}

export interface StripeDeletedCustomer {
	id: string;
	object: 'customer';
	deleted: boolean;
}

export interface StripePaymentIntent {
	id: string;
	object: 'payment_intent';
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

export interface StripeCharge {
	id: string;
	object: 'charge';
	amount: number;
	currency: string;
	metadata?: Record<string, string> | null;
	refunded?: boolean;
	status: string;
}

export interface StripeSubscription {
	id: string;
	object: 'subscription';
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

export interface StripeBalanceAmount {
	amount: number;
	currency: string;
	source_types?: Record<string, number> | null;
}

export interface StripeBalance {
	available: StripeBalanceAmount[];
	connect_reserved?: StripeBalanceAmount[] | null;
	livemode?: boolean;
	pending: StripeBalanceAmount[];
}

export interface StripeEvent {
	id: string;
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

export type StripePaymentObject =
	| StripeCheckoutSession
	| StripePaymentIntent
	| StripeCharge;

export interface StripeListResponse<T> {
	object: 'list' | 'search_result';
	data: T[];
	has_more: boolean;
}

export interface StripeProduct {
	id: string;
	object: 'product';
	active?: boolean;
	description?: string | null;
	metadata?: Record<string, string> | null;
	name: string;
}

export interface StripePrice {
	id: string;
	object: 'price';
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
