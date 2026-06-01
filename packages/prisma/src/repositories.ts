import type {
	CompiledQuery,
	DatabaseTableKey,
	PaymeshDatabaseRepositories,
	ResolvedDatabaseSchema,
	SqlValue,
} from 'paymesh';

interface SqlExecutor {
	persistRaw: boolean;
	query<Row = unknown>(query: CompiledQuery): Promise<Row[]>;
	execute(query: CompiledQuery): Promise<void>;
}

export function createRepositories(
	executor: SqlExecutor,
): PaymeshDatabaseRepositories {
	const repositories: PaymeshDatabaseRepositories = {
		customers: {
			upsert: (schema, customer, options) =>
				upsertByProviderId(
					executor,
					schema,
					'customers',
					{
						provider: customer.provider,
						provider_id: customer.id,
						version: getVersion(customer, getInternalRaw(customer)),
						external_id:
							'externalId' in customer ? (customer.externalId ?? null) : null,
						name: 'name' in customer ? (customer.name ?? null) : null,
						email: 'email' in customer ? (customer.email ?? null) : null,
						phone: 'phone' in customer ? (customer.phone ?? null) : null,
						metadata:
							'metadata' in customer ? (customer.metadata ?? null) : null,
						data: customer,
						raw: getPersistableRaw(executor, customer),
						deleted_at: options?.deleted ? new Date().toISOString() : null,
						updated_at: new Date().toISOString(),
					},
					[
						'external_id',
						'name',
						'email',
						'phone',
						'metadata',
						'data',
						'raw',
						'deleted_at',
						'updated_at',
						'version',
					],
				),
		},
		checkouts: {
			upsert: (schema, payment) =>
				upsertByProviderId(
					executor,
					schema,
					'checkouts',
					{
						provider: payment.provider,
						provider_id: payment.id,
						version: getVersion(payment, getInternalRaw(payment)),
						customer_provider_id: payment.customer?.id ?? null,
						amount: payment.amount,
						currency: payment.currency,
						status: payment.status,
						checkout_url: payment.checkoutUrl ?? null,
						metadata: payment.metadata ?? null,
						data: payment,
						raw: getPersistableRaw(executor, payment),
						updated_at: new Date().toISOString(),
					},
					[
						'customer_provider_id',
						'amount',
						'currency',
						'status',
						'checkout_url',
						'metadata',
						'data',
						'raw',
						'updated_at',
						'version',
					],
				),
		},
		invoices: {
			upsert: (schema, payment) =>
				upsertByProviderId(
					executor,
					schema,
					'invoices',
					{
						provider: payment.provider,
						provider_id: payment.id,
						version: getVersion(payment, getInternalRaw(payment)),
						customer_provider_id: payment.customer?.id ?? null,
						checkout_provider_id: payment.checkoutUrl ? payment.id : null,
						subscription_provider_id: null,
						amount: payment.amount,
						currency: payment.currency,
						status: payment.status,
						metadata: payment.metadata ?? null,
						data: payment,
						raw: getPersistableRaw(executor, payment),
						updated_at: new Date().toISOString(),
					},
					[
						'customer_provider_id',
						'checkout_provider_id',
						'subscription_provider_id',
						'amount',
						'currency',
						'status',
						'metadata',
						'data',
						'raw',
						'updated_at',
						'version',
					],
				),
		},
		subscriptions: {
			upsert: (schema, event) => {
				const data = asRecord(event.data);
				return upsertByProviderId(
					executor,
					schema,
					'subscriptions',
					{
						provider: event.provider,
						provider_id:
							typeof data.id === 'string' && data.id.length > 0
								? data.id
								: event.id,
						version: getVersion(data, getInternalRaw(event.data)),
						customer_provider_id:
							typeof data.customer_id === 'string' ? data.customer_id : null,
						product_provider_id:
							typeof data.product_id === 'string' ? data.product_id : null,
						price_provider_id:
							typeof data.price_id === 'string' ? data.price_id : null,
						status:
							event.type === 'subscription.canceled'
								? 'canceled'
								: typeof data.status === 'string'
									? data.status
									: 'active',
						amount: typeof data.amount === 'number' ? data.amount : null,
						currency: typeof data.currency === 'string' ? data.currency : null,
						cancel_at_period_end:
							typeof data.cancel_at_period_end === 'boolean'
								? data.cancel_at_period_end
								: null,
						data,
						raw: getPersistableRaw(executor, event.data),
						updated_at: new Date().toISOString(),
					},
					[
						'customer_provider_id',
						'product_provider_id',
						'price_provider_id',
						'status',
						'amount',
						'currency',
						'cancel_at_period_end',
						'data',
						'raw',
						'updated_at',
						'version',
					],
				);
			},
		},
		webhookEvents: {
			acquire: async (schema, event, deliveryId) => {
				const [result] = await executor.query<{
					inserted: boolean;
					retried: boolean;
				}>({
					sql: `WITH inserted AS (
						INSERT INTO ${tableName(schema, 'webhookEvents')} (provider, provider_id, version, event_type, status, attempts, data, raw, updated_at)
						VALUES ($1, $2, $3, $4, 'processing', 1, $5, $6, NOW())
						ON CONFLICT (provider, provider_id) DO NOTHING
						RETURNING 1
					),
					retried AS (
						UPDATE ${tableName(schema, 'webhookEvents')}
						SET status = 'processing', attempts = attempts + 1, last_error = NULL, event_type = $4, data = $5, raw = $6, updated_at = NOW()
						WHERE provider = $1 AND provider_id = $2 AND status = 'failed'
						RETURNING 1
					)
					SELECT
						EXISTS(SELECT 1 FROM inserted) AS inserted,
						EXISTS(SELECT 1 FROM retried) AS retried`,
					params: [
						event.provider,
						deliveryId,
						getVersion(event, getInternalRaw(event)),
						event.type,
						event,
						getPersistableRaw(executor, event),
					],
				});

				return result?.inserted || result?.retried
					? { duplicate: false }
					: { duplicate: true };
			},
			markProcessed: (schema, event, deliveryId) =>
				executor.execute({
					sql: `UPDATE ${tableName(schema, 'webhookEvents')}
					 SET status = 'processed', processed_at = NOW(), updated_at = NOW(), last_error = NULL
					 WHERE provider = $1 AND provider_id = $2`,
					params: [event.provider, deliveryId],
				}),
			markFailed: (schema, event, deliveryId, error) =>
				executor.execute({
					sql: `UPDATE ${tableName(schema, 'webhookEvents')}
					 SET status = 'failed', last_error = $3, updated_at = NOW()
					 WHERE provider = $1 AND provider_id = $2`,
					params: [
						event.provider,
						deliveryId,
						error instanceof Error ? error.message : 'Webhook handling failed',
					],
				}),
		},
		products: {
			upsertMany: (schema, provider, products) =>
				upsertManyByProviderId(
					executor,
					schema,
					'products',
					products.map((product) => ({
						provider,
						provider_id: product.id,
						version: product.version ?? 'v1',
						name: product.name ?? null,
						description: product.description ?? null,
						active: product.active ?? null,
						metadata: product.metadata ?? null,
						data: product,
						raw: getPersistableCatalogRaw(executor, product.raw),
						updated_at: new Date().toISOString(),
					})),
					[
						'name',
						'description',
						'active',
						'metadata',
						'data',
						'raw',
						'updated_at',
						'version',
					],
				),
		},
		prices: {
			upsertMany: (schema, provider, prices) =>
				upsertManyByProviderId(
					executor,
					schema,
					'prices',
					prices.map((price) => ({
						provider,
						provider_id: price.id,
						version: price.version ?? 'v1',
						product_provider_id: price.productId ?? null,
						active: price.active ?? null,
						type: price.type ?? null,
						currency: price.currency ?? null,
						amount: price.amount ?? null,
						interval: price.interval ?? null,
						interval_count: price.intervalCount ?? null,
						metadata: price.metadata ?? null,
						data: price,
						raw: getPersistableCatalogRaw(executor, price.raw),
						updated_at: new Date().toISOString(),
					})),
					[
						'product_provider_id',
						'active',
						'type',
						'currency',
						'amount',
						'interval',
						'interval_count',
						'metadata',
						'data',
						'raw',
						'updated_at',
						'version',
					],
				),
		},
		migrations: {
			ensureTable: (schema) =>
				executor.execute({
					sql: `CREATE TABLE IF NOT EXISTS ${tableName(schema, 'migrations')} (
						id BIGSERIAL PRIMARY KEY,
						name TEXT NOT NULL UNIQUE,
						applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
					)`,
					params: [],
				}),
			listApplied: async (schema) => {
				await repositories.migrations.ensureTable(schema);
				const rows = await executor.query<{ name: string }>({
					sql: `SELECT name FROM ${tableName(schema, 'migrations')} ORDER BY name ASC`,
					params: [],
				});
				return rows.map((row) => row.name);
			},
			recordApplied: async (schema, name) => {
				await repositories.migrations.ensureTable(schema);
				await executor.execute({
					sql: `INSERT INTO ${tableName(schema, 'migrations')} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
					params: [name],
				});
			},
		},
	};

	return repositories;
}

function upsertByProviderId(
	executor: SqlExecutor,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	row: Record<string, SqlValue>,
	updateColumns: string[],
) {
	const entries = Object.entries(row);
	const columns = entries.map(([key]) => quoteIdentifier(key));
	const params = entries.map(([, value]) => value);
	const placeholders = params.map((_, index) => `$${index + 1}`);
	const updates = updateColumns.map(
		(column) =>
			`${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`,
	);

	return executor.execute({
		sql: `INSERT INTO ${tableName(schema, tableKey)} (${columns.join(', ')})
		 VALUES (${placeholders.join(', ')})
		 ON CONFLICT (provider, provider_id) DO UPDATE SET ${updates.join(', ')}`,
		params,
	});
}

function upsertManyByProviderId(
	executor: SqlExecutor,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	rows: Array<Record<string, SqlValue>>,
	updateColumns: string[],
) {
	if (rows.length === 0) return Promise.resolve();

	const columns = Object.keys(rows[0] ?? {});
	const params: SqlValue[] = [];
	const values = rows.map((row) => {
		const placeholders = columns.map((column) => {
			params.push(row[column] as SqlValue);
			return `$${params.length}`;
		});

		return `(${placeholders.join(', ')})`;
	});
	const updates = updateColumns.map(
		(column) =>
			`${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`,
	);

	return executor.execute({
		sql: `INSERT INTO ${tableName(schema, tableKey)} (${columns.map((column) => quoteIdentifier(column)).join(', ')})
		 VALUES ${values.join(', ')}
		 ON CONFLICT (provider, provider_id) DO UPDATE SET ${updates.join(', ')}`,
		params,
	});
}

function getPersistableRaw(
	executor: Pick<SqlExecutor, 'persistRaw'>,
	value: unknown,
) {
	return executor.persistRaw ? getInternalRaw(value) : null;
}

function getPersistableCatalogRaw(
	executor: Pick<SqlExecutor, 'persistRaw'>,
	value: unknown,
) {
	return executor.persistRaw ? (value ?? null) : null;
}

function getVersion(value: unknown, raw: unknown) {
	for (const candidate of [value, raw]) {
		const record = asRecord(candidate);
		if (typeof record.version === 'string' && record.version.length > 0) {
			return record.version;
		}

		const metadata = asRecord(record.metadata);
		if (typeof metadata.version === 'string' && metadata.version.length > 0) {
			return metadata.version;
		}
	}

	return 'v1';
}

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

function tableName(schema: ResolvedDatabaseSchema, key: DatabaseTableKey) {
	return quoteIdentifier(schema.tables[key].name);
}

function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function getInternalRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return null;

	const rawKey = Symbol.for('paymesh.raw');
	return (value as Record<PropertyKey, unknown>)[rawKey] ?? null;
}
