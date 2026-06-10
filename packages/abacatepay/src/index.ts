import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	type CustomerUpsertData,
	defineProvider,
	type PaymentCreateData,
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
	ABACATEPAY_BASE_URL,
	ABACATEPAY_CAPABILITIES,
	ABACATEPAY_EVENTS,
	ABACATEPAY_HOOKS,
	ABACATEPAY_PAYMENT_STATUSES,
	ABACATEPAY_PUBLIC_HMAC_KEY,
	SANDBOXED_API_KEY_PREFIX,
} from './shared/constants';
import { extractData } from './shared/data';
import {
	mapAbacatePayCheckout,
	mapAbacatePayCustomer,
	mapAbacatePayTransparentCharge,
} from './shared/mapper';
import type {
	AbacatePayCheckout,
	AbacatePayCustomer,
	AbacatePayProduct,
	AbacatePayProviderOptions,
	AbacatePayResponse,
	AbacatePayTransparentCharge,
	AbacatePayWebhookEvent,
} from './types';

export type * from './types';

export const abacatepay = ({
	retry,
	fetch,
	timeout,
	baseUrl = ABACATEPAY_BASE_URL,
	apiKey = process.env.ABACATEPAY_API_KEY,
	webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET,
	sandbox = apiKey?.startsWith(SANDBOXED_API_KEY_PREFIX) ?? false,
}: AbacatePayProviderOptions = {}) => {
	const baseRequestOptions = {
		baseUrl,
		fetch,
		headers: {
			authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json',
		},
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
		id: 'abacatepay',
		isSandbox: () => sandbox,
		capabilities: ABACATEPAY_CAPABILITIES,
		payments: {
			async create<IncludeRaw extends boolean = false>(
				data: PaymentCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				if (!data.productIds?.length) {
					throw new PaymeshError({
						code: 'invalid_request',
						message:
							'AbacatePay requires at least one product ID. Pass productIds when creating a payment.',
						provider: 'abacatepay',
					});
				}

				const body = {
					items: data.productIds.map((id) => ({ id, quantity: 1 })),
					methods: ['PIX', 'CARD'],
					...(data.customer?.id && { customerId: data.customer.id }),
					...(data.metadata?.externalId && {
						externalId: String(data.metadata.externalId),
					}),
					...(data.successUrl && { completionUrl: data.successUrl }),
					...(data.returnUrl && { returnUrl: data.returnUrl }),
					...(data.metadata && { metadata: data.metadata }),
				};

				const response = await request<AbacatePayResponse<AbacatePayCheckout>>(
					'/v2/checkouts/create',
					{
						provider: 'abacatepay',
						...resolveRequestOptions(options),
						method: 'POST',
						body,
					},
				);

				const checkout = extractData(response);

				return withRaw(
					{
						id: checkout.id,
						provider: 'abacatepay',
						sandbox,
						amount: checkout.amount,
						currency: 'BRL',
						checkoutUrl: checkout.url,
						customer: checkout.customerId
							? { id: checkout.customerId }
							: undefined,
						metadata: checkout.externalId
							? { externalId: checkout.externalId }
							: undefined,
						status:
							ABACATEPAY_PAYMENT_STATUSES[checkout.status ?? ''] ?? 'pending',
					},
					checkout,
					options?.includeRaw,
				);
			},
		},
		pix: {
			async create<IncludeRaw extends boolean = false>(
				data: PixCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const body = {
					method: 'PIX',
					data: {
						amount: data.amount,
						...(data.description && { description: data.description }),
						...(data.pix?.expiresAfterSeconds && {
							expiresIn: data.pix.expiresAfterSeconds,
						}),
						...(data.customer?.id && { customerId: data.customer.id }),
						...(data.metadata?.externalId && {
							externalId: String(data.metadata.externalId),
						}),
						...(data.metadata && { metadata: data.metadata }),
					},
				};

				const response = await request<
					AbacatePayResponse<AbacatePayTransparentCharge>
				>('/v2/transparents/create', {
					provider: 'abacatepay',
					...resolveRequestOptions(options),
					method: 'POST',
					body,
				});

				const charge = extractData(response);

				return withRaw(
					mapAbacatePayTransparentCharge(charge, sandbox),
					charge,
					options?.includeRaw,
				);
			},
			async get<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const response = await request<
					AbacatePayResponse<AbacatePayTransparentCharge>
				>(`/v2/transparents/get?id=${encodeURIComponent(id)}`, {
					provider: 'abacatepay',
					...resolveRequestOptions(options),
				});

				const charge = extractData(response);

				return withRaw(
					mapAbacatePayTransparentCharge(charge, sandbox),
					charge,
					options?.includeRaw,
				);
			},
		},
		customers: {
			async get<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const response = await request<AbacatePayResponse<AbacatePayCustomer>>(
					`/v2/customers/get?id=${encodeURIComponent(id)}`,
					{
						provider: 'abacatepay',
						...resolveRequestOptions(options),
					},
				);

				const customer = extractData(response);

				return withRaw(
					mapAbacatePayCustomer(customer, sandbox),
					customer,
					options?.includeRaw,
				);
			},
			async upsert<IncludeRaw extends boolean = false>(
				data: CustomerUpsertData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const body = {
					...(data.email && { email: data.email }),
					...(data.name && { name: data.name }),
					...(data.phone && { cellphone: data.phone }),
					...(data.metadata && { metadata: data.metadata }),
				};

				const response = await request<AbacatePayResponse<AbacatePayCustomer>>(
					'/v2/customers/create',
					{
						provider: 'abacatepay',
						...resolveRequestOptions(options),
						method: 'POST',
						body,
					},
				);

				const customer = extractData(response);

				return withRaw(
					mapAbacatePayCustomer(customer, sandbox),
					customer,
					options?.includeRaw,
				);
			},
			async delete<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				await request<AbacatePayResponse<null>>(
					`/v2/customers/delete?id=${encodeURIComponent(id)}`,
					{
						provider: 'abacatepay',
						...resolveRequestOptions(options),
						method: 'POST',
					},
				);

				return withRaw(
					{
						id,
						provider: 'abacatepay',
						sandbox,
						deleted: true,
					},
					null,
					options?.includeRaw,
				);
			},
		},
		catalog: {
			async list() {
				const response = await request<AbacatePayResponse<AbacatePayProduct[]>>(
					'/v2/products',
					{
						provider: 'abacatepay',
						...baseRequestOptions,
					},
				);

				const products = extractData(response);

				return {
					products: products.map((product) => ({
						id: product.id,
						sandbox,
						name: product.name,
						description: product.description ?? undefined,
						active: product.active ?? true,
						metadata: undefined,
						version: undefined,
						raw: product,
					})),
					prices: products
						.filter((p) => typeof p.price === 'number')
						.map((product) => ({
							id: `${product.id}_price`,
							sandbox,
							productId: product.id,
							active: product.active ?? true,
							type: 'one_time' as const,
							currency: product.currency ?? 'BRL',
							amount: product.price,
							interval: undefined,
							intervalCount: undefined,
							metadata: undefined,
							version: undefined,
							raw: product,
						})),
				};
			},
		},
		webhooks: {
			async verify({ request: req }) {
				if (!webhookSecret) return false;

				const signature = req.headers.get('x-webhook-signature');

				if (!signature) return false;

				const url = new URL(req.url);

				if (url.searchParams.get('webhookSecret') !== webhookSecret)
					return false;

				const body = await req.text();

				const actual = createHmac('sha256', ABACATEPAY_PUBLIC_HMAC_KEY)
					.update(Buffer.from(body, 'utf8'))
					.digest('base64');

				return (
					actual.length === signature.length &&
					timingSafeEqual(Buffer.from(actual), Buffer.from(signature))
				);
			},
			async handle<IncludeRaw extends boolean = false>(
				options: ProviderWebhookHandleOptions<IncludeRaw>,
			): Promise<ProviderWebhookHandleResult<IncludeRaw>> {
				const { request: req, includeRaw } = options;

				const payload = await req.json();

				if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
					throw new TypeError(
						'AbacatePay webhook payload must be a JSON object.',
					);
				}

				const event = payload as AbacatePayWebhookEvent;
				const type = ABACATEPAY_EVENTS[event.event] ?? 'payment.created';

				const eventSandbox =
					typeof event.devMode === 'boolean' ? event.devMode : sandbox;

				let data: unknown = event.data;

				if (type === 'customer.created' || type === 'customer.updated') {
					const customer = event.data?.customer as
						| AbacatePayCustomer
						| undefined;
					if (customer) {
						data = withRaw(
							mapAbacatePayCustomer(customer, eventSandbox),
							customer,
							includeRaw,
						);
					}
				} else if (
					event.event.startsWith('checkout.') ||
					event.event.startsWith('transparent.')
				) {
					const checkout = event.data?.checkout as
						| AbacatePayCheckout
						| undefined;
					const transparent = event.data?.transparent as
						| AbacatePayTransparentCharge
						| undefined;

					if (checkout) {
						data = withRaw(
							mapAbacatePayCheckout(checkout, eventSandbox),
							checkout,
							includeRaw,
						);
					} else if (transparent) {
						data = withRaw(
							mapAbacatePayTransparentCharge(transparent, eventSandbox),
							transparent,
							includeRaw,
						);
					}
				}

				return {
					deliveryId: event.id,
					hook: ABACATEPAY_HOOKS[type],
					event: withRaw(
						{
							id: event.id,
							type,
							provider: 'abacatepay',
							sandbox: eventSandbox,
							data,
						},
						payload,
						includeRaw,
					) as PaymeshEvent<unknown, IncludeRaw>,
				};
			},
		},
	});
};
