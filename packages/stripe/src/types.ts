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
	metadata?: Record<string, string> | null;
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
