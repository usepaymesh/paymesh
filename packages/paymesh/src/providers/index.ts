import type { Provider, ProviderDefinition } from '../types/providers';

/**
 * Normalizes a provider definition into a public provider instance.
 *
 * @example
 * ```ts
 * export const myProvider = defineProvider({
 *   id: 'my-provider',
 *   capabilities: { checkout: true, webhooks: true, customers: true },
 *   payments: {
 *     async create(data) {
 *       return {
 *         id: 'pay_123',
 *         provider: 'my-provider',
 *         amount: data.amount,
 *         currency: data.currency,
 *         status: 'pending',
 *         raw: null,
 *       };
 *     },
 *   },
 *   customers: {
 *     async get(id) {
 *       throw new Error(`Customer ${id} not found`);
 *     },
 *     async upsert(data) {
 *       return { id: data.id ?? 'cus_123', provider: 'my-provider', raw: null };
 *     },
 *     async delete(id) {
 *       return { id, provider: 'my-provider', deleted: true, raw: null };
 *     },
 *   },
 * });
 * ```
 */
export function defineProvider<const Name extends string>(
	definition: ProviderDefinition<Name>,
) {
	return {
		...definition,
		type: 'provider',
	} satisfies Provider<Name>;
}
