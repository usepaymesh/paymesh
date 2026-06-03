import type { ResolvedDatabaseExtraTableFields } from '../../types/database';

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
