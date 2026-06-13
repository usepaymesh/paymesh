import { describe, expect, test } from 'bun:test';
import {
	type CompiledQuery,
	createClient,
	defineProvider,
	type PaymeshDatabaseDriver,
} from 'paymesh';
import { Dashboard, dash } from '../src';

describe('@paymesh/dash', () => {
	test('renders the dashboard shell and overview API through the standalone handler', async () => {
		const database = createDashboardDatabase();
		const client = createClient({
			provider: createDashboardProvider(),
			database,
			plugins: [
				dash({
					auth() {
						return {
							id: 'usr_123',
							email: 'ada@example.com',
							name: 'Ada',
						};
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const page = await handler(
			new Request('https://app.test/admin/paymesh', { method: 'GET' }),
		);
		const overview = await handler(
			new Request('https://app.test/admin/paymesh/api/overview', {
				method: 'GET',
			}),
		);

		expect(page.status).toBe(200);
		expect(await page.text()).toContain('Paymesh Dashboard');
		expect(overview.status).toBe(200);
		expect(await overview.json()).toMatchObject({
			counts: {
				customers: 3,
				pix: 2,
				webhooks: 1,
			},
			provider: {
				id: 'stub',
			},
		});
	});

	test('denies access when auth throws and keeps unrelated paths out of scope', async () => {
		const client = createClient({
			provider: createDashboardProvider(),
			database: createDashboardDatabase(),
			plugins: [
				dash({
					auth() {
						throw new Error('No access');
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const page = await handler(
			new Request('https://app.test/admin/paymesh', { method: 'GET' }),
		);
		const api = await handler(
			new Request('https://app.test/admin/paymesh/api/overview', {
				method: 'GET',
			}),
		);
		const outside = await handler(
			new Request('https://app.test/elsewhere', { method: 'GET' }),
		);

		expect(page.status).toBe(403);
		expect(api.status).toBe(403);
		expect(await api.json()).toEqual({
			error: 'plugin_error',
			message: 'No access',
		});
		expect(outside.status).toBe(404);
	});

	test('creates customers through the dashboard API and writes an audit entry', async () => {
		const database = createDashboardDatabase();
		let createdEmail: string | undefined;
		const client = createClient({
			provider: createDashboardProvider({
				onCustomerUpsert(data) {
					createdEmail = data.email;
				},
			}),
			database,
			plugins: [
				dash({
					auth() {
						return {
							id: 'usr_456',
							email: 'ops@example.com',
						};
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const response = await handler(
			new Request('https://app.test/admin/paymesh/api/customers', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					email: 'new@example.com',
					name: 'New Customer',
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			email: 'new@example.com',
			id: 'cus_created',
			name: 'New Customer',
		});
		expect(createdEmail).toBe('new@example.com');
		expect(database.auditLog.length).toBe(1);
		expect(database.auditLog[0]).toMatchObject({
			action: 'customer.create',
			actor_id: 'usr_456',
			resource_id: 'cus_created',
		});
	});

	test('creates PIX payments through the dashboard API and writes an audit entry', async () => {
		const database = createDashboardDatabase();
		let createdPixAmount: number | undefined;
		const client = createClient({
			provider: createDashboardProvider({
				onPixCreate(data) {
					createdPixAmount = data.amount;
				},
			}),
			database,
			plugins: [
				dash({
					auth() {
						return {
							id: 'usr_pix',
							email: 'finance@example.com',
						};
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const response = await handler(
			new Request('https://app.test/admin/paymesh/api/pix', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					amount: 2300,
					currency: 'BRL',
					customer: {
						email: 'pix@example.com',
					},
					description: 'PIX order',
					pix: {
						expiresAfterSeconds: 900,
					},
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: 'pix_created',
			status: 'pending',
		});
		expect(createdPixAmount).toBe(2300);
		expect(database.auditLog).toContainEqual(
			expect.objectContaining({
				action: 'pix.create',
				actor_id: 'usr_pix',
				resource_id: 'pix_created',
			}),
		);
	});

	test('resolves relative checkout redirect URLs through the dashboard API', async () => {
		const database = createDashboardDatabase();
		let paymentInput:
			| {
					cancelUrl?: string;
					returnUrl?: string;
					successUrl?: string;
			  }
			| undefined;
		const client = createClient({
			provider: createDashboardProvider({
				onPaymentCreate(data) {
					paymentInput = data;
				},
			}),
			database,
			trustedOrigins: ['https://app.test'],
			plugins: [
				dash({
					auth() {
						return {
							id: 'usr_pay',
						};
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const response = await handler(
			new Request('https://app.test/admin/paymesh/api/payments', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					amount: 1200,
					currency: 'USD',
					successUrl: '/success',
					cancelUrl: '/cancel',
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(paymentInput).toMatchObject({
			successUrl: 'https://app.test/success',
			cancelUrl: 'https://app.test/cancel',
		});
	});

	test('rejects untrusted relative checkout redirect URLs through the dashboard API', async () => {
		const database = createDashboardDatabase();
		const client = createClient({
			provider: createDashboardProvider(),
			database,
			trustedOrigins: ['https://app.test'],
			plugins: [
				dash({
					auth() {
						return {
							id: 'usr_pay',
						};
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const response = await handler(
			new Request('https://admin.test/admin/paymesh/api/payments', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					amount: 1200,
					currency: 'USD',
					successUrl: '/success',
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'invalid_request',
			message: 'Untrusted origin for request origin: "https://admin.test".',
		});
	});

	test('resolves relative checkout redirect URLs with wildcard trusted origins', async () => {
		const database = createDashboardDatabase();
		let paymentInput:
			| {
					successUrl?: string;
			  }
			| undefined;
		const client = createClient({
			provider: createDashboardProvider({
				onPaymentCreate(data) {
					paymentInput = data;
				},
			}),
			database,
			trustedOrigins: ['rewritetoday.com*'],
			plugins: [
				dash({
					auth() {
						return {
							id: 'usr_pay',
						};
					},
				}),
			] as const,
		});
		const handler = Dashboard({ client });

		const response = await handler(
			new Request('https://rewritetoday.com/admin/paymesh/api/payments', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					amount: 1200,
					currency: 'USD',
					successUrl: '/success',
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(paymentInput?.successUrl).toBe('https://rewritetoday.com/success');
	});
});

function createDashboardProvider(options?: {
	onCustomerUpsert?(data: { email?: string; name?: string }): void;
	onPixCreate?(data: { amount: number }): void;
	onPaymentCreate?(data: {
		cancelUrl?: string;
		returnUrl?: string;
		successUrl?: string;
	}): void;
}) {
	return defineProvider({
		id: 'stub',
		isSandbox: () => false,
		capabilities: {
			checkout: true,
			customers: true,
			pix: true,
			subscriptions: true,
			webhooks: true,
		},
		payments: {
			async create(data) {
				options?.onPaymentCreate?.(data);
				return {
					id: 'pay_created',
					provider: 'stub',
					sandbox: false,
					amount: 1200,
					currency: 'usd',
					status: 'pending' as const,
					checkoutUrl: 'https://checkout.test/pay_created',
					raw: null,
				};
			},
		},
		pix: {
			async create(data) {
				options?.onPixCreate?.({
					amount: data.amount,
				});

				return {
					id: 'pix_created',
					provider: 'stub',
					sandbox: false,
					amount: data.amount,
					copyPasteCode: '000201PIXDASH',
					currency: data.currency.toLowerCase(),
					method: 'pix' as const,
					status: 'pending' as const,
					raw: null,
				};
			},
			async get(id) {
				return {
					id,
					provider: 'stub',
					sandbox: false,
					amount: 2300,
					copyPasteCode: '000201PIXDASH',
					currency: 'brl',
					method: 'pix' as const,
					status: 'pending' as const,
					raw: null,
				};
			},
		},
		customers: {
			async get(id) {
				return {
					id,
					provider: 'stub',
					sandbox: false,
					email: 'customer@example.com',
					raw: null,
				};
			},
			async upsert(data) {
				options?.onCustomerUpsert?.({
					email: data.email,
					name: data.name,
				});

				return {
					id: 'cus_created',
					provider: 'stub',
					sandbox: false,
					email: data.email,
					name: data.name,
					raw: null,
				};
			},
			async delete(id) {
				return {
					id,
					provider: 'stub',
					sandbox: false,
					deleted: true,
					raw: null,
				};
			},
		},
		dashboard: {
			async getBalance() {
				return null;
			},
		},
	});
}

function createDashboardDatabase() {
	const auditLog: Array<Record<string, unknown>> = [];
	const database: PaymeshDatabaseDriver & {
		auditLog: Array<Record<string, unknown>>;
	} = {
		id: 'stub-db',
		type: 'database',
		dialect: 'postgres',
		persistRaw: true,
		auditLog,
		repositories: {
			customers: {
				async findByProviderId() {
					return null;
				},
				async list() {
					return {
						data: [],
						next: null,
						previous: null,
						total: 0,
					};
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
		async query<Row = unknown>(query: CompiledQuery) {
			const sql = query.sql;
			if (sql.includes('AS customer_count')) {
				return [
					{
						checkout_count: '1',
						customer_count: '3',
						failed_webhook_count: '0',
						invoice_count: '2',
						pix_count: '2',
						price_count: '4',
						product_count: '2',
						subscription_count: '1',
						webhook_count: '1',
					},
				] as Row[];
			}

			if (sql.includes('FROM "paymesh_webhook_events"')) {
				return [
					{
						attempts: 1,
						created_at: '2026-06-04T10:00:00.000Z',
						data: {
							id: 'evt_1',
						},
						event_type: 'payment.succeeded',
						last_error: null,
						processed_at: '2026-06-04T10:00:01.000Z',
						provider: 'stub',
						sandbox: false,
						provider_id: 'evt_1',
						raw: {
							id: 'evt_1',
						},
						status: 'processed',
						updated_at: '2026-06-04T10:00:01.000Z',
					},
				] as Row[];
			}

			return [] as Row[];
		},
		async execute(query: CompiledQuery) {
			if (query.sql.includes('INSERT INTO "paymesh_dash_audit_log_entries"')) {
				auditLog.push({
					action: query.params[4],
					actor_id: query.params[0],
					resource_id: query.params[6],
				});
			}
		},
		async transaction(callback) {
			return callback(database);
		},
	};

	return database;
}
