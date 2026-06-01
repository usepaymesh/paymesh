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
	getExpectedMigrationNames,
	getPaymeshMigrationFiles,
	loadClient,
	pushProviderCatalog,
	readMigrationFiles,
	resolveClientPath,
	writeMigrationFiles,
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

		await writeMigrationFiles(migrationsDir, files);
		const readBack = await readMigrationFiles(migrationsDir);
		const expected = await getExpectedMigrationNames(
			migrationsDir,
			resolveDatabaseSchema(),
		);

		expect(readBack.map((file) => file.name)).toEqual(
			files.map((file) => file.name),
		);
		expect(expected).toEqual(files.map((file) => file.name));
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
					async upsert() {},
				},
				checkouts: {
					async upsert() {},
				},
				invoices: {
					async upsert() {},
				},
				subscriptions: {
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
					create: async () => {
						throw new Error('not used');
					},
					get: async () => {
						throw new Error('not used');
					},
					update: async () => {
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
