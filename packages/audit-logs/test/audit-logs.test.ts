import { describe, expect, test } from 'bun:test';
import {
	type CompiledQuery,
	createClient,
	defineDatabaseAdapter,
	defineProvider,
	withRaw,
} from 'paymesh';
import { auditLog } from '../src/index';

describe('@paymesh/audit-logs', () => {
	test('creates, redacts, and lists manual audit log entries', async () => {
		const database = createAuditDatabase();
		const client = createClient({
			provider: createWebhookProvider(),
			database,
			plugins: [auditLog()] as const,
		});

		const created = await client.auditLog.create({
			action: 'user.upgraded_manually',
			actor: {
				type: 'user',
				id: 'user_123',
				email: 'admin@app.com',
			},
			resource: {
				type: 'subscription',
				id: 'sub_123',
			},
			customerId: 'cus_123',
			message: 'Admin manually upgraded customer to Pro',
			metadata: {
				password: 'secret',
				toPlan: 'pro',
			},
		});
		const listed = await client.auditLog.list({
			customerId: 'cus_123',
		});

		expect(created.id).toStartWith('alog_');
		expect(created.metadata).toEqual({
			password: '[REDACTED]',
			toPlan: 'pro',
		});
		expect(listed.total).toBe(1);
		expect(listed.data[0]?.action).toBe('user.upgraded_manually');
		expect(listed.data[0]?.resource.id).toBe('sub_123');
	});

	test('captures normalized webhook events with request context', async () => {
		const database = createAuditDatabase();
		const client = createClient({
			provider: createWebhookProvider(),
			database,
			plugins: [auditLog({ events: ['customer.*'] })] as const,
		});

		const result = await client.webhooks.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-request-id': 'req_123',
					'x-correlation-id': 'corr_123',
					'user-agent': 'bun-test',
				},
				body: JSON.stringify({
					id: 'cus_123',
					email: 'ada@example.com',
				}),
			}),
		});
		const listed = await client.auditLog.list({
			customerId: 'cus_123',
		});

		expect(result.status).toBe(200);
		expect(listed.total).toBe(1);
		expect(listed.data[0]).toMatchObject({
			action: 'customer.created',
			source: 'webhook',
			customerId: 'cus_123',
			requestId: 'req_123',
			correlationId: 'corr_123',
			webhookEventId: 'delivery_123',
			providerEventId: 'evt_123',
			provider: 'stub',
		});
	});

	test('prunes old entries with an explicit cutoff', async () => {
		const database = createAuditDatabase();
		const client = createClient({
			provider: createWebhookProvider(),
			database,
			plugins: [auditLog()] as const,
		});

		await client.auditLog.create({
			action: 'customer.created',
			resource: {
				type: 'customer',
				id: 'cus_old',
			},
			occurredAt: '2024-01-01T00:00:00.000Z',
		});
		await client.auditLog.create({
			action: 'customer.updated',
			resource: {
				type: 'customer',
				id: 'cus_new',
			},
			occurredAt: '2026-01-01T00:00:00.000Z',
		});

		const summary = await client.auditLog.prune({
			before: '2025-01-01T00:00:00.000Z',
		});
		const listed = await client.auditLog.list();

		expect(summary.deleted).toBe(1);
		expect(listed.total).toBe(1);
		expect(listed.data[0]?.resource.id).toBe('cus_new');
	});
});

function createWebhookProvider() {
	return defineProvider({
		id: 'stub',
		isSandbox: () => false,
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
						sandbox: false,
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
						sandbox: false,
					},
					{ id: 'raw_customer' },
					options?.includeRaw,
				),
			upsert: async (_data, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
						sandbox: false,
					},
					{ id: 'raw_customer' },
					options?.includeRaw,
				),
			delete: async (_id, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
						sandbox: false,
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
					deliveryId: 'delivery_123',
					hook: 'onCustomerCreated',
					event: withRaw(
						{
							id: 'evt_123',
							type: 'customer.created' as const,
							provider: 'stub',
							sandbox: false,
							data: withRaw(
								{
									id: String(payload.id ?? 'cus_123'),
									provider: 'stub',
									sandbox: false,
									email:
										typeof payload.email === 'string'
											? payload.email
											: undefined,
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
}

function createAuditDatabase() {
	const rows: AuditLogDatabaseRow[] = [];
	const database = defineDatabaseAdapter({
		id: 'audit-db',
		dialect: 'postgres',
		persistRaw: false,
		repositories: {
			customers: {
				async findByProviderId() {
					return null;
				},
				async list() {
					return {
						data: [],
						total: 0,
						previous: null,
						next: null,
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
			if (query.sql.includes('COUNT(*) AS total')) {
				return [{ total: filterRows(rows, query).length }] as Row[];
			}

			if (query.sql.startsWith('SELECT *')) {
				const filtered = filterRows(rows, query);
				const ordered = orderRows(filtered, query.sql);
				const limit = Number(query.params[query.params.length - 1] ?? 20);
				return ordered.slice(0, limit) as Row[];
			}

			if (query.sql.startsWith('DELETE FROM')) {
				const cutoff = String(query.params[0]);
				const deleted = rows.filter((row) => row.occurred_at < cutoff);
				for (const row of deleted) {
					rows.splice(rows.indexOf(row), 1);
				}
				return deleted.map((row) => ({ id: row.id })) as Row[];
			}

			return [] as Row[];
		},
		async execute(query) {
			if (!query.sql.startsWith('INSERT INTO')) {
				return;
			}

			rows.push(rowFromInsert(query));
		},
		async transaction(callback) {
			return callback(database);
		},
	});

	return database;
}

interface AuditLogDatabaseRow {
	id: string;
	action: string;
	category: string | null;
	actor_type: string | null;
	actor_id: string | null;
	actor_email: string | null;
	actor_name: string | null;
	resource_type: string;
	resource_id: string | null;
	resource_name: string | null;
	customer_id: string | null;
	organization_id: string | null;
	provider: string | null;
	provider_account_id: string | null;
	provider_resource_id: string | null;
	source: string;
	status: string;
	severity: string;
	message: string | null;
	changes: Record<string, unknown> | unknown[] | null;
	metadata: Record<string, unknown> | unknown[] | null;
	request_id: string | null;
	correlation_id: string | null;
	idempotency_key: string | null;
	webhook_event_id: string | null;
	provider_event_id: string | null;
	ip_address: string | null;
	user_agent: string | null;
	occurred_at: string;
	created_at: string;
	hash: string | null;
	previous_hash: string | null;
}

function rowFromInsert(query: CompiledQuery): AuditLogDatabaseRow {
	const [
		id,
		action,
		category,
		actor_type,
		actor_id,
		actor_email,
		actor_name,
		resource_type,
		resource_id,
		resource_name,
		customer_id,
		organization_id,
		provider,
		provider_account_id,
		provider_resource_id,
		source,
		status,
		severity,
		message,
		changes,
		metadata,
		request_id,
		correlation_id,
		idempotency_key,
		webhook_event_id,
		provider_event_id,
		ip_address,
		user_agent,
		occurred_at,
		hash,
		previous_hash,
	] = query.params;

	return {
		id: String(id),
		action: String(action),
		category: toNullableString(category),
		actor_type: toNullableString(actor_type),
		actor_id: toNullableString(actor_id),
		actor_email: toNullableString(actor_email),
		actor_name: toNullableString(actor_name),
		resource_type: String(resource_type),
		resource_id: toNullableString(resource_id),
		resource_name: toNullableString(resource_name),
		customer_id: toNullableString(customer_id),
		organization_id: toNullableString(organization_id),
		provider: toNullableString(provider),
		provider_account_id: toNullableString(provider_account_id),
		provider_resource_id: toNullableString(provider_resource_id),
		source: String(source),
		status: String(status),
		severity: String(severity),
		message: toNullableString(message),
		changes: (changes as AuditLogDatabaseRow['changes']) ?? null,
		metadata: (metadata as AuditLogDatabaseRow['metadata']) ?? null,
		request_id: toNullableString(request_id),
		correlation_id: toNullableString(correlation_id),
		idempotency_key: toNullableString(idempotency_key),
		webhook_event_id: toNullableString(webhook_event_id),
		provider_event_id: toNullableString(provider_event_id),
		ip_address: toNullableString(ip_address),
		user_agent: toNullableString(user_agent),
		occurred_at: new Date(String(occurred_at)).toISOString(),
		created_at: new Date().toISOString(),
		hash: toNullableString(hash),
		previous_hash: toNullableString(previous_hash),
	};
}

function filterRows(rows: AuditLogDatabaseRow[], query: CompiledQuery) {
	const filterColumns = [...query.sql.matchAll(/"([a-z_]+)" = \$\d+/g)].map(
		(match) => match[1] ?? '',
	);
	const equalityParams = query.params.slice(0, filterColumns.length);
	let filtered = rows.filter((row) =>
		filterColumns.every(
			(column, index) =>
				String(row[column as keyof AuditLogDatabaseRow] ?? '') ===
				String(equalityParams[index] ?? ''),
		),
	);

	const cursorIndex = filterColumns.length;
	if (query.sql.includes('(occurred_at, id) <')) {
		const occurredAt = String(query.params[cursorIndex] ?? '');
		const id = String(query.params[cursorIndex + 1] ?? '');
		filtered = filtered.filter(
			(row) =>
				row.occurred_at < occurredAt ||
				(row.occurred_at === occurredAt && row.id < id),
		);
	}

	if (query.sql.includes('(occurred_at, id) >')) {
		const occurredAt = String(query.params[cursorIndex] ?? '');
		const id = String(query.params[cursorIndex + 1] ?? '');
		filtered = filtered.filter(
			(row) =>
				row.occurred_at > occurredAt ||
				(row.occurred_at === occurredAt && row.id > id),
		);
	}

	return filtered;
}

function orderRows(rows: AuditLogDatabaseRow[], sql: string) {
	const ordered = [...rows].sort((left, right) => {
		if (left.occurred_at !== right.occurred_at) {
			return left.occurred_at < right.occurred_at ? -1 : 1;
		}

		return left.id < right.id ? -1 : 1;
	});

	return sql.includes('ORDER BY occurred_at ASC') ? ordered : ordered.reverse();
}

function toNullableString(value: unknown) {
	return value == null ? null : String(value);
}
