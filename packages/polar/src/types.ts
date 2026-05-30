import type { RetryOptions } from 'paymesh';

export interface PolarProviderOptions {
	accessToken?: string;
	webhookSecret?: string;
	baseUrl?: string;
	retry?: RetryOptions;
	timeout?: number;
	fetch?: typeof fetch;
}

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

export interface PolarCustomer {
	id: string;
	email: string;
	name?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
	external_id?: string | null;
	deleted_at?: string | null;
}

export interface PolarOrder {
	id: string;
	paid?: boolean;
	total_amount?: number | null;
	refunded_amount?: number | null;
	currency?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
	customer_id?: string | null;
	checkout_id?: string | null;
	customer?: PolarCustomer | null;
}

export interface PolarSubscription {
	id: string;
	amount?: number | null;
	currency?: string | null;
	metadata?: Record<string, string | number | boolean> | null;
	cancel_at_period_end?: boolean | null;
	canceled_at?: string | null;
	ends_at?: string | null;
	ended_at?: string | null;
}

export interface PolarWebhookEvent<TData = unknown> {
	type: string;
	timestamp: string;
	data: TData;
}
