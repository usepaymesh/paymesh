import type { SqlValue } from 'paymesh';
import type { SqlExecutor } from './db';

/**
 * Drops the `raw` field from a payload before persisting normalized data.
 */
export function withoutRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return {};

	const { raw: _raw, ...data } = value as Record<string, unknown>;
	return data;
}

/**
 * Converts any unknown value into a record when it can be safely treated as one.
 */
export function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Reads the hidden raw payload attached through `withRaw`.
 */
export function getInternalRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return null;

	const rawKey = Symbol.for('paymesh.raw');
	return (value as Record<PropertyKey, unknown>)[rawKey] ?? null;
}

/**
 * Returns the raw payload to persist for normalized provider records.
 */
export function getPersistableRaw(
	executor: Pick<SqlExecutor, 'persistRaw'>,
	value: unknown,
) {
	return executor.persistRaw
		? ((getInternalRaw(value) ?? null) as SqlValue)
		: null;
}

/**
 * Returns the raw payload to persist for catalog snapshots.
 */
export function getPersistableCatalogRaw(
	executor: Pick<SqlExecutor, 'persistRaw'>,
	value: unknown,
) {
	return executor.persistRaw ? ((value ?? null) as SqlValue) : null;
}

/**
 * Resolves a stable version label from a record or its metadata.
 */
export function getVersion(value: unknown, raw: unknown) {
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
