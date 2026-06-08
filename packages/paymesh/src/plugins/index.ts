import type {
	LazyPluginExtension,
	PaymeshPlugin,
	PluginEventDefinition,
	PluginEventDefinitions,
} from '../types/plugins';

/**
 * Normalizes a plugin definition into a public plugin instance.
 *
 * @example
 * ```ts
 * const auditPlugin = definePlugin({
 *   id: 'audit-logs',
 *   name: 'Audit Logs',
 *   events: {
 *     'audit.entry.created': event<{ id: string }>({
 *       description: 'Emitted when an audit entry is created.',
 *     }),
 *   },
 * });
 * ```
 */
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

/**
 * Declares a typed plugin event definition.
 *
 * @example
 * ```ts
 * const entryCreated = event<{ id: string }>({
 *   description: 'Emitted when an audit entry is created.',
 *   async: true,
 * });
 * ```
 */
export function event<Payload = never>(
	definition: Omit<PluginEventDefinition<Payload>, '__payload'> = {},
): PluginEventDefinition<Payload> {
	return definition;
}

/**
 * Defers the creation of a plugin extension until it is actually needed.
 *
 * @example
 * ```ts
 * const plugin = definePlugin({
 *   id: 'example',
 *   extends: () => lazy(() => ({ hello: 'world' })),
 * });
 * ```
 */
export function lazy<TValue extends object>(
	load: () => TValue,
): LazyPluginExtension<TValue> {
	return {
		__type: 'paymesh.lazy_extension',
		load,
	};
}
