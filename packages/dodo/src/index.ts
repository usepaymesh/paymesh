import {
	type CustomerUpsertData,
	defineProvider,
	type PaymentCreateData,
	PaymeshError,
	type PaymeshEvent,
	type ProviderRequestOptions,
	type ProviderWebhookHandleOptions,
	type ProviderWebhookHandleResult,
	request,
	withRaw,
} from 'paymesh';
import {
	DODO_CAPABILITIES,
	DODO_LIVE_BASE_URL,
	DODO_PIX_METHOD_TYPES,
	DODO_TEST_BASE_URL,
} from './shared/constants';
import {
	mapDodoCatalogPrice,
	mapDodoCatalogProduct,
	mapDodoCustomer,
	mapDodoPayment,
} from './shared/mapper';
import {
	syncDodoCustomer,
	syncDodoPayment,
	syncDodoSubscription,
} from './shared/sync';
import {
	buildDodoCustomerRequest,
	buildDodoProductCart,
	isRecord,
	serializeMetadata,
	verifyDodoWebhookSignature,
} from './shared/utils';
import {
	resolveDodoWebhookData,
	resolveDodoWebhookEventId,
	resolveDodoWebhookHook,
	resolveDodoWebhookType,
} from './shared/webhooks';
import type {
	DodoCustomer,
	DodoPaginatedResponse,
	DodoPayment,
	DodoProductListResponse,
	DodoProviderOptions,
	DodoWebhookPayload,
} from './types';

export type * from './types';

export const dodo = ({
	apiKey = process.env.DODO_PAYMENTS_API_KEY,
	webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_KEY,
	baseUrl = process.env.DODO_PAYMENTS_BASE_URL ?? DODO_LIVE_BASE_URL,
	sandbox,
	retry,
	timeout,
	fetch,
}: DodoProviderOptions = {}) => {
	const resolveProviderSandbox = () =>
		typeof sandbox === 'boolean' ? sandbox : baseUrl === DODO_TEST_BASE_URL;

	const headers = {
		authorization: `Bearer ${apiKey}`,
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
		id: 'dodo',
		isSandbox: resolveProviderSandbox,
		capabilities: DODO_CAPABILITIES,
		payments: {
			async create<IncludeRaw extends boolean = false>(
				data: PaymentCreateData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const customer = buildDodoCustomerRequest({
					customer: data.customer,
					provider: 'dodo',
				});
				const metadata = serializeMetadata(data.metadata);
				const payment = await request<DodoPayment>('/payments', {
					provider: 'dodo',
					...resolveRequestOptions(options),
					method: 'POST',
					body: {
						billing: {
							country: 'BR',
						},
						customer,
						product_cart: buildDodoProductCart({
							amount: data.amount,
							productIds: data.productIds ?? [],
							provider: 'dodo',
						}),
						allowed_payment_method_types:
							data.currency?.toUpperCase() === 'BRL'
								? [...DODO_PIX_METHOD_TYPES]
								: undefined,
						billing_currency: data.currency?.toUpperCase(),
						metadata,
						payment_link: true,
						return_url: data.returnUrl ?? data.successUrl ?? data.cancelUrl,
						show_saved_payment_methods: Boolean(data.customer?.id),
					},
				});

				const normalized = mapDodoPayment(payment, resolveProviderSandbox());
				const result = {
					id: normalized.id,
					provider: normalized.provider,
					sandbox: normalized.sandbox,
					amount: normalized.amount,
					currency: normalized.currency,
					status: normalized.status,
					checkoutUrl: normalized.checkoutUrl,
					customer: normalized.customer,
					metadata: normalized.metadata,
				};

				return withRaw(result, payment, options?.includeRaw);
			},
		},
		customers: {
			async get<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				const customer = await request<DodoCustomer>(
					`/customers/${encodeURIComponent(id)}`,
					{
						provider: 'dodo',
						...resolveRequestOptions(options),
					},
				);

				return withRaw(
					mapDodoCustomer(customer, resolveProviderSandbox()),
					customer,
					options?.includeRaw,
				);
			},
			async upsert<IncludeRaw extends boolean = false>(
				data: CustomerUpsertData,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				if (!data.id && !data.email) {
					throw new PaymeshError({
						code: 'invalid_request',
						message: 'Provider "dodo" requires "email" when creating customers',
						provider: 'dodo',
					});
				}

				const metadata = serializeMetadata({
					...data.metadata,
					...(data.externalId ? { externalId: data.externalId } : {}),
				});

				const customer = await request<DodoCustomer>(
					data.id ? `/customers/${encodeURIComponent(data.id)}` : '/customers',
					{
						provider: 'dodo',
						...resolveRequestOptions(options),
						method: data.id ? 'PATCH' : 'POST',
						body: data.id
							? {
									email: data.email,
									name: data.name,
									phone_number: data.phone,
									metadata,
								}
							: {
									email: data.email,
									name: data.name ?? data.email!,
									phone_number: data.phone,
									metadata,
								},
					},
				);

				return withRaw(
					mapDodoCustomer(customer, resolveProviderSandbox()),
					customer,
					options?.includeRaw,
				);
			},
			async delete<IncludeRaw extends boolean = false>(
				id: string,
				options?: ProviderRequestOptions<IncludeRaw>,
			) {
				throw new PaymeshError({
					code: 'unsupported_capability',
					message: 'Provider "dodo" does not support deleting customers.',
					provider: 'dodo',
					cause: { id, includeRaw: options?.includeRaw },
				});
			},
		},
		catalog: {
			async list() {
				const response = await request<
					DodoPaginatedResponse<DodoProductListResponse>
				>('/products', {
					provider: 'dodo',
					...baseRequestOptions,
					query: {
						page_size: 100,
					},
				});
				const products = response.items ?? response.data ?? [];

				return {
					products: products.map((product) =>
						mapDodoCatalogProduct(product, resolveProviderSandbox()),
					),
					prices: products
						.filter(
							(product) =>
								typeof product.price === 'number' ||
								typeof product.price_detail?.price === 'number',
						)
						.map((product) =>
							mapDodoCatalogPrice(product, resolveProviderSandbox()),
						),
				};
			},
		},
		dashboard: {
			getResourceUrl() {
				return null;
			},
			syncCustomer: (input) =>
				syncDodoCustomer({
					...input,
					requestOptions: baseRequestOptions,
					sandbox: resolveProviderSandbox(),
				}),
			syncPayment: (input) =>
				syncDodoPayment({
					...input,
					requestOptions: baseRequestOptions,
					sandbox: resolveProviderSandbox(),
				}),
			syncSubscription: (input) =>
				syncDodoSubscription({
					...input,
					requestOptions: baseRequestOptions,
					sandbox: resolveProviderSandbox(),
				}),
		},
		webhooks: {
			async verify({ request }) {
				const payload = await request.text();
				return verifyDodoWebhookSignature({
					headers: request.headers,
					payload,
					secret: webhookSecret,
				});
			},
			async handle<IncludeRaw extends boolean = false>(
				options: ProviderWebhookHandleOptions<IncludeRaw>,
			): Promise<ProviderWebhookHandleResult<IncludeRaw>> {
				const { request: incoming, includeRaw = false } = options;
				const payload = await incoming.text();

				let event: DodoWebhookPayload;

				try {
					event = JSON.parse(payload) as DodoWebhookPayload;
				} catch (error) {
					throw new PaymeshError({
						code: 'webhook_parse_error',
						message: 'Dodo webhook payload must be valid JSON.',
						provider: 'dodo',
						cause: error,
					});
				}

				if (!isRecord(event) || typeof event.type !== 'string') {
					throw new TypeError('Dodo webhook payload must be a JSON object.');
				}

				const type = resolveDodoWebhookType(event.type);
				const hook = resolveDodoWebhookHook(type);
				const data = resolveDodoWebhookData(
					event,
					type,
					includeRaw,
					resolveProviderSandbox(),
				);
				const id = resolveDodoWebhookEventId(event);

				return {
					deliveryId: incoming.headers.get('webhook-id') ?? undefined,
					hook,
					event: withRaw(
						{
							id,
							type,
							provider: 'dodo',
							sandbox: resolveProviderSandbox(),
							data,
						},
						event,
						includeRaw,
					) as PaymeshEvent<unknown, IncludeRaw>,
				};
			},
		},
	});
};
