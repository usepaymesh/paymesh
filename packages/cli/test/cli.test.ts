import { afterEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	type CompiledQuery,
	defineDatabaseAdapter,
	defineProvider,
	resolveDatabaseSchema,
} from 'paymesh';
import {
	createMigrationHistory,
	getExpectedMigrationNames,
	getMigrationHistoryStatus,
	getPaymeshMigrationFiles,
	loadClient,
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

	test('writes and reads generated migration files', async () => {
		const directory = await createTempProject();
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const migrationsDir = path.join(directory, 'paymesh', 'migrations');
		const historyPath = resolveHistoryPath(directory);

		await writeMigrationFiles(migrationsDir, files);
		await writeMigrationHistory(historyPath, createMigrationHistory(files));
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
