import { describe, expect, test } from 'bun:test';
import { createClient, defineProvider, withRaw } from 'paymesh';
import { memory } from '../src/index';

describe('@paymesh/memory', () => {
	test('reads seeded customers through the client without hitting the provider', async () => {
		let providerReads = 0;
		const database = memory({
			persistRaw: true,
			seed: {
				customers: [
					{
						id: 'cus_seed',
						provider: 'stub',
						sandbox: false,
						email: 'seed@example.com',
						raw: { seeded: true },
					},
				],
			},
		});
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				isSandbox: () => false,
				capabilities: {
					checkout: true,
					customers: true,
				},
				payments: {
					create: async () => {
						throw new Error('not used');
					},
				},
				customers: {
					get: async () => {
						providerReads += 1;
						throw new Error('not used');
					},
					upsert: async (_data, options) =>
						withRaw(
							{
								id: 'cus_provider',
								provider: 'stub',
								sandbox: false,
							},
							{ from: 'provider' },
							options?.includeRaw,
						),
					delete: async (_id, options) =>
						withRaw(
							{
								id: 'cus_provider',
								provider: 'stub',
								sandbox: false,
								deleted: true,
							},
							{ from: 'provider' },
							options?.includeRaw,
						),
				},
			}),
			database,
			includeRaw: true,
		});

		const customer = await client.customers.get('cus_seed');

		expect(customer).toMatchObject({
			id: 'cus_seed',
			email: 'seed@example.com',
			raw: { seeded: true },
		});
		expect(providerReads).toBe(0);
	});

	test('supports customer list pagination from seeded memory state', async () => {
		const database = memory({
			seed: {
				customers: [
					{
						id: 'cus_1',
						provider: 'stub',
						sandbox: false,
						email: 'ada@example.com',
						createdAt: '2024-01-01T00:00:00.000Z',
					},
					{
						id: 'cus_2',
						provider: 'stub',
						sandbox: false,
						email: 'grace@example.com',
						createdAt: '2024-01-01T00:00:00.000Z',
					},
					{
						id: 'cus_3',
						provider: 'stub',
						sandbox: false,
						email: 'linus@example.com',
						createdAt: '2024-01-02T00:00:00.000Z',
					},
				],
			},
		});
		const firstPage = await database.repositories.customers.list(
			createSchema(),
			'stub',
			false,
			{ limit: 2 },
		);
		const secondPage = await database.repositories.customers.list(
			createSchema(),
			'stub',
			false,
			{
				limit: 2,
				after: firstPage.next ?? undefined,
			},
		);

		expect(firstPage.data.map((customer) => customer.id)).toEqual([
			'cus_1',
			'cus_2',
		]);
		expect(firstPage.total).toBe(3);
		expect(firstPage.next).toEqual(expect.any(String));
		expect(secondPage.data.map((customer) => customer.id)).toEqual(['cus_3']);
	});

	test('validates related entities in strict mode during seed', () => {
		expect(() =>
			memory({
				seed: {
					prices: [
						{
							id: 'price_missing_product',
							provider: 'stub',
							sandbox: false,
							productId: 'prod_missing',
						},
					],
				},
			}),
		).toThrow(/Related product "prod_missing" does not exist/);
	});

	test('allows permissive seed and writes when strict is disabled', async () => {
		const database = memory({
			strict: false,
			seed: {
				prices: [
					{
						id: 'price_loose',
						provider: 'stub',
						sandbox: false,
						productId: 'prod_missing',
					},
				],
			},
		});

		await expect(
			database.repositories.pix.upsert(createSchema(), {
				id: 'pix_1',
				provider: 'stub',
				sandbox: false,
				amount: 1000,
				currency: 'brl',
				status: 'pending',
				method: 'pix',
				customer: { id: 'cus_missing' },
			}),
		).resolves.toBeUndefined();
	});

	test('rolls back writes when a transaction fails', async () => {
		const database = memory();

		await expect(
			database.transaction(async (tx) => {
				await tx.repositories.customers.upsert(createSchema(), {
					id: 'cus_tx',
					provider: 'stub',
					sandbox: false,
					email: 'tx@example.com',
				});
				throw new Error('boom');
			}),
		).rejects.toThrow('boom');

		await expect(
			database.repositories.customers.findByProviderId(
				createSchema(),
				'stub',
				false,
				'cus_tx',
			),
		).resolves.toBeNull();
	});

	test('throws a clear error for arbitrary SQL query execution', async () => {
		const database = memory();

		await expect(
			database.query({
				sql: 'select 1',
				params: [],
			}),
		).rejects.toMatchObject({
			name: 'PaymeshError',
			code: 'database_error',
			message:
				'@paymesh/memory does not execute arbitrary SQL. Use repository methods instead.',
		});
	});
});

function createSchema() {
	return createClient({
		provider: defineProvider({
			id: 'stub',
			isSandbox: () => false,
			capabilities: {
				checkout: true,
				customers: true,
			},
			payments: {
				create: async () => {
					throw new Error('not used');
				},
			},
			customers: {
				get: async () => {
					throw new Error('not used');
				},
				upsert: async () => {
					throw new Error('not used');
				},
				delete: async () => {
					throw new Error('not used');
				},
			},
		}),
	}).schema;
}
