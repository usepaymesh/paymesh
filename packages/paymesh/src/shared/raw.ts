import type { WithRaw } from '../types/providers';

export function withRaw<TObject extends object, IncludeRaw extends boolean>(
	object: TObject,
	raw: unknown,
	includeRaw?: IncludeRaw,
): WithRaw<TObject, IncludeRaw> {
	return {
		...object,
		raw: includeRaw ? raw : null,
	} as WithRaw<TObject, IncludeRaw>;
}
