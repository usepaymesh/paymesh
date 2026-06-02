import type {
	DatabaseExtraTableFieldOptions,
	DatabaseExtraTableFields,
	DatabaseSchemaOptions,
	DatabaseTableKey,
	ResolvedDatabaseExtraTableFields,
	ResolvedDatabaseSchema,
} from '../types/database';

export const PAYMESH_DEFAULT_SCHEMA_PREFIX = 'paymesh_';

export const PAYMESH_DATABASE_TABLE_NAMES = {
	customers: 'customers',
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

export const PAYMESH_DATABASE_TABLE_KEYS = Object.keys(
	PAYMESH_DATABASE_TABLE_NAMES,
) as DatabaseTableKey[];

export function resolveDatabaseSchema(
	schema: DatabaseSchemaOptions = {},
): ResolvedDatabaseSchema {
	const prefix = schema.prefix ?? PAYMESH_DEFAULT_SCHEMA_PREFIX;

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
	};
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

function validateField(key: string, field: DatabaseExtraTableFieldOptions) {
	if (field.required && field.default !== undefined) {
		throw new Error(
			`Database field "${key}" cannot be required and define a default value at the same time.`,
		);
	}

	if (field.type === 'enum' && (!field.enum || field.enum.length === 0)) {
		throw new Error(
			`Database field "${key}" must define at least one enum value.`,
		);
	}
}
