import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type CustomerUpsertData,
	defineProvider,
	type PaymentCreateData,
	type PaymentStatus,
	PaymeshError,
	type PaymeshEvent,
	type PixCreateData,
	type ProviderRequestOptions,
	type ProviderWebhookHandleOptions,
	type ProviderWebhookHandleResult,
	request,
	withRaw,
} from 'paymesh';
import {
	STRIPE_BASE_URL,
	STRIPE_CAPABILITIES,
	STRIPE_EVENTS,
	STRIPE_HOOKS,
	STRIPE_PAYMENT_STATUSES,
} from './shared/constants';
import {
	mapStripeCustomer,
	mapStripePaymentObject,
	mapStripePixIntent,
} from './shared/mapper';
import {
	syncStripePayment,
	syncStripePix,
	syncStripeSubscription,
} from './shared/sync';
import { isStripePixPaymentIntent } from './shared/utils';
import type {
	StripeBalance,
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

/**
 * Creates a Stripe provider configured for Paymesh.
 *
 * @example
 * ```ts
 * export const provider = stripe({
 *   secret: process.env.STRIPE_API_KEY,
 *   webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
 * });
 * ```
 */
export const stripe = ({
	retry,
	fetch,
	timeout,
	baseUrl = STRIPE_BASE_URL,
	secret = process.env.STRIPE_API_KEY,
	sandbox,
	webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
}: StripeProviderOptions = {}) => {
	const resolveProviderSandbox = () => {
		if (typeof sandbox === 'boolean') return sandbox;
		if (secret?.startsWith('sk_test_')) return true;
		if (secret?.startsWith('sk_live_')) return false;
		return false;
	};
	const headers = {
		authorization: `Bearer ${secret}`,
		'content-type': 'application/x-www-form-urlencoded',
	};

	const baseRequestOptions = {
		baseUrl,
		fetch,
		headers,
		retry,
		timeout,
	};

	const resolveRequestOptions = <IncludeRaw extends boolean = false>(
		options?: ProviderRequestOptions<IncludeRaw>,
	) => ({
		baseUrl: options?.baseUrl ?? baseRequestOptions.baseUrl,
		timeout: options?.timeout ?? baseRequestOptions.timeout,
		retry: options?.retry ?? baseRequestOptions.retry,
		fetch: options?.fetch ?? baseRequestOptions.fetch,
		headers: baseRequestOptions.headers,
	});

	return defineProvider({
		id: 'stripe',
		isSandbox: resolveProviderSandbox,
		capabilities: STRIPE_CAPABILITIES,
		payments: {
			async create<IncludeRaw extends boolean = false>(
				data: PaymentCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				if (typeof data.amount !== 'number' || !data.currency)
					throw new PaymeshError({
						code: 'invalid_request',
						message:
							'Stripe requires "amount" and "currency" when creating a payment.',
						provider: 'stripe',
					});

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
						...resolveRequestOptions(options),
						method: 'POST',
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
						sandbox: resolveProviderSandbox(),
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
		pix: {
			async create<IncludeRaw extends boolean = false>(
				data: PixCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const body = new URLSearchParams({
					amount: String(data.amount),
					confirm: 'true',
					currency: data.currency.toLowerCase(),
					'payment_method_data[type]': 'pix',
					'payment_method_types[0]': 'pix',
				});

				if (data.description) body.set('description', data.description);
				if (data.customer?.id) body.set('customer', data.customer.id);
				if (data.customer?.email) {
					body.set('receipt_email', data.customer.email);
					body.set(
						'payment_method_data[billing_details][email]',
						data.customer.email,
					);
				}
				if (data.customer?.name) {
					body.set(
						'payment_method_data[billing_details][name]',
						data.customer.name,
					);
				}
				if (data.customer?.phone) {
					body.set(
						'payment_method_data[billing_details][phone]',
						data.customer.phone,
					);
				}
				if (data.customer?.externalId) {
					body.set('metadata[externalId]', data.customer.externalId);
				}

				for (const [key, value] of Object.entries(data.metadata ?? {})) {
					if (value !== null) body.set(`metadata[${key}]`, String(value));
				}

				if (data.pix?.amountIncludesIof) {
					body.set(
						'payment_method_options[pix][amount_includes_iof]',
						data.pix.amountIncludesIof,
					);
				}
				if (data.pix?.expiresAt) {
					const expiresAt =
						data.pix.expiresAt instanceof Date
							? Math.floor(data.pix.expiresAt.getTime() / 1000)
							: Math.floor(new Date(data.pix.expiresAt).getTime() / 1000);
					body.set(
						'payment_method_options[pix][expires_at]',
						String(expiresAt),
					);
				} else if (typeof data.pix?.expiresAfterSeconds === 'number') {
					body.set(
						'payment_method_options[pix][expires_after_seconds]',
						String(data.pix.expiresAfterSeconds),
					);
				}

				const paymentIntent = await request<
					Extract<StripePaymentObject, { object: 'payment_intent' }>
				>('/v1/payment_intents', {
					provider: 'stripe',
					...resolveRequestOptions(options),
					method: 'POST',
					body,
				});

				return withRaw(
					mapStripePixIntent(paymentIntent, resolveProviderSandbox()),
					paymentIntent,
					options?.includeRaw,
				);
			},
			async get<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const paymentIntent = await request<
					Extract<StripePaymentObject, { object: 'payment_intent' }>
				>(`/v1/payment_intents/${encodeURIComponent(id)}`, {
					provider: 'stripe',
					...resolveRequestOptions(options),
				});

				if (!isStripePixPaymentIntent(paymentIntent)) {
					throw new PaymeshError({
						code: 'provider_not_found',
						message: `PIX payment "${id}" was not found on Stripe`,
						provider: 'stripe',
					});
				}

				return withRaw(
					mapStripePixIntent(paymentIntent, resolveProviderSandbox()),
					paymentIntent,
					options?.includeRaw,
				);
			},
		},
		customers: {
			async upsert<IncludeRaw extends boolean = false>(
				data: CustomerUpsertData,
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

				const customer = await request<StripeCustomer>(
					data.id
						? `/v1/customers/${encodeURIComponent(data.id)}`
						: '/v1/customers',
					{
						provider: 'stripe',
						...resolveRequestOptions(options),
						method: 'POST',
						body,
					},
				);

				return withRaw(
					mapStripeCustomer(customer, resolveProviderSandbox()),
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
						...resolveRequestOptions(options),
					},
				);

				return withRaw(
					mapStripeCustomer(customer, resolveProviderSandbox()),
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
						...resolveRequestOptions(options),
						method: 'DELETE',
					},
				);

				return withRaw(
					{
						id: customer.id,
						provider: 'stripe',
						sandbox: resolveProviderSandbox(),
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
						...baseRequestOptions,
						query: {
							limit: 100,
						},
					}),
					request<StripeListResponse<StripePrice>>('/v1/prices', {
						provider: 'stripe',
						...baseRequestOptions,
						query: {
							limit: 100,
						},
					}),
				]);

				return {
					products: products.data.map((product) => ({
						id: product.id,
						sandbox: resolveProviderSandbox(),
						name: product.name,
						description: product.description ?? undefined,
						active: product.active ?? true,
						metadata: product.metadata ?? undefined,
						version: product.metadata?.version ?? undefined,
						raw: product,
					})),
					prices: prices.data.map((price) => ({
						id: price.id,
						sandbox: resolveProviderSandbox(),
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
		dashboard: {
			async getBalance() {
				const balance = await request<StripeBalance>('/v1/balance', {
					provider: 'stripe',
					...baseRequestOptions,
				});

				return {
					available: balance.available.map((entry) => ({
						amount: entry.amount,
						currency: entry.currency,
						label: `Available (${entry.currency.toUpperCase()})`,
					})),
					pending: balance.pending.map((entry) => ({
						amount: entry.amount,
						currency: entry.currency,
						label: `Pending (${entry.currency.toUpperCase()})`,
					})),
					reserved: (balance.connect_reserved ?? []).map((entry) => ({
						amount: entry.amount,
						currency: entry.currency,
						label: `Reserved (${entry.currency.toUpperCase()})`,
					})),
				};
			},
			getResourceUrl({ id, type }) {
				if (type === 'customer') {
					return `https://dashboard.stripe.com/customers/${encodeURIComponent(id)}`;
				}

				if (type === 'subscription') {
					return `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(id)}`;
				}

				if (type === 'payment' || type === 'pix') {
					return `https://dashboard.stripe.com/payments/${encodeURIComponent(id)}`;
				}

				return null;
			},
			syncPayment: (input) =>
				syncStripePayment({
					...input,
					requestOptions: baseRequestOptions,
					sandbox: resolveProviderSandbox(),
				}),
			syncPix: (input) =>
				syncStripePix({
					...input,
					requestOptions: baseRequestOptions,
					sandbox: resolveProviderSandbox(),
				}),
			syncSubscription: (input) =>
				syncStripeSubscription({
					...input,
					requestOptions: baseRequestOptions,
					sandbox: resolveProviderSandbox(),
				}),
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
				const eventSandbox =
					typeof event.livemode === 'boolean'
						? !event.livemode
						: resolveProviderSandbox();

				let data: unknown = body;

				if (object) {
					if (type === 'customer.deleted') {
						const customer = object as StripeDeletedCustomer;

						data = withRaw(
							{
								id: customer.id,
								provider: 'stripe',
								sandbox: eventSandbox,
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
							mapStripeCustomer(customer, eventSandbox),
							customer,
							includeRaw,
						);
					} else {
						const payment = object as StripePaymentObject;
						data = withRaw(
							mapStripePaymentObject(payment, eventSandbox),
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
							sandbox: eventSandbox,
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
