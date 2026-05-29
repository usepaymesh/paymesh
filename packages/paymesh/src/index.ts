import { PaymeshError } from './errors';
import type { ClientOptions } from './types/client';
import type {
	Provider,
	ProviderCapability,
	ProviderRequestOptions,
} from './types/providers';

export type * from './errors';

export { PaymeshError } from './errors';
export { defineProvider } from './providers';
export { withRaw } from './shared/raw';
export type { RetryOptions } from './shared/request';
export { request } from './shared/request';
export type * from './types/client';
export type * from './types/providers';

export const createClient = <
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
>({
	provider,
	...options
}: ClientOptions<P, IncludeRaw>) => {
	const assertCapability = (capability: ProviderCapability) => {
		if (!provider.capabilities[capability])
			throw new PaymeshError({
				provider: provider.id,
				code: 'unsupported_capability',
				message: `Provider "${provider.id}" does not support "${capability}" capability`,
			});
	};

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
			) => {
				assertCapability('checkout');

				return provider.payments.create(data, mergeOptions(requestOptions));
			},
		},
		customers: {
			create: <CallIncludeRaw extends boolean = IncludeRaw>(
				data: Parameters<P['customers']['create']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				return provider.customers.create(data, mergeOptions(requestOptions));
			},
			get: <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['get']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				return provider.customers.get(id, mergeOptions(requestOptions));
			},
			update: <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['update']>[0],
				data: Parameters<P['customers']['update']>[1],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				return provider.customers.update(
					id,
					data,
					mergeOptions(requestOptions),
				);
			},
			delete: <CallIncludeRaw extends boolean = IncludeRaw>(
				id: Parameters<P['customers']['delete']>[0],
				requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
			) => {
				assertCapability('customers');

				return provider.customers.delete(id, mergeOptions(requestOptions));
			},
		},
		capabilities: provider.capabilities,
	};
};
