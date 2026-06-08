import { PaymeshError } from 'paymesh';

/**
 * Cursor shape used by customer pagination.
 */
export interface CustomerListCursor {
	mode: 'after' | 'before';
	value: {
		createdAt: string;
		providerId: string;
	};
}

/**
 * Encodes a customer cursor from a row's ordering fields.
 */
export function encodeCustomerCursor(row: {
	created_at: Date | string;
	provider_id: string;
}) {
	return `pc1.${Buffer.from(
		JSON.stringify({
			createdAt:
				row.created_at instanceof Date
					? row.created_at.toISOString()
					: String(row.created_at),
			providerId: row.provider_id,
		}),
	).toString('base64url')}`;
}

/**
 * Decodes a customer pagination cursor.
 */
export function decodeCustomerCursor(
	cursorValue: string | undefined,
	mode: 'after' | 'before',
): CustomerListCursor | null {
	if (!cursorValue) return null;

	if (!cursorValue.startsWith('pc1.')) {
		throw new PaymeshError({
			code: 'invalid_request',
			message: 'Invalid customer list cursor',
		});
	}

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
			throw new PaymeshError({
				code: 'database_error',
				message: 'Invalid cursor payload',
			});

		return {
			mode,
			value: {
				createdAt: parsed.createdAt,
				providerId: parsed.providerId,
			},
		};
	} catch {
		throw new PaymeshError({
			code: 'invalid_request',
			message: 'Invalid customer list cursor',
		});
	}
}
