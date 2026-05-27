import { createHmac, timingSafeEqual } from 'node:crypto';
import { withRaw } from '../shared/raw';
import { request } from '../shared/request';
import type {
	Customer,
	CustomerCreateData,
	CustomerDeleteResult,
	CustomerUpdateData,
	Payment,
	PaymentCreateData,
	PaymentStatus,
	PaymeshEvent,
	PaymeshEventType,
	ProviderCapabilities,
	ProviderRequestOptions,
	ProviderWebhookMapOptions,
} from '../types/providers';
import type {
	StripeCheckoutSession,
	StripeCustomer,
	StripeDeletedCustomer,
	StripeEvent,
	StripePaymentObject,
	StripeProviderOptions,
} from '../types/providers/stripe';
import { defineProvider } from '.';

const STRIPE_BASE_URL = 'https://api.stripe.com';

const STRIPE_CAPABILITIES = {
	checkout: true,
	coupons: true,
	pix: false,
	refunds: true,
	subscriptions: true,
	webhooks: true,
	customerPortal: true,
	customers: true,
} satisfies ProviderCapabilities;

const STRIPE_EVENTS: Record<string, PaymeshEventType> = {
	'checkout.session.completed': 'checkout.completed',
	'checkout.session.expired': 'payment.canceled',
	'payment_intent.created': 'payment.created',
	'payment_intent.succeeded': 'payment.succeeded',
	'payment_intent.payment_failed': 'payment.failed',
	'payment_intent.canceled': 'payment.canceled',
	'charge.refunded': 'payment.refunded',
};

const STRIPE_PAYMENT_STATUSES: Record<string, PaymentStatus> = {
	paid: 'paid',
	expired: 'canceled',
	succeeded: 'paid',
	failed: 'failed',
	canceled: 'canceled',
};

export const stripe = ({
	secret = process.env.STRIPE_API_KEY,
	webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
	baseUrl = STRIPE_BASE_URL,
	retry,
	timeout,
	fetch,
}: StripeProviderOptions = {}) => {
	const headers = {
		authorization: `Bearer ${secret}`,
		'content-type': 'application/x-www-form-urlencoded',
	};

	return defineProvider({
		id: 'stripe',
		capabilities: STRIPE_CAPABILITIES,
		payments: {
			async create<IncludeRaw extends boolean = false>(
				data: PaymentCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const body = new URLSearchParams({
					mode: 'payment',
					'line_items[0][quantity]': '1',
					'line_items[0][price_data][currency]': data.currency.toLowerCase(),
					'line_items[0][price_data][unit_amount]': String(data.amount),
					'line_items[0][price_data][product_data][name]':
						data.description ?? 'Payment',
				});

				if (data.successUrl) body.set('success_url', data.successUrl);
				if (data.cancelUrl) body.set('cancel_url', data.cancelUrl);
				if (data.customer?.id) body.set('customer', data.customer.id);
				else if (data.customer?.email)
					body.set('customer_email', data.customer.email);

				for (const [key, value] of Object.entries(data.metadata ?? {})) {
					if (value !== null) body.set(`metadata[${key}]`, String(value));
				}

				const session = await request<StripeCheckoutSession>(
					'/v1/checkout/sessions',
					{
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						method: 'POST',
						headers,
						body,
					},
				);

				return toPayment(session, options?.includeRaw);
			},
		},
		customers: {
			async create<IncludeRaw extends boolean = false>(
				data: CustomerCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const body = new URLSearchParams();

				if (data.name !== undefined) body.set('name', data.name);
				if (data.email !== undefined) body.set('email', data.email);
				if (data.phone !== undefined) body.set('phone', data.phone);

				for (const [key, value] of Object.entries(data.metadata ?? {})) {
					if (value !== null) body.set(`metadata[${key}]`, String(value));
				}

				const customer = await request<StripeCustomer>('/v1/customers', {
					baseUrl: options?.baseUrl ?? baseUrl,
					timeout: options?.timeout ?? timeout,
					retry: options?.retry ?? retry,
					fetch: options?.fetch ?? fetch,
					method: 'POST',
					headers,
					body,
				});

				return toCustomer(customer, options?.includeRaw);
			},
			async get<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const customer = await request<StripeCustomer>(
					`/v1/customers/${encodeURIComponent(id)}`,
					{
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						headers,
					},
				);

				return toCustomer(customer, options?.includeRaw);
			},
			async update<IncludeRaw extends boolean = false>(
				id: string,
				data: CustomerUpdateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const body = new URLSearchParams();

				if (data.name !== undefined) body.set('name', data.name);
				if (data.email !== undefined) body.set('email', data.email);
				if (data.phone !== undefined) body.set('phone', data.phone);

				for (const [key, value] of Object.entries(data.metadata ?? {})) {
					if (value !== null) body.set(`metadata[${key}]`, String(value));
				}

				const customer = await request<StripeCustomer>(
					`/v1/customers/${encodeURIComponent(id)}`,
					{
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						method: 'POST',
						headers,
						body,
					},
				);

				return toCustomer(customer, options?.includeRaw);
			},
			async delete<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const customer = await request<StripeDeletedCustomer>(
					`/v1/customers/${encodeURIComponent(id)}`,
					{
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						method: 'DELETE',
						headers,
					},
				);

				return toCustomerDeleteResult(customer, options?.includeRaw);
			},
		},
		webhooks: {
			map<IncludeRaw extends boolean = false>(
				body: Record<string, unknown>,
				options?: ProviderWebhookMapOptions<IncludeRaw>,
			): PaymeshEvent<unknown, IncludeRaw> {
				const event = body as unknown as StripeEvent;
				const object = event.data?.object;

				return withRaw(
					{
						id: event.id,
						type: STRIPE_EVENTS[event.type] ?? 'payment.created',
						provider: 'stripe',
						data: object ? toPayment(object, options?.includeRaw) : body,
					},
					body,
					options?.includeRaw,
				);
			},
			async verify({ request }) {
				if (!webhookSecret) return false;

				const signature = new URLSearchParams(
					request.headers.get('stripe-signature')?.replaceAll(',', '&'),
				);
				const timestamp = signature.get('t');
				const expected = signature.get('v1');
				if (!timestamp || !expected) return false;

				const payload = `${timestamp}.${await request.text()}`;
				const actual = createHmac('sha256', webhookSecret)
					.update(payload)
					.digest('hex');

				return (
					actual.length === expected.length &&
					timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
				);
			},
		},
	});
};

function toCustomer<IncludeRaw extends boolean = false>(
	customer: StripeCustomer,
	includeRaw?: IncludeRaw,
): Customer<IncludeRaw> {
	return withRaw(
		{
			id: customer.id,
			provider: 'stripe',
			name: customer.name ?? undefined,
			email: customer.email ?? undefined,
			phone: customer.phone ?? undefined,
			metadata: customer.metadata ?? undefined,
		},
		customer,
		includeRaw,
	);
}

function toCustomerDeleteResult<IncludeRaw extends boolean = false>(
	customer: StripeDeletedCustomer,
	includeRaw?: IncludeRaw,
): CustomerDeleteResult<IncludeRaw> {
	return withRaw(
		{
			id: customer.id,
			provider: 'stripe',
			deleted: customer.deleted,
		},
		customer,
		includeRaw,
	);
}

function toPayment<IncludeRaw extends boolean = false>(
	data: StripePaymentObject,
	includeRaw?: IncludeRaw,
): Payment<IncludeRaw> {
	const status: PaymentStatus =
		('payment_status' in data &&
			STRIPE_PAYMENT_STATUSES[data.payment_status ?? data.status ?? '']) ||
		('refunded' in data && data.refunded && 'refunded') ||
		STRIPE_PAYMENT_STATUSES[data.status ?? ''] ||
		'pending';

	return withRaw(
		{
			id: data.id,
			provider: 'stripe',
			amount:
				'amount_total' in data
					? (data.amount_total ?? 0)
					: 'amount' in data
						? data.amount
						: 0,
			currency: data.currency ?? 'usd',
			status,
			checkoutUrl: 'url' in data ? (data.url ?? undefined) : undefined,
			customer:
				'customer_details' in data
					? {
							id: typeof data.customer === 'string' ? data.customer : undefined,
							name: data.customer_details?.name ?? undefined,
							email:
								data.customer_details?.email ??
								data.customer_email ??
								undefined,
							phone: data.customer_details?.phone ?? undefined,
						}
					: undefined,
			metadata: data.metadata ?? undefined,
		},
		data,
		includeRaw,
	);
}
