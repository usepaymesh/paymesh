import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type BaseAnyPayment,
	type BasePayment,
	type CustomerUpsertData,
	defineProvider,
	type PaymentCreateData,
	type PaymentStatus,
	PaymeshError,
	type PaymeshEvent,
	type PaymeshEventType,
	type PixCreateData,
	type ProviderCapabilities,
	type ProviderDashboardSyncInput,
	type ProviderRequestOptions,
	type ProviderWebhookHandleOptions,
	type ProviderWebhookHandleResult,
	request,
	withRaw,
} from 'paymesh';
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
	StripeSubscription,
} from './types';

export type * from './types';

const STRIPE_BASE_URL = 'https://api.stripe.com';

const STRIPE_CAPABILITIES = {
	checkout: true,
	coupons: true,
	pix: true,
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
	processing: 'processing',
	paid: 'paid',
	expired: 'canceled',
	requires_action: 'pending',
	requires_payment_method: 'failed',
	succeeded: 'paid',
	failed: 'failed',
	canceled: 'canceled',
};

function getStripeExternalId(metadata?: Record<string, string> | null) {
	return typeof metadata?.externalId === 'string' &&
		metadata.externalId.length > 0
		? metadata.externalId
		: undefined;
}

function mapStripeCustomer(customer: StripeCustomer) {
	return {
		id: customer.id,
		provider: 'stripe' as const,
		externalId: getStripeExternalId(customer.metadata),
		name: customer.name ?? undefined,
		email: customer.email ?? undefined,
		phone: customer.phone ?? undefined,
		metadata: customer.metadata ?? undefined,
	};
}

function isStripePixPaymentIntent(
	payment: Extract<StripePaymentObject, { object: 'payment_intent' }>,
) {
	return (
		payment.payment_method_types?.includes('pix') === true ||
		payment.payment_method_options?.pix != null ||
		payment.next_action?.type === 'pix_display_qr_code'
	);
}

function mapStripePixIntent(
	payment: Extract<StripePaymentObject, { object: 'payment_intent' }>,
): Extract<BaseAnyPayment, { method: 'pix' }> {
	const status: PaymentStatus =
		STRIPE_PAYMENT_STATUSES[payment.status ?? ''] ?? 'pending';
	const qrCode = payment.next_action?.pix_display_qr_code;

	return {
		id: payment.id,
		provider: 'stripe' as const,
		amount: payment.amount,
		copyPasteCode: qrCode?.data ?? undefined,
		currency: payment.currency ?? 'brl',
		customer:
			typeof payment.customer === 'string' ||
			typeof payment.receipt_email === 'string' ||
			getStripeExternalId(payment.metadata)
				? {
						id:
							typeof payment.customer === 'string'
								? payment.customer
								: undefined,
						email: payment.receipt_email ?? undefined,
						externalId: getStripeExternalId(payment.metadata),
					}
				: undefined,
		expiresAt:
			typeof qrCode?.expires_at === 'number'
				? new Date(qrCode.expires_at * 1000).toISOString()
				: typeof payment.payment_method_options?.pix?.expires_at === 'number'
					? new Date(
							payment.payment_method_options.pix.expires_at * 1000,
						).toISOString()
					: undefined,
		instructionsUrl: qrCode?.hosted_instructions_url ?? undefined,
		metadata: payment.metadata ?? undefined,
		method: 'pix' as const,
		qrCodeImageUrlPng: qrCode?.image_url_png ?? undefined,
		qrCodeImageUrlSvg: qrCode?.image_url_svg ?? undefined,
		status,
	};
}

function mapStripePaymentObject(payment: StripeCheckoutSession): BasePayment;
function mapStripePaymentObject(payment: StripePaymentObject): BaseAnyPayment;
function mapStripePaymentObject(payment: StripePaymentObject): BaseAnyPayment {
	if (
		payment.object === 'payment_intent' &&
		isStripePixPaymentIntent(payment)
	) {
		return mapStripePixIntent(payment);
	}

	const status: PaymentStatus =
		('payment_status' in payment &&
			STRIPE_PAYMENT_STATUSES[
				payment.payment_status ?? payment.status ?? ''
			]) ||
		('refunded' in payment && payment.refunded && 'refunded') ||
		STRIPE_PAYMENT_STATUSES[payment.status ?? ''] ||
		'pending';

	let customer:
		| {
				email?: string;
				externalId?: string;
				id?: string;
				name?: string;
				phone?: string;
		  }
		| undefined;

	if ('customer_details' in payment) {
		customer = {
			id: typeof payment.customer === 'string' ? payment.customer : undefined,
			externalId:
				'client_reference_id' in payment
					? (payment.client_reference_id ?? undefined)
					: undefined,
			name: payment.customer_details?.name ?? undefined,
			email:
				payment.customer_details?.email ?? payment.customer_email ?? undefined,
			phone: payment.customer_details?.phone ?? undefined,
		};
	} else if (payment.object === 'payment_intent') {
		if (
			typeof payment.customer === 'string' ||
			typeof payment.receipt_email === 'string' ||
			getStripeExternalId(payment.metadata)
		) {
			customer = {
				id: typeof payment.customer === 'string' ? payment.customer : undefined,
				email: payment.receipt_email ?? undefined,
				externalId: getStripeExternalId(payment.metadata),
			};
		}
	}

	return {
		id: payment.id,
		provider: 'stripe' as const,
		amount:
			'amount_total' in payment
				? (payment.amount_total ?? 0)
				: 'amount' in payment
					? payment.amount
					: 0,
		currency: payment.currency ?? 'usd',
		status,
		checkoutUrl: 'url' in payment ? (payment.url ?? undefined) : undefined,
		customer,
		metadata: payment.metadata ?? undefined,
	};
}

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

	const requestOptions = {
		baseUrl,
		fetch,
		headers,
		retry,
		timeout,
	};

	const readStripePayment = async (id: string) => {
		if (id.startsWith('cs_')) {
			return {
				kind: 'checkout' as const,
				raw: await request<StripeCheckoutSession>(
					`/v1/checkout/sessions/${encodeURIComponent(id)}`,
					{
						provider: 'stripe',
						...requestOptions,
					},
				),
			};
		}

		if (id.startsWith('pi_')) {
			return {
				kind: 'invoice' as const,
				raw: await request<
					Extract<StripePaymentObject, { object: 'payment_intent' }>
				>(`/v1/payment_intents/${encodeURIComponent(id)}`, {
					provider: 'stripe',
					...requestOptions,
				}),
			};
		}

		return {
			kind: 'invoice' as const,
			raw: await request<Extract<StripePaymentObject, { object: 'charge' }>>(
				`/v1/charges/${encodeURIComponent(id)}`,
				{
					provider: 'stripe',
					...requestOptions,
				},
			),
		};
	};

	const syncStripePayment = async ({
		database,
		id,
		schema,
	}: ProviderDashboardSyncInput) => {
		const payment = await readStripePayment(id);

		if (payment.kind === 'checkout') {
			const normalized = withRaw(
				mapStripePaymentObject(payment.raw),
				payment.raw,
				true,
			);
			await database.repositories.checkouts.upsert(schema, normalized);
			return normalized;
		}

		const normalized = withRaw(
			mapStripePaymentObject(payment.raw),
			payment.raw,
			true,
		);
		await database.repositories.invoices.upsert(schema, normalized);
		if (normalized.method === 'pix') {
			await database.repositories.pix.upsert(schema, normalized);
		}

		return normalized;
	};

	const syncStripePix = async ({
		database,
		id,
		schema,
	}: ProviderDashboardSyncInput) => {
		if (!id.startsWith('pi_')) {
			throw new PaymeshError({
				code: 'invalid_request',
				message:
					'Provider "stripe" requires a PaymentIntent id when fetching PIX payments',
				provider: 'stripe',
			});
		}
		const paymentIntent = await request<
			Extract<StripePaymentObject, { object: 'payment_intent' }>
		>(`/v1/payment_intents/${encodeURIComponent(id)}`, {
			provider: 'stripe',
			...requestOptions,
		});

		if (!isStripePixPaymentIntent(paymentIntent)) {
			throw new PaymeshError({
				code: 'provider_not_found',
				message: `PIX payment "${id}" was not found on Stripe`,
				provider: 'stripe',
			});
		}

		const normalized = withRaw(
			mapStripePixIntent(paymentIntent),
			paymentIntent,
			true,
		);

		await database.repositories.pix.upsert(schema, normalized);
		await database.repositories.invoices.upsert(schema, normalized);

		return normalized;
	};

	const syncStripeSubscription = async ({
		database,
		id,
		schema,
	}: ProviderDashboardSyncInput) => {
		const subscription = await request<StripeSubscription>(
			`/v1/subscriptions/${encodeURIComponent(id)}`,
			{
				provider: 'stripe',
				...requestOptions,
			},
		);
		const eventType =
			subscription.status === 'canceled'
				? ('subscription.canceled' as const)
				: ('subscription.updated' as const);
		const event = withRaw(
			{
				id,
				provider: 'stripe',
				type: eventType,
				data: withRaw(subscription, subscription, true),
			},
			subscription,
			true,
		);

		await database.repositories.subscriptions.upsert(schema, event);
		return event.data as unknown as Record<string, unknown>;
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
					baseUrl: options?.baseUrl ?? baseUrl,
					timeout: options?.timeout ?? timeout,
					retry: options?.retry ?? retry,
					fetch: options?.fetch ?? fetch,
					method: 'POST',
					headers,
					body,
				});

				return withRaw(
					mapStripePixIntent(paymentIntent),
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
					baseUrl: options?.baseUrl ?? baseUrl,
					timeout: options?.timeout ?? timeout,
					retry: options?.retry ?? retry,
					fetch: options?.fetch ?? fetch,
					headers,
				});

				if (!isStripePixPaymentIntent(paymentIntent)) {
					throw new PaymeshError({
						code: 'provider_not_found',
						message: `PIX payment "${id}" was not found on Stripe`,
						provider: 'stripe',
					});
				}

				return withRaw(
					mapStripePixIntent(paymentIntent),
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
					mapStripeCustomer(customer),
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
					mapStripeCustomer(customer),
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
		dashboard: {
			async getBalance() {
				const balance = await request<StripeBalance>('/v1/balance', {
					provider: 'stripe',
					...requestOptions,
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
			syncPayment: syncStripePayment,
			syncPix: syncStripePix,
			syncSubscription: syncStripeSubscription,
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
						data = withRaw(
							mapStripePaymentObject(payment),
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
