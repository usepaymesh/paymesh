import type { Provider, ProviderDefinition } from '../types/providers';

export function defineProvider<const Name extends string>(
	definition: ProviderDefinition<Name>,
) {
	return {
		...definition,
		type: 'provider',
	} satisfies Provider<Name>;
}
