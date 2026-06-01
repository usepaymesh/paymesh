import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type CustomerCreateData,
	type CustomerUpdateData,
	defineProvider,
	type PaymentCreateData,
	type PaymentStatus,
	type PaymeshEvent,
	type PaymeshEventType,
	type ProviderCapabilities,
	type ProviderRequestOptions,
	type ProviderWebhookHandleOptions,
	type ProviderWebhookHandleResult,
	request,
	withRaw,
} from 'paymesh';
import type {
	StripeCheckoutSession,
	StripeCustomer,
	StripeDeletedCustomer,
	StripeEvent,
	StripeListResponse,
	StripePaymentObject,
	StripePrice,
	StripeProduct,
	StripeProviderOptions,
} from './types';

export type * from './types';

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

				if (data.customer?.id) {
					body.set('customer', data.customer.id);
				} else {
					if (data.customer?.externalId) {
						body.set('client_reference_id', data.customer.externalId);
					}
					if (data.customer?.email) {
						body.set('customer_email', data.customer.email);
					}
				}

				for (const [key, value] of Object.entries(data.metadata ?? {})) {
					if (value !== null) body.set(`metadata[${key}]`, String(value));
				}

				const session = await request<StripeCheckoutSession>(
					'/v1/checkout/sessions',
					{
						provider: 'stripe',
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
									externalId: session.client_reference_id ?? undefined,
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
				if (data.externalId) body.set('metadata[externalId]', data.externalId);

				const customer = await request<StripeCustomer>('/v1/customers', {
					provider: 'stripe',
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
						externalId:
							typeof customer.metadata?.externalId === 'string' &&
							customer.metadata.externalId.length > 0
								? customer.metadata.externalId
								: undefined,
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
						provider: 'stripe',
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
						externalId:
							typeof customer.metadata?.externalId === 'string' &&
							customer.metadata.externalId.length > 0
								? customer.metadata.externalId
								: undefined,
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
						provider: 'stripe',
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
						externalId:
							typeof customer.metadata?.externalId === 'string' &&
							customer.metadata.externalId.length > 0
								? customer.metadata.externalId
								: undefined,
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
						provider: 'stripe',
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
		catalog: {
			async list() {
				const [products, prices] = await Promise.all([
					request<StripeListResponse<StripeProduct>>('/v1/products', {
						provider: 'stripe',
						baseUrl,
						timeout,
						retry,
						fetch,
						headers,
						query: {
							limit: 100,
						},
					}),
					request<StripeListResponse<StripePrice>>('/v1/prices', {
						provider: 'stripe',
						baseUrl,
						timeout,
						retry,
						fetch,
						headers,
						query: {
							limit: 100,
						},
					}),
				]);

				return {
					products: products.data.map((product) => ({
						id: product.id,
						name: product.name,
						description: product.description ?? undefined,
						active: product.active ?? true,
						metadata: product.metadata ?? undefined,
						version: product.metadata?.version ?? undefined,
						raw: product,
					})),
					prices: prices.data.map((price) => ({
						id: price.id,
						productId:
							typeof price.product === 'string' ? price.product : undefined,
						active: price.active ?? true,
						type: price.type ?? undefined,
						currency: price.currency ?? undefined,
						amount: price.unit_amount ?? undefined,
						interval: price.recurring?.interval ?? undefined,
						intervalCount: price.recurring?.interval_count ?? undefined,
						metadata: price.metadata ?? undefined,
						version: price.metadata?.version ?? undefined,
						raw: price,
					})),
				};
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
			async handle<IncludeRaw extends boolean = false>(
				options: ProviderWebhookHandleOptions<IncludeRaw>,
			): Promise<ProviderWebhookHandleResult<IncludeRaw>> {
				const { request, includeRaw } = options;
				const payload = await request.json();

				if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
					throw new TypeError('Stripe webhook payload must be a JSON object.');
				}

				const body = payload as Record<string, unknown>;
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
							includeRaw,
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
								externalId:
									typeof customer.metadata?.externalId === 'string' &&
									customer.metadata.externalId.length > 0
										? customer.metadata.externalId
										: undefined,
								name: customer.name ?? undefined,
								email: customer.email ?? undefined,
								phone: customer.phone ?? undefined,
								metadata: customer.metadata ?? undefined,
							},
							customer,
							includeRaw,
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
												externalId:
													'client_reference_id' in payment
														? (payment.client_reference_id ?? undefined)
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
							includeRaw,
						);
					}
				}

				return {
					deliveryId: event.id,
					hook: STRIPE_HOOKS[type],
					event: withRaw(
						{
							id: event.id,
							type,
							provider: 'stripe',
							data,
						},
						body,
						includeRaw,
					) as PaymeshEvent<unknown, IncludeRaw>,
				};
			},
		},
	});
};
