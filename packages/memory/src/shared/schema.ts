import type {
	DatabaseTableKey,
	ResolvedDatabaseSchema,
	ResolvedDatabaseTable,
} from 'paymesh';
import { PaymeshError } from 'paymesh';

/**
 * Applies default values from a resolved table schema to a record.
 *
 * Fields that are `undefined` in the record but have a `default` defined
 * in the schema are filled with a deep-cloned copy of the default value.
 */
export function applyTableFieldDefaults<
	TRecord extends Record<string, unknown>,
>(table: ResolvedDatabaseTable, record: TRecord) {
	const next: Record<string, unknown> = { ...record };

	for (const field of Object.values(table.fields)) {
		if (next[field.key] === undefined && field.default !== undefined) {
			next[field.key] = cloneValue(field.default);
		}
	}

	return next;
}

/**
 * Validates that all required fields (per schema) are present and non-null
 * in a record.
 *
 * Throws a `PaymeshError` with `database_error` code when a required field
 * without a default value is missing.
 */
export function validateRequiredTableFields(
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	record: Record<string, unknown>,
) {
	const table = schema.tables[tableKey];

	for (const field of Object.values(table.fields)) {
		if (
			field.required &&
			field.default === undefined &&
			(record[field.key] === undefined || record[field.key] === null)
		) {
			throw new PaymeshError({
				code: 'database_error',
				message: `Missing required field "${field.key}" for table "${table.name}".`,
			});
		}
	}
}

/**
 * Removes all keys that match defined table field keys from a record.
 *
 * Returns a new object containing only the extra (non-schema) keys, which
 * are used as additional metadata attached to stored records.
 */
export function stripTableFieldKeys(
	record: Record<string, unknown>,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
) {
	const next = { ...record };

	for (const key of Object.keys(schema.tables[tableKey].fields)) {
		delete next[key];
	}

	return next;
}

/**
 * Copies defined table field values from a record onto a target object.
 *
 * Ensures that all schema-defined keys are present in the returned object,
 * preserving any existing values from the input record.
 */
export function hydrateTableFieldKeys<TRecord extends Record<string, unknown>>(
	record: TRecord,
	table: ResolvedDatabaseTable,
) {
	const next: Record<string, unknown> = { ...record };

	for (const field of Object.values(table.fields)) {
		if (record[field.key] !== undefined && record[field.key] !== null) {
			next[field.key] = record[field.key];
		}
	}

	return next;
}

/**
 * Deep-clones a value using `structuredClone`.
 *
 * Falls back to returning the original value if cloning fails (e.g. for
 * functions, symbols, or circular references).
 */
export function cloneValue<T>(value: T): T {
	try {
		return structuredClone(value);
	} catch {
		return value;
	}
}
