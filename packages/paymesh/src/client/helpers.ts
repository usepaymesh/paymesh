import { PaymeshError } from '../errors';
import type { ProviderCapability } from '../types/providers';

export type RuntimeHookDispatcher = (
	hook: string,
	event: unknown,
) => Promise<void>;

export function resolveIncludeRaw(
	callIncludeRaw: boolean | undefined,
	baseIncludeRaw: boolean,
) {
	return callIncludeRaw ?? baseIncludeRaw ?? false;
}

export function getRequiredProviderFeature<T>(
	feature: T | undefined,
	providerId: string,
	capability: ProviderCapability,
) {
	if (feature) return feature;

	throw new PaymeshError({
		code: 'unsupported_capability',
		message: `Provider "${providerId}" does not support "${capability}" capability`,
		provider: providerId,
	});
}
