import type {
	PaymeshDatabaseDriver,
	PaymeshDatabaseDriverDefinition,
} from '../types/database';

/**
 * Normalizes a database adapter definition into a runtime driver.
 *
 * @example
 * ```ts
 * export const adapter = defineDatabaseAdapter({
 *   id: 'memory',
 *   dialect: 'postgres',
 *   persistRaw: false,
 *   repositories,
 *   query: async () => [],
 *   execute: async () => undefined,
 *   transaction: async (callback) => callback(adapter as never),
 * });
 * ```
 */
export function defineDatabaseAdapter(
	definition: PaymeshDatabaseDriverDefinition,
) {
	return {
		...definition,
		type: 'database',
		persistRaw: definition.persistRaw ?? false,
	} satisfies PaymeshDatabaseDriver;
}
