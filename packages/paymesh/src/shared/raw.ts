import type { WithRaw } from '../types/providers';

const PAYMESH_INTERNAL_RAW = Symbol.for('paymesh.raw');

/**
 * Attaches the raw upstream payload to an object when `includeRaw` is enabled.
 *
 * @example
 * ```ts
 * const payment = withRaw({ id: 'pay_123', provider: 'stripe' }, raw, true);
 * ```
 */
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

/**
 * Reads the internal raw payload that was stored by `withRaw`.
 */
export function getInternalRaw(value: unknown) {
	if (typeof value !== 'object' || value === null) return null;

	return (
		(value as { [PAYMESH_INTERNAL_RAW]?: unknown })[PAYMESH_INTERNAL_RAW] ??
		null
	);
}
