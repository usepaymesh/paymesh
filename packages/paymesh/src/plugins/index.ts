import type { PaymeshPlugin, PluginEventDefinitions } from '../types/plugins';

export function definePlugin<
	const TId extends string,
	const TEvents extends PluginEventDefinitions = Record<never, never>,
	TExtends extends Record<string, unknown> = Record<never, never>,
	TProviderId extends string = string,
>(definition: PaymeshPlugin<TId, TEvents, TExtends, TProviderId>) {
	return {
		...definition,
		type: 'plugin',
	} as PaymeshPlugin<TId, TEvents, TExtends, TProviderId> & {
		readonly type: 'plugin';
	};
}
