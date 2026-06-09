import type { ProviderRequestOptions } from '../../types/providers';
import type { RetryOptions } from '../request';

interface ClientRequestDefaults {
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	includeRaw?: boolean;
	sandbox?: boolean;
}

/**
 * Creates a merge function for provider request options with client defaults.
 *
 * @example
 * ```ts
 * const merge = createRequestOptionsMerger({ baseUrl: 'https://api.example.com' });
 * const options = merge({ includeRaw: true });
 * ```
 */
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
		sandbox: requestOptions?.sandbox ?? defaults.sandbox,
	});
}
