import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type CustomerCreateData,
	type CustomerUpdateData,
	defineProvider,
	type Payment,
	type PaymentCreateData,
	type PaymentStatus,
	PaymeshError,
	type PaymeshEvent,
	type PaymeshEventType,
	type ProviderCapabilities,
	type ProviderRequestOptions,
	type ProviderWebhookMapOptions,
	request,
	withRaw,
} from 'paymesh';
import type {
	PolarCheckout,
	PolarCustomer,
	PolarOrder,
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
			async create<IncludeRaw extends boolean = false>(
				data: CustomerCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				if (!data.email) {
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

				const customer = await request<PolarCustomer>('/v1/customers', {
					provider: 'polar',
					baseUrl: options?.baseUrl ?? baseUrl,
					timeout: options?.timeout ?? timeout,
					retry: options?.retry ?? retry,
					fetch: options?.fetch ?? fetch,
					method: 'POST',
					headers,
					body: {
						email: data.email,
						name: data.name,
						external_id: data.externalId,
						metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
					},
				});

				return withRaw(
					{
						id: customer.id,
						provider: 'polar',
						externalId: customer.external_id ?? undefined,
						name: customer.name ?? undefined,
						email: customer.email ?? undefined,
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
					{
						id: customer.id,
						provider: 'polar',
						externalId: customer.external_id ?? undefined,
						name: customer.name ?? undefined,
						email: customer.email ?? undefined,
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
				const metadata = Object.fromEntries(
					Object.entries(data.metadata ?? {}).filter(
						([, value]) => value !== null,
					),
				);

				const customer = await request<PolarCustomer>(
					`/v1/customers/${encodeURIComponent(id)}`,
					{
						provider: 'polar',
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						method: 'PATCH',
						headers,
						body: {
							email: data.email,
							name: data.name,
							metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
						},
					},
				);

				return withRaw(
					{
						id: customer.id,
						provider: 'polar',
						externalId: customer.external_id ?? undefined,
						name: customer.name ?? undefined,
						email: customer.email ?? undefined,
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
			async parse(request) {
				const payload = await request.json();

				if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
					throw new TypeError('Polar webhook payload must be a JSON object.');
				}

				return payload as Record<string, unknown>;
			},
			map<IncludeRaw extends boolean = false>(
				body: Record<string, unknown>,
				options?: ProviderWebhookMapOptions<IncludeRaw>,
			): PaymeshEvent<unknown, IncludeRaw> {
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
							options?.includeRaw,
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
							options?.includeRaw,
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
						options?.includeRaw,
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
						options?.includeRaw,
					);
				} else if (
					type === 'subscription.created' ||
					type === 'subscription.updated' ||
					type === 'subscription.canceled'
				) {
					const subscription = event.data as PolarSubscription;
					data = withRaw(subscription, subscription, options?.includeRaw);
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

				return withRaw(
					{
						id,
						type,
						provider: 'polar',
						data,
					},
					body,
					options?.includeRaw,
				);
			},
			hook(event) {
				switch (event.type) {
					case 'payment.created':
						return 'onPaymentCreated';
					case 'payment.succeeded':
						return 'onPaymentSucceeded';
					case 'payment.failed':
						return 'onPaymentFailed';
					case 'payment.canceled':
						return 'onPaymentCanceled';
					case 'payment.refunded':
						return 'onPaymentRefunded';
					case 'customer.created':
						return 'onCustomerCreated';
					case 'customer.updated':
						return 'onCustomerUpdated';
					case 'customer.deleted':
						return 'onCustomerDeleted';
					case 'subscription.created':
						return 'onSubscriptionCreated';
					case 'subscription.updated':
						return 'onSubscriptionUpdated';
					case 'subscription.canceled':
						return 'onSubscriptionCanceled';
					case 'checkout.completed':
						return 'onCheckoutCompleted';
				}
			},
		},
	});
};
