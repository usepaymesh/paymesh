import type {
	LazyPluginExtension,
	PaymeshPlugin,
	PluginEventDefinition,
	PluginEventDefinitions,
} from '../types/plugins';

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

export function event<Payload = never>(
	definition: Omit<PluginEventDefinition<Payload>, '__payload'> = {},
): PluginEventDefinition<Payload> {
	return definition;
}

export function lazy<TValue extends object>(
	load: () => TValue,
): LazyPluginExtension<TValue> {
	return {
		__type: 'paymesh.lazy_extension',
		load,
	};
}
