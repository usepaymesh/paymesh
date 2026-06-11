/**
 * Drops the public `raw` field from a payload before storing normalized data.
 *
 * @example
 * ```ts
 * const data = withoutRaw({ id: '1', name: 'test', raw: { ... } });
 * // => { id: '1', name: 'test' }
 * ```
 */
export function withoutRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return {};

	const { raw: _raw, ...data } = value as Record<string, unknown>;

	return data;
}

/**
 * Converts unknown values into records when possible.
 *
 * Returns an empty object for non-object values.
 *
 * @example
 * ```ts
 * asRecord({ foo: 1 }); // => { foo: 1 }
 * asRecord(null);        // => {}
 * asRecord('hello');     // => {}
 * ```
 */
export function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Reads the hidden raw payload attached through `withRaw`.
 *
 * The raw payload is stored under the `Symbol.for('paymesh.raw')` key.
 * Returns `null` when no raw payload is present.
 */
export function getInternalRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return null;

	const rawKey = Symbol.for('paymesh.raw');
	return (value as Record<PropertyKey, unknown>)[rawKey] ?? null;
}

/**
 * Returns the raw payload to persist for normalized provider records.
 *
 * Extracts the internal raw via `Symbol.for('paymesh.raw')` when `persistRaw`
 * is `true`, otherwise returns `null`.
 */
export function getPersistableRaw(persistRaw: boolean, value: unknown) {
	return persistRaw ? (getInternalRaw(value) ?? null) : null;
}

/**
 * Returns the raw payload to persist for catalog snapshots.
 *
 * Catalog records store the raw value directly (unlike normalized records
 * which use `Symbol.for('paymesh.raw')`). Returns `null` when `persistRaw`
 * is `false`.
 */
export function getPersistableCatalogRaw(persistRaw: boolean, value: unknown) {
	return persistRaw ? (value ?? null) : null;
}

/**
 * Resolves a stable version label from a record or its metadata.
 *
 * Checks for a `version` string on the record or its `metadata.version`,
 * falling back to `'v1'` when no version is found.
 */
export function getVersion(value: unknown, raw: unknown) {
	for (const candidate of [value, raw]) {
		const record = asRecord(candidate);

		if (typeof record.version === 'string' && record.version.length > 0)
			return record.version;

		const metadata = asRecord(record.metadata);

		if (typeof metadata.version === 'string' && metadata.version.length > 0)
			return metadata.version;
	}

	return 'v1';
}
