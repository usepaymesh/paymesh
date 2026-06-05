import { afterEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	type CompiledQuery,
	defineDatabaseAdapter,
	defineProvider,
	resolveDatabaseSchema,
} from 'paymesh';
import {
	createMigrationHistory,
	createProgram,
	getExpectedMigrationNames,
	getMigrationHistoryStatus,
	getPaymeshMigrationFiles,
	loadClient,
	planGenerateMigrations,
	pushProviderCatalog,
	readMigrationFiles,
	readMigrationHistory,
	resolveClientPath,
	resolveHistoryPath,
	writeMigrationFiles,
	writeMigrationHistory,
} from '../src/index';

const tempDirectories: string[] = [];

afterEach(async () => {
	for (const directory of tempDirectories.splice(0)) {
		await fs.rm(directory, { recursive: true, force: true });
	}
});

describe('cli helpers', () => {
	test('resolves the client path from package.json', async () => {
		const directory = await createTempProject();
		await fs.mkdir(path.join(directory, 'src'), { recursive: true });
		await fs.writeFile(
			path.join(directory, 'package.json'),
			JSON.stringify({
				paymesh: {
					path: './src/paymesh-client.mjs',
				},
			}),
		);
		await fs.writeFile(
			path.join(directory, 'src/paymesh-client.mjs'),
			'export default { provider: { id: "stub" }, schema: { prefix: "paymesh_", tables: {} } };',
		);

		const resolved = await resolveClientPath(directory);
		expect(resolved).toBe(path.join(directory, 'src/paymesh-client.mjs'));
	});

	test('loads default and named paymesh client exports', async () => {
		const defaultDirectory = await createTempProject();
		await fs.writeFile(
			path.join(defaultDirectory, 'default-client.mjs'),
			'export default { provider: { id: "stub" }, schema: { prefix: "paymesh_", tables: {} } };',
		);
		const namedDirectory = await createTempProject();
		await fs.writeFile(
			path.join(namedDirectory, 'named-client.mjs'),
			'export const paymesh = { provider: { id: "stub" }, schema: { prefix: "paymesh_", tables: {} } };',
		);

		const defaultClient = await loadClient({
			cwd: defaultDirectory,
			explicitPath: './default-client.mjs',
		});
		const namedClient = await loadClient({
			cwd: namedDirectory,
			explicitPath: './named-client.mjs',
		});

		expect(defaultClient.provider.id).toBe('stub');
		expect(namedClient.provider.id).toBe('stub');
	});

	test('triggers a built-in event from the CLI', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);
		const logs = await withinCwd(directory, () =>
			captureLogs(async () => {
				await createProgram().parseAsync([
					'node',
					'paymesh',
					'trigger',
					'customer.created',
					'--client',
					'./paymesh-client.ts',
				]);
			}),
		);

		expect(logs).toContain('customer.created');
		expect(logs).toContain('hooks:');
		expect(logs).toContain('onEvent, onCustomerCreated');
		expect(
			await fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
		).toContain('"hook":"onCustomerCreated"');
	});

	test('triggers a plugin event from the CLI with json payload', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);
		const logs = await withinCwd(directory, () =>
			captureLogs(async () => {
				await createProgram().parseAsync([
					'node',
					'paymesh',
					'trigger',
					'onCouponRedeemed',
					'--client',
					'./paymesh-client.ts',
					'--data',
					'{"code":"WELCOME10"}',
				]);
			}),
		);

		expect(logs).toContain('onCouponRedeemed');
		expect(logs).toContain('plugin:coupons');
		expect(logs).toContain('hooks:');
		expect(
			await fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
		).toContain('"code":"WELCOME10"');
	});

	test('rejects non-object built-in --data payloads', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);

		await expect(
			withinCwd(directory, () =>
				createProgram().parseAsync([
					'node',
					'paymesh',
					'trigger',
					'customer.created',
					'--client',
					'./paymesh-client.ts',
					'--data',
					'"ada@example.com"',
				]),
			),
		).rejects.toMatchObject({
			code: 'client_error',
			message: 'Built-in events require --data to be a JSON object',
		});
	});

	test('requires --data for plugin events', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);

		await expect(
			withinCwd(directory, () =>
				createProgram().parseAsync([
					'node',
					'paymesh',
					'trigger',
					'onCouponRedeemed',
					'--client',
					'./paymesh-client.ts',
				]),
			),
		).rejects.toMatchObject({
			code: 'client_error',
			message:
				'Plugin event "onCouponRedeemed" requires --data with a JSON payload',
		});
	});

	test('writes and reads generated migration files', async () => {
		const directory = await createTempProject();
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const migrationsDir = path.join(directory, 'paymesh', 'migrations');
		const historyPath = resolveHistoryPath(directory);

		await writeMigrationFiles(migrationsDir, files);
		await writeMigrationHistory(
			historyPath,
			createMigrationHistory(files, schema),
		);
		const readBack = await readMigrationFiles(migrationsDir);
		const history = await readMigrationHistory(historyPath);
		const expected = await getExpectedMigrationNames(
			migrationsDir,
			resolveDatabaseSchema(),
			historyPath,
		);
		const historyStatus = await getMigrationHistoryStatus(
			migrationsDir,
			historyPath,
			resolveDatabaseSchema(),
		);

		expect(readBack.map((file) => file.file)).toEqual(
			files.map((file) => file.file),
		);
		expect(history?.migrations.map((migration) => migration.file)).toEqual(
			files.map((file) => file.file),
		);
		expect(expected).toEqual(files.map((file) => file.file));
		expect(historyStatus).toMatchObject({
			exists: true,
			valid: true,
		});
	});

	test('plans an incremental migration when the client schema changes', async () => {
		const directory = await createTempProject();
		const migrationsDir = path.join(directory, 'paymesh', 'migrations');
		const historyPath = resolveHistoryPath(directory);
		const initialSchema = resolveDatabaseSchema();
		const initialFiles = getPaymeshMigrationFiles(initialSchema);

		await writeMigrationFiles(migrationsDir, initialFiles);
		await writeMigrationHistory(
			historyPath,
			createMigrationHistory(initialFiles, initialSchema),
		);

		const nextSchema = resolveDatabaseSchema({
			tables: {
				customers: {
					fields: {
						segment: {
							type: 'string',
							default: 'vip',
							index: true,
						},
					},
				},
			},
		});
		const plan = await planGenerateMigrations(
			migrationsDir,
			historyPath,
			nextSchema,
		);

		expect(plan.changed).toBe(true);
		expect(plan.files).toHaveLength(1);
		expect(plan.files[0]?.file).toBe('0003_paymesh_schema_sync.sql');
		expect(plan.files[0]?.sql).toContain(
			'ADD COLUMN IF NOT EXISTS "segment" TEXT DEFAULT \'vip\'',
		);
		expect(plan.files[0]?.sql).toContain(
			'CREATE INDEX IF NOT EXISTS "paymesh_customers_idx_segment"',
		);
		expect(plan.history.schema).toEqual(nextSchema);
	});

	test('includes schema extra fields in generated migrations', () => {
		const files = getPaymeshMigrationFiles(
			resolveDatabaseSchema({
				tables: {
					customers: {
						fields: {
							first_and_last_name: {
								type: 'string',
								required: true,
								column: 'full_name',
								index: true,
							},
							lifecycle_stage: {
								type: 'enum',
								enum: ['lead', 'customer'],
								default: 'lead',
								unique: true,
							},
						},
					},
				},
			}),
		);
		const initial = files.find((file) => file.version === 1);
		const incremental = files.find((file) => file.version === 2);

		expect(initial?.sql).toContain('"full_name" TEXT NOT NULL');
		expect(initial?.sql).toContain('"lifecycle_stage" TEXT DEFAULT \'lead\'');
		expect(incremental?.sql).toContain('full_name');
		expect(incremental?.sql).toContain('lifecycle_stage');
		expect(incremental?.sql).toContain('customer');
	});

	test('includes custom plugin tables in generated migrations', () => {
		const files = getPaymeshMigrationFiles(
			resolveDatabaseSchema({
				customTables: {
					'coupons.redemptions': {
						pluginId: 'coupons',
						fields: {
							code: {
								type: 'string',
								required: true,
								unique: true,
							},
							status: {
								type: 'enum',
								enum: ['pending', 'redeemed'],
								default: 'pending',
								index: true,
							},
						},
					},
				},
			}),
		);
		const initial = files.find((file) => file.version === 1);
		const incremental = files.find((file) => file.version === 2);

		expect(initial?.sql).toContain(
			'CREATE TABLE IF NOT EXISTS "paymesh_coupons_redemptions"',
		);
		expect(initial?.sql).toContain('"code" TEXT NOT NULL');
		expect(initial?.sql).toContain('"status" TEXT DEFAULT \'pending\'');
		expect(incremental?.sql).toContain(
			'paymesh_coupons_redemptions_idx_status',
		);
		expect(incremental?.sql).toContain('paymesh_coupons_redemptions_uniq_code');
		expect(incremental?.sql).toContain("\"status\" IN ('pending', 'redeemed')");
	});

	test('supports custom table primary keys, timestamps, and explicit indexes', () => {
		const files = getPaymeshMigrationFiles(
			resolveDatabaseSchema({
				customTables: {
					'audit-logs.audit_logs': {
						name: 'paymesh_audit_logs',
						pluginId: 'audit-logs',
						primaryKey: {
							type: 'text',
						},
						timestamps: {
							createdAt: true,
							updatedAt: false,
						},
						fields: {
							action: {
								type: 'string',
								required: true,
							},
							resource_type: {
								type: 'string',
								required: true,
							},
							occurred_at: {
								type: 'date',
								required: true,
							},
						},
						indexes: [
							{
								name: 'paymesh_audit_logs_resource_idx',
								columns: ['resource_type', 'action'],
							},
						],
					},
				},
			}),
		);
		const initial = files.find((file) => file.version === 1);
		const incremental = files.find((file) => file.version === 2);

		expect(initial?.sql).toContain(
			'CREATE TABLE IF NOT EXISTS "paymesh_audit_logs"',
		);
		expect(initial?.sql).toContain('"id" TEXT PRIMARY KEY');
		expect(initial?.sql).toContain('"action" TEXT NOT NULL');
		expect(initial?.sql).toContain(
			'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
		);
		expect(initial?.sql).not.toContain('"updated_at" TIMESTAMPTZ');
		expect(incremental?.sql).toContain('paymesh_audit_logs_resource_idx');
		expect(incremental?.sql).toContain('("resource_type", "action")');
	});

	test('pushes catalog through cli helper', async () => {
		const productWrites: Array<{ provider: string; count: number }> = [];
		const priceWrites: Array<{ provider: string; count: number }> = [];
		const database = defineDatabaseAdapter({
			id: 'mock',
			dialect: 'postgres',
			persistRaw: false,
			repositories: {
				customers: {
					async findByProviderId() {
						return null;
					},
					async list() {
						return {
							data: [],
							total: 0,
							previous: null,
							next: null,
						};
					},
					async upsert() {},
					async markDeleted() {},
				},
				checkouts: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
				},
				invoices: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
				},
				subscriptions: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
				},
				webhookEvents: {
					async acquire() {
						return { duplicate: false };
					},
					async markProcessed() {},
					async markFailed() {},
				},
				products: {
					async upsertMany(_schema, provider, products) {
						productWrites.push({ provider, count: products.length });
					},
				},
				prices: {
					async upsertMany(_schema, provider, prices) {
						priceWrites.push({ provider, count: prices.length });
					},
				},
				migrations: {
					async ensureTable() {},
					async listApplied() {
						return [];
					},
					async recordApplied() {},
				},
			},
			async query<Row = unknown>(_query: CompiledQuery) {
				return [] as Row[];
			},
			async execute(query: CompiledQuery) {
				void query;
			},
			async transaction(callback) {
				return callback(database);
			},
		});
		const client = {
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
					customers: true,
				},
				payments: {
					create: async () => {
						throw new Error('not used');
					},
				},
				customers: {
					get: async () => {
						throw new Error('not used');
					},
					upsert: async () => {
						throw new Error('not used');
					},
					delete: async () => {
						throw new Error('not used');
					},
				},
				catalog: {
					list: async () => ({
						products: [{ id: 'prod_1', name: 'Starter', version: 'v2' }],
						prices: [
							{
								id: 'price_1',
								productId: 'prod_1',
								amount: 990,
								currency: 'usd',
								type: 'one_time',
							},
						],
					}),
				},
			}),
			schema: resolveDatabaseSchema(),
			database,
		};

		const summary = await pushProviderCatalog(client);

		expect(summary).toEqual({ products: 1, prices: 1 });
		expect(productWrites).toEqual([{ provider: 'stub', count: 1 }]);
		expect(priceWrites).toEqual([{ provider: 'stub', count: 1 }]);
	});
});

async function createTempProject() {
	const directory = await fs.mkdtemp(path.join(tmpdir(), 'paymesh-cli-'));
	tempDirectories.push(directory);
	return directory;
}

async function writeCliClient(directory: string) {
	const paymeshModuleUrl = pathToFileURL(
		path.resolve(process.cwd(), 'packages/paymesh/src/index.ts'),
	).href;
	const logFile = path.join(directory, 'trigger-log.json');

	await fs.writeFile(
		path.join(directory, 'paymesh-client.ts'),
		`
import { appendFileSync } from "node:fs";
import { createClient, definePlugin, defineProvider } from ${JSON.stringify(paymeshModuleUrl)};

const coupons = definePlugin({
	id: 'coupons',
	events: {
		onCouponRedeemed: {
			description: 'Triggered when a coupon is redeemed',
		},
	},
});

export default createClient({
	provider: defineProvider({
		id: 'stub',
		capabilities: {
			checkout: true,
			customers: true,
		},
		payments: {
			create: async () => {
				throw new Error('not used');
			},
		},
		customers: {
			get: async () => {
				throw new Error('not used');
			},
			upsert: async () => {
				throw new Error('not used');
			},
			delete: async () => {
				throw new Error('not used');
			},
		},
	}),
	plugins: [coupons] as const,
	hooks: {
		onEvent(event) {
			appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({
				hook: 'onEvent',
				type: event.type,
			}) + "\\n");
		},
		onCustomerCreated(event) {
			appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({
				hook: 'onCustomerCreated',
				customerId: event.data.id,
			}) + "\\n");
		},
		onCouponRedeemed(event) {
			appendFileSync(${JSON.stringify(logFile)}, JSON.stringify({
				hook: 'onCouponRedeemed',
				code: event.data.code,
			}) + "\\n");
		},
	},
});
`.trim(),
	);
}

async function captureLogs(callback: () => Promise<void>) {
	const originalLog = console.log;
	const lines: string[] = [];

	console.log = (...args: unknown[]) => {
		lines.push(args.map((value) => String(value)).join(' '));
	};

	try {
		await callback();
	} finally {
		console.log = originalLog;
	}

	return lines.join('\n');
}

async function withinCwd<T>(directory: string, callback: () => Promise<T>) {
	const previous = process.cwd();
	process.chdir(directory);

	try {
		return await callback();
	} finally {
		process.chdir(previous);
	}
}
