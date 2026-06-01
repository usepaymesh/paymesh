import type {
	DatabaseSchemaOptions,
	DatabaseTableKey,
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
				},
			]),
		) as ResolvedDatabaseSchema['tables'],
	};
}
