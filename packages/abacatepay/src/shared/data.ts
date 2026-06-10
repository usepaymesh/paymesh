import { PaymeshError } from 'paymesh';
import type { AbacatePayResponse } from 'src/types';

export function extractData<T>(response: AbacatePayResponse<T>) {
	if (!response.success)
		throw new PaymeshError({
			cause: response,
			provider: 'abacatepay',
			code: 'provider_error',
			message: response.error ?? 'Unknown AbacatePay error',
		});

	return response.data;
}
