import { describe, expect, test } from 'bun:test';
import {
	type CompiledQuery,
	type PaymeshDatabaseDriver,
	resolveDatabaseSchema,
} from 'paymesh';
import { dodo } from '../src';

describe('dodo dashboard adapter', () => {
	test('syncs customer, payment, pix-shaped payment, and subscriptions', async () => {
		let syncedCustomerId: string | undefined;
		let syncedInvoiceId: string | undefined;
		let syncedPixId: string | undefined;
		let syncedSubscriptionId: string | undefined;
		const provider = dodo({
			apiKey: 'dodo_test_123',
			baseUrl: 'https://test.dodopayments.com',
			fetch: (async (input) => {
				if (String(input).endsWith('/customers/cus_123')) {
					return Response.json({
						customer_id: 'cus_123',
						email: 'ana@example.com',
						name: 'Ana',
						metadata: {
							externalId: 'user_123',
						},
					});
				}

				if (String(input).endsWith('/payments/pay_123')) {
					return Response.json({
						payment_id: 'pay_123',
						total_amount: 4200,
						currency: 'USD',
						customer: {
							customer_id: 'cus_123',
							email: 'ana@example.com',
							name: 'Ana',
						},
						metadata: {},
						payment_link: 'https://pay.dodo.test/pay_123',
						status: 'succeeded',
					});
				}

				if (String(input).endsWith('/payments/pay_pix_123')) {
					return Response.json({
						payment_id: 'pay_pix_123',
						total_amount: 3100,
						currency: 'BRL',
						customer: {
							customer_id: 'cus_123',
							email: 'ana@example.com',
							name: 'Ana',
						},
						metadata: {},
						payment_link: 'https://pay.dodo.test/pay_pix_123',
						payment_method_type: 'pix',
						status: 'processing',
					});
				}

				if (String(input).endsWith('/subscriptions/sub_123')) {
					return Response.json({
						subscription_id: 'sub_123',
						product_id: 'prod_123',
						recurring_pre_tax_amount: 3900,
						currency: 'USD',
						status: 'active',
						cancel_at_next_billing_date: false,
						customer: {
							customer_id: 'cus_123',
							email: 'ana@example.com',
							name: 'Ana',
						},
						metadata: {},
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});
		const database = createDatabaseStub({
			onCustomerUpsert(id) {
				syncedCustomerId = id;
			},
			onInvoiceUpsert(id) {
				syncedInvoiceId = id;
			},
			onPixUpsert(id) {
				syncedPixId = id;
			},
			onSubscriptionUpsert(id) {
				syncedSubscriptionId = id;
			},
		});

		const customer = await provider.dashboard?.syncCustomer?.({
			database,
			id: 'cus_123',
			schema: createSchema(),
		});
		const payment = await provider.dashboard?.syncPayment?.({
			database,
			id: 'pay_123',
			schema: createSchema(),
		});
		const pix = await provider.dashboard?.syncPayment?.({
			database,
			id: 'pay_pix_123',
			schema: createSchema(),
		});
		const subscription = await provider.dashboard?.syncSubscription?.({
			database,
			id: 'sub_123',
			schema: createSchema(),
		});

		expect(
			provider.dashboard?.getResourceUrl?.({ type: 'payment', id: 'pay_123' }),
		).toBeNull();
		expect(customer?.id).toBe('cus_123');
		expect(payment?.id).toBe('pay_123');
		expect(pix).toMatchObject({
			id: 'pay_pix_123',
			method: 'pix',
			status: 'processing',
		});
		expect(subscription?.id).toBe('sub_123');
		expect(syncedCustomerId).toBe('cus_123');
		expect(syncedInvoiceId).toBe('pay_pix_123');
		expect(syncedPixId).toBe('pay_pix_123');
		expect(syncedSubscriptionId).toBe('sub_123');
	});
});

function createDatabaseStub(options: {
	onCustomerUpsert(id: string): void;
	onInvoiceUpsert(id: string): void;
	onPixUpsert(id: string): void;
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
				async upsert(_schema: unknown, customer: { id: string }) {
					options.onCustomerUpsert(customer.id);
				},
				async list() {
					return { data: [], next: null, previous: null, total: 0 };
				},
				async markDeleted() {},
			},
			pix: {
				async findByProviderId() {
					return null;
				},
				async upsert(_schema: unknown, pix: { id: string }) {
					options.onPixUpsert(pix.id);
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
	return resolveDatabaseSchema();
}
