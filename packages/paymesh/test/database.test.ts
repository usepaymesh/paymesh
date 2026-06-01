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
		{
			id: string;
			provider: string;
			email?: string;
			name?: string;
			phone?: string;
			externalId?: string;
			metadata?: Record<string, unknown>;
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

					return withRaw(
						{
							id: customer.id,
							provider: customer.provider,
							email: customer.email,
							name: customer.name,
							phone: customer.phone,
							externalId: customer.externalId,
							metadata: customer.metadata,
						},
						customer.raw,
						options?.includeRaw,
					);
				},
				async upsert(_schema, customer) {
					customerWrites.push({
						raw: persistRaw ? getInternalRaw(customer) : null,
					});
					customers.set(`${customer.provider}:${customer.id}`, {
						id: customer.id,
						provider: customer.provider,
						email: customer.email,
						name: customer.name,
						phone: customer.phone,
						externalId: customer.externalId,
						metadata: customer.metadata,
						raw: persistRaw ? getInternalRaw(customer) : null,
					});
				},
				async markDeleted(_schema, customer) {
					customers.set(`${customer.provider}:${customer.id}`, {
						id: customer.id,
						provider: customer.provider,
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

	return Object.assign(database, { customerWrites });
}
