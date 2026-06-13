import { PaymeshError } from '../errors';
import { splitExtraFields } from '../shared/database/fields';
import type { PaymeshPayment, PaymeshPaymentCreateData } from '../types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { Provider, ProviderRequestOptions } from '../types/providers';

export function createPaymentsClient<
	Schema extends DatabaseSchemaOptions,
	P extends Provider<string>,
	IncludeRaw extends boolean,
>({
	assertCapability,
	database,
	mergeOptions,
	provider,
	schema,
	trustedOrigins,
}: {
	assertCapability: (capability: 'checkout') => void;
	database?: PaymeshDatabaseDriver;
	mergeOptions: <CallIncludeRaw extends boolean = false>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	) => ProviderRequestOptions<CallIncludeRaw>;
	provider: P;
	schema: ResolvedDatabaseSchema;
	trustedOrigins?: string[];
}) {
	return {
		create: async <CallIncludeRaw extends boolean = IncludeRaw>(
			data: PaymeshPaymentCreateData<Schema>,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('checkout');

			for (const field of ['successUrl', 'cancelUrl', 'returnUrl'] as const) {
				const value = data[field];
				if (!value) continue;

				let url: URL;

				try {
					url = new URL(value);
				} catch {
					throw new PaymeshError({
						code: 'invalid_request',
						message: `Payment ${field} must be an absolute URL.`,
					});
				}

				if (!trustedOrigins?.length) continue;

				let trusted = false;
				for (const trustedOrigin of trustedOrigins) {
					if (trustedOrigin === '*') {
						trusted = true;
						break;
					}

					if (!trustedOrigin.includes('*')) {
						if (url.origin === trustedOrigin) {
							trusted = true;
							break;
						}

						continue;
					}

					const pattern = trustedOrigin.includes('://') ? url.origin : url.host;
					const regexp = new RegExp(
						`^${trustedOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '.*')}$`,
					);

					if (regexp.test(pattern)) {
						trusted = true;
						break;
					}
				}

				if (!trusted) {
					throw new PaymeshError({
						code: 'invalid_request',
						message: `Untrusted origin for ${field}: "${url.origin}".`,
					});
				}
			}

			const { input, extra } = splitExtraFields(
				data,
				schema.tables.checkouts.fields,
			);

			const payment = await provider.payments.create(
				input as Parameters<P['payments']['create']>[0],
				mergeOptions(requestOptions),
			);
			const resolvedPayment = Object.assign(payment, extra) as PaymeshPayment<
				CallIncludeRaw,
				Schema
			>;

			if (database) {
				await database.repositories.checkouts.upsert(schema, resolvedPayment);
			}

			return resolvedPayment;
		},
	};
}
