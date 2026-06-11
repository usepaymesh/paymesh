import { PaymeshError } from 'paymesh';

/**
 * Decoded customer list pagination cursor.
 *
 * Contains the cursor mode (`after` or `before`) and the positional value
 * used for keyset pagination.
 */
export interface CustomerListCursor {
	/** Whether this cursor is for forward (`after`) or backward (`before`) pagination. */
	mode: 'after' | 'before';
	/** Positional value containing the `createdAt` timestamp and `providerId` of the boundary record. */
	value: {
		/** ISO-8601 creation timestamp of the boundary record. */
		createdAt: string;
		/** Provider-assigned customer id of the boundary record. */
		providerId: string;
	};
}

/**
 * Encodes a cursor value into a base64url string prefixed with `pc1.`.
 *
 * The cursor is an opaque token intended to be passed back by the client
 * for keyset pagination.
 */
export function encodeCustomerCursor(row: {
	createdAt: string;
	providerId: string;
}) {
	return `pc1.${Buffer.from(JSON.stringify(row)).toString('base64url')}`;
}

/**
 * Decodes a base64url cursor string back into a {@link CustomerListCursor}.
 *
 * Returns `null` when the cursor value is `undefined`. Throws a
 * `PaymeshError` with `invalid_request` code on malformed input.
 */
export function decodeCustomerCursor(
	cursorValue: string | undefined,
	mode: 'after' | 'before',
): CustomerListCursor | null {
	if (!cursorValue) return null;

	if (!cursorValue.startsWith('pc1.'))
		throw new PaymeshError({
			code: 'invalid_request',
			message: 'Invalid customer list cursor',
		});

	try {
		const parsed = JSON.parse(
			Buffer.from(cursorValue.slice(4), 'base64url').toString('utf8'),
		) as Record<string, unknown>;

		if (
			typeof parsed.createdAt !== 'string' ||
			typeof parsed.providerId !== 'string' ||
			parsed.createdAt.length === 0 ||
			parsed.providerId.length === 0
		)
			throw new Error('invalid');

		return {
			mode,
			value: {
				createdAt: parsed.createdAt,
				providerId: parsed.providerId,
			},
		};
	} catch (err) {
		throw new PaymeshError({
			cause: err,
			code: 'invalid_request',
			message: 'Invalid customer list cursor',
		});
	}
}
