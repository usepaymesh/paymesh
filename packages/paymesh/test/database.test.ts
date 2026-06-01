import { describe, expect, test } from 'bun:test';
import {
	type CompiledQuery,
	createClient,
	defineDatabaseAdapter,
	defineProvider,
	resolveDatabaseSchema,
	withRaw,
} from '../src';

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
					create: async (_data, options) =>
						withRaw(
							{
								id: 'cus_123',
								provider: 'stub',
								email: 'ada@example.com',
							},
							{ id: 'raw_customer_123' },
							options?.includeRaw,
						),
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
					update: async (_id, _data, options) =>
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

		await client.customers.create({
			email: 'ada@example.com',
		});

		const customerWrite = database.calls.find((call) =>
			call.sql.includes('"paymesh_customers"'),
		);

		expect(customerWrite).toBeDefined();
		expect(customerWrite?.params).toContainEqual({ id: 'raw_customer_123' });
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
				create: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				get: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				update: async (_id, _data, options) =>
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
				create: async (_data, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				get: async (_id, options) =>
					withRaw(
						{
							id: 'cus_123',
							provider: 'stub',
						},
						{ id: 'raw_customer' },
						options?.includeRaw,
					),
				update: async (_id, _data, options) =>
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
	const calls: CompiledQuery[] = [];

	const database = defineDatabaseAdapter({
		id: 'mock',
		dialect: 'postgres',
		persistRaw,
		async query<Row = unknown>(query: CompiledQuery) {
			calls.push(query);

			if (
				query.sql.startsWith('WITH inserted AS (') &&
				query.sql.includes('"paymesh_webhook_events"')
			) {
				const key = `${query.params[0]}:${query.params[1]}`;
				const current = webhookEvents.get(key);

				if (!current) {
					webhookEvents.set(key, { status: 'processing' });
					return [{ inserted: true, retried: false }] as Row[];
				}

				if (current.status === 'failed') {
					webhookEvents.set(key, { status: 'processing' });
					return [{ inserted: false, retried: true }] as Row[];
				}

				return [{ inserted: false, retried: false }] as Row[];
			}

			return [] as Row[];
		},
		async execute(query) {
			calls.push(query);

			if (
				query.sql.startsWith('UPDATE "paymesh_webhook_events"') &&
				query.sql.includes("SET status = 'processed'")
			) {
				const key = `${query.params[0]}:${query.params[1]}`;
				webhookEvents.set(key, { status: 'processed' });
				return;
			}

			if (
				query.sql.startsWith('UPDATE "paymesh_webhook_events"') &&
				query.sql.includes("SET status = 'failed'")
			) {
				const key = `${query.params[0]}:${query.params[1]}`;
				webhookEvents.set(key, { status: 'failed' });
			}
		},
		async transaction(callback) {
			return callback(database);
		},
	});

	return Object.assign(database, { calls });
}
