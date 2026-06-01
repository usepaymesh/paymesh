import type { WithRaw } from '../types/providers';

const PAYMESH_INTERNAL_RAW = Symbol.for('paymesh.raw');

export function withRaw<TObject extends object, IncludeRaw extends boolean>(
	object: TObject,
	raw: unknown,
	includeRaw?: IncludeRaw,
): WithRaw<TObject, IncludeRaw> {
	const value = {
		...object,
		raw: includeRaw ? raw : null,
	} as WithRaw<TObject, IncludeRaw> & {
		[PAYMESH_INTERNAL_RAW]?: unknown;
	};

	Object.defineProperty(value, PAYMESH_INTERNAL_RAW, {
		configurable: false,
		enumerable: false,
		value: raw,
		writable: false,
	});

	return value;
}

export function getInternalRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return null;

	return (
		(value as { [PAYMESH_INTERNAL_RAW]?: unknown })[PAYMESH_INTERNAL_RAW] ??
		null
	);
}
