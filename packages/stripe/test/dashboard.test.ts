import { describe, expect, test } from 'bun:test';
import {
	type CompiledQuery,
	type PaymeshDatabaseDriver,
	resolveDatabaseSchema,
} from 'paymesh';
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

	test('syncs PIX resources through the dashboard adapter', async () => {
		let syncedInvoiceId: string | undefined;
		let syncedPixId: string | undefined;
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.dashboard.test',
			fetch: (async (input) => {
				if (String(input).endsWith('/v1/payment_intents/pi_pix_123')) {
					return Response.json({
						id: 'pi_pix_123',
						object: 'payment_intent',
						amount: 3100,
						currency: 'brl',
						metadata: {
							orderId: 'ord_pix_123',
						},
						next_action: {
							type: 'pix_display_qr_code',
							pix_display_qr_code: {
								data: '000201DASHPIX',
							},
						},
						payment_method_types: ['pix'],
						status: 'processing',
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});

		const synced = await provider.dashboard?.syncPix?.({
			database: createDatabaseStub({
				onInvoiceUpsert(id) {
					syncedInvoiceId = id;
				},
				onPixUpsert(id) {
					syncedPixId = id;
				},
			}),
			id: 'pi_pix_123',
			schema: createSchema(),
		});

		expect(
			provider.dashboard?.getResourceUrl?.({
				type: 'pix',
				id: 'pi_pix_123',
			}),
		).toBe('https://dashboard.stripe.com/payments/pi_pix_123');
		expect(synced).toMatchObject({
			id: 'pi_pix_123',
			status: 'processing',
			method: 'pix',
			copyPasteCode: '000201DASHPIX',
		});
		expect(syncedInvoiceId).toBe('pi_pix_123');
		expect(syncedPixId).toBe('pi_pix_123');
	});
});

function createDatabaseStub(options: {
	onInvoiceUpsert(id: string): void;
	onPixUpsert?(id: string): void;
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
			pix: {
				async findByProviderId() {
					return null;
				},
				async upsert(_schema: unknown, pix: { id: string }) {
					options.onPixUpsert?.(pix.id);
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
	return resolveDatabaseSchema();
}
