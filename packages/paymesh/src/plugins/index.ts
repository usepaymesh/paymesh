import type { PaymeshPlugin, PluginEventDefinitions } from '../types/plugins';

export function definePlugin<
	const Id extends string,
	const Events extends PluginEventDefinitions = Record<never, never>,
	Extends extends Record<string, unknown> = Record<never, never>,
	ProviderId extends string = string,
>(definition: PaymeshPlugin<Id, Events, Extends, ProviderId>) {
	return {
		...definition,
		type: 'plugin',
	} as PaymeshPlugin<Id, Events, Extends, ProviderId> & {
		readonly type: 'plugin';
	};
}
