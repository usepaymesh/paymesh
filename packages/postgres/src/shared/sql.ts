import type {
	DatabaseTableKey,
	ResolvedDatabaseSchema,
	SqlValue,
} from 'paymesh';
import type { SqlExecutor } from './db';

/**
 * Escapes an identifier for direct use in SQL strings.
 */
export function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Resolves the quoted table name for a schema table key.
 */
export function tableName(
	schema: ResolvedDatabaseSchema,
	key: DatabaseTableKey,
) {
	return quoteIdentifier(schema.tables[key].name);
}

/**
 * Loads the persisted `data` payload for a row by provider id.
 */
export async function findDataByProviderId(
	executor: Pick<SqlExecutor, 'query'>,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	provider: string,
	id: string,
) {
	const [row] = await executor.query<{
		data: Record<string, unknown> | null;
		sandbox: boolean | null;
	}>({
		sql: `SELECT data, sandbox
				FROM ${tableName(schema, tableKey)}
				WHERE provider = $1 AND provider_id = $2
				LIMIT 1`,
		params: [provider, id],
	});

	if (!row) return null;

	return {
		...(row.data ?? {}),
		sandbox: row.sandbox ?? false,
	};
}

/**
 * Inserts or updates a single row by provider id.
 */
export function upsertByProviderId(
	executor: Pick<SqlExecutor, 'execute'>,
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

/**
 * Inserts or updates many rows by provider id.
 */
export function upsertManyByProviderId(
	executor: Pick<SqlExecutor, 'execute'>,
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
