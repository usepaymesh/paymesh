import { mergeDatabaseSchemas } from '../../database/schema';
import type { DatabaseSchemaOptions } from '../../types/database';
import type { PaymeshPlugin, PluginSchema } from '../../types/plugins';

export function resolveClientSchemaOptions(
	base: DatabaseSchemaOptions | undefined,
	plugins: readonly PaymeshPlugin[],
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
