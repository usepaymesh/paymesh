import { describe, expect, test } from 'bun:test';
import {
	type Customer,
	createClient,
	defineDatabaseAdapter,
	definePlugin,
	defineProvider,
	event,
	lazy,
	type Payment,
	PaymeshError,
	type Pix,
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
							sandbox: false,
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

	test('supports raw PIX payloads globally and per call', async () => {
		const provider = createStubProvider();
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPix = await defaultClient.pix.create({
			amount: 2200,
			currency: 'BRL',
		});
		const callRawPix = await defaultClient.pix.create(
			{
				amount: 2200,
				currency: 'BRL',
			},
			{ includeRaw: true },
		);
		const globalRawPix = await rawClient.pix.get('pix_123');
		const callNullPix = await rawClient.pix.get('pix_123', {
			includeRaw: false,
		});

		expectType<null>(defaultPix.raw);
		expectType<unknown>(callRawPix.raw);
		expectType<unknown>(globalRawPix.raw);
		expectType<null>(callNullPix.raw);

		expect(defaultPix.raw).toBeNull();
		expect(callRawPix.raw).toMatchObject({ id: 'raw_pix_123' });
		expect(globalRawPix.raw).toMatchObject({ id: 'raw_pix_123' });
		expect(callNullPix.raw).toBeNull();
		expect(defaultPix.method).toBe('pix');
	});

	test('delegates client.isSandbox() to the provider', () => {
		const client = createClient({
			provider: createStubProvider({ sandbox: true }),
		});

		expect(client.isSandbox()).toBe(true);
		expect(client.provider.isSandbox()).toBe(true);
	});

	test('rejects createClient sandbox mismatch', () => {
		expect(() =>
			createClient({
				provider: createStubProvider({ sandbox: false }),
				sandbox: true,
			}),
		).toThrow(
			new PaymeshError({
				code: 'invalid_request',
				message:
					'Client sandbox option (true) does not match provider "stub" sandbox mode (false).',
				provider: 'stub',
			}),
		);
	});

	test('rejects createClient when sandbox:false but provider is sandbox', () => {
		expect(() =>
			createClient({
				provider: createStubProvider({ sandbox: true }),
				sandbox: false,
			}),
		).toThrow(
			new PaymeshError({
				code: 'invalid_request',
				message:
					'Client sandbox option (false) does not match provider "stub" sandbox mode (true).',
				provider: 'stub',
			}),
		);
	});

	test('allows createClient when sandbox assertion matches provider mode', () => {
		expect(() =>
			createClient({
				provider: createStubProvider({ sandbox: true }),
				sandbox: true,
			}),
		).not.toThrow();

		expect(() =>
			createClient({
				provider: createStubProvider({ sandbox: false }),
				sandbox: false,
			}),
		).not.toThrow();
	});

	test('allows createClient without sandbox assertion regardless of provider mode', () => {
		expect(() =>
			createClient({
				provider: createStubProvider({ sandbox: true }),
			}),
		).not.toThrow();

		expect(() =>
			createClient({
				provider: createStubProvider({ sandbox: false }),
			}),
		).not.toThrow();
	});

	test('passes sandbox override to customers.get through the database', async () => {
		const sandboxGets: boolean[] = [];
		const database = defineDatabaseAdapter({
			id: 'mock',
			dialect: 'postgres',
			persistRaw: false,
			repositories: {
				customers: {
					async findByProviderId(_schema, _provider, sandbox, _id, options) {
						sandboxGets.push(sandbox);
						return withRaw(
							{
								id: 'cus_123',
								provider: 'stub',
								sandbox,
							},
							null,
							options?.includeRaw,
						) as never;
					},
					async list() {
						return { data: [], total: 0, previous: null, next: null };
					},
					async upsert() {},
					async markDeleted() {},
				},
				pix: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
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
						return { duplicate: false };
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
		const client = createClient({
			provider: createStubProvider({ sandbox: false }),
			database,
		});

		await client.customers.get('cus_123');
		await client.customers.get('cus_123', { sandbox: true });

		expect(sandboxGets).toEqual([false, true]);
	});

	test('passes sandbox override to pix.get through the database', async () => {
		const sandboxGets: boolean[] = [];
		const database = defineDatabaseAdapter({
			id: 'mock',
			dialect: 'postgres',
			persistRaw: false,
			repositories: {
				customers: {
					async findByProviderId() {
						return null;
					},
					async list() {
						return { data: [], total: 0, previous: null, next: null };
					},
					async upsert() {},
					async markDeleted() {},
				},
				pix: {
					async findByProviderId(_schema, _provider, sandbox, _id, options) {
						sandboxGets.push(sandbox);
						return withRaw(
							{
								id: 'pix_123',
								provider: 'stub',
								sandbox,
								amount: 1000,
								currency: 'brl',
								status: 'pending' as const,
								method: 'pix' as const,
							},
							null,
							options?.includeRaw,
						) as never;
					},
					async upsert() {},
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
						return { duplicate: false };
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
		const client = createClient({
			provider: createStubProvider({ sandbox: false }),
			database,
		});

		await client.pix.get('pix_123');
		await client.pix.get('pix_123', { sandbox: true });

		expect(sandboxGets).toEqual([false, true]);
	});

	test('merges sandbox into request options from client defaults', async () => {
		const calls: Array<ProviderRequestOptions<boolean> | undefined> = [];
		const provider = createStubProvider({
			onPaymentCreate(_data, options) {
				calls.push(options);
				return Promise.resolve(
					withRaw(
						{
							id: 'pay_123',
							provider: 'stub',
							sandbox: false,
							amount: 1000,
							currency: 'usd',
							status: 'paid' as const,
						},
						null,
						options?.includeRaw,
					),
				);
			},
		});

		const client = createClient({ provider });
		await client.payments.create({ amount: 1000, currency: 'USD' });

		expect(calls[0]).toHaveProperty('sandbox', undefined);
	});

	test('types onEvent as a discriminated union of normalized webhook events', () => {
		const client = createClient({
			provider: createStubProvider(),
			hooks: {
				onEvent(event) {
					expectType<string>(event.id);
					expectType<string>(event.provider);
					expectType<Request>(event.context.request);
					expectType<string>(event.context.deliveryId);

					if (event.type === 'checkout.completed') {
						expectType<string>(event.data.id);
						expectType<number>(event.data.amount);
					}

					if (event.type === 'customer.deleted') {
						expectType<boolean>(event.data.deleted);
						// @ts-expect-error customer.deleted payload does not expose amount
						expectType<number>(event.data.amount);
					}
				},
			},
		});

		expectType<typeof client>(client);
	});

	test('types onUnhandledEvent as a discriminated union of normalized webhook events', () => {
		const client = createClient({
			provider: createStubProvider(),
			hooks: {
				onUnhandledEvent(event) {
					expectType<string | undefined>(event.context.hook);
					expectType<string>(event.context.deliveryId);

					if (event.type === 'checkout.completed') {
						expectType<string>(event.data.id);
						expectType<number>(event.data.amount);
					}

					if (event.type === 'customer.deleted') {
						expectType<boolean>(event.data.deleted);
						// @ts-expect-error customer.deleted payload does not expose amount
						expectType<number>(event.data.amount);
					}
				},
			},
		});

		expectType<typeof client>(client);
	});

	test('narrows payment webhook payloads to PIX when method is pix', () => {
		const client = createClient({
			provider: createStubProvider(),
			hooks: {
				onPaymentCreated(event) {
					expectType<'pix' | undefined>(event.data.method);

					if (event.data.method === 'pix') {
						expectType<string | undefined>(event.data.copyPasteCode);
						expectType<string | undefined>(event.data.qrCodeImageUrlPng);
					} else {
						// @ts-expect-error non-PIX payments do not expose PIX fields
						expectType<string | undefined>(event.data.copyPasteCode);
					}
				},
			},
		});

		expectType<typeof client>(client);
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
			sandbox: false,
			segment: 'vip',
		});
	});

	test('lists only sandbox customers when the provider is in sandbox mode', async () => {
		const database = createListDatabase();
		const client = createClient({
			provider: createStubProvider({ sandbox: true }),
			database,
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

		const page = await client.customers.list();

		expect(page.data).toHaveLength(1);
		expect(page.data[0]).toMatchObject({
			id: 'cus_test_1',
			provider: 'stub',
			sandbox: true,
		});
	});

	test('overrides sandbox mode in customers.list() per call', async () => {
		const database = createListDatabase();
		const client = createClient({
			provider: createStubProvider({ sandbox: true }),
			database,
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

		const page = await client.customers.list({ sandbox: false });

		expect(page.data).toHaveLength(2);
		expect(page.data[0]).toMatchObject({
			id: 'cus_1',
			provider: 'stub',
			sandbox: false,
		});
	});

	test('types schema defaults from the field discriminator', () => {
		createClient({
			provider: createStubProvider(),
			schema: {
				tables: {
					customers: {
						fields: {
							createdOn: {
								type: 'date',
								default: new Date(),
							},
							retryCount: {
								type: 'number',
								default: 2,
							},
						},
					},
				},
			},
		});

		createClient({
			provider: createStubProvider(),
			schema: {
				tables: {
					customers: {
						fields: {
							// @ts-expect-error date defaults must be Date, not string
							createdOn: {
								type: 'date',
								default: '2024-01-01',
							},
							// @ts-expect-error number defaults must be number, not string
							retryCount: {
								type: 'number',
								default: '2',
							},
						},
					},
				},
			},
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
				isSandbox: () => false,
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
				isSandbox: () => false,
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

	test('checks pix capability before calling the provider', async () => {
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				isSandbox: () => false,
				capabilities: {
					checkout: true,
					customers: true,
					pix: false,
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
			client.pix.create({
				amount: 1000,
				currency: 'BRL',
			}),
		).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "stub" does not support "pix" capability',
			provider: 'stub',
		});
	});

	test('infers pix schema extra fields and strips them from provider calls', async () => {
		let pixInput: Record<string, unknown> | undefined;
		let persistedPix: Record<string, unknown> | undefined;
		const database = defineDatabaseAdapter({
			id: 'pix-db',
			dialect: 'postgres',
			persistRaw: true,
			repositories: {
				customers: {
					async findByProviderId() {
						return null;
					},
					async list() {
						return { data: [], total: 0, previous: null, next: null };
					},
					async upsert() {},
					async markDeleted() {},
				},
				pix: {
					async findByProviderId() {
						return null;
					},
					async upsert(_schema, pix) {
						persistedPix = pix as Record<string, unknown>;
					},
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
						return { duplicate: false };
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
		const client = createClient({
			provider: createStubProvider({
				onPixCreate(data, options) {
					pixInput = data as Record<string, unknown>;
					return Promise.resolve(
						withRaw(
							{
								id: 'pix_extra',
								provider: 'stub',
								sandbox: false,
								amount: 1800,
								currency: 'brl',
								status: 'pending' as const,
								method: 'pix' as const,
							},
							{ id: 'raw_pix_extra' },
							options?.includeRaw,
						),
					);
				},
			}),
			database,
			schema: {
				tables: {
					pix: {
						fields: {
							channel: {
								type: 'string',
							},
						},
					},
				},
			},
		});

		const pix = await client.pix.create({
			amount: 1800,
			currency: 'BRL',
			channel: 'qr',
		});

		expect(pixInput).toMatchObject({
			amount: 1800,
			currency: 'BRL',
		});
		expect(pixInput).not.toHaveProperty('channel');
		expect(pix.channel).toBe('qr');
		expect(persistedPix?.channel).toBe('qr');
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
								sandbox: false,
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
								sandbox: false,
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
		let lazyLoads = 0;
		const plugin = definePlugin({
			id: 'coupons',
			events: {
				onCouponRedeemed: event<{ code: string }>({
					description: 'Triggered when a coupon is redeemed',
					example: {
						code: 'WELCOME10',
					},
					async: false,
				}),
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

						return Response.json({ ok: true });
					},
				},
			],
			extends(context) {
				expectType<typeof context.client.customers.get>(
					context.client.customers.get,
				);
				return {
					coupons: lazy(() => {
						lazyLoads += 1;
						return {
							repository: 'available',
							async redeem(code: string) {
								await context.emit('onCouponRedeemed', {
									code,
								});

								return {
									code,
								};
							},
						};
					}),
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

		type CouponsRepository = (typeof client)['coupons']['repository'];
		type CustomerSync = (typeof client)['customers']['sync'];
		expectType<CouponsRepository>('available');
		expectType<CustomerSync>(() => 'synced');
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
		expect(lazyLoads).toBe(0);
		type CouponsClient = typeof client.coupons;
		expectType<CouponsClient>({} as never);
		expect(client.coupons.repository).toBe('available');
		expect(lazyLoads).toBe(1);
		expect(await client.coupons.redeem('SPRING25')).toEqual({
			code: 'SPRING25',
		});
		expect(redeemedCodes).toEqual(['WELCOME10', 'SPRING25']);
		expect(pluginHooks).toEqual(['WELCOME10', 'SPRING25']);
		expect(client.coupons.repository).toBe('available');
		expect(lazyLoads).toBe(1);
	});

	test('matches dynamic plugin routes and shares locals through middleware', async () => {
		const client = createClient({
			provider: createStubProvider(),
			plugins: [
				definePlugin({
					id: 'dashish',
					middleware: [
						async (context, next) => {
							context.locals.actor = 'ada';
							return next();
						},
					],
					routes: [
						{
							method: 'GET',
							path: '/resources/:resourceId',
							async handler(context) {
								return Response.json({
									actor: context.locals.actor,
									resourceId: context.params.resourceId,
								});
							},
						},
					],
				}),
			] as const,
		});

		const response = await client.routes.handle(
			new Request('https://app.test/resources/pay_123', { method: 'GET' }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			actor: 'ada',
			resourceId: 'pay_123',
		});
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

	test('rejects plugin events using the built-in onEvent hook name', () => {
		expect(() =>
			createClient({
				provider: createStubProvider(),
				plugins: [
					definePlugin({
						id: 'invalid-plugin',
						events: {
							onEvent: event<{ ok: true }>({
								description: 'invalid',
							}),
						},
					}),
				] as const,
			}),
		).toThrow(
			new PaymeshError({
				code: 'plugin_configuration_error',
				message:
					'Plugin "invalid-plugin" cannot reuse the built-in hook name "onEvent".',
				provider: 'stub',
			}),
		);
	});

	test('allows built-in hooks when plugins are passed as a non-const array', () => {
		const plugins = [
			definePlugin({
				id: 'coupons',
			}),
			definePlugin({
				id: 'seats',
			}),
		];

		const client = createClient({
			provider: createStubProvider(),
			plugins,
			hooks: {
				onEvent(event) {
					expectType<string>(event.type);
					return {};
				},
			},
		});

		expectType<typeof client>(client);
	});
});

function createStubProvider({
	sandbox = false,
	onPaymentCreate,
	onPixCreate,
	onPixGet,
	onCustomerUpsert,
}: {
	sandbox?: boolean;
	onPaymentCreate?: <IncludeRaw extends boolean = false>(
		data: { amount: number; currency: string },
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Payment<IncludeRaw>>;
	onPixCreate?: <IncludeRaw extends boolean = false>(
		data: {
			amount: number;
			currency: string;
		},
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Pix<IncludeRaw>>;
	onPixGet?: <IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Pix<IncludeRaw>>;
	onCustomerUpsert?: <IncludeRaw extends boolean = false>(
		data: Record<string, unknown>,
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Customer<IncludeRaw>>;
} = {}) {
	return defineProvider({
		id: 'stub',
		isSandbox: () => sandbox,
		capabilities: {
			checkout: true,
			customers: true,
			pix: true,
		},
		payments: {
			create: onPaymentCreate
				? onPaymentCreate
				: async (_data, options) =>
						withRaw(
							{
								id: 'pay_123',
								provider: 'stub',
								sandbox,
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
		pix: {
			create: onPixCreate
				? onPixCreate
				: async (_data, options) =>
						withRaw(
							{
								id: 'pix_123',
								provider: 'stub',
								sandbox,
								amount: 2200,
								currency: 'brl',
								status: 'pending' as const,
								method: 'pix' as const,
							},
							{
								id: 'raw_pix_123',
							},
							options?.includeRaw,
						),
			get: onPixGet
				? onPixGet
				: async (_id, options) =>
						withRaw(
							{
								id: 'pix_123',
								provider: 'stub',
								sandbox,
								amount: 2200,
								currency: 'brl',
								status: 'pending' as const,
								method: 'pix' as const,
								copyPasteCode: '000201',
							},
							{
								id: 'raw_pix_123',
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
						sandbox,
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
								sandbox,
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
						sandbox,
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
				async list(_schema, _provider, sandbox, options) {
					const rows = sandbox
						? [
								withRaw(
									{
										id: 'cus_test_1',
										provider: 'stub',
										sandbox: true,
										email: 'ada@example.com',
										segment: 'vip',
									},
									{ id: 'raw_cus_test_1' },
									options?.includeRaw,
								),
							]
						: [
								withRaw(
									{
										id: 'cus_1',
										provider: 'stub',
										sandbox: false,
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
										sandbox: false,
										email: 'grace@example.com',
										segment: 'vip',
									},
									{ id: 'raw_cus_2' },
									options?.includeRaw,
								),
							];
					return {
						data: rows,
						total: rows.length,
						previous: null,
						next: null,
					} as never;
				},
				async upsert() {},
				async markDeleted() {},
			},
			pix: {
				async findByProviderId() {
					return null;
				},
				async upsert() {},
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
