import type {
	DatabaseTableKey,
	ResolvedDatabaseSchema,
	SqlValue,
} from 'paymesh';
import type { SqlExecutor } from '../types';

interface SchemaField {
	key: string;
	column: string;
}

/**
 * Rebuilds a row payload by merging the stored `data` object with schema-backed fields.
 */
export function hydrateStoredData<Row extends Record<string, unknown>>(
	rowData: Record<string, unknown> | null | undefined,
	fields: readonly SchemaField[],
	row: Row,
) {
	const data = { ...(rowData ?? {}) };

	for (const field of fields) {
		const value = row[field.key];
		if (value !== null && value !== undefined) data[field.key] = value;
	}

	return data;
}

/**
 * Removes schema-backed fields from a record before persisting it in `data`.
 */
export function withoutSchemaFields(
	value: Record<string, unknown>,
	fields: ResolvedDatabaseSchema['tables'][DatabaseTableKey]['fields'],
) {
	if (Object.keys(fields).length === 0) return value;

	const data = { ...value };

	for (const key of Object.keys(fields)) delete data[key];

	return data;
}

/**
 * Collects schema-backed values from a record for explicit columns.
 */
export function getExtraFieldValues(
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

/**
 * Minimal SQL executor contract used by Drizzle repository helpers.
 */
export type { SqlExecutor };
