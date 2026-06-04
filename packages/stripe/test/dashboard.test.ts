import { describe, expect, test } from 'bun:test';
import type { CompiledQuery, PaymeshDatabaseDriver } from 'paymesh';
import { stripe } from '../src';

describe('stripe dashboard adapter', () => {
	test('retrieves balance and syncs payment resources', async () => {
		let syncedInvoiceId: string | undefined;
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.dashboard.test',
			fetch: (async (input) => {
				if (String(input).endsWith('/v1/balance')) {
					return Response.json({
						available: [{ amount: 5000, currency: 'usd' }],
						pending: [{ amount: 1200, currency: 'usd' }],
						connect_reserved: [{ amount: 300, currency: 'usd' }],
					});
				}

				if (String(input).endsWith('/v1/payment_intents/pi_123')) {
					return Response.json({
						id: 'pi_123',
						object: 'payment_intent',
						amount: 4200,
						currency: 'usd',
						status: 'succeeded',
						metadata: {
							orderId: 'ord_123',
						},
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});

		const balance = await provider.dashboard?.getBalance?.();
		const synced = await provider.dashboard?.syncPayment?.({
			database: createDatabaseStub({
				onInvoiceUpsert(id) {
					syncedInvoiceId = id;
				},
			}),
			id: 'pi_123',
			schema: createSchema(),
		});

		expect(balance).toEqual({
			available: [
				{
					amount: 5000,
					currency: 'usd',
					label: 'Available (USD)',
				},
			],
			pending: [
				{
					amount: 1200,
					currency: 'usd',
					label: 'Pending (USD)',
				},
			],
			reserved: [
				{
					amount: 300,
					currency: 'usd',
					label: 'Reserved (USD)',
				},
			],
		});
		expect(
			provider.dashboard?.getResourceUrl?.({
				type: 'payment',
				id: 'pi_123',
			}),
		).toBe('https://dashboard.stripe.com/payments/pi_123');
		expect(synced?.id).toBe('pi_123');
		expect(syncedInvoiceId).toBe('pi_123');
	});
});

function createDatabaseStub(options: { onInvoiceUpsert(id: string): void }) {
	return {
		id: 'stub-db',
		type: 'database',
		dialect: 'postgres',
		persistRaw: true,
		repositories: {
			customers: {
				async findByProviderId() {
					return null;
				},
				async upsert() {},
				async list() {
					return { data: [], next: null, previous: null, total: 0 };
				},
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
				async upsert(_schema: unknown, payment: { id: string }) {
					options.onInvoiceUpsert(payment.id);
				},
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
		async query<Row = unknown>(_query: CompiledQuery) {
			return [] as Row[];
		},
		async execute(_query: CompiledQuery) {},
		async transaction(
			callback: (database: PaymeshDatabaseDriver) => Promise<unknown>,
		) {
			return callback(this as unknown as PaymeshDatabaseDriver);
		},
	} as unknown as PaymeshDatabaseDriver;
}

function createSchema() {
	return {
		customTables: {},
		prefix: 'paymesh_',
		tables: {
			checkouts: { fields: {}, key: 'checkouts', name: 'paymesh_checkouts' },
			customers: { fields: {}, key: 'customers', name: 'paymesh_customers' },
			entitlements: {
				fields: {},
				key: 'entitlements',
				name: 'paymesh_entitlements',
			},
			invoices: { fields: {}, key: 'invoices', name: 'paymesh_invoices' },
			migrations: { fields: {}, key: 'migrations', name: 'paymesh_migrations' },
			paymentMethods: {
				fields: {},
				key: 'paymentMethods',
				name: 'paymesh_payment_methods',
			},
			prices: { fields: {}, key: 'prices', name: 'paymesh_prices' },
			products: { fields: {}, key: 'products', name: 'paymesh_products' },
			subscriptions: {
				fields: {},
				key: 'subscriptions',
				name: 'paymesh_subscriptions',
			},
			usage: { fields: {}, key: 'usage', name: 'paymesh_usage' },
			webhookEvents: {
				fields: {},
				key: 'webhookEvents',
				name: 'paymesh_webhook_events',
			},
		},
	} as const;
}
