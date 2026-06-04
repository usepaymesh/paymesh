import { describe, expect, test } from 'bun:test';
import type { CompiledQuery, PaymeshDatabaseDriver } from 'paymesh';
import { polar } from '../src';

describe('polar dashboard adapter', () => {
	test('syncs orders and subscriptions for dashboard actions', async () => {
		let syncedInvoiceId: string | undefined;
		let syncedSubscriptionId: string | undefined;
		const provider = polar({
			accessToken: 'polar_oat_123',
			baseUrl: 'https://polar.dashboard.test',
			fetch: (async (input) => {
				if (String(input).endsWith('/v1/orders/ord_123')) {
					return Response.json({
						id: 'ord_123',
						status: 'paid',
						paid: true,
						total_amount: 3900,
						currency: 'usd',
						customer_id: 'cus_123',
					});
				}

				if (String(input).endsWith('/v1/subscriptions/sub_123')) {
					return Response.json({
						id: 'sub_123',
						amount: 3900,
						currency: 'usd',
						customer_id: 'cus_123',
						product_id: 'prod_123',
						price_id: 'price_123',
						status: 'active',
						cancel_at_period_end: false,
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});

		const database = createDatabaseStub({
			onInvoiceUpsert(id) {
				syncedInvoiceId = id;
			},
			onSubscriptionUpsert(id) {
				syncedSubscriptionId = id;
			},
		});

		const payment = await provider.dashboard?.syncPayment?.({
			database,
			id: 'ord_123',
			schema: createSchema(),
		});
		const subscription = await provider.dashboard?.syncSubscription?.({
			database,
			id: 'sub_123',
			schema: createSchema(),
		});

		expect(
			provider.dashboard?.getResourceUrl?.({
				type: 'payment',
				id: 'ord_123',
			}),
		).toBe('https://polar.sh/dashboard');
		expect(payment?.id).toBe('ord_123');
		expect(subscription?.id).toBe('sub_123');
		expect(syncedInvoiceId).toBe('ord_123');
		expect(syncedSubscriptionId).toBe('sub_123');
	});
});

function createDatabaseStub(options: {
	onInvoiceUpsert(id: string): void;
	onSubscriptionUpsert(id: string): void;
}) {
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
				async upsert(_schema: unknown, event: { data?: { id?: string } }) {
					options.onSubscriptionUpsert(event.data?.id ?? 'missing');
				},
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
