import type { ClientOptions } from './types/client';
import type { Provider } from './types/providers';

export type { PaymeshErrorProps, PaymeshErrorType } from './errors';
export { PaymeshError } from './errors';
export type { ClientOptions, PaymeshLogger } from './types/client';
export type {
	Customer,
	CustomerCreateData,
	CustomerDeleteResult,
	CustomerUpdateData,
	Payment,
	PaymentCreateData,
	PaymentCustomer,
	PaymentStatus,
	Provider,
	ProviderCapabilities,
	ProviderCapability,
	ProviderCustomers,
	ProviderDefinition,
	ProviderId,
	ProviderPayments,
	ProviderRequestOptions,
} from './types/providers';

export const createClient = <P extends Provider<string>>({
	provider,
	...options
}: ClientOptions<P>) => {
	return {
		payments: {
			create: (data: Parameters<P['payments']['create']>[0]) =>
				provider.payments.create(data, options),
		},
		customers: {
			create: (data: Parameters<P['customers']['create']>[0]) =>
				provider.customers.create(data, options),
			get: (id: Parameters<P['customers']['get']>[0]) =>
				provider.customers.get(id, options),
			update: (
				id: Parameters<P['customers']['update']>[0],
				data: Parameters<P['customers']['update']>[1],
			) => provider.customers.update(id, data, options),
			delete: (id: Parameters<P['customers']['delete']>[0]) =>
				provider.customers.delete(id, options),
		},
		capabilities: provider.capabilities,
	};
};
