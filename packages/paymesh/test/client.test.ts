import { describe, expect, test } from 'bun:test';
import {
	type Customer,
	createClient,
	defineDatabaseAdapter,
	definePlugin,
	defineProvider,
	type Payment,
	PaymeshError,
	type PluginEventDefinition,
	type ProviderRequestOptions,
	withRaw,
} from '../src';

function expectType<T>(_value: T) {}

describe('client', () => {
	test('merges default request options into provider calls', async () => {
		const calls: Array<ProviderRequestOptions<boolean> | undefined> = [];
		const retry = { max: 1 };
		const fetcher = (async () =>
			Response.json({
				ok: true,
			})) as unknown as typeof fetch;
		const provider = createStubProvider({
			onPaymentCreate(_data, options) {
				calls.push(options);

				return Promise.resolve(
					withRaw(
						{
							id: 'pay_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'paid' as const,
						},
						{
							id: 'raw_pay_123',
						},
						options?.includeRaw,
					),
				);
			},
		});
		const client = createClient({
			provider,
			baseUrl: 'https://api.stub.test',
			timeout: 1234,
			retry,
			fetch: fetcher,
		});

		await client.payments.create({
			amount: 1000,
			currency: 'USD',
			productIds: ['prod_123'],
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			baseUrl: 'https://api.stub.test',
			timeout: 1234,
			retry,
			fetch: fetcher,
			includeRaw: false,
		});
	});

	test('supports raw payloads globally and per call', async () => {
		const provider = createStubProvider();
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPayment = await defaultClient.payments.create({
			amount: 1200,
			currency: 'USD',
			productIds: ['prod_123'],
		});
		const callRawPayment = await defaultClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
				productIds: ['prod_123'],
			},
			{ includeRaw: true },
		);
		const globalRawPayment = await rawClient.payments.create({
			amount: 1200,
			currency: 'USD',
			productIds: ['prod_123'],
		});
		const callNullPayment = await rawClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
				productIds: ['prod_123'],
			},
			{ includeRaw: false },
		);
		const defaultCustomer = await defaultClient.customers.get('cus_123');
		const callRawCustomer = await defaultClient.customers.get('cus_123', {
			includeRaw: true,
		});

		expectType<null>(defaultPayment.raw);
		expectType<unknown>(callRawPayment.raw);
		expectType<unknown>(globalRawPayment.raw);
		expectType<null>(callNullPayment.raw);
		expectType<null>(defaultCustomer.raw);
		expectType<unknown>(callRawCustomer.raw);

		expect(defaultPayment.raw).toBeNull();
		expect(callRawPayment.raw).toMatchObject({ id: 'raw_pay_123' });
		expect(globalRawPayment.raw).toMatchObject({ id: 'raw_pay_123' });
		expect(callNullPayment.raw).toBeNull();
		expect(defaultCustomer.raw).toBeNull();
		expect(callRawCustomer.raw).toMatchObject({ id: 'raw_cus_123' });
	});

	test('lists customers from the configured database with typed extra fields', async () => {
		const database = createListDatabase();
		const client = createClient({
			provider: createStubProvider(),
			database,
			includeRaw: true,
			schema: {
				tables: {
					customers: {
						fields: {
							segment: {
								type: 'string',
								required: true,
							},
						},
					},
				},
			},
		});

		const page = await client.customers.list({ limit: 10 });
		const firstCustomer = page.data[0]!;

		expectType<number>(page.total);
		expectType<string | null>(page.previous);
		expectType<string | null>(page.next);
		expectType<string>(firstCustomer.segment);
		expectType<unknown>(firstCustomer.raw);
		expect(page.data).toHaveLength(2);
		expect(firstCustomer).toMatchObject({
			id: 'cus_1',
			provider: 'stub',
			segment: 'vip',
		});
	});

	test('rejects customers.list without a configured database', async () => {
		const client = createClient({
			provider: createStubProvider(),
		});

		await expect(client.customers.list()).rejects.toMatchObject({
			code: 'unsupported_capability',
			message:
				'Provider "stub" does not support "customers.list" without a configured database',
			provider: 'stub',
		});
	});

	test('checks customer capability before calling the provider', async () => {
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
					customers: false,
				},
				payments: {
					create: async () => {
						throw new Error('should not be called');
					},
				},
				customers: {
					get: async () => {
						throw new Error('should not be called');
					},
					upsert: async () => {
						throw new Error('should not be called');
					},
					delete: async () => {
						throw new Error('should not be called');
					},
				},
			}),
		});

		await expect(client.customers.get('cus_test')).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "stub" does not support "customers" capability',
			provider: 'stub',
		});
		await expect(client.customers.get('cus_test')).rejects.toBeInstanceOf(
			PaymeshError,
		);
	});

	test('checks checkout capability before calling the provider', async () => {
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: false,
					customers: true,
				},
				payments: {
					create: async () => {
						throw new Error('should not be called');
					},
				},
				customers: {
					get: async () => {
						throw new Error('should not be called');
					},
					upsert: async () => {
						throw new Error('should not be called');
					},
					delete: async () => {
						throw new Error('should not be called');
					},
				},
			}),
		});

		await expect(
			client.payments.create({
				amount: 1000,
				currency: 'USD',
			}),
		).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "stub" does not support "checkout" capability',
			provider: 'stub',
		});
		await expect(
			client.payments.create({
				amount: 1000,
				currency: 'USD',
			}),
		).rejects.toBeInstanceOf(PaymeshError);
	});

	test('infers schema extra fields and strips them from provider calls', async () => {
		let paymentInput: Record<string, unknown> | undefined;
		let customerInput: Record<string, unknown> | undefined;
		const schema = {
			tables: {
				customers: {
					fields: {
						first_and_last_name: {
							type: 'string',
							required: true,
						},
					},
				},
				checkouts: {
					fields: {
						campaign: {
							type: 'string',
						},
					},
				},
			},
		} as const;
		const client = createClient({
			provider: createStubProvider({
				onPaymentCreate(data, options) {
					paymentInput = data as Record<string, unknown>;
					return Promise.resolve(
						withRaw(
							{
								id: 'pay_extra',
								provider: 'stub',
								amount: 1200,
								currency: 'usd',
								status: 'paid' as const,
							},
							{ id: 'raw_pay_extra' },
							options?.includeRaw,
						),
					);
				},
				onCustomerUpsert(data, options) {
					customerInput = data as Record<string, unknown>;
					return Promise.resolve(
						withRaw(
							{
								id: 'cus_extra',
								provider: 'stub',
								email: 'ada@example.com',
							},
							{ id: 'raw_cus_extra' },
							options?.includeRaw,
						),
					);
				},
			}),
			schema,
		});
		type CustomerUpsertInput = Parameters<typeof client.customers.upsert>[0];
		const validInput: CustomerUpsertInput = {
			email: 'ada@example.com',
			first_and_last_name: 'Ada Lovelace',
		};
		void validInput;
		// @ts-expect-error first_and_last_name is required by schema
		const invalidInput: CustomerUpsertInput = {
			email: 'ada@example.com',
		};
		void invalidInput;

		const payment = await client.payments.create({
			amount: 1200,
			currency: 'USD',
			campaign: 'summer-launch',
		});
		const customer = await client.customers.upsert({
			email: 'ada@example.com',
			first_and_last_name: 'Ada Lovelace',
		});

		expectType<string | undefined>(payment.campaign);
		expectType<string>(customer.first_and_last_name);
		expect(payment.campaign).toBe('summer-launch');
		expect(customer.first_and_last_name).toBe('Ada Lovelace');
		expect(paymentInput?.campaign).toBeUndefined();
		expect(customerInput?.first_and_last_name).toBeUndefined();
	});

	test('supports plugin routes, events, and client extensions', async () => {
		const redeemedCodes: string[] = [];
		const pluginHooks: string[] = [];
		const plugin = definePlugin({
			id: 'coupons',
			events: {
				onCouponRedeemed: {
					description: 'Triggered when a coupon is redeemed',
				} as PluginEventDefinition<{ code: string }>,
			},
			hooks: {
				onCouponRedeemed(event) {
					expectType<string>(event.data.code);
					pluginHooks.push(event.data.code);
				},
			},
			schema: {
				customTables: {
					redemptions: {
						fields: {
							code: {
								type: 'string',
								required: true,
								unique: true,
							},
						},
					},
				},
			},
			routes: [
				{
					method: 'POST',
					path: '/coupons/redeem',
					async handler(context) {
						expectType<Request>(context.request);
						expectType<typeof context.client.customers.get>(
							context.client.customers.get,
						);
						await context.emit('onCouponRedeemed', {
							code: 'WELCOME10',
						});
						if (false) {
							// @ts-expect-error plugin event payload is strictly typed
							await context.emit('onCouponRedeemed', { code: 10 });
							// @ts-expect-error plugin can only emit its own declared events
							await context.emit('onMissingHook', {
								code: 'WELCOME10',
							});
						}

						return Response.json({ ok: true });
					},
				},
			],
			extends() {
				return {
					coupons: {
						repository: 'available',
					},
					customers: {
						sync() {
							return 'synced';
						},
					},
				};
			},
		});
		const client = createClient({
			provider: createStubProvider(),
			plugins: [plugin] as const,
			hooks: {
				onCouponRedeemed(event) {
					expectType<string>(event.data.code);
					// @ts-expect-error plugin event payload should not accept unknown properties
					expectType<string>(event.data.missing);
					redeemedCodes.push(event.data.code);
				},
			},
		});

		expectType<string>(client.coupons.repository);
		expectType<() => string>(client.customers.sync);
		expect(client.schema.customTables['coupons.redemptions']?.name).toBe(
			'paymesh_coupons_redemptions',
		);
		expect(client.routes.list()).toEqual([
			{
				pluginId: 'coupons',
				method: 'POST',
				path: '/coupons/redeem',
				description: undefined,
			},
		]);
		expect(client.plugins.byId.coupons?.eventHooks).toEqual([
			'onCouponRedeemed',
		]);

		const response = await client.routes.handle(
			new Request('https://app.test/coupons/redeem', { method: 'POST' }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(redeemedCodes).toEqual(['WELCOME10']);
		expect(pluginHooks).toEqual(['WELCOME10']);
		expect(client.customers.sync()).toBe('synced');
	});

	test('tracks async plugin setup state without blocking client creation', async () => {
		let resolveSetup: (() => void) | undefined;
		const client = createClient({
			provider: createStubProvider(),
			plugins: [
				definePlugin({
					id: 'async-plugin',
					setup(context) {
						expectType<typeof context.client.payments.create>(
							context.client.payments.create,
						);
						return new Promise<void>((resolve) => {
							resolveSetup = resolve;
						});
					},
				}),
			] as const,
		});

		expect(client.plugins.byId['async-plugin']?.status).toBe('pending');

		resolveSetup?.();
		await Promise.resolve();
		await Promise.resolve();

		expect(client.plugins.byId['async-plugin']?.status).toBe('ready');
	});
});

function createStubProvider({
	onPaymentCreate,
	onCustomerUpsert,
}: {
	onPaymentCreate?: <IncludeRaw extends boolean = false>(
		data: { amount: number; currency: string },
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Payment<IncludeRaw>>;
	onCustomerUpsert?: <IncludeRaw extends boolean = false>(
		data: Record<string, unknown>,
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Customer<IncludeRaw>>;
} = {}) {
	return defineProvider({
		id: 'stub',
		capabilities: {
			checkout: true,
			customers: true,
		},
		payments: {
			create: onPaymentCreate
				? onPaymentCreate
				: async (_data, options) =>
						withRaw(
							{
								id: 'pay_123',
								provider: 'stub',
								amount: 1200,
								currency: 'usd',
								status: 'paid' as const,
							},
							{
								id: 'raw_pay_123',
							},
							options?.includeRaw,
						),
		},
		customers: {
			get: async (_id, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
					},
					{
						id: 'raw_cus_123',
					},
					options?.includeRaw,
				),
			upsert: onCustomerUpsert
				? onCustomerUpsert
				: async (_data, options) =>
						withRaw(
							{
								id: 'cus_123',
								provider: 'stub',
							},
							{
								id: 'raw_cus_123',
							},
							options?.includeRaw,
						),
			delete: async (_id, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
						deleted: true,
					},
					{
						id: 'raw_cus_123',
					},
					options?.includeRaw,
				),
		},
	});
}

function createListDatabase() {
	const database = defineDatabaseAdapter({
		id: 'mock',
		dialect: 'postgres',
		persistRaw: true,
		repositories: {
			customers: {
				async findByProviderId() {
					return null;
				},
				async list(_schema, _provider, options) {
					return {
						data: [
							withRaw(
								{
									id: 'cus_1',
									provider: 'stub',
									email: 'ada@example.com',
									segment: 'vip',
								},
								{ id: 'raw_cus_1' },
								options?.includeRaw,
							),
							withRaw(
								{
									id: 'cus_2',
									provider: 'stub',
									email: 'grace@example.com',
									segment: 'vip',
								},
								{ id: 'raw_cus_2' },
								options?.includeRaw,
							),
						],
						total: 2,
						previous: null,
						next: null,
					} as never;
				},
				async upsert() {},
				async markDeleted() {},
			},
			checkouts: {
				async findByProviderId() {
					return null;
				},
				async upsert() {},
			},
			invoices: {
				async findByProviderId() {
					return null;
				},
				async upsert() {},
			},
			subscriptions: {
				async findByProviderId() {
					return null;
				},
				async upsert() {},
			},
			webhookEvents: {
				async acquire() {
					return { duplicate: true };
				},
				async markProcessed() {},
				async markFailed() {},
			},
			products: {
				async upsertMany() {},
			},
			prices: {
				async upsertMany() {},
			},
			migrations: {
				async ensureTable() {},
				async listApplied() {
					return [];
				},
				async recordApplied() {},
			},
		},
		async query<Row = unknown>() {
			return [] as Row[];
		},
		async execute() {},
		async transaction(callback) {
			return callback(database);
		},
	});

	return database;
}
