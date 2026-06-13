import type { RetryOptions } from 'paymesh';

export interface DodoProviderOptions {
	apiKey?: string;
	sandbox?: boolean;
	webhookSecret?: string;
	baseUrl?: string;
	retry?: RetryOptions;
	timeout?: number;
	fetch?: typeof fetch;
}

export type DodoMetadata = Record<string, string> | null;

export interface DodoCustomer {
	business_id?: string;
	created_at?: string;
	customer_id: string;
	email: string;
	name: string;
	metadata?: DodoMetadata;
	phone_number?: string | null;
}

export type DodoIntentStatus =
	| 'succeeded'
	| 'failed'
	| 'cancelled'
	| 'processing'
	| 'requires_customer_action'
	| 'requires_merchant_action'
	| 'requires_payment_method'
	| 'requires_confirmation'
	| 'requires_capture'
	| 'partially_captured'
	| 'partially_captured_and_capturable';

export interface DodoPayment {
	billing?: {
		country?: string;
		city?: string | null;
		state?: string | null;
		street?: string | null;
		zipcode?: string | null;
	};
	brand_id?: string;
	business_id?: string;
	created_at?: string;
	currency: string;
	customer: DodoCustomer;
	digital_products_delivered?: boolean;
	disputes?: unknown[];
	metadata: DodoMetadata;
	payment_id: string;
	payment_provider?: 'stripe' | 'adyen' | 'dodo';
	refunds?: DodoRefund[];
	retry_attempt?: number;
	settlement_amount?: number;
	settlement_currency?: string;
	total_amount: number;
	card_holder_name?: string | null;
	card_issuing_country?: string | null;
	card_last_four?: string | null;
	card_network?: string | null;
	card_type?: string | null;
	checkout_session_id?: string | null;
	custom_field_responses?: Array<{ key: string; value: string }> | null;
	discount_id?: string | null;
	discounts?: unknown[] | null;
	error_code?: string | null;
	error_message?: string | null;
	invoice_id?: string | null;
	invoice_url?: string | null;
	payment_link?: string | null;
	payment_method?: string | null;
	payment_method_type?: string | null;
	product_cart?: Array<{
		product_id: string;
		quantity: number;
		amount?: number | null;
	}> | null;
	refund_status?: string | null;
	status?: DodoIntentStatus | null;
	subscription_id?: string | null;
}

export interface DodoRefund {
	amount?: number | null;
	business_id?: string;
	created_at?: string;
	customer?: DodoCustomer;
	is_partial?: boolean;
	metadata?: DodoMetadata;
	payment_id: string;
	refund_id: string;
	status: 'succeeded' | 'failed' | 'pending' | 'review';
	currency?: string | null;
	reason?: string | null;
}

export interface DodoSubscription {
	addons?: Array<{
		addon_id: string;
		name?: string;
		quantity: number;
	}>;
	billing?: DodoPayment['billing'];
	cancel_at_next_billing_date: boolean;
	created_at?: string;
	currency: string;
	customer: DodoCustomer;
	metadata: DodoMetadata;
	next_billing_date?: string;
	on_demand?: boolean;
	payment_frequency_count?: number;
	payment_frequency_interval?: string;
	previous_billing_date?: string;
	product_id: string;
	quantity: number;
	recurring_pre_tax_amount: number;
	status: 'pending' | 'active' | 'on_hold' | 'cancelled' | 'failed' | 'expired';
	subscription_id: string;
	subscription_period_count?: number;
	subscription_period_interval?: string;
	tax_inclusive?: boolean;
	trial_period_days?: number;
	cancellation_comment?: string | null;
	cancellation_feedback?: string | null;
	cancelled_at?: string | null;
	custom_field_responses?: Array<{ key: string; value: string }> | null;
	customer_business_name?: string | null;
	discount_id?: string | null;
	discounts?: unknown[] | null;
	expires_at?: string | null;
	payment_method_id?: string | null;
	scheduled_change?: unknown | null;
	tax_id?: string | null;
}

export interface DodoCheckoutResponse {
	session_id: string;
	checkout_url?: string | null;
	client_secret?: string | null;
	payment_id?: string | null;
	publishable_key?: string | null;
}

export interface DodoProductPrice {
	type: 'one_time_price' | 'recurring_price' | 'usage_based_price';
	currency: string;
	price: number;
	payment_frequency_count?: number;
	payment_frequency_interval?: 'Day' | 'Week' | 'Month' | 'Year';
	subscription_period_count?: number;
	subscription_period_interval?: 'Day' | 'Week' | 'Month' | 'Year';
	tax_inclusive?: boolean | null;
}

export interface DodoProductListResponse {
	business_id?: string;
	created_at?: string;
	entitlements?: unknown[];
	is_recurring: boolean;
	metadata: DodoMetadata;
	product_id: string;
	tax_category?: string;
	updated_at?: string;
	currency?: string | null;
	description?: string | null;
	image?: string | null;
	name?: string | null;
	price?: number | null;
	price_detail?: DodoProductPrice | null;
	tax_inclusive?: boolean | null;
}

export interface DodoPaginatedResponse<T> {
	items?: T[];
	data?: T[];
}

export type DodoWebhookPayload =
	| {
			business_id: string;
			data: DodoPayment;
			timestamp: string;
			type:
				| 'payment.succeeded'
				| 'payment.failed'
				| 'payment.processing'
				| 'payment.cancelled';
	  }
	| {
			business_id: string;
			data: DodoRefund;
			timestamp: string;
			type: 'refund.succeeded' | 'refund.failed';
	  }
	| {
			business_id: string;
			data: DodoSubscription;
			timestamp: string;
			type:
				| 'subscription.active'
				| 'subscription.renewed'
				| 'subscription.on_hold'
				| 'subscription.paused'
				| 'subscription.cancelled'
				| 'subscription.failed'
				| 'subscription.expired'
				| 'subscription.plan_changed'
				| 'subscription.updated';
	  }
	| {
			business_id?: string;
			data: Record<string, unknown>;
			timestamp: string;
			type: string;
	  };
