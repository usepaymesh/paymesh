import { describe, expect, test } from 'bun:test';
import {
	type CompiledQuery,
	createClient,
	defineDatabaseAdapter,
	defineProvider,
	resolveDatabaseSchema,
	withRaw,
} from '../src';
import { getInternalRaw } from '../src/shared/raw';

describe('database support', () => {
	test('resolves schema prefix and custom table names', () => {
		const schema = resolveDatabaseSchema({
			prefix: 'custom_',
			tables: {
				customers: {
					name: 'cust',
				},
			},
		});

		expect(schema.prefix).toBe('custom_');
		expect(schema.tables.customers.name).toBe('cust');
		expect(schema.tables.invoices.name).toBe('custom_invoices');
	});

	test('persists hidden raw payloads when persistRaw is enabled', async () => {
		const database = createMockDatabase({ persistRaw: true });
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
					customers: true,
				},
				payments: {
					create: async (_data, options) =>
						withRaw(
							{
								id: 'chk_123',
								provider: 'stub',
								amount: 1500,
								currency: 'usd',
								status: 'pending' as const,
							},
							{ id: 'raw_checkout_123' },
							options?.includeRaw,
						),
				},
				customers: {
					get: async (_id, options) =>
						withRaw(
							{
								id: 'cus_123',
								provider: 'stub',
								email: 'ada@example.com',
							},
							{ id: 'raw_customer_123' },
							options?.includeRaw,
						),
					upsert: async (_data, options) =>
						withRaw(
							{
								id: 'cus_123',
								provider: 'stub',
								email: 'ada@example.com',
							},
							{ id: 'raw_customer_123' },
							options?.includeRaw,
						),
					delete: async (_id, options) =>
						withRaw(
							{
								id: 'cus_123',
								provider: 'stub',
								deleted: true,
							},
							{ id: 'raw_customer_123' },
							options?.includeRaw,
						),
				},
			}),
			database,
		});

		await client.customers.upsert({
			email: 'ada@example.com',
		});

		expect(database.customerWrites[0]?.raw).toEqual({ id: 'raw_customer_123' });
	});

	test('reads customers from the local database without calling the provider', async () => {
		const database = createMockDatabase({ persistRaw: true });
		let providerReads = 0;
		await database.repositories.customers.upsert(resolveDatabaseSchema(), {
			id: 'cus_local',
			provider: 'stub',
			email: 'ada@example.com',
		});
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
					customers: true,
				},
				payments: {
					create: async () => {
						throw new Error('should not be called');
					},
				},
				customers: {
					get: async () => {
						providerReads += 1;
						throw new Error('should not be called');
					},
					upsert: async (_data, options) =>
						withRaw(
							{
								id: 'cus_local',
								provider: 'stub',
								email: 'ada@example.com',
							},
							{ id: 'raw_customer_local' },
							options?.includeRaw,
						),
					delete: async (_id, options) =>
						withRaw(
							{
								id: 'cus_local',
								provider: 'stub',
								deleted: true,
							},
							{ id: 'raw_customer_local' },
							options?.includeRaw,
						),
				},
			}),
			database,
			includeRaw: true,
		});

		const customer = await client.customers.get('cus_local');

		expect(customer).toMatchObject({
			id: 'cus_local',
			provider: 'stub',
			email: 'ada@example.com',
		});
		expect(customer.raw).toBeNull();
		expect(providerReads).toBe(0);
		expect(database.customerWrites).toHaveLength(1);
	});

	test('lists customers from the local database with cursor pagination', async () => {
		const database = createMockDatabase({ persistRaw: true });
		database.seedCustomer({
			id: 'cus_1',
			provider: 'stub',
			createdAt: '2024-01-01T00:00:00.000Z',
			email: 'ada@example.com',
			raw: { id: 'raw_cus_1' },
		});
		database.seedCustomer({
			id: 'cus_2',
			provider: 'stub',
			createdAt: '2024-01-01T00:00:00.000Z',
			email: 'grace@example.com',
			raw: { id: 'raw_cus_2' },
		});
		database.seedCustomer({
			id: 'cus_3',
			provider: 'stub',
			createdAt: '2024-01-02T00:00:00.000Z',
			email: 'linus@example.com',
			raw: { id: 'raw_cus_3' },
		});
		database.seedCustomer({
			id: 'cus_4',
			provider: 'stub',
			createdAt: '2024-01-03T00:00:00.000Z',
			email: 'rita@example.com',
			raw: { id: 'raw_cus_4' },
		});
		database.seedCustomer({
			id: 'cus_5',
			provider: 'stub',
			createdAt: '2024-01-04T00:00:00.000Z',
			email: 'deleted@example.com',
			deleted: true,
			raw: { id: 'raw_cus_5' },
		});
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
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
			database,
			includeRaw: true,
		});

		const firstPage = await client.customers.list({ limit: 2 });
		const secondPage = await client.customers.list({
			limit: 2,
			after: firstPage.next ?? undefined,
		});
		const previousPage = await client.customers.list({
			limit: 2,
			before: secondPage.previous ?? undefined,
		});

		expect(firstPage.total).toBe(4);
		expect(firstPage.data.map((customer) => customer.id)).toEqual([
			'cus_1',
			'cus_2',
		]);
		expect(firstPage.previous).toBeNull();
		expect(firstPage.next).toEqual(expect.any(String));
		expect(firstPage.data[0]!.raw).toEqual({ id: 'raw_cus_1' });
		expect(secondPage.data.map((customer) => customer.id)).toEqual([
			'cus_3',
			'cus_4',
		]);
		expect(secondPage.previous).toEqual(expect.any(String));
		expect(secondPage.next).toBeNull();
		expect(previousPage.data.map((customer) => customer.id)).toEqual([
			'cus_1',
			'cus_2',
		]);
		expect(previousPage.previous).toBeNull();
		expect(previousPage.next).toEqual(firstPage.next);
	});

	test('persists and reads schema extra fields on customers', async () => {
		const database = createMockDatabase({ persistRaw: true });
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
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
					upsert: async (_data, options) =>
						withRaw(
							{
								id: 'cus_extra',
								provider: 'stub',
								email: 'ada@example.com',
							},
							{ id: 'raw_customer_extra' },
							options?.includeRaw,
						),
					delete: async (_id, options) =>
						withRaw(
							{
								id: 'cus_extra',
								provider: 'stub',
								deleted: true,
							},
							{ id: 'raw_customer_extra' },
							options?.includeRaw,
						),
				},
			}),
			database,
			schema: {
				tables: {
					customers: {
						fields: {
							first_and_last_name: {
								type: 'string',
								required: true,
							},
						},
					},
				},
			},
		});

		const created = await client.customers.upsert({
			email: 'ada@example.com',
			first_and_last_name: 'Ada Lovelace',
		});
		const stored = await client.customers.get('cus_extra');

		expect(created.first_and_last_name).toBe('Ada Lovelace');
		expect(stored.first_and_last_name).toBe('Ada Lovelace');
	});

	test('deduplicates webhook processing by provider event id', async () => {
		const database = createMockDatabase();
		let deliveries = 0;
		const provider = defineProvider({
			id: 'stub',
			capabilities: {
				checkout: true,
				customers: true,
				webhooks: true,
			},
			payments: {
				create: async (_data, options) =>
					withRaw(
						{
							id: 'chk_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'pending' as const,
						},
						{ id: 'raw_checkout' },
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
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				upsert: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				delete: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							deleted: true,
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
			},
			webhooks: {
				verify: async () => true,
				handle: async ({ request, includeRaw }) => {
					const payload = (await request.json()) as Record<string, unknown>;

					return {
						deliveryId: 'evt_123',
						hook: 'onCustomerCreated',
						event: withRaw(
							{
								id: 'evt_123',
								type: 'customer.created' as const,
								provider: 'stub',
								data: withRaw(
									{
										id: 'cus_123',
										provider: 'stub',
										email: payload.email as string | undefined,
									},
									payload,
									includeRaw,
								),
							},
							payload,
							includeRaw,
						),
					};
				},
			},
		});
		const client = createClient({
			provider,
			database,
		});

		const request = new Request('https://app.test/webhooks', {
			method: 'POST',
			body: JSON.stringify({
				email: 'ada@example.com',
			}),
			headers: {
				'content-type': 'application/json',
			},
		});

		const first = await client.webhooks.handle({
			request: request.clone(),
			hooks: {
				onCustomerCreated: async () => {
					deliveries += 1;
				},
			},
		});
		const second = await client.webhooks.handle({
			request: request.clone(),
			hooks: {
				onCustomerCreated: async () => {
					deliveries += 1;
				},
			},
		});

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(second.body.duplicate).toBe(true);
		expect(deliveries).toBe(1);
	});

	test('dispatches onEvent alongside the specific webhook hook', async () => {
		const database = createMockDatabase();
		const calls: string[] = [];
		const provider = defineProvider({
			id: 'stub',
			capabilities: {
				checkout: true,
				customers: true,
				webhooks: true,
			},
			payments: {
				create: async (_data, options) =>
					withRaw(
						{
							id: 'chk_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'pending' as const,
						},
						{ id: 'raw_checkout' },
						options?.includeRaw,
					),
			},
			customers: {
				get: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							email: 'ada@example.com',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				upsert: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							email: 'ada@example.com',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				delete: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							deleted: true,
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
			},
			webhooks: {
				verify: async () => true,
				handle: async ({ request, includeRaw }) => {
					const payload = (await request.json()) as Record<string, unknown>;

					return {
						deliveryId: 'evt_parallel',
						hook: 'onCustomerCreated',
						event: withRaw(
							{
								id: 'evt_parallel',
								type: 'customer.created' as const,
								provider: 'stub',
								data: withRaw(
									{
										id: 'cus_123',
										provider: 'stub',
										email: payload.email as string | undefined,
									},
									payload,
									includeRaw,
								),
							},
							payload,
							includeRaw,
						),
					};
				},
			},
		});
		const client = createClient({
			provider,
			database,
		});

		const result = await client.webhooks.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				body: JSON.stringify({ email: 'ada@example.com' }),
				headers: {
					'content-type': 'application/json',
				},
			}),
			hooks: {
				onEvent: async (event) => {
					calls.push(`event:${event.type}`);
				},
				onCustomerCreated: async (event) => {
					calls.push(`specific:${event.data.id}`);
				},
			},
		});

		expect(result.status).toBe(200);
		expect(calls).toEqual(['event:customer.created', 'specific:cus_123']);
	});

	test('dispatches onEvent even when the provider returns no specific hook', async () => {
		const database = createMockDatabase();
		const calls: string[] = [];
		const provider = defineProvider({
			id: 'stub',
			capabilities: {
				checkout: true,
				customers: true,
				webhooks: true,
			},
			payments: {
				create: async (_data, options) =>
					withRaw(
						{
							id: 'chk_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'pending' as const,
						},
						{ id: 'raw_checkout' },
						options?.includeRaw,
					),
			},
			customers: {
				get: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							email: 'ada@example.com',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				upsert: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							email: 'ada@example.com',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				delete: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							deleted: true,
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
			},
			webhooks: {
				verify: async () => true,
				handle: async ({ request, includeRaw }) => {
					const payload = (await request.json()) as Record<string, unknown>;

					return {
						deliveryId: 'evt_no_specific',
						event: withRaw(
							{
								id: 'evt_no_specific',
								type: 'subscription.updated' as const,
								provider: 'stub',
								data: withRaw(
									{
										id: 'sub_123',
										status: payload.status,
									},
									payload,
									includeRaw,
								),
							},
							payload,
							includeRaw,
						),
					};
				},
			},
		});
		const client = createClient({
			provider,
			database,
		});

		const result = await client.webhooks.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				body: JSON.stringify({ status: 'active' }),
				headers: {
					'content-type': 'application/json',
				},
			}),
			hooks: {
				onEvent: async (event) => {
					calls.push(event.type);
				},
			},
		});

		expect(result.status).toBe(200);
		expect(calls).toEqual(['subscription.updated']);
	});

	test('returns hook_error when onEvent fails', async () => {
		const database = createMockDatabase();
		const provider = defineProvider({
			id: 'stub',
			capabilities: {
				checkout: true,
				customers: true,
				webhooks: true,
			},
			payments: {
				create: async (_data, options) =>
					withRaw(
						{
							id: 'chk_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'pending' as const,
						},
						{ id: 'raw_checkout' },
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
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				upsert: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				delete: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							deleted: true,
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
			},
			webhooks: {
				verify: async () => true,
				handle: async ({ request, includeRaw }) => {
					const payload = (await request.json()) as Record<string, unknown>;

					return {
						deliveryId: 'evt_failed_global',
						hook: 'onCustomerCreated',
						event: withRaw(
							{
								id: 'evt_failed_global',
								type: 'customer.created' as const,
								provider: 'stub',
								data: withRaw(
									{
										id: 'cus_123',
										provider: 'stub',
										email: payload.email as string | undefined,
									},
									payload,
									includeRaw,
								),
							},
							payload,
							includeRaw,
						),
					};
				},
			},
		});
		const client = createClient({
			provider,
			database,
		});

		const result = await client.webhooks.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				body: JSON.stringify({ email: 'ada@example.com' }),
				headers: {
					'content-type': 'application/json',
				},
			}),
			hooks: {
				onEvent: async () => {
					throw new Error('global hook failed');
				},
				onCustomerCreated: async () => {},
			},
		});

		expect(result.status).toBe(500);
		expect(result.body).toEqual({ error: 'hook_error' });
	});

	test('uses provider-specific webhook delivery ids for idempotency', async () => {
		const database = createMockDatabase();
		let deliveries = 0;
		const provider = defineProvider({
			id: 'stub',
			capabilities: {
				checkout: true,
				customers: true,
				webhooks: true,
			},
			payments: {
				create: async (_data, options) =>
					withRaw(
						{
							id: 'chk_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'pending' as const,
						},
						{ id: 'raw_checkout' },
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
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				upsert: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				delete: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
							deleted: true,
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
			},
			webhooks: {
				verify: async () => true,
				handle: async ({ request, includeRaw }) => {
					const payload = (await request.json()) as Record<string, unknown>;

					return {
						deliveryId:
							typeof payload.deliveryId === 'string'
								? payload.deliveryId
								: undefined,
						hook: 'onCustomerUpdated',
						event: withRaw(
							{
								id: 'entity_123',
								type: 'customer.updated' as const,
								provider: 'stub',
								data: withRaw(
									{
										id: 'cus_123',
										provider: 'stub',
										email: payload.email as string | undefined,
									},
									payload,
									includeRaw,
								),
							},
							payload,
							includeRaw,
						),
					};
				},
			},
		});
		const client = createClient({
			provider,
			database,
		});

		const first = await client.webhooks.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					deliveryId: 'msg_1',
					email: 'ada@example.com',
				}),
			}),
			hooks: {
				onCustomerUpdated: async () => {
					deliveries += 1;
				},
			},
		});
		const second = await client.webhooks.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					deliveryId: 'msg_2',
					email: 'ada@example.com',
				}),
			}),
			hooks: {
				onCustomerUpdated: async () => {
					deliveries += 1;
				},
			},
		});

		expect(first.body.duplicate).toBeUndefined();
		expect(second.body.duplicate).toBeUndefined();
		expect(deliveries).toBe(2);
	});
});

function createMockDatabase({
	persistRaw = false,
}: {
	persistRaw?: boolean;
} = {}) {
	const webhookEvents = new Map<string, { status: string }>();
	const customers = new Map<
		string,
		Record<string, unknown> & {
			id: string;
			provider: string;
			createdAt: string;
			deleted?: boolean;
			raw: unknown;
		}
	>();
	const customerWrites: Array<{ raw: unknown }> = [];

	const database = defineDatabaseAdapter({
		id: 'mock',
		dialect: 'postgres',
		persistRaw,
		repositories: {
			customers: {
				async findByProviderId(_schema, provider, id, options) {
					const customer = customers.get(`${provider}:${id}`);
					if (!customer || customer.deleted) return null;

					const {
						createdAt: _createdAt,
						deleted: _deleted,
						raw,
						...data
					} = customer;
					return withRaw(
						{
							...data,
						},
						raw,
						options?.includeRaw,
					) as never;
				},
				async list(_schema, provider, options) {
					const limit = resolveCustomerListLimit(options?.limit);
					const cursor = resolveCustomerCursor(options?.after, options?.before);
					const includeRaw = options?.includeRaw;
					const filtered = [...customers.values()]
						.filter(
							(customer) => customer.provider === provider && !customer.deleted,
						)
						.sort(compareCustomerRecords);
					const total = filtered.length;

					let pageSource = filtered;
					if (cursor?.mode === 'after') {
						pageSource = filtered.filter(
							(customer) => compareCustomerCursor(customer, cursor.value) > 0,
						);
					} else if (cursor?.mode === 'before') {
						pageSource = filtered
							.filter(
								(customer) => compareCustomerCursor(customer, cursor.value) < 0,
							)
							.sort((left, right) => compareCustomerRecords(right, left));
					}

					const hasExtra = pageSource.length > limit;
					const windowRows = hasExtra ? pageSource.slice(0, limit) : pageSource;
					const pageRows =
						cursor?.mode === 'before' ? [...windowRows].reverse() : windowRows;
					const data = pageRows.map((customer) => {
						const {
							createdAt: _createdAt,
							deleted: _deleted,
							raw,
							...record
						} = customer;

						return withRaw(record, raw, includeRaw) as never;
					});

					return {
						data,
						total,
						previous:
							data.length === 0
								? null
								: cursor?.mode === 'before'
									? hasExtra
										? encodeCustomerCursor(pageRows[0]!)
										: null
									: cursor
										? encodeCustomerCursor(pageRows[0]!)
										: null,
						next:
							data.length === 0
								? null
								: cursor?.mode === 'before'
									? encodeCustomerCursor(pageRows[pageRows.length - 1]!)
									: hasExtra
										? encodeCustomerCursor(pageRows[pageRows.length - 1]!)
										: null,
					};
				},
				async upsert(_schema, customer) {
					const existing = customers.get(`${customer.provider}:${customer.id}`);
					const createdAt = existing?.createdAt ?? new Date().toISOString();
					customerWrites.push({
						raw: persistRaw ? getInternalRaw(customer) : null,
					});
					customers.set(`${customer.provider}:${customer.id}`, {
						id: customer.id,
						provider: customer.provider,
						createdAt,
						...(customer as Record<string, unknown>),
						raw: persistRaw ? getInternalRaw(customer) : null,
					});
				},
				async markDeleted(_schema, customer) {
					const existing = customers.get(`${customer.provider}:${customer.id}`);
					customers.set(`${customer.provider}:${customer.id}`, {
						id: customer.id,
						provider: customer.provider,
						createdAt: existing?.createdAt ?? new Date().toISOString(),
						deleted: true,
						raw: persistRaw ? getInternalRaw(customer) : null,
					});
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
				async acquire(_schema, event, deliveryId) {
					const key = `${event.provider}:${deliveryId}`;
					const current = webhookEvents.get(key);

					if (!current) {
						webhookEvents.set(key, { status: 'processing' });
						return { duplicate: false };
					}

					if (current.status === 'failed') {
						webhookEvents.set(key, { status: 'processing' });
						return { duplicate: false };
					}

					return { duplicate: true };
				},
				async markProcessed(_schema, event, deliveryId) {
					webhookEvents.set(`${event.provider}:${deliveryId}`, {
						status: 'processed',
					});
				},
				async markFailed(_schema, event, deliveryId) {
					webhookEvents.set(`${event.provider}:${deliveryId}`, {
						status: 'failed',
					});
				},
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
		async query<Row = unknown>(query: CompiledQuery) {
			void query;
			return [] as Row[];
		},
		async execute(query) {
			void query;
		},
		async transaction(callback) {
			return callback(database);
		},
	});

	function seedCustomer(
		customer: Record<string, unknown> & {
			id: string;
			provider: string;
			createdAt: string;
			deleted?: boolean;
			raw: unknown;
		},
	) {
		customers.set(`${customer.provider}:${customer.id}`, customer);
	}

	return Object.assign(database, { customerWrites, seedCustomer });
}

function resolveCustomerListLimit(limit?: number) {
	if (limit === undefined) return 20;
	if (!Number.isInteger(limit) || limit <= 0) {
		throw new Error('Customer list limit must be a positive integer');
	}

	return limit;
}

function resolveCustomerCursor(after?: string, before?: string) {
	if (after && before) {
		throw new Error(
			'Customer list accepts either "after" or "before", not both',
		);
	}

	if (before) {
		return {
			mode: 'before' as const,
			value: decodeCustomerCursor(before),
		};
	}

	if (after) {
		return {
			mode: 'after' as const,
			value: decodeCustomerCursor(after),
		};
	}

	return null;
}

function decodeCustomerCursor(cursor: string) {
	if (!cursor.startsWith('pc1.')) {
		throw new Error('Invalid customer list cursor');
	}

	const parsed = JSON.parse(
		Buffer.from(cursor.slice(4), 'base64url').toString('utf8'),
	) as Record<string, unknown>;

	if (
		typeof parsed.createdAt !== 'string' ||
		typeof parsed.providerId !== 'string' ||
		parsed.createdAt.length === 0 ||
		parsed.providerId.length === 0
	) {
		throw new Error('Invalid customer list cursor');
	}

	return {
		createdAt: parsed.createdAt,
		providerId: parsed.providerId,
	};
}

function encodeCustomerCursor(customer: { createdAt: string; id: string }) {
	return `pc1.${Buffer.from(
		JSON.stringify({
			createdAt: customer.createdAt,
			providerId: customer.id,
		}),
	).toString('base64url')}`;
}

function compareCustomerRecords(
	left: Record<string, unknown> & { createdAt: string; id: string },
	right: Record<string, unknown> & { createdAt: string; id: string },
) {
	return (
		left.createdAt.localeCompare(right.createdAt) ||
		left.id.localeCompare(right.id)
	);
}

function compareCustomerCursor(
	left: { createdAt: string; id: string },
	right: { createdAt: string; providerId: string },
) {
	return (
		left.createdAt.localeCompare(right.createdAt) ||
		left.id.localeCompare(right.providerId)
	);
}
