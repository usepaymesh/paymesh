import type { ResolvedDatabaseExtraTableFields } from '../../types/database';

/**
 * Splits user input into persisted table columns and extra fields for storage.
 *
 * @example
 * ```ts
 * const { input, extra } = splitExtraFields(
 *   { amount: 1000, note: 'hello' },
 *   { note: { key: 'note', column: 'note', type: 'string' } },
 * );
 * ```
 */
export function splitExtraFields(
	value: unknown,
	fields: ResolvedDatabaseExtraTableFields,
) {
	const extra: Record<string, unknown> = {};

	if (typeof value !== 'object' || value === null) {
		return { input: value, extra };
	}

	const input = { ...(value as Record<string, unknown>) };

	for (const key of Object.keys(fields)) {
		if (!Object.hasOwn(input, key)) continue;
		extra[key] = input[key];
		delete input[key];
	}

	return { input, extra };
}
