import type { ProviderRequestOptions } from '../../types/providers';
import type { RetryOptions } from '../request';

interface ClientRequestDefaults {
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	includeRaw?: boolean;
}

export function createRequestOptionsMerger(defaults: ClientRequestDefaults) {
	return <IncludeRaw extends boolean = false>(
		requestOptions?: ProviderRequestOptions<IncludeRaw>,
	): ProviderRequestOptions<IncludeRaw> => ({
		baseUrl: requestOptions?.baseUrl ?? defaults.baseUrl,
		timeout: requestOptions?.timeout ?? defaults.timeout,
		retry: requestOptions?.retry ?? defaults.retry,
		fetch: requestOptions?.fetch ?? defaults.fetch,
		includeRaw: (requestOptions?.includeRaw ??
			defaults.includeRaw ??
			false) as IncludeRaw,
	});
}
