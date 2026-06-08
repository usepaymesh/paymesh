import { PaymeshError } from '../errors';
import type {
	CustomDatabaseTableConfig,
	CustomDatabaseTableIndexConfig,
	DatabaseExtraTableFieldOptions,
	DatabaseExtraTableFields,
	DatabaseSchemaOptions,
	DatabaseTableKey,
	ResolvedCustomDatabaseTable,
	ResolvedCustomDatabaseTableIndex,
	ResolvedDatabaseExtraTableFields,
	ResolvedDatabaseSchema,
} from '../types/database';

/**
 * Default prefix applied to Paymesh-managed database tables.
 */
export const PAYMESH_DEFAULT_SCHEMA_PREFIX = 'paymesh_';

/**
 * Canonical table names used by the built-in schema resolver.
 */
export const PAYMESH_DATABASE_TABLE_NAMES = {
	customers: 'customers',
	pix: 'pix',
	checkouts: 'checkouts',
	invoices: 'invoices',
	paymentMethods: 'payment_methods',
	entitlements: 'entitlements',
	usage: 'usage',
	webhookEvents: 'webhook_events',
	subscriptions: 'subscriptions',
	products: 'products',
	prices: 'prices',
	migrations: 'migrations',
} satisfies Record<DatabaseTableKey, string>;

/**
 * Ordered list of built-in database table keys.
 */
export const PAYMESH_DATABASE_TABLE_KEYS = Object.keys(
	PAYMESH_DATABASE_TABLE_NAMES,
) as DatabaseTableKey[];

/**
 * Resolves a user schema into concrete table and custom-table metadata.
 *
 * @example
 * ```ts
 * const schema = resolveDatabaseSchema({
 *   prefix: 'app_',
 *   customTables: {
 *     'audit.logs': {
 *       fields: { action: { type: 'string', required: true } },
 *     },
 *   },
 * });
 * ```
 */
export function resolveDatabaseSchema(
	schema: DatabaseSchemaOptions = {},
): ResolvedDatabaseSchema {
	const prefix = schema.prefix ?? PAYMESH_DEFAULT_SCHEMA_PREFIX;
	const customTables = resolveCustomTables(prefix, schema.customTables);

	return {
		prefix,
		tables: Object.fromEntries(
			PAYMESH_DATABASE_TABLE_KEYS.map((key) => [
				key,
				{
					key,
					name:
						schema.tables?.[key]?.name ??
						`${prefix}${PAYMESH_DATABASE_TABLE_NAMES[key]}`,
					fields: resolveTableFields(schema.tables?.[key]?.fields),
				},
			]),
		) as ResolvedDatabaseSchema['tables'],
		customTables,
	};
}

/**
 * Merges the base schema with plugin-provided schema extensions.
 *
 * @example
 * ```ts
 * const merged = mergeDatabaseSchemas(baseSchema, [pluginSchema]);
 * ```
 */
export function mergeDatabaseSchemas(
	base: DatabaseSchemaOptions = {},
	extensions: DatabaseSchemaOptions[] = [],
) {
	const mergedTables: NonNullable<DatabaseSchemaOptions['tables']> = {
		...(base.tables ?? {}),
	};
	const mergedCustomTables: NonNullable<DatabaseSchemaOptions['customTables']> =
		{
			...(base.customTables ?? {}),
		};

	for (const extension of extensions) {
		for (const key of PAYMESH_DATABASE_TABLE_KEYS) {
			const table = extension.tables?.[key];
			if (!table) continue;

			if (table.name)
				throw new PaymeshError({
					code: 'database_error',
					message: `Plugin schema cannot redefine the table name for "${key}".`,
				});

			const current = mergedTables[key];
			mergedTables[key] = {
				...current,
				fields: {
					...(current?.fields ?? {}),
					...(table.fields ?? {}),
				},
			};
		}

		for (const [key, table] of Object.entries(extension.customTables ?? {})) {
			if (mergedCustomTables[key])
				throw new PaymeshError({
					code: 'database_error',
					message: `Custom table "${key}" is already registered.`,
				});

			mergedCustomTables[key] = table;
		}
	}

	return {
		...base,
		tables: mergedTables,
		customTables: mergedCustomTables,
	} satisfies DatabaseSchemaOptions;
}

function resolveTableFields(fields?: DatabaseExtraTableFields) {
	if (!fields) return {};

	return Object.fromEntries(
		Object.entries(fields).map(([key, field]) => {
			validateField(key, field);

			return [
				key,
				{
					...field,
					key,
					column: field.column ?? key,
				},
			];
		}),
	) as ResolvedDatabaseExtraTableFields;
}

function resolveCustomTables(
	prefix: string,
	tables?: Record<string, CustomDatabaseTableConfig>,
) {
	if (!tables) return {};

	return Object.fromEntries(
		Object.entries(tables).map(([id, table]) => {
			const key = id.includes('.') ? id.slice(id.indexOf('.') + 1) : id;

			return [
				id,
				{
					id,
					key,
					name: table.name ?? `${prefix}${normalizeIdentifier(id)}`,
					fields: resolveTableFields(table.fields),
					pluginId: table.pluginId,
					primaryKey: {
						name: table.primaryKey?.name ?? 'id',
						type: table.primaryKey?.type ?? 'bigserial',
					},
					timestamps: {
						createdAt: table.timestamps?.createdAt ?? true,
						updatedAt: table.timestamps?.updatedAt ?? true,
					},
					indexes: resolveCustomTableIndexes(table.indexes),
				} satisfies ResolvedCustomDatabaseTable,
			];
		}),
	) as ResolvedDatabaseSchema['customTables'];
}

function normalizeIdentifier(value: string) {
	return value.replaceAll(/[^a-zA-Z0-9_]/g, '_').replaceAll(/_+/g, '_');
}

function resolveCustomTableIndexes(indexes?: CustomDatabaseTableIndexConfig[]) {
	return (indexes ?? []).map((index) => {
		if (!Array.isArray(index.columns) || index.columns.length === 0)
			throw new PaymeshError({
				code: 'database_error',
				message: 'Custom table indexes must define at least one column.',
			});

		return {
			name: index.name,
			columns: [...index.columns],
			unique: index.unique ?? false,
		};
	}) satisfies ResolvedCustomDatabaseTableIndex[];
}

function validateField(key: string, field: DatabaseExtraTableFieldOptions) {
	if (field.required && field.default !== undefined)
		throw new PaymeshError({
			code: 'database_error',
			message: `Database field "${key}" cannot be required and define a default value at the same time.`,
		});

	if (field.type === 'enum' && (!field.enum || field.enum.length === 0))
		throw new PaymeshError({
			code: 'database_error',
			message: `Database field "${key}" must define at least one enum value.`,
		});
}
