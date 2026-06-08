import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type CustomerUpsertData,
	defineProvider,
	type Payment,
	type PaymentCreateData,
	PaymeshError,
	type PaymeshEvent,
	type ProviderRequestOptions,
	type ProviderWebhookHandleOptions,
	type ProviderWebhookHandleResult,
	request,
	withRaw,
} from 'paymesh';
import { readPolarProducts, readVersion } from './shared/catalog';
import { POLAR_BASE_URL, POLAR_CAPABILITIES } from './shared/constants';
import { mapPolarCustomer } from './shared/mapper';
import { syncPolarPayment, syncPolarSubscription } from './shared/sync';
import {
	resolvePolarWebhookData,
	resolvePolarWebhookHook,
	resolvePolarWebhookId,
	resolvePolarWebhookType,
} from './shared/webhooks';
import type {
	PolarCheckout,
	PolarCustomer,
	PolarProductListResponse,
	PolarProviderOptions,
	PolarWebhookEvent,
} from './types';

export type * from './types';

/**
 * Creates a Polar provider configured for Paymesh.
 *
 * @example
 * ```ts
 * export const provider = polar({
 *   accessToken: process.env.POLAR_ACCESS_TOKEN,
 *   webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
 * });
 * ```
 */
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
					...resolveRequestOptions(options),
					method: 'POST',
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

				return withRaw(
					{
						id: checkout.id,
						provider: 'polar',
						amount: checkout.total_amount ?? checkout.amount ?? 0,
						currency: checkout.currency ?? 'usd',
						status:
							checkout.status === 'succeeded'
								? 'paid'
								: checkout.status === 'expired'
									? 'canceled'
									: checkout.status === 'failed'
										? 'failed'
										: 'pending',
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
						...resolveRequestOptions(options),
						method: data.id ? 'PATCH' : 'POST',
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
						...resolveRequestOptions(options),
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
					...resolveRequestOptions(options),
					method: 'DELETE',
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
						...baseRequestOptions,
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
		dashboard: {
			async getBalance() {
				return null;
			},
			getResourceUrl() {
				return 'https://polar.sh/dashboard';
			},
			syncPayment: (input) =>
				syncPolarPayment({
					...input,
					requestOptions: baseRequestOptions,
				}),
			syncSubscription: (input) =>
				syncPolarSubscription({
					...input,
					requestOptions: baseRequestOptions,
				}),
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
				const { request, includeRaw = false } = options;

				const payload = await request.json();
				const webhookId = request.headers.get('webhook-id');

				if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
					throw new TypeError('Polar webhook payload must be a JSON object.');
				}

				const body = payload as Record<string, unknown>;
				const event = body as unknown as PolarWebhookEvent;
				const type = resolvePolarWebhookType(event);
				const data = resolvePolarWebhookData(type, event, includeRaw);
				const id = resolvePolarWebhookId(event);
				const hook = resolvePolarWebhookHook(type);

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
