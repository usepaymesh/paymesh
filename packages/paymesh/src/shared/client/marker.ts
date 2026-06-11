import type { PaymeshClient } from '../../types/client';

export const PAYMESH_CLIENT_SYMBOL = Symbol.for('paymesh.client');

export function isPaymeshClient(
	value: unknown,
): value is PaymeshClient<boolean> {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Record<PropertyKey, unknown>)[PAYMESH_CLIENT_SYMBOL] === true
	);
}
