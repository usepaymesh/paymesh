import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PaymeshDatabaseDriver, ResolvedDatabaseSchema } from 'paymesh';
import { tableName } from './sql';

export interface PaymeshMigrationFile {
	name: string;
	sql: string;
}

export const DEFAULT_MIGRATIONS_DIR = 'paymesh/migrations';
export const PAYMESH_MIGRATIONS: readonly string[] = ['0001_paymesh_init.sql'];

export function resolveMigrationsDir(cwd: string, explicitDir?: string) {
	return path.resolve(cwd, explicitDir ?? DEFAULT_MIGRATIONS_DIR);
}

export function getPaymeshMigrationFiles(
	schema: ResolvedDatabaseSchema,
): PaymeshMigrationFile[] {
	return [
		{
			name: PAYMESH_MIGRATIONS[0]!,
			sql: createInitialMigrationSql(schema),
		},
	];
}

export async function getAppliedPaymeshMigrations(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
) {
	return database.repositories.migrations.listApplied(schema);
}

export async function writeMigrationFiles(
	directory: string,
	files: PaymeshMigrationFile[],
) {
	await fs.mkdir(directory, { recursive: true });

	for (const file of files) {
		await fs.writeFile(
			path.join(directory, file.name),
			`${file.sql}\n`,
			'utf8',
		);
	}
}

export async function readMigrationFiles(directory: string) {
	const entries = await fs.readdir(directory).catch(() => []);
	const files = entries.filter((entry) => entry.endsWith('.sql')).sort();

	return Promise.all(
		files.map(async (name) => ({
			name,
			sql: await fs.readFile(path.join(directory, name), 'utf8'),
		})),
	);
}

export async function getExpectedMigrationNames(
	directory: string,
	clientSchema: ResolvedDatabaseSchema,
) {
	const files = await readMigrationFiles(directory);
	if (files.length > 0) return files.map((file) => file.name);
	return getPaymeshMigrationFiles(clientSchema).map((file) => file.name);
}

function createInitialMigrationSql(schema: ResolvedDatabaseSchema) {
	return [
		createMigrationsTableSql(schema),
		createCustomersTableSql(schema),
		createCheckoutsTableSql(schema),
		createInvoicesTableSql(schema),
		createPaymentMethodsTableSql(schema),
		createEntitlementsTableSql(schema),
		createUsageTableSql(schema),
		createWebhookEventsTableSql(schema),
		createSubscriptionsTableSql(schema),
		createProductsTableSql(schema),
		createPricesTableSql(schema),
	].join('\n\n');
}

function createMigrationsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'migrations')} (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`.trim();
}

function createCustomersTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'customers')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	external_id TEXT,
	name TEXT,
	email TEXT,
	phone TEXT,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	deleted_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createCheckoutsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'checkouts')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	customer_provider_id TEXT,
	amount BIGINT,
	currency TEXT,
	status TEXT,
	checkout_url TEXT,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createInvoicesTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'invoices')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	customer_provider_id TEXT,
	checkout_provider_id TEXT,
	subscription_provider_id TEXT,
	amount BIGINT,
	currency TEXT,
	status TEXT,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createPaymentMethodsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'paymentMethods')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	customer_provider_id TEXT,
	type TEXT,
	brand TEXT,
	last4 TEXT,
	expiry_month INTEGER,
	expiry_year INTEGER,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createEntitlementsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'entitlements')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	subscription_provider_id TEXT,
	key TEXT,
	value JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createUsageTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'usage')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	subscription_provider_id TEXT,
	meter TEXT,
	quantity NUMERIC,
	window_start TIMESTAMPTZ,
	window_end TIMESTAMPTZ,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createWebhookEventsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'webhookEvents')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	event_type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'processing',
	attempts INTEGER NOT NULL DEFAULT 1,
	last_error TEXT,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	processed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createSubscriptionsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'subscriptions')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	customer_provider_id TEXT,
	product_provider_id TEXT,
	price_provider_id TEXT,
	status TEXT,
	amount BIGINT,
	currency TEXT,
	cancel_at_period_end BOOLEAN,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createProductsTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'products')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	name TEXT,
	description TEXT,
	active BOOLEAN,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createPricesTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'prices')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	product_provider_id TEXT,
	active BOOLEAN,
	type TEXT,
	currency TEXT,
	amount BIGINT,
	interval TEXT,
	interval_count INTEGER,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function table(
	schema: ResolvedDatabaseSchema,
	key: keyof ResolvedDatabaseSchema['tables'],
) {
	return tableName(schema, key);
}
