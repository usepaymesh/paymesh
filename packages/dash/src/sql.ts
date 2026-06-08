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

export function customTableName(schema: ResolvedDatabaseSchema, key: string) {
	const table = schema.customTables[key];
	if (!table) {
		throw new Error(`Custom table "${key}" is not registered.`);
	}

	return quoteIdentifier(table.name);
}

export function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}
