import type { ClientOptions } from './types/client';
import type { Provider, ProviderRequestOptions } from './types/providers';

export type * from './errors';

export { PaymeshError } from './errors';

export type * from './types/client';
export type * from './types/providers';

export const createClient = <
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
>({
	provider,
	...options
}: ClientOptions<P, IncludeRaw>) => {
	const mergeOptions = <CallIncludeRaw extends boolean = IncludeRaw>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	): ProviderRequestOptions<CallIncludeRaw> => ({
		baseUrl: requestOptions?.baseUrl ?? options.baseUrl,
		timeout: requestOptions?.timeout ?? options.timeout,
		retry: requestOptions?.retry ?? options.retry,
		fetch: requestOptions?.fetch ?? options.fetch,
		includeRaw: (requestOptions?.includeRaw ??
			options.includeRaw ??
			false) as CallIncludeRaw,
	});

	return {
		provider,
		hooks: options.hooks,
		includeRaw: options.includeRaw,
		payments: {
			create: <CallIncludeRaw extends boolean = IncludeRaw>(
				data: Parameters<P['payments']['create']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => provider.payments.create(data, mergeOptions(requestOptions)),
		},
		customers: {
			create: <CallIncludeRaw extends boolean = IncludeRaw>(
				data: Parameters<P['customers']['create']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => provider.customers.create(data, mergeOptions(requestOptions)),
			get: <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['get']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => provider.customers.get(id, mergeOptions(requestOptions)),
			update: <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['update']>[0],
				data: Parameters<P['customers']['update']>[1],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => provider.customers.update(id, data, mergeOptions(requestOptions)),
			delete: <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['delete']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => provider.customers.delete(id, mergeOptions(requestOptions)),
		},
		capabilities: provider.capabilities,
	};
};
