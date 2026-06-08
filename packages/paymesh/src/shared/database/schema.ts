import { mergeDatabaseSchemas } from '../../database/schema';
import type { DatabaseSchemaOptions } from '../../types/database';
import type { AnyPaymeshPlugin, PluginSchema } from '../../types/plugins';

/**
 * Resolves client schema options by merging plugin schema extensions into the base schema.
 */
export function resolveClientSchemaOptions(
	base: DatabaseSchemaOptions | undefined,
	plugins: readonly AnyPaymeshPlugin[],
) {
	return mergeDatabaseSchemas(
		base,
		plugins.flatMap((plugin) =>
			plugin.schema ? [normalizePluginSchema(plugin.id, plugin.schema)] : [],
		),
	);
}

function normalizePluginSchema(pluginId: string, schema: PluginSchema) {
	return {
		tables: schema.tables,
		customTables: Object.fromEntries(
			Object.entries(schema.customTables ?? {}).map(([key, table]) => [
				`${pluginId}.${key}`,
				{
					...table,
					pluginId,
				},
			]),
		),
	} satisfies DatabaseSchemaOptions;
}
