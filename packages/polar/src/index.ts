import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type CustomerUpsertData,
	defineProvider,
	type Payment,
	type PaymentCreateData,
	type PaymentStatus,
	PaymeshError,
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
	PolarCheckout,
	PolarCustomer,
	PolarOrder,
	PolarProduct,
	PolarProductListResponse,
	PolarProviderOptions,
	PolarSubscription,
	PolarWebhookEvent,
} from './types';

export type * from './types';

const POLAR_BASE_URL = 'https://api.polar.sh';

const POLAR_CAPABILITIES = {
	checkout: true,
	coupons: true,
	pix: false,
	refunds: true,
	subscriptions: true,
	webhooks: true,
	customerPortal: true,
	customers: true,
} satisfies ProviderCapabilities;

function mapPolarCustomer(customer: PolarCustomer) {
	return {
		id: customer.id,
		provider: 'polar' as const,
		externalId: customer.external_id ?? undefined,
		name: customer.name ?? undefined,
		email: customer.email ?? undefined,
		metadata: customer.metadata ?? undefined,
	};
}

export const polar = ({
	accessToken = process.env.POLAR_ACCESS_TOKEN,
	webhookSecret = process.env.POLAR_WEBHOOK_SECRET,
	baseUrl = POLAR_BASE_URL,
	retry,
	timeout,
	fetch,
}: PolarProviderOptions = {}) => {
	const headers = {
		authorization: `Bearer ${accessToken}`,
		'content-type': 'application/json',
	};

	return defineProvider({
		id: 'polar',
		capabilities: POLAR_CAPABILITIES,
		payments: {
			async create<IncludeRaw extends boolean = false>(
				data: PaymentCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			): Promise<Payment<IncludeRaw>> {
				if (!data.productIds || data.productIds.length === 0) {
					throw new PaymeshError({
						code: 'invalid_request',
						message:
							'Provider "polar" requires at least one product id in "productIds"',
						provider: 'polar',
					});
				}

				const metadata = Object.fromEntries(
					Object.entries(data.metadata ?? {}).filter(
						([, value]) => value !== null,
					),
				);

				const checkout = await request<PolarCheckout>('/v1/checkouts', {
					provider: 'polar',
					baseUrl: options?.baseUrl ?? baseUrl,
					timeout: options?.timeout ?? timeout,
					retry: options?.retry ?? retry,
					fetch: options?.fetch ?? fetch,
					method: 'POST',
					headers,
					body: {
						products: data.productIds,
						amount: data.amount,
						currency: data.currency.toLowerCase(),
						customer_id: data.customer?.id,
						external_customer_id: data.customer?.externalId,
						customer_name: data.customer?.name,
						customer_email: data.customer?.email,
						metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
						success_url: data.successUrl,
						return_url: data.returnUrl ?? data.cancelUrl,
					},
				});

				let status: PaymentStatus = 'pending';
				if (checkout.status === 'succeeded') status = 'paid';
				if (checkout.status === 'expired') status = 'canceled';
				if (checkout.status === 'failed') status = 'failed';

				return withRaw(
					{
						id: checkout.id,
						provider: 'polar',
						amount: checkout.total_amount ?? checkout.amount ?? 0,
						currency: checkout.currency ?? 'usd',
						status,
						checkoutUrl: checkout.url ?? undefined,
						customer:
							checkout.customer_id != null ||
							checkout.external_customer_id != null ||
							checkout.customer_name != null ||
							checkout.customer_email != null
								? {
										id: checkout.customer_id ?? undefined,
										externalId: checkout.external_customer_id ?? undefined,
										name: checkout.customer_name ?? undefined,
										email: checkout.customer_email ?? undefined,
									}
								: undefined,
						metadata: checkout.metadata ?? undefined,
					},
					checkout,
					options?.includeRaw,
				);
			},
		},
		customers: {
			async upsert<IncludeRaw extends boolean = false>(
				data: CustomerUpsertData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				if (!data.id && !data.email) {
					throw new PaymeshError({
						code: 'invalid_request',
						message:
							'Provider "polar" requires "email" when creating customers',
						provider: 'polar',
					});
				}

				const metadata = Object.fromEntries(
					Object.entries(data.metadata ?? {}).filter(
						([, value]) => value !== null,
					),
				);

				const customer = await request<PolarCustomer>(
					data.id
						? `/v1/customers/${encodeURIComponent(data.id)}`
						: '/v1/customers',
					{
						provider: 'polar',
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						method: data.id ? 'PATCH' : 'POST',
						headers,
						body: data.id
							? {
									email: data.email,
									name: data.name,
									metadata:
										Object.keys(metadata).length > 0 ? metadata : undefined,
								}
							: {
									email: data.email,
									name: data.name,
									external_id: data.externalId,
									metadata:
										Object.keys(metadata).length > 0 ? metadata : undefined,
								},
					},
				);

				return withRaw(
					mapPolarCustomer(customer),
					customer,
					options?.includeRaw,
				);
			},
			async get<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const customer = await request<PolarCustomer>(
					`/v1/customers/${encodeURIComponent(id)}`,
					{
						provider: 'polar',
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						headers,
					},
				);

				return withRaw(
					mapPolarCustomer(customer),
					customer,
					options?.includeRaw,
				);
			},
			async delete<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				await request<void>(`/v1/customers/${encodeURIComponent(id)}`, {
					provider: 'polar',
					baseUrl: options?.baseUrl ?? baseUrl,
					timeout: options?.timeout ?? timeout,
					retry: options?.retry ?? retry,
					fetch: options?.fetch ?? fetch,
					method: 'DELETE',
					headers: {
						authorization: `Bearer ${accessToken}`,
					},
				});

				return withRaw(
					{
						id,
						provider: 'polar',
						deleted: true,
					},
					{ id, deleted: true },
					options?.includeRaw,
				);
			},
		},
		catalog: {
			async list() {
				const response = await request<PolarProductListResponse>(
					'/v1/products',
					{
						provider: 'polar',
						baseUrl,
						timeout,
						retry,
						fetch,
						headers,
						query: {
							limit: 100,
						},
					},
				);
				const products = readPolarProducts(response);

				return {
					products: products.map((product) => ({
						id: product.id,
						name: product.name,
						description: product.description ?? undefined,
						active: !product.is_archived,
						metadata: product.metadata ?? undefined,
						version: readVersion(product.metadata),
						raw: product,
					})),
					prices: products.flatMap((product) =>
						(product.prices ?? []).map((price) => ({
							id: price.id,
							productId: product.id,
							active: !product.is_archived,
							type:
								price.type ?? (product.is_recurring ? 'recurring' : 'one_time'),
							currency: price.price_currency ?? undefined,
							amount: price.price_amount ?? undefined,
							interval: product.recurring_interval ?? undefined,
							intervalCount: product.recurring_interval_count ?? undefined,
							metadata: price.metadata ?? undefined,
							version:
								readVersion(price.metadata) ?? readVersion(product.metadata),
							raw: {
								product,
								price,
							},
						})),
					),
				};
			},
		},
		webhooks: {
			async verify({ request }) {
				if (!webhookSecret) return false;

				const webhookId = request.headers.get('webhook-id');
				const timestamp = request.headers.get('webhook-timestamp');
				const signatureHeader = request.headers.get('webhook-signature');

				if (!webhookId || !timestamp || !signatureHeader) return false;

				const secret = webhookSecret.startsWith('whsec_')
					? Buffer.from(webhookSecret.slice('whsec_'.length), 'base64')
					: Buffer.from(webhookSecret);
				const payload = await request.text();
				const actual = createHmac('sha256', secret)
					.update(`${webhookId}.${timestamp}.${payload}`)
					.digest('base64');

				for (const part of signatureHeader.split(/\s+/)) {
					const [version, expected] = part.trim().split(',', 2);
					if (version !== 'v1' || !expected) continue;
					if (
						actual.length === expected.length &&
						timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
					) {
						return true;
					}
				}

				return false;
			},
			async handle<IncludeRaw extends boolean = false>(
				options: ProviderWebhookHandleOptions<IncludeRaw>,
			): Promise<ProviderWebhookHandleResult<IncludeRaw>> {
				const { request, includeRaw } = options;
				const payload = await request.json();
				const webhookId = request.headers.get('webhook-id');

				if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
					throw new TypeError('Polar webhook payload must be a JSON object.');
				}

				const body = payload as Record<string, unknown>;
				const event = body as unknown as PolarWebhookEvent;
				let type: PaymeshEventType = 'payment.created';

				switch (event.type) {
					case 'checkout.created':
						type = 'payment.created';
						break;
					case 'checkout.updated': {
						const checkout = event.data as PolarCheckout;
						type =
							checkout.status === 'succeeded'
								? 'checkout.completed'
								: checkout.status === 'expired'
									? 'payment.canceled'
									: 'payment.created';
						break;
					}
					case 'order.created':
						type = 'payment.created';
						break;
					case 'order.paid':
						type = 'payment.succeeded';
						break;
					case 'order.refunded':
						type = 'payment.refunded';
						break;
					case 'customer.created':
						type = 'customer.created';
						break;
					case 'customer.updated':
					case 'customer.state_changed':
						type = 'customer.updated';
						break;
					case 'customer.deleted':
						type = 'customer.deleted';
						break;
					case 'subscription.created':
						type = 'subscription.created';
						break;
					case 'subscription.canceled':
					case 'subscription.revoked':
						type = 'subscription.canceled';
						break;
					case 'subscription.updated': {
						const subscription = event.data as PolarSubscription;
						type =
							subscription.canceled_at || subscription.ended_at
								? 'subscription.canceled'
								: 'subscription.updated';
						break;
					}
				}

				let data: unknown = event.data;

				if (
					type === 'checkout.completed' ||
					type === 'payment.created' ||
					type === 'payment.succeeded' ||
					type === 'payment.refunded' ||
					type === 'payment.canceled'
				) {
					if ('status' in (event.data as PolarCheckout)) {
						const checkout = event.data as PolarCheckout;
						let status: PaymentStatus = 'pending';
						if (checkout.status === 'succeeded') status = 'paid';
						if (checkout.status === 'expired') status = 'canceled';
						if (checkout.status === 'failed') status = 'failed';

						data = withRaw(
							{
								id: checkout.id,
								provider: 'polar',
								amount: checkout.total_amount ?? checkout.amount ?? 0,
								currency: checkout.currency ?? 'usd',
								status,
								checkoutUrl: checkout.url ?? undefined,
								customer:
									checkout.customer_id != null ||
									checkout.external_customer_id != null ||
									checkout.customer_name != null ||
									checkout.customer_email != null
										? {
												id: checkout.customer_id ?? undefined,
												externalId: checkout.external_customer_id ?? undefined,
												name: checkout.customer_name ?? undefined,
												email: checkout.customer_email ?? undefined,
											}
										: undefined,
								metadata: checkout.metadata ?? undefined,
							},
							checkout,
							includeRaw,
						);
					} else {
						const order = event.data as PolarOrder;
						const status: PaymentStatus =
							type === 'payment.succeeded'
								? 'paid'
								: type === 'payment.refunded'
									? 'refunded'
									: type === 'payment.canceled'
										? 'canceled'
										: order.paid
											? 'paid'
											: 'pending';

						data = withRaw(
							{
								id: order.id,
								provider: 'polar',
								amount: order.total_amount ?? 0,
								currency: order.currency ?? 'usd',
								status,
								customer: order.customer
									? {
											id: order.customer.id,
											externalId: order.customer.external_id ?? undefined,
											name: order.customer.name ?? undefined,
											email: order.customer.email ?? undefined,
										}
									: order.customer_id
										? { id: order.customer_id }
										: undefined,
								metadata: order.metadata ?? undefined,
							},
							order,
							includeRaw,
						);
					}
				} else if (type === 'customer.created' || type === 'customer.updated') {
					const customer = event.data as PolarCustomer;

					data = withRaw(
						{
							id: customer.id,
							provider: 'polar',
							externalId: customer.external_id ?? undefined,
							name: customer.name ?? undefined,
							email: customer.email ?? undefined,
							metadata: customer.metadata ?? undefined,
						},
						customer,
						includeRaw,
					);
				} else if (type === 'customer.deleted') {
					const customer = event.data as PolarCustomer;

					data = withRaw(
						{
							id: customer.id,
							provider: 'polar',
							deleted: true,
						},
						customer,
						includeRaw,
					);
				} else if (
					type === 'subscription.created' ||
					type === 'subscription.updated' ||
					type === 'subscription.canceled'
				) {
					const subscription = event.data as PolarSubscription;
					data = withRaw(subscription, subscription, includeRaw);
				}

				let id = `${event.type}:${event.timestamp}`;
				if (
					event.data &&
					typeof event.data === 'object' &&
					'id' in event.data &&
					typeof event.data.id === 'string'
				) {
					id = event.data.id;
				}

				let hook: string | undefined;

				switch (type) {
					case 'payment.created':
						hook = 'onPaymentCreated';
						break;
					case 'payment.succeeded':
						hook = 'onPaymentSucceeded';
						break;
					case 'payment.canceled':
						hook = 'onPaymentCanceled';
						break;
					case 'payment.refunded':
						hook = 'onPaymentRefunded';
						break;
					case 'customer.created':
						hook = 'onCustomerCreated';
						break;
					case 'customer.updated':
						hook = 'onCustomerUpdated';
						break;
					case 'customer.deleted':
						hook = 'onCustomerDeleted';
						break;
					case 'subscription.created':
						hook = 'onSubscriptionCreated';
						break;
					case 'subscription.updated':
						hook = 'onSubscriptionUpdated';
						break;
					case 'subscription.canceled':
						hook = 'onSubscriptionCanceled';
						break;
					case 'checkout.completed':
						hook = 'onCheckoutCompleted';
						break;
				}

				return {
					deliveryId: webhookId ?? undefined,
					hook,
					event: withRaw(
						{
							id,
							type,
							provider: 'polar',
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

function readPolarProducts(response: PolarProductListResponse) {
	if (Array.isArray(response)) return response;
	if (Array.isArray(response.items)) return response.items;
	if (Array.isArray(response.data)) return response.data;
	if (Array.isArray(response.result)) return response.result;
	return [];
}

function readVersion(metadata: PolarProduct['metadata']) {
	const version = metadata?.version;
	return typeof version === 'string' && version.length > 0
		? version
		: undefined;
}
