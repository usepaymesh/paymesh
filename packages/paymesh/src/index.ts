import type { ClientOptions } from './types/client';
import type { Provider } from './types/providers';

export type { PaymeshErrorProps, PaymeshErrorType } from './errors';
export { PaymeshError } from './errors';

export const createClient = <P extends Provider<string>>({
	provider,
	...options
}: ClientOptions<P>) => {
	return {
		payments: {
			create: (data: Parameters<P['payments']['create']>[0]) =>
				provider.payments.create(data, options),
		},
		capabilities: provider.capabilities,
	};
};
