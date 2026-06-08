import {
	type CompiledQuery,
	type DatabaseTableKey,
	type PaymeshDatabaseRepositories,
	PaymeshError,
	type ResolvedDatabaseSchema,
	type SqlValue,
	withRaw,
} from 'paymesh';

interface SqlExecutor {
	persistRaw: boolean;
	query<Row = unknown>(query: CompiledQuery): Promise<Row[]>;
	execute(query: CompiledQuery): Promise<void>;
}

export function createRepositories(
	executor: SqlExecutor,
): PaymeshDatabaseRepositories {
	return {
		customers: {
			async findByProviderId(schema, provider, id, options) {
				const fields = Object.values(schema.tables.customers.fields);
				const [row] = await executor.query<
					{
						provider: string;
						provider_id: string;
						data: Record<string, unknown> | null;
						raw: unknown;
					} & Record<string, unknown>
				>({
					sql: `SELECT provider, provider_id, data, raw${fields.length === 0 ? '' : `, ${fields.map((field) => `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`).join(', ')}`}
						FROM ${tableName(schema, 'customers')}
						WHERE provider = $1 AND provider_id = $2 AND deleted_at IS NULL
						LIMIT 1`,
					params: [provider, id],
				});

				if (!row) return null;

				const data = { ...(row.data ?? {}) };
				for (const field of fields) {
					const value = row[field.key];
					if (value !== null && value !== undefined) data[field.key] = value;
				}

				return withRaw(
					{
						...data,
						id: row.provider_id,
						provider: row.provider,
					},
					row.raw,
					options?.includeRaw,
				) as never;
			},
			async list(schema, provider, options) {
				const fields = Object.values(schema.tables.customers.fields);
				const limit = options?.limit ?? 20;
				if (!Number.isInteger(limit) || limit <= 0) {
					throw new PaymeshError({
						code: 'invalid_request',
						message: 'Customer list limit must be a positive integer',
					});
				}

				if (options?.after && options?.before) {
					throw new PaymeshError({
						code: 'invalid_request',
						message:
							'Customer list accepts either "after" or "before", not both',
					});
				}

				const cursorValue = options?.before ?? options?.after;
				let cursor: {
					mode: 'after' | 'before';
					value: {
						createdAt: string;
						providerId: string;
					};
				} | null = null;

				if (cursorValue) {
					if (!cursorValue.startsWith('pc1.')) {
						throw new PaymeshError({
							code: 'invalid_request',
							message: 'Invalid customer list cursor',
						});
					}

					try {
						const parsed = JSON.parse(
							Buffer.from(cursorValue.slice(4), 'base64url').toString('utf8'),
						) as Record<string, unknown>;

						if (
							typeof parsed.createdAt !== 'string' ||
							typeof parsed.providerId !== 'string' ||
							parsed.createdAt.length === 0 ||
							parsed.providerId.length === 0
						)
							throw new PaymeshError({
								code: 'database_error',
								message: 'Invalid cursor payload',
							});

						cursor = {
							mode: options?.before ? 'before' : 'after',
							value: {
								createdAt: parsed.createdAt,
								providerId: parsed.providerId,
							},
						};
					} catch {
						throw new PaymeshError({
							code: 'invalid_request',
							message: 'Invalid customer list cursor',
						});
					}
				}
				const includeRaw = options?.includeRaw;
				const [totalRow] = await executor.query<{ total: number | string }>({
					sql: `SELECT COUNT(*) AS total
						FROM ${tableName(schema, 'customers')}
						WHERE provider = $1 AND deleted_at IS NULL`,
					params: [provider],
				});
				const params: SqlValue[] = [provider];
				let cursorSql = '';
				let order = 'ASC';

				if (cursor) {
					params.push(cursor.value.createdAt, cursor.value.providerId);
					if (cursor.mode === 'before') {
						cursorSql = ' AND (created_at, provider_id) < ($2, $3)';
						order = 'DESC';
					} else {
						cursorSql = ' AND (created_at, provider_id) > ($2, $3)';
					}
				}

				params.push(limit + 1);
				const limitPlaceholder = `$${params.length}`;
				const rows = await executor.query<
					{
						provider: string;
						provider_id: string;
						created_at: Date | string;
						data: Record<string, unknown> | null;
						raw: unknown;
					} & Record<string, unknown>
				>({
					sql: `SELECT provider, provider_id, created_at, data, raw${fields.length === 0 ? '' : `, ${fields.map((field) => `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`).join(', ')}`}
						FROM ${tableName(schema, 'customers')}
						WHERE provider = $1 AND deleted_at IS NULL${cursorSql}
						ORDER BY created_at ${order}, provider_id ${order}
						LIMIT ${limitPlaceholder}`,
					params,
				});

				const hasExtra = rows.length > limit;
				const windowRows = hasExtra ? rows.slice(0, limit) : rows;
				const pageRows =
					cursor?.mode === 'before' ? [...windowRows].reverse() : windowRows;
				const data = pageRows.map((row) => {
					const data = { ...(row.data ?? {}) };
					for (const field of fields) {
						const value = row[field.key];
						if (value !== null && value !== undefined) data[field.key] = value;
					}

					return withRaw(
						{
							...data,
							id: row.provider_id,
							provider: row.provider,
						},
						row.raw,
						includeRaw,
					) as never;
				});
				const encodeCursor = (row: {
					created_at: Date | string;
					provider_id: string;
				}) =>
					`pc1.${Buffer.from(
						JSON.stringify({
							createdAt:
								row.created_at instanceof Date
									? row.created_at.toISOString()
									: String(row.created_at),
							providerId: row.provider_id,
						}),
					).toString('base64url')}`;

				return {
					data,
					total: Number(totalRow?.total ?? 0),
					previous:
						data.length === 0
							? null
							: cursor?.mode === 'before'
								? hasExtra
									? encodeCursor(pageRows[0]!)
									: null
								: cursor
									? encodeCursor(pageRows[0]!)
									: null,
					next:
						data.length === 0
							? null
							: cursor?.mode === 'before'
								? encodeCursor(pageRows[pageRows.length - 1]!)
								: hasExtra
									? encodeCursor(pageRows[pageRows.length - 1]!)
									: null,
				};
			},
			upsert: (schema, customer) =>
				upsertByProviderId(executor, schema, 'customers', {
					provider: customer.provider,
					provider_id: customer.id,
					version: getVersion(customer, getInternalRaw(customer)),
					external_id: customer.externalId ?? null,
					name: customer.name ?? null,
					email: customer.email ?? null,
					phone: customer.phone ?? null,
					metadata: customer.metadata ?? null,
					data: withoutSchemaFields(
						withoutRaw(customer),
						schema.tables.customers.fields,
					),
					raw: getPersistableRaw(executor, customer),
					deleted_at: null,
					updated_at: new Date().toISOString(),
					...getExtraFieldValues(schema, 'customers', customer),
				}),
			markDeleted: (schema, customer) =>
				executor.execute({
					sql: `UPDATE ${tableName(schema, 'customers')}
						SET version = $3, data = $4, raw = $5, deleted_at = NOW(), updated_at = NOW()
						WHERE provider = $1 AND provider_id = $2`,
					params: [
						customer.provider,
						customer.id,
						getVersion(customer, getInternalRaw(customer)),
						withoutRaw(customer),
						getPersistableRaw(executor, customer),
					],
				}),
		},
		pix: {
			async findByProviderId(schema, provider, id, options) {
				const fields = Object.values(schema.tables.pix.fields);

				const [row] = await executor.query<
					{
						amount: number | string | null;
						copy_paste_code: string | null;
						currency: string | null;
						customer_provider_id: string | null;
						data: Record<string, unknown> | null;
						expires_at: Date | string | null;
						instructions_url: string | null;
						metadata: Record<string, unknown> | null;
						method: string | null;
						provider: string;
						provider_id: string;
						qr_code_image_url_png: string | null;
						qr_code_image_url_svg: string | null;
						raw: unknown;
						status: string | null;
					} & Record<string, unknown>
				>({
					sql: `SELECT provider, provider_id, customer_provider_id, amount, currency, status, method, copy_paste_code, qr_code_image_url_png, qr_code_image_url_svg, instructions_url, expires_at, metadata, data, raw${fields.length === 0 ? '' : `, ${fields.map((field) => `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`).join(', ')}`}
						FROM ${tableName(schema, 'pix')}
						WHERE provider = $1 AND provider_id = $2
						LIMIT 1`,
					params: [provider, id],
				});

				if (!row) return null;

				const data = { ...(row.data ?? {}) };

				for (const field of fields) {
					const value = row[field.key];

					if (value !== null && value !== undefined) data[field.key] = value;
				}

				return withRaw(
					{
						...data,
						id: row.provider_id,
						provider: row.provider,
						amount: toNullableNumber(row.amount) ?? 0,
						copyPasteCode: row.copy_paste_code ?? undefined,
						currency: row.currency ?? 'usd',
						customer: row.customer_provider_id
							? { id: row.customer_provider_id }
							: undefined,
						expiresAt: toIsoString(row.expires_at) ?? undefined,
						instructionsUrl: row.instructions_url ?? undefined,
						metadata: row.metadata ?? undefined,
						method: row.method ?? 'pix',
						qrCodeImageUrlPng: row.qr_code_image_url_png ?? undefined,
						qrCodeImageUrlSvg: row.qr_code_image_url_svg ?? undefined,
						status: row.status ?? 'pending',
					},
					row.raw,
					options?.includeRaw,
				) as never;
			},
			upsert: (schema, pix) =>
				upsertByProviderId(executor, schema, 'pix', {
					provider: pix.provider,
					provider_id: pix.id,
					version: getVersion(pix, getInternalRaw(pix)),
					customer_provider_id: pix.customer?.id ?? null,
					amount: pix.amount,
					currency: pix.currency,
					status: pix.status,
					method: pix.method,
					copy_paste_code: pix.copyPasteCode ?? null,
					qr_code_image_url_png: pix.qrCodeImageUrlPng ?? null,
					qr_code_image_url_svg: pix.qrCodeImageUrlSvg ?? null,
					instructions_url: pix.instructionsUrl ?? null,
					expires_at: pix.expiresAt ?? null,
					metadata: pix.metadata ?? null,
					data: withoutSchemaFields(withoutRaw(pix), schema.tables.pix.fields),
					raw: getPersistableRaw(executor, pix),
					updated_at: new Date().toISOString(),
					...getExtraFieldValues(schema, 'pix', pix),
				}),
		},
		checkouts: {
			findByProviderId: (schema, provider, id) =>
				findDataByProviderId(executor, schema, 'checkouts', provider, id).then(
					(data) => data as never,
				),
			upsert: (schema, payment) =>
				upsertByProviderId(executor, schema, 'checkouts', {
					provider: payment.provider,
					provider_id: payment.id,
					version: getVersion(payment, getInternalRaw(payment)),
					customer_provider_id: payment.customer?.id ?? null,
					amount: payment.amount,
					currency: payment.currency,
					status: payment.status,
					checkout_url: payment.checkoutUrl ?? null,
					metadata: payment.metadata ?? null,
					data: withoutSchemaFields(
						withoutRaw(payment),
						schema.tables.checkouts.fields,
					),
					raw: getPersistableRaw(executor, payment),
					updated_at: new Date().toISOString(),
					...getExtraFieldValues(schema, 'checkouts', payment),
				}),
		},
		invoices: {
			findByProviderId: (schema, provider, id) =>
				findDataByProviderId(executor, schema, 'invoices', provider, id).then(
					(data) => data as never,
				),
			upsert: (schema, payment) =>
				upsertByProviderId(executor, schema, 'invoices', {
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
					data: withoutRaw(payment),
					raw: getPersistableRaw(executor, payment),
					updated_at: new Date().toISOString(),
				}),
		},
		subscriptions: {
			findByProviderId: (schema, provider, id) =>
				findDataByProviderId(executor, schema, 'subscriptions', provider, id),
			upsert: (schema, event) => {
				const data = asRecord(event.data);
				return upsertByProviderId(executor, schema, 'subscriptions', {
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
				});
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
						withoutRaw(event),
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
						data: withoutRaw(product),
						raw: getPersistableCatalogRaw(executor, product.raw),
						updated_at: new Date().toISOString(),
					})),
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
						data: withoutRaw(price),
						raw: getPersistableCatalogRaw(executor, price.raw),
						updated_at: new Date().toISOString(),
					})),
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
				await executor.execute({
					sql: `CREATE TABLE IF NOT EXISTS ${tableName(schema, 'migrations')} (
						id BIGSERIAL PRIMARY KEY,
						name TEXT NOT NULL UNIQUE,
						applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
					)`,
					params: [],
				});
				const rows = await executor.query<{ name: string }>({
					sql: `SELECT name FROM ${tableName(schema, 'migrations')} ORDER BY name ASC`,
					params: [],
				});
				return rows.map((row) => row.name);
			},
			recordApplied: async (schema, name) => {
				await executor.execute({
					sql: `CREATE TABLE IF NOT EXISTS ${tableName(schema, 'migrations')} (
						id BIGSERIAL PRIMARY KEY,
						name TEXT NOT NULL UNIQUE,
						applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
					)`,
					params: [],
				});
				await executor.execute({
					sql: `INSERT INTO ${tableName(schema, 'migrations')} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
					params: [name],
				});
			},
		},
	};
}

function findDataByProviderId(
	executor: SqlExecutor,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	provider: string,
	id: string,
) {
	return executor
		.query<{ data: Record<string, unknown> | null }>({
			sql: `SELECT data
				FROM ${tableName(schema, tableKey)}
				WHERE provider = $1 AND provider_id = $2
				LIMIT 1`,
			params: [provider, id],
		})
		.then(([row]) => row?.data ?? null);
}

function upsertByProviderId(
	executor: SqlExecutor,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	row: Record<string, SqlValue>,
) {
	const entries = Object.entries(row);
	const updates = entries
		.filter(([column]) => column !== 'provider' && column !== 'provider_id')
		.map(
			([column]) =>
				`${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`,
		);

	return executor.execute({
		sql: `INSERT INTO ${tableName(schema, tableKey)} (${entries.map(([column]) => quoteIdentifier(column)).join(', ')})
			VALUES (${entries.map((_, index) => `$${index + 1}`).join(', ')})
			ON CONFLICT (provider, provider_id) DO UPDATE SET ${updates.join(', ')}`,
		params: entries.map(([, value]) => value),
	});
}

function upsertManyByProviderId(
	executor: SqlExecutor,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	rows: Array<Record<string, SqlValue>>,
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
	const updates = columns
		.filter((column) => column !== 'provider' && column !== 'provider_id')
		.map(
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

function withoutRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return {};

	const { raw: _raw, ...data } = value as Record<string, unknown>;
	return data;
}

function withoutSchemaFields(
	value: Record<string, unknown>,
	fields: ResolvedDatabaseSchema['tables'][DatabaseTableKey]['fields'],
) {
	if (Object.keys(fields).length === 0) return value;

	const data = { ...value };

	for (const key of Object.keys(fields)) {
		delete data[key];
	}

	return data;
}

function getExtraFieldValues(
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	value: unknown,
) {
	if (typeof value !== 'object' || value === null) return {};

	const record = value as Record<string, unknown>;
	return Object.fromEntries(
		Object.values(schema.tables[tableKey].fields)
			.filter((field) => Object.hasOwn(record, field.key))
			.map((field) => [field.column, record[field.key] as SqlValue]),
	) as Record<string, SqlValue>;
}

function getPersistableRaw(
	executor: Pick<SqlExecutor, 'persistRaw'>,
	value: unknown,
) {
	return executor.persistRaw
		? ((getInternalRaw(value) ?? null) as SqlValue)
		: null;
}

function getPersistableCatalogRaw(
	executor: Pick<SqlExecutor, 'persistRaw'>,
	value: unknown,
) {
	return executor.persistRaw ? ((value ?? null) as SqlValue) : null;
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

function toNullableNumber(value: number | string | null) {
	if (typeof value === 'number') return value;
	if (typeof value === 'string' && value.length > 0) return Number(value);
	return null;
}

function toIsoString(value: Date | string | null) {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : String(value);
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
