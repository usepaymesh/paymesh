import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
	DatabaseTableKey,
	PaymeshDatabaseDriver,
	ResolvedCustomDatabaseTable,
	ResolvedDatabaseExtraTableField,
	ResolvedDatabaseSchema,
} from 'paymesh';
import { PaymeshError } from 'paymesh';
import { tableName } from './sql';

export interface PaymeshMigrationFile {
	version: number;
	name: string;
	file: string;
	checksum: string;
	sql: string;
}

export interface PaymeshMigrationHistoryEntry {
	version: number;
	name: string;
	file: string;
	checksum: string;
}

export interface PaymeshMigrationHistory {
	version: 1 | 2;
	migrations: PaymeshMigrationHistoryEntry[];
	schema?: ResolvedDatabaseSchema;
}

export interface PaymeshMigrationHistoryStatus {
	exists: boolean;
	valid: boolean;
	missingFiles: string[];
	checksumMismatches: string[];
	migrations: string[];
}

interface PaymeshMigrationDefinition {
	version: number;
	name: string;
	sql(schema: ResolvedDatabaseSchema): string;
}

export const DEFAULT_MIGRATIONS_DIR = 'paymesh/migrations';
export const DEFAULT_HISTORY_FILE = 'paymesh/history.json';

const PAYMESH_MIGRATIONS: readonly PaymeshMigrationDefinition[] = [
	{
		version: 1,
		name: 'paymesh_init',
		sql: createInitialMigrationSql,
	},
	{
		version: 2,
		name: 'paymesh_indexes_and_constraints',
		sql: createIndexesAndConstraintsSql,
	},
];

const BUILT_IN_SANDBOX_TABLES: readonly DatabaseTableKey[] = [
	'customers',
	'pix',
	'checkouts',
	'invoices',
	'paymentMethods',
	'entitlements',
	'usage',
	'webhookEvents',
	'subscriptions',
	'products',
	'prices',
];

export function resolveMigrationsDir(cwd: string, explicitDir?: string) {
	return path.resolve(cwd, explicitDir ?? DEFAULT_MIGRATIONS_DIR);
}

export function resolveHistoryPath(cwd: string) {
	return path.resolve(cwd, DEFAULT_HISTORY_FILE);
}

export function getPaymeshMigrationFiles(
	schema: ResolvedDatabaseSchema,
): PaymeshMigrationFile[] {
	return PAYMESH_MIGRATIONS.map((migration) => {
		const sql = migration.sql(schema);
		const file = `${String(migration.version).padStart(4, '0')}_${migration.name}.sql`;

		return {
			version: migration.version,
			name: migration.name,
			file,
			checksum: checksum(sql),
			sql,
		};
	});
}

export function createMigrationHistory(
	files: PaymeshMigrationFile[],
	schema?: ResolvedDatabaseSchema,
): PaymeshMigrationHistory {
	return {
		version: schema ? 2 : 1,
		migrations: files.map((file) => ({
			version: file.version,
			name: file.name,
			file: file.file,
			checksum: file.checksum,
		})),
		schema,
	};
}

export async function readMigrationHistory(historyPath: string) {
	return fs
		.readFile(historyPath, 'utf8')
		.then((contents) => JSON.parse(contents) as PaymeshMigrationHistory)
		.catch(() => null);
}

export async function writeMigrationHistory(
	historyPath: string,
	history: PaymeshMigrationHistory,
) {
	await fs.mkdir(path.dirname(historyPath), { recursive: true });
	await fs.writeFile(`${historyPath}`, `${JSON.stringify(history, null, 2)}\n`);
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
			path.join(directory, file.file),
			`${file.sql}\n`,
			'utf8',
		);
	}
}

export async function readMigrationFiles(directory: string) {
	const entries = await fs.readdir(directory).catch(() => []);
	const files = entries.filter((entry) => entry.endsWith('.sql')).sort();

	return Promise.all(
		files.map(async (file) => {
			const sql = await fs.readFile(path.join(directory, file), 'utf8');
			return {
				version: Number.parseInt(file.slice(0, 4), 10) || 0,
				name: file.replace(/^\d+_/, '').replace(/\.sql$/, ''),
				file,
				checksum: checksum(sql),
				sql,
			} satisfies PaymeshMigrationFile;
		}),
	);
}

export async function getExpectedMigrations(
	directory: string,
	historyPath: string,
	_clientSchema: ResolvedDatabaseSchema,
) {
	const history = await readMigrationHistory(historyPath);
	if (!history) {
		throw new PaymeshError({
			code: 'database_error',
			message:
				'Missing paymesh/history.json. Run "paymesh generate" before applying migrations.',
		});
	}

	const localFiles = await readMigrationFiles(directory);
	const files = new Map(localFiles.map((file) => [file.file, file]));

	return history.migrations.map((entry) => {
		const file = files.get(entry.file);
		if (!file) {
			throw new PaymeshError({
				code: 'database_error',
				message: `Missing migration file "${entry.file}". Run "paymesh generate" to restore the expected artifacts.`,
			});
		}

		if (file.checksum !== entry.checksum) {
			throw new PaymeshError({
				code: 'database_error',
				message: `Migration file "${entry.file}" does not match paymesh/history.json. Run "paymesh generate" to regenerate the expected artifacts.`,
			});
		}

		return file;
	});
}

export async function planGenerateMigrations(
	_directory: string,
	historyPath: string,
	schema: ResolvedDatabaseSchema,
) {
	const history = await readMigrationHistory(historyPath);

	if (!history) {
		const files = getPaymeshMigrationFiles(schema);
		return {
			files,
			history: createMigrationHistory(files, schema),
			changed: true,
			historyChanged: true,
		};
	}

	const baseFiles = getPaymeshMigrationFiles(schema);
	const historyByFile = new Map(
		history.migrations.map((migration) => [migration.file, migration]),
	);
	const hasLegacyDrift = baseFiles.some((file) => {
		const historyEntry = historyByFile.get(file.file);
		return historyEntry && historyEntry.checksum !== file.checksum;
	});
	const previousSchema = history.schema;
	const hasSnapshotDrift =
		previousSchema !== undefined &&
		checksum(JSON.stringify(previousSchema)) !==
			checksum(JSON.stringify(schema));

	if (!hasLegacyDrift && !hasSnapshotDrift) {
		return {
			files: [],
			history: {
				...history,
				version: 2,
				schema,
			} satisfies PaymeshMigrationHistory,
			changed: false,
			historyChanged:
				history.version !== 2 ||
				checksum(JSON.stringify(history.schema ?? null)) !==
					checksum(JSON.stringify(schema)),
		};
	}

	const version =
		Math.max(...history.migrations.map((migration) => migration.version), 0) +
		1;
	const name = 'paymesh_schema_sync';
	const sql = createSchemaSyncMigrationSql(schema, previousSchema);
	const file = `${String(version).padStart(4, '0')}_${name}.sql`;
	const migrationFile = {
		version,
		name,
		file,
		checksum: checksum(sql),
		sql,
	} satisfies PaymeshMigrationFile;

	return {
		files: [migrationFile],
		history: {
			version: 2,
			migrations: [
				...history.migrations,
				{
					version,
					name,
					file,
					checksum: migrationFile.checksum,
				},
			],
			schema,
		} satisfies PaymeshMigrationHistory,
		changed: true,
		historyChanged: true,
	};
}

export async function getExpectedMigrationNames(
	directory: string,
	clientSchema: ResolvedDatabaseSchema,
	historyPath: string,
) {
	return getExpectedMigrations(directory, historyPath, clientSchema).then(
		(files) => files.map((file) => file.file),
	);
}

export async function getMigrationHistoryStatus(
	directory: string,
	historyPath: string,
	clientSchema: ResolvedDatabaseSchema,
) {
	const history = await readMigrationHistory(historyPath);

	if (!history) {
		return {
			exists: false,
			valid: false,
			missingFiles: [],
			checksumMismatches: [],
			migrations: getPaymeshMigrationFiles(clientSchema).map(
				(file) => file.file,
			),
		} satisfies PaymeshMigrationHistoryStatus;
	}

	const localFiles = await readMigrationFiles(directory);
	const files = new Map(localFiles.map((file) => [file.file, file]));
	const missingFiles: string[] = [];
	const checksumMismatches: string[] = [];

	for (const migration of history.migrations) {
		const file = files.get(migration.file);

		if (!file) {
			missingFiles.push(migration.file);
			continue;
		}

		if (file.checksum !== migration.checksum) {
			checksumMismatches.push(migration.file);
		}
	}

	return {
		exists: true,
		valid: missingFiles.length === 0 && checksumMismatches.length === 0,
		missingFiles,
		checksumMismatches,
		migrations: history.migrations.map((migration) => migration.file),
	} satisfies PaymeshMigrationHistoryStatus;
}

function checksum(sql: string) {
	return createHash('sha256').update(sql.trimEnd()).digest('hex');
}

function createInitialMigrationSql(schema: ResolvedDatabaseSchema) {
	return [
		createMigrationsTableSql(schema),
		createCustomersTableSql(schema),
		createPixTableSql(schema),
		createCheckoutsTableSql(schema),
		createInvoicesTableSql(schema),
		createPaymentMethodsTableSql(schema),
		createEntitlementsTableSql(schema),
		createUsageTableSql(schema),
		createWebhookEventsTableSql(schema),
		createSubscriptionsTableSql(schema),
		createProductsTableSql(schema),
		createPricesTableSql(schema),
		...Object.values(schema.customTables).map((table) =>
			createCustomTableSql(table),
		),
	].join('\n\n');
}

function createSchemaSyncMigrationSql(
	schema: ResolvedDatabaseSchema,
	previousSchema?: ResolvedDatabaseSchema,
) {
	const statements = [
		...BUILT_IN_SANDBOX_TABLES.map((key) =>
			createBuiltInSandboxSyncSql(schema.tables[key].name),
		),
		...Object.entries(schema.tables).flatMap(([key, table]) =>
			Object.values(table.fields).flatMap((field) =>
				createManagedFieldSyncSql({
					tableName: table.name,
					field,
					previousField:
						previousSchema?.tables[
							key as keyof ResolvedDatabaseSchema['tables']
						].fields[field.key],
				}),
			),
		),
		...Object.values(schema.customTables).flatMap((table) => [
			createCustomTableSql(table),
			...Object.values(table.fields).flatMap((field) =>
				createManagedFieldSyncSql({
					tableName: table.name,
					field,
					previousField:
						previousSchema?.customTables[table.id]?.fields[field.key],
				}),
			),
		]),
		...createExtraFieldIndexesAndConstraintsSql(schema),
		...Object.values(schema.customTables).flatMap((table) =>
			createCustomTableIndexesAndConstraintsSql(table),
		),
	];

	const sql = statements
		.map((statement) => statement.trim())
		.filter(Boolean)
		.join('\n\n');

	return sql.length > 0 ? sql : '-- No schema changes detected';
}

function createManagedFieldSyncSql({
	tableName,
	field,
	previousField,
}: {
	tableName: string;
	field: ResolvedDatabaseExtraTableField;
	previousField?: ResolvedDatabaseExtraTableField;
}) {
	const statements = [
		`ALTER TABLE ${quoteIdentifier(tableName)}
ADD COLUMN IF NOT EXISTS ${createExtraTableColumnSql(field)};`,
	];

	if (previousField && previousField.type !== field.type) {
		statements.push(
			`ALTER TABLE ${quoteIdentifier(tableName)}
ALTER COLUMN ${quoteIdentifier(field.column)}
TYPE ${postgresType(field)} USING ${quoteIdentifier(field.column)}::${postgresType(field)};`,
		);
	}

	if (previousField === undefined || previousField.default !== field.default) {
		statements.push(
			field.default === undefined
				? `ALTER TABLE ${quoteIdentifier(tableName)}
ALTER COLUMN ${quoteIdentifier(field.column)} DROP DEFAULT;`
				: `ALTER TABLE ${quoteIdentifier(tableName)}
ALTER COLUMN ${quoteIdentifier(field.column)} SET DEFAULT ${serializeDefault(field.default)};`,
		);
	}

	if (
		previousField === undefined ||
		previousField.required !== field.required
	) {
		statements.push(
			`ALTER TABLE ${quoteIdentifier(tableName)}
ALTER COLUMN ${quoteIdentifier(field.column)} ${field.required ? 'SET' : 'DROP'} NOT NULL;`,
		);
	}

	if (
		previousField &&
		isEnumField(previousField) &&
		isEnumField(field) &&
		previousField.enum.join('\0') !== field.enum.join('\0')
	) {
		statements.push(dropCheckConstraintSql(tableName, `${field.column}_enum`));
	}

	return statements;
}

function createBuiltInSandboxSyncSql(tableName: string) {
	return `ALTER TABLE ${quoteIdentifier(tableName)}
ADD COLUMN IF NOT EXISTS sandbox BOOLEAN NOT NULL DEFAULT FALSE;`;
}

function createIndexesAndConstraintsSql(schema: ResolvedDatabaseSchema) {
	return [
		createIndexSql(schema, 'customers', ['provider', 'external_id']),
		createIndexSql(schema, 'customers', ['provider', 'email']),
		createIndexSql(schema, 'customers', ['provider', 'deleted_at']),
		createIndexSql(schema, 'pix', ['provider', 'customer_provider_id']),
		createIndexSql(schema, 'pix', ['provider', 'status']),
		createIndexSql(schema, 'pix', ['provider', 'expires_at']),
		createIndexSql(schema, 'pix', ['provider', 'created_at']),
		createIndexSql(schema, 'checkouts', ['provider', 'customer_provider_id']),
		createIndexSql(schema, 'checkouts', ['provider', 'status']),
		createIndexSql(schema, 'checkouts', ['provider', 'created_at']),
		createIndexSql(schema, 'invoices', ['provider', 'customer_provider_id']),
		createIndexSql(schema, 'invoices', [
			'provider',
			'subscription_provider_id',
		]),
		createIndexSql(schema, 'invoices', ['provider', 'checkout_provider_id']),
		createIndexSql(schema, 'invoices', ['provider', 'status']),
		createIndexSql(schema, 'invoices', ['provider', 'created_at']),
		createIndexSql(schema, 'paymentMethods', [
			'provider',
			'customer_provider_id',
		]),
		createIndexSql(schema, 'paymentMethods', ['provider', 'type']),
		createIndexSql(schema, 'entitlements', [
			'provider',
			'subscription_provider_id',
		]),
		createIndexSql(schema, 'entitlements', ['provider', 'key']),
		createIndexSql(schema, 'usage', ['provider', 'subscription_provider_id']),
		createIndexSql(schema, 'usage', ['provider', 'meter']),
		createIndexSql(schema, 'usage', ['provider', 'window_start']),
		createIndexSql(schema, 'usage', ['provider', 'window_end']),
		createIndexSql(schema, 'webhookEvents', ['provider', 'status']),
		createIndexSql(schema, 'webhookEvents', ['provider', 'event_type']),
		createIndexSql(schema, 'webhookEvents', ['provider', 'processed_at']),
		createIndexSql(schema, 'webhookEvents', ['provider', 'created_at']),
		createIndexSql(schema, 'subscriptions', [
			'provider',
			'customer_provider_id',
		]),
		createIndexSql(schema, 'subscriptions', [
			'provider',
			'product_provider_id',
		]),
		createIndexSql(schema, 'subscriptions', ['provider', 'price_provider_id']),
		createIndexSql(schema, 'subscriptions', ['provider', 'status']),
		createIndexSql(schema, 'subscriptions', ['provider', 'created_at']),
		createIndexSql(schema, 'products', ['provider', 'active']),
		createIndexSql(schema, 'products', ['provider', 'updated_at']),
		createIndexSql(schema, 'prices', ['provider', 'product_provider_id']),
		createIndexSql(schema, 'prices', ['provider', 'active']),
		createIndexSql(schema, 'prices', ['provider', 'type']),
		createCheckConstraintSql(
			schema,
			'webhookEvents',
			'status_valid',
			`status IN ('processing', 'processed', 'failed')`,
		),
		createCheckConstraintSql(
			schema,
			'webhookEvents',
			'attempts_valid',
			'attempts >= 1',
		),
		createCheckConstraintSql(
			schema,
			'pix',
			'amount_valid',
			'amount IS NULL OR amount >= 0',
		),
		createCheckConstraintSql(
			schema,
			'checkouts',
			'amount_valid',
			'amount IS NULL OR amount >= 0',
		),
		createCheckConstraintSql(
			schema,
			'invoices',
			'amount_valid',
			'amount IS NULL OR amount >= 0',
		),
		createCheckConstraintSql(
			schema,
			'subscriptions',
			'amount_valid',
			'amount IS NULL OR amount >= 0',
		),
		createCheckConstraintSql(
			schema,
			'prices',
			'amount_valid',
			'amount IS NULL OR amount >= 0',
		),
		createCheckConstraintSql(
			schema,
			'usage',
			'quantity_valid',
			'quantity IS NULL OR quantity >= 0',
		),
		...createExtraFieldIndexesAndConstraintsSql(schema),
		...Object.values(schema.customTables).flatMap((table) =>
			createCustomTableIndexesAndConstraintsSql(table),
		),
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	external_id TEXT,
	name TEXT,
	email TEXT,
	phone TEXT,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	deleted_at TIMESTAMPTZ,
${extraTableColumnsSql(schema, 'customers')}
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createPixTableSql(schema: ResolvedDatabaseSchema) {
	return `
CREATE TABLE IF NOT EXISTS ${table(schema, 'pix')} (
	id BIGSERIAL PRIMARY KEY,
	provider TEXT NOT NULL,
	provider_id TEXT NOT NULL,
	version TEXT NOT NULL DEFAULT 'v1',
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	customer_provider_id TEXT,
	amount BIGINT,
	currency TEXT,
	status TEXT,
	method TEXT,
	copy_paste_code TEXT,
	qr_code_image_url_png TEXT,
	qr_code_image_url_svg TEXT,
	instructions_url TEXT,
	expires_at TIMESTAMPTZ,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'pix')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	customer_provider_id TEXT,
	amount BIGINT,
	currency TEXT,
	status TEXT,
	checkout_url TEXT,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'checkouts')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	customer_provider_id TEXT,
	checkout_provider_id TEXT,
	subscription_provider_id TEXT,
	amount BIGINT,
	currency TEXT,
	status TEXT,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'invoices')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	customer_provider_id TEXT,
	type TEXT,
	brand TEXT,
	last4 TEXT,
	expiry_month INTEGER,
	expiry_year INTEGER,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'paymentMethods')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	subscription_provider_id TEXT,
	key TEXT,
	value JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'entitlements')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	subscription_provider_id TEXT,
	meter TEXT,
	quantity NUMERIC,
	window_start TIMESTAMPTZ,
	window_end TIMESTAMPTZ,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'usage')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	event_type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'processing',
	attempts INTEGER NOT NULL DEFAULT 1,
	last_error TEXT,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
	processed_at TIMESTAMPTZ,
${extraTableColumnsSql(schema, 'webhookEvents')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	customer_provider_id TEXT,
	product_provider_id TEXT,
	price_provider_id TEXT,
	status TEXT,
	amount BIGINT,
	currency TEXT,
	cancel_at_period_end BOOLEAN,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'subscriptions')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
	name TEXT,
	description TEXT,
	active BOOLEAN,
	metadata JSONB,
	data JSONB NOT NULL DEFAULT '{}'::jsonb,
	raw JSONB,
${extraTableColumnsSql(schema, 'products')}
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
	sandbox BOOLEAN NOT NULL DEFAULT FALSE,
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
${extraTableColumnsSql(schema, 'prices')}
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	UNIQUE (provider, provider_id)
);`.trim();
}

function createCustomTableSql(table: ResolvedCustomDatabaseTable) {
	const lines = [
		`\t${createCustomTablePrimaryKeySql(table)}`,
		...Object.values(table.fields).map(
			(field) => `\t${createExtraTableColumnSql(field)}`,
		),
	];

	if (table.timestamps.createdAt) {
		lines.push('\tcreated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
	}

	if (table.timestamps.updatedAt) {
		lines.push('\tupdated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
	}

	return `
CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (
${lines.join(',\n')}
);`.trim();
}

function createIndexSql(
	schema: ResolvedDatabaseSchema,
	key: keyof ResolvedDatabaseSchema['tables'],
	columns: string[],
) {
	return `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(objectName(schema.tables[key].name, `idx_${columns.join('_')}`))}
ON ${table(schema, key)} (${columns.map(quoteIdentifier).join(', ')});`;
}

function createUniqueIndexSql(
	schema: ResolvedDatabaseSchema,
	key: keyof ResolvedDatabaseSchema['tables'],
	columns: string[],
) {
	return `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier(objectName(schema.tables[key].name, `uniq_${columns.join('_')}`))}
ON ${table(schema, key)} (${columns.map(quoteIdentifier).join(', ')});`;
}

function createCheckConstraintSql(
	schema: ResolvedDatabaseSchema,
	key: keyof ResolvedDatabaseSchema['tables'],
	suffix: string,
	expression: string,
) {
	return createCheckConstraintForTableSql(
		schema.tables[key].name,
		suffix,
		expression,
	);
}

function objectName(base: string, suffix: string) {
	const candidate = `${base}_${suffix}`.replaceAll(/[^a-zA-Z0-9_]/g, '_');
	if (candidate.length <= 63) return candidate;

	const hash = createHash('sha1').update(candidate).digest('hex').slice(0, 8);
	return `${candidate.slice(0, 54)}_${hash}`;
}

function table(
	schema: ResolvedDatabaseSchema,
	key: keyof ResolvedDatabaseSchema['tables'],
) {
	return tableName(schema, key);
}

function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function extraTableColumnsSql(
	schema: ResolvedDatabaseSchema,
	key: keyof ResolvedDatabaseSchema['tables'],
) {
	const columns = Object.values(schema.tables[key].fields).map((field) =>
		createExtraTableColumnSql(field),
	);

	return columns.length === 0 ? '' : `\t${columns.join(',\n\t')},\n`;
}

function createCustomTablePrimaryKeySql(table: ResolvedCustomDatabaseTable) {
	return table.primaryKey.type === 'text'
		? `${quoteIdentifier(table.primaryKey.name)} TEXT PRIMARY KEY`
		: `${quoteIdentifier(table.primaryKey.name)} BIGSERIAL PRIMARY KEY`;
}

function createExtraTableColumnSql(field: ResolvedDatabaseExtraTableField) {
	return `${quoteIdentifier(field.column)} ${postgresType(field)}${field.required ? ' NOT NULL' : ''}${defaultSql(field)}`;
}

function createExtraFieldIndexesAndConstraintsSql(
	schema: ResolvedDatabaseSchema,
) {
	return Object.entries(schema.tables).flatMap(([key, table]) =>
		Object.values(table.fields).flatMap((field) => {
			const queries: string[] = [];

			if (field.unique) {
				queries.push(
					createUniqueIndexSql(
						schema,
						key as keyof ResolvedDatabaseSchema['tables'],
						[field.column],
					),
				);
			} else if (field.index) {
				queries.push(
					createIndexSql(
						schema,
						key as keyof ResolvedDatabaseSchema['tables'],
						[field.column],
					),
				);
			}

			if (isEnumField(field)) {
				queries.push(
					createCheckConstraintSql(
						schema,
						key as keyof ResolvedDatabaseSchema['tables'],
						`${field.column}_enum`,
						enumCheckSql(field),
					),
				);
			}

			return queries;
		}),
	);
}

function createCustomTableIndexesAndConstraintsSql(
	table: ResolvedCustomDatabaseTable,
) {
	return [
		...table.indexes.map((index) =>
			createCustomTableIndexSql(table, index.columns, index.unique, index.name),
		),
		...Object.values(table.fields).flatMap((field) => {
			const queries: string[] = [];

			if (field.unique) {
				queries.push(createCustomTableIndexSql(table, [field.column], true));
			} else if (field.index) {
				queries.push(createCustomTableIndexSql(table, [field.column], false));
			}

			if (isEnumField(field)) {
				queries.push(
					createCustomTableCheckConstraintSql(
						table,
						`${field.column}_enum`,
						enumCheckSql(field),
					),
				);
			}

			return queries;
		}),
	];
}

function createCustomTableIndexSql(
	table: ResolvedCustomDatabaseTable,
	columns: string[],
	unique: boolean,
	name?: string,
) {
	const suffix = `${unique ? 'uniq' : 'idx'}_${columns.join('_')}`;
	const prefix = unique ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX';
	return `${prefix} IF NOT EXISTS ${quoteIdentifier(name ?? objectName(table.name, suffix))}
ON ${quoteIdentifier(table.name)} (${columns.map(quoteIdentifier).join(', ')});`;
}

function createCustomTableCheckConstraintSql(
	table: ResolvedCustomDatabaseTable,
	suffix: string,
	expression: string,
) {
	return createCheckConstraintForTableSql(table.name, suffix, expression);
}

function createCheckConstraintForTableSql(
	tableName: string,
	suffix: string,
	expression: string,
) {
	const constraint = objectName(tableName, suffix);
	return `DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = '${constraint}'
	) THEN
		ALTER TABLE ${quoteIdentifier(tableName)}
		ADD CONSTRAINT ${quoteIdentifier(constraint)} CHECK (${expression});
	END IF;
END $$;`;
}

function dropCheckConstraintSql(tableName: string, suffix: string) {
	const constraint = objectName(tableName, suffix);
	return `ALTER TABLE ${quoteIdentifier(tableName)}
DROP CONSTRAINT IF EXISTS ${quoteIdentifier(constraint)};`;
}

function postgresType(field: ResolvedDatabaseExtraTableField) {
	switch (field.type) {
		case 'string':
		case 'enum':
			return 'TEXT';
		case 'number':
			return 'DOUBLE PRECISION';
		case 'bigint':
			return 'BIGINT';
		case 'boolean':
			return 'BOOLEAN';
		case 'date':
			return 'TIMESTAMPTZ';
		case 'json':
			return 'JSONB';
		case 'decimal':
			return 'NUMERIC';
	}
}

function defaultSql(field: ResolvedDatabaseExtraTableField) {
	if (field.default === undefined) return '';

	return ` DEFAULT ${serializeDefault(field.default)}`;
}

function serializeDefault(value: unknown): string {
	if (value === null) return 'NULL';
	if (typeof value === 'number' || typeof value === 'bigint') return `${value}`;
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
	if (value instanceof Date) return `'${value.toISOString()}'`;
	if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;

	return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

function enumCheckSql(field: ResolvedDatabaseExtraTableField) {
	if (!isEnumField(field)) {
		throw new PaymeshError({
			code: 'database_error',
			message: `Field "${field.column}" is not an enum field.`,
		});
	}

	const values = field.enum.map(
		(value: string) => `'${value.replaceAll("'", "''")}'`,
	);
	const nullable = field.required
		? ''
		: ` OR ${quoteIdentifier(field.column)} IS NULL`;
	return `${quoteIdentifier(field.column)} IN (${values.join(', ')})${nullable}`;
}

function isEnumField(
	field: ResolvedDatabaseExtraTableField,
): field is ResolvedDatabaseExtraTableField & {
	type: 'enum';
	enum: readonly string[];
} {
	return (
		field.type === 'enum' &&
		'enum' in field &&
		Array.isArray((field as { enum?: unknown }).enum)
	);
}
