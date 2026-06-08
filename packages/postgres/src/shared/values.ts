/**
 * Converts a number-like nullable database value to a number.
 */
export function toNullableNumber(value: number | string | null) {
	if (typeof value === 'number') return value;
	if (typeof value === 'string' && value.length > 0) return Number(value);
	return null;
}

/**
 * Converts a database date value to ISO string form.
 */
export function toIsoString(value: Date | string | null) {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : String(value);
}
