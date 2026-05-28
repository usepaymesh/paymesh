import { createHmac, timingSafeEqual } from 'node:crypto';
import { withRaw } from '../shared/raw';
import { request } from '../shared/request';
import type {
	CustomerCreateData,
	CustomerUpdateData,
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
	'customer.created': 'customer.created',
	'customer.updated': 'customer.updated',
	'customer.deleted': 'customer.deleted',
};

const STRIPE_HOOKS: Record<PaymeshEventType, string> = {
	'payment.created': 'onPaymentCreated',
	'payment.succeeded': 'onPaymentSucceeded',
	'payment.failed': 'onPaymentFailed',
	'payment.canceled': 'onPaymentCanceled',
	'payment.refunded': 'onPaymentRefunded',
	'customer.created': 'onCustomerCreated',
	'customer.updated': 'onCustomerUpdated',
	'customer.deleted': 'onCustomerDeleted',
	'subscription.created': 'onSubscriptionCreated',
	'subscription.updated': 'onSubscriptionUpdated',
	'subscription.canceled': 'onSubscriptionCanceled',
	'checkout.completed': 'onCheckoutCompleted',
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
				const status: PaymentStatus =
					STRIPE_PAYMENT_STATUSES[
						session.payment_status ?? session.status ?? ''
					] ?? 'pending';

				return withRaw(
					{
						id: session.id,
						provider: 'stripe',
						amount: session.amount_total ?? 0,
						currency: session.currency ?? 'usd',
						status,
						checkoutUrl: session.url ?? undefined,
						customer: session.customer_details
							? {
									id:
										typeof session.customer === 'string'
											? session.customer
											: undefined,
									name: session.customer_details.name ?? undefined,
									email:
										session.customer_details.email ??
										session.customer_email ??
										undefined,
									phone: session.customer_details.phone ?? undefined,
								}
							: undefined,
						metadata: session.metadata ?? undefined,
					},
					session,
					options?.includeRaw,
				);
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
					options?.includeRaw,
				);
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
					options?.includeRaw,
				);
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
					options?.includeRaw,
				);
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

				return withRaw(
					{
						id: customer.id,
						provider: 'stripe',
						deleted: customer.deleted,
					},
					customer,
					options?.includeRaw,
				);
			},
		},
		webhooks: {
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
			async parse(request) {
				const payload = await request.json();

				if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
					throw new TypeError('Stripe webhook payload must be a JSON object.');
				}

				return payload as Record<string, unknown>;
			},
			map<IncludeRaw extends boolean = false>(
				body: Record<string, unknown>,
				options?: ProviderWebhookMapOptions<IncludeRaw>,
			): PaymeshEvent<unknown, IncludeRaw> {
				const event = body as unknown as StripeEvent;
				const object = event.data?.object;
				const type = STRIPE_EVENTS[event.type] ?? 'payment.created';
				let data: unknown = body;

				if (object) {
					if (type === 'customer.deleted') {
						const customer = object as StripeDeletedCustomer;

						data = withRaw(
							{
								id: customer.id,
								provider: 'stripe',
								deleted: customer.deleted,
							},
							customer,
							options?.includeRaw,
						);
					} else if (
						type === 'customer.created' ||
						type === 'customer.updated'
					) {
						const customer = object as StripeCustomer;

						data = withRaw(
							{
								id: customer.id,
								provider: 'stripe',
								name: customer.name ?? undefined,
								email: customer.email ?? undefined,
								phone: customer.phone ?? undefined,
								metadata: customer.metadata ?? undefined,
							},
							customer,
							options?.includeRaw,
						);
					} else {
						const payment = object as StripePaymentObject;
						const status: PaymentStatus =
							('payment_status' in payment &&
								STRIPE_PAYMENT_STATUSES[
									payment.payment_status ?? payment.status ?? ''
								]) ||
							('refunded' in payment && payment.refunded && 'refunded') ||
							STRIPE_PAYMENT_STATUSES[payment.status ?? ''] ||
							'pending';

						data = withRaw(
							{
								id: payment.id,
								provider: 'stripe',
								amount:
									'amount_total' in payment
										? (payment.amount_total ?? 0)
										: 'amount' in payment
											? payment.amount
											: 0,
								currency: payment.currency ?? 'usd',
								status,
								checkoutUrl:
									'url' in payment ? (payment.url ?? undefined) : undefined,
								customer:
									'customer_details' in payment
										? {
												id:
													typeof payment.customer === 'string'
														? payment.customer
														: undefined,
												name: payment.customer_details?.name ?? undefined,
												email:
													payment.customer_details?.email ??
													payment.customer_email ??
													undefined,
												phone: payment.customer_details?.phone ?? undefined,
											}
										: undefined,
								metadata: payment.metadata ?? undefined,
							},
							payment,
							options?.includeRaw,
						);
					}
				}

				return withRaw(
					{
						id: event.id,
						type,
						provider: 'stripe',
						data,
					},
					body,
					options?.includeRaw,
				);
			},
			hook(event) {
				return STRIPE_HOOKS[event.type];
			},
		},
	});
};
