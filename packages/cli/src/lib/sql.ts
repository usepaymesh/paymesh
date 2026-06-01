import type {
	CompiledQuery,
	DatabaseTableKey,
	ResolvedDatabaseSchema,
	SqlValue,
} from 'paymesh';

export function compileQuery(
	sql: string,
	params: SqlValue[] = [],
): CompiledQuery {
	return { sql, params };
}

export function tableName(
	schema: ResolvedDatabaseSchema,
	key: DatabaseTableKey,
) {
	return quoteIdentifier(schema.tables[key].name);
}

export function upsertManyByProviderIdQuery(
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	rows: Array<Record<string, SqlValue>>,
	updateColumns: string[],
) {
	if (rows.length === 0) return null;

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

	return compileQuery(
		`INSERT INTO ${tableName(schema, tableKey)} (${columns.map((column) => quoteIdentifier(column)).join(', ')})
		 VALUES ${values.join(', ')}
		 ON CONFLICT (provider, provider_id) DO UPDATE SET ${updates.join(', ')}`,
		params,
	);
}

function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}
