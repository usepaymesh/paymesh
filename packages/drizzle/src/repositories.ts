import {
	type PaymeshDatabaseRepositories,
	PaymeshError,
	type ResolvedDatabaseSchema,
	type SqlValue,
	withRaw,
} from 'paymesh';
import { decodeCustomerCursor, encodeCustomerCursor } from './shared/cursor';
import {
	getExtraFieldValues,
	hydrateStoredData,
	withoutSchemaFields,
} from './shared/db';
import {
	asRecord,
	getInternalRaw,
	getPersistableCatalogRaw,
	getPersistableRaw,
	getVersion,
	withoutRaw,
} from './shared/raw';
import {
	findDataByProviderId,
	quoteIdentifier,
	tableName,
	upsertByProviderId,
	upsertManyByProviderId,
} from './shared/sql';
import { toIsoString, toNullableNumber } from './shared/values';
import type { SqlExecutor } from './types';

export function createRepositories(
	executor: SqlExecutor,
): PaymeshDatabaseRepositories {
	const migrationsTableSql = (schema: ResolvedDatabaseSchema) =>
		`CREATE TABLE IF NOT EXISTS ${tableName(schema, 'migrations')} (
			id BIGSERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`;

	return {
		customers: {
			async findByProviderId(schema, provider, sandbox, id, options) {
				const fields = Object.values(schema.tables.customers.fields);
				const [row] = await executor.query<
					{
						provider: string;
						provider_id: string;
						sandbox: boolean | null;
						data: Record<string, unknown> | null;
						raw: unknown;
					} & Record<string, unknown>
				>({
					sql: `SELECT provider, provider_id, sandbox, data, raw${fields.length === 0 ? '' : `, ${fields.map((field) => `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`).join(', ')}`}
						FROM ${tableName(schema, 'customers')}
						WHERE provider = $1 AND sandbox = $2 AND provider_id = $3 AND deleted_at IS NULL
						LIMIT 1`,
					params: [provider, sandbox, id],
				});

				if (!row) return null;

				const data = hydrateStoredData(row.data, fields, row);

				return withRaw(
					{
						...data,
						id: row.provider_id,
						provider: row.provider,
						sandbox: row.sandbox ?? false,
					},
					row.raw,
					options?.includeRaw,
				) as never;
			},
			async list(schema, provider, sandbox, options) {
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

				const cursor = decodeCustomerCursor(
					options?.before ?? options?.after,
					options?.before ? 'before' : 'after',
				);
				const includeRaw = options?.includeRaw;
				const [totalRow] = await executor.query<{ total: number | string }>({
					sql: `SELECT COUNT(*) AS total
						FROM ${tableName(schema, 'customers')}
						WHERE provider = $1 AND sandbox = $2 AND deleted_at IS NULL`,
					params: [provider, sandbox],
				});
				const params: SqlValue[] = [provider, sandbox];
				let cursorSql = '';
				let order = 'ASC';

				if (cursor) {
					params.push(cursor.value.createdAt, cursor.value.providerId);
					if (cursor.mode === 'before') {
						cursorSql = ' AND (created_at, provider_id) < ($3, $4)';
						order = 'DESC';
					} else {
						cursorSql = ' AND (created_at, provider_id) > ($3, $4)';
					}
				}

				params.push(limit + 1);
				const limitPlaceholder = `$${params.length}`;
				const rows = await executor.query<
					{
						provider: string;
						provider_id: string;
						sandbox: boolean | null;
						created_at: Date | string;
						data: Record<string, unknown> | null;
						raw: unknown;
					} & Record<string, unknown>
				>({
					sql: `SELECT provider, provider_id, sandbox, created_at, data, raw${fields.length === 0 ? '' : `, ${fields.map((field) => `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`).join(', ')}`}
						FROM ${tableName(schema, 'customers')}
						WHERE provider = $1 AND sandbox = $2 AND deleted_at IS NULL${cursorSql}
						ORDER BY created_at ${order}, provider_id ${order}
						LIMIT ${limitPlaceholder}`,
					params,
				});

				const hasExtra = rows.length > limit;
				const windowRows = hasExtra ? rows.slice(0, limit) : rows;
				const pageRows =
					cursor?.mode === 'before' ? [...windowRows].reverse() : windowRows;
				const data = pageRows.map((row) => {
					const data = hydrateStoredData(row.data, fields, row);

					return withRaw(
						{
							...data,
							id: row.provider_id,
							provider: row.provider,
							sandbox: row.sandbox ?? false,
						},
						row.raw,
						includeRaw,
					) as never;
				});
				return {
					data,
					total: Number(totalRow?.total ?? 0),
					previous:
						data.length === 0
							? null
							: cursor?.mode === 'before'
								? hasExtra
									? encodeCustomerCursor(pageRows[0]!)
									: null
								: cursor
									? encodeCustomerCursor(pageRows[0]!)
									: null,
					next:
						data.length === 0
							? null
							: cursor?.mode === 'before'
								? encodeCustomerCursor(pageRows[pageRows.length - 1]!)
								: hasExtra
									? encodeCustomerCursor(pageRows[pageRows.length - 1]!)
									: null,
				};
			},
			upsert: (schema, customer) =>
				upsertByProviderId(executor, schema, 'customers', {
					provider: customer.provider,
					provider_id: customer.id,
					version: getVersion(customer, getInternalRaw(customer)),
					sandbox: customer.sandbox,
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
						SET version = $4, data = $5, raw = $6, deleted_at = NOW(), updated_at = NOW()
						WHERE provider = $1 AND sandbox = $2 AND provider_id = $3`,
					params: [
						customer.provider,
						customer.sandbox,
						customer.id,
						getVersion(customer, getInternalRaw(customer)),
						withoutRaw(customer),
						getPersistableRaw(executor, customer),
					],
				}),
		},
		pix: {
			async findByProviderId(schema, provider, sandbox, id, options) {
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
						sandbox: boolean | null;
						status: string | null;
					} & Record<string, unknown>
				>({
					sql: `SELECT provider, provider_id, sandbox, customer_provider_id, amount, currency, status, method, copy_paste_code, qr_code_image_url_png, qr_code_image_url_svg, instructions_url, expires_at, metadata, data, raw${fields.length === 0 ? '' : `, ${fields.map((field) => `${quoteIdentifier(field.column)} AS ${quoteIdentifier(field.key)}`).join(', ')}`}
						FROM ${tableName(schema, 'pix')}
						WHERE provider = $1 AND sandbox = $2 AND provider_id = $3
						LIMIT 1`,
					params: [provider, sandbox, id],
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
						sandbox: row.sandbox ?? false,
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
					sandbox: pix.sandbox,
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
			findByProviderId: (schema, provider, sandbox, id) =>
				findDataByProviderId(
					executor,
					schema,
					'checkouts',
					provider,
					sandbox,
					id,
				).then((data) => data as never),
			upsert: (schema, payment) =>
				upsertByProviderId(executor, schema, 'checkouts', {
					provider: payment.provider,
					provider_id: payment.id,
					version: getVersion(payment, getInternalRaw(payment)),
					sandbox: payment.sandbox,
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
			findByProviderId: (schema, provider, sandbox, id) =>
				findDataByProviderId(
					executor,
					schema,
					'invoices',
					provider,
					sandbox,
					id,
				).then((data) => data as never),
			upsert: (schema, payment) =>
				upsertByProviderId(executor, schema, 'invoices', {
					provider: payment.provider,
					provider_id: payment.id,
					version: getVersion(payment, getInternalRaw(payment)),
					sandbox: payment.sandbox,
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
			findByProviderId: (schema, provider, sandbox, id) =>
				findDataByProviderId(
					executor,
					schema,
					'subscriptions',
					provider,
					sandbox,
					id,
				),
			upsert: (schema, event) => {
				const data = asRecord(event.data);
				return upsertByProviderId(executor, schema, 'subscriptions', {
					provider: event.provider,
					provider_id:
						typeof data.id === 'string' && data.id.length > 0
							? data.id
							: event.id,
					version: getVersion(data, getInternalRaw(event.data)),
					sandbox: event.sandbox,
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
						INSERT INTO ${tableName(schema, 'webhookEvents')} (provider, provider_id, version, sandbox, event_type, status, attempts, data, raw, updated_at)
						VALUES ($1, $2, $3, $4, $5, 'processing', 1, $6, $7, NOW())
						ON CONFLICT (provider, sandbox, provider_id) DO NOTHING
						RETURNING 1
					),
					retried AS (
						UPDATE ${tableName(schema, 'webhookEvents')}
						SET status = 'processing', attempts = attempts + 1, last_error = NULL, sandbox = $4, event_type = $5, data = $6, raw = $7, updated_at = NOW()
						WHERE provider = $1 AND sandbox = $4 AND provider_id = $2 AND status = 'failed'
						RETURNING 1
					)
					SELECT
						EXISTS(SELECT 1 FROM inserted) AS inserted,
						EXISTS(SELECT 1 FROM retried) AS retried`,
					params: [
						event.provider,
						deliveryId,
						getVersion(event, getInternalRaw(event)),
						event.sandbox,
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
						WHERE provider = $1 AND sandbox = $2 AND provider_id = $3`,
					params: [event.provider, event.sandbox, deliveryId],
				}),
			markFailed: (schema, event, deliveryId, error) =>
				executor.execute({
					sql: `UPDATE ${tableName(schema, 'webhookEvents')}
						SET status = 'failed', last_error = $3, updated_at = NOW()
						WHERE provider = $1 AND sandbox = $2 AND provider_id = $4`,
					params: [
						event.provider,
						event.sandbox,
						error instanceof Error ? error.message : 'Webhook handling failed',
						deliveryId,
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
						sandbox: product.sandbox,
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
						sandbox: price.sandbox,
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
					sql: migrationsTableSql(schema),
					params: [],
				}),
			listApplied: async (schema) => {
				await executor.execute({
					sql: migrationsTableSql(schema),
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
					sql: migrationsTableSql(schema),
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
