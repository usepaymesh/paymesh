import type { PolarProduct, PolarProductListResponse } from '../types';

/**
 * Normalizes the Polar list response into a flat product array.
 */
export function readPolarProducts(response: PolarProductListResponse) {
	if (Array.isArray(response)) return response;
	if (Array.isArray(response.items)) return response.items;
	if (Array.isArray(response.data)) return response.data;
	if (Array.isArray(response.result)) return response.result;

	return [];
}

/**
 * Reads a stable version label from Polar product metadata.
 */
export function readVersion(metadata: PolarProduct['metadata']) {
	const version = metadata?.version;
	return typeof version === 'string' && version.length > 0
		? version
		: undefined;
}
