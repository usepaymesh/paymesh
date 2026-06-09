import { afterEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	type CompiledQuery,
	defineDatabaseAdapter,
	defineProvider,
	type PaymeshEventType,
	resolveDatabaseSchema,
	withRaw,
} from 'paymesh';
import {
	createMigrationHistory,
	createProgram,
	getExpectedMigrationNames,
	getMigrationHistoryStatus,
	getPaymeshMigrationFiles,
	getPaymeshStatus,
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
import { inspectWebhookRequest, startWebhookServer } from '../src/lib/listen';

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
		expect(logs).toContain('hooks onEvent, onCustomerCreated');
		expect(logs).toContain('onEvent, onCustomerCreated');
		expect(
			await fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
		).toContain('"hook":"onCustomerCreated"');
	});

	test('sends a built-in event to paymesh listen', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);
		const lines: string[] = [];
		const server = await startWebhookServer({
			client: createWebhookClient(),
			port: 0,
			logger: (message) => {
				lines.push(message);
			},
		});

		try {
			const logs = await withinCwd(directory, () =>
				captureLogs(async () => {
					await createProgram().parseAsync([
						'node',
						'paymesh',
						'trigger',
						'payment.succeeded',
						'--client',
						'./paymesh-client.ts',
						'--listen',
						`http://127.0.0.1:${server.port}/webhooks`,
					]);
				}),
			);
			const listenerLine = stripAnsi(lines[0] ?? '');

			expect(logs).toContain('listener http://');
			expect(logs).toContain('status 200');
			expect(listenerLine).toContain('source=trigger');
			expect(listenerLine).toContain('event=payment.succeeded');
			await expect(
				fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
			).rejects.toThrow();
		} finally {
			await server.close();
		}
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
		expect(logs).toContain('plugin coupons');
		expect(logs).toContain('hook onCouponRedeemed');
		expect(
			await fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
		).toContain('"code":"WELCOME10"');
	});

	test('triggers a built-in event from a json file', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);
		await fs.writeFile(
			path.join(directory, 'customer.json'),
			JSON.stringify({ email: 'file@example.com' }),
		);

		await withinCwd(directory, () =>
			captureLogs(async () => {
				await createProgram().parseAsync([
					'node',
					'paymesh',
					'trigger',
					'customer.created',
					'--client',
					'./paymesh-client.ts',
					'--data',
					'@customer.json',
				]);
			}),
		);

		expect(
			await fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
		).toContain('"email":"file@example.com"');
	});

	test('triggers a plugin event from a json file', async () => {
		const directory = await createTempProject();
		await writeCliClient(directory);
		await fs.writeFile(
			path.join(directory, 'coupon.json'),
			JSON.stringify({ code: 'FILE10' }),
		);

		await withinCwd(directory, () =>
			captureLogs(async () => {
				await createProgram().parseAsync([
					'node',
					'paymesh',
					'trigger',
					'onCouponRedeemed',
					'--client',
					'./paymesh-client.ts',
					'--data',
					'@coupon.json',
				]);
			}),
		);

		expect(
			await fs.readFile(path.join(directory, 'trigger-log.json'), 'utf8'),
		).toContain('"code":"FILE10"');
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

	test('rejects file data that does not end with json', async () => {
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
					'@customer.txt',
				]),
			),
		).rejects.toMatchObject({
			code: 'client_error',
			message: 'File passed to --data must start with "@" and end with ".json"',
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

	test('rejects sending plugin events to paymesh listen', async () => {
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
					'--listen',
					'http://127.0.0.1:3000/webhooks',
					'--data',
					'{"code":"WELCOME10"}',
				]),
			),
		).rejects.toMatchObject({
			code: 'client_error',
			message:
				'Plugin events cannot be sent to paymesh listen. Use built-in webhook events only.',
		});
	});

	test('inspects a valid webhook request', async () => {
		const payload = JSON.stringify({
			id: 'evt_123',
			type: 'payment.succeeded',
			data: {
				id: 'pay_123',
				provider: 'stub',
				sandbox: false,
			},
		});
		const request = new Request('http://localhost/webhooks', {
			method: 'POST',
			headers: {
				'x-paymesh-signature': 'valid',
				'content-type': 'application/json',
			},
			body: payload,
		});

		const result = await inspectWebhookRequest(
			createWebhookClient().provider,
			request,
		);

		expect(result.status).toBe(200);
		expect(result.body).toEqual({ received: true });
		expect(result.deliveryId).toBe('delivery_evt_123');
		expect(result.hook).toBe('onPaymentSucceeded');
		expect(result.rawBody).toBe(payload);
		expect(result.event).toMatchObject({
			id: 'evt_123',
			type: 'payment.succeeded',
			provider: 'stub',
			sandbox: false,
		});
	});

	test('rejects webhook requests with invalid signature', async () => {
		const result = await inspectWebhookRequest(
			createWebhookClient().provider,
			new Request('http://localhost/webhooks', {
				method: 'POST',
				headers: {
					'x-paymesh-signature': 'invalid',
					'content-type': 'application/json',
				},
				body: JSON.stringify({ id: 'evt_123' }),
			}),
		);

		expect(result.status).toBe(401);
		expect(result.body).toEqual({ error: 'invalid_webhook_signature' });
	});

	test('returns a 400 when webhook payload parsing fails', async () => {
		const result = await inspectWebhookRequest(
			createWebhookClient().provider,
			new Request('http://localhost/webhooks', {
				method: 'POST',
				headers: {
					'x-paymesh-signature': 'valid',
					'content-type': 'application/json',
				},
				body: '{',
			}),
		);

		expect(result.status).toBe(400);
		expect(result.body).toEqual({ error: 'webhook_handle_error' });
	});

	test('serves webhook events through the listener server and logs payloads', async () => {
		const lines: string[] = [];
		const server = await startWebhookServer({
			client: createWebhookClient(),
			port: 0,
			logger: (message) => {
				lines.push(message);
			},
		});

		try {
			const response = await fetch(`http://127.0.0.1:${server.port}/webhooks`, {
				method: 'POST',
				headers: {
					'x-paymesh-signature': 'valid',
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_live',
					type: 'checkout.completed',
					data: {
						id: 'pay_123',
						provider: 'stub',
						sandbox: false,
					},
				}),
			});
			const summaryLine = stripAnsi(lines[0] ?? '');

			expect(response.status).toBe(200);
			await expect(response.json()).resolves.toEqual({ received: true });
			expect(summaryLine).toContain('200');
			expect(summaryLine).toContain('provider=stub');
			expect(summaryLine).toContain('event=checkout.completed');
			expect(lines[1]).toContain('"normalizedEvent"');
			expect(lines[1]).toContain('"rawBody"');
		} finally {
			await server.close();
		}
	});

	test('returns 405 for unsupported methods', async () => {
		const lines: string[] = [];
		const server = await startWebhookServer({
			client: createWebhookClient(),
			port: 0,
			logger: (message) => {
				lines.push(message);
			},
		});

		try {
			const response = await fetch(`http://127.0.0.1:${server.port}/webhooks`);
			const summaryLine = stripAnsi(lines[0] ?? '');

			expect(response.status).toBe(405);
			await expect(response.json()).resolves.toEqual({
				error: 'method_not_allowed',
			});
			expect(summaryLine).toContain('405');
			expect(summaryLine).toContain('GET');
		} finally {
			await server.close();
		}
	});

	test('fails to start the listener when provider does not support webhooks', async () => {
		await expect(
			startWebhookServer({
				client: {
					provider: defineProvider({
						id: 'stub',
						isSandbox: () => false,
						capabilities: {
							checkout: true,
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
				},
				port: 0,
			}),
		).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "stub" does not support webhooks capability',
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
		expect(plan.files[0]?.file).toBe('0004_paymesh_schema_sync.sql');
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

	test('initial migration includes sandbox column in all built-in tables', () => {
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const initial = files.find((file) => file.version === 1);

		expect(initial).toBeDefined();
		// sandbox column appears once per table — 11 built-in sandbox tables
		const sandboxColumnMatches =
			initial?.sql.match(/sandbox BOOLEAN NOT NULL DEFAULT FALSE/g) ?? [];
		expect(sandboxColumnMatches.length).toBeGreaterThanOrEqual(11);
		// unique constraint includes sandbox — appears once per built-in table
		const uniqueConstraintMatches =
			initial?.sql.match(/UNIQUE \(provider, sandbox, provider_id\)/g) ?? [];
		expect(uniqueConstraintMatches.length).toBeGreaterThanOrEqual(11);
	});

	test('initial migration does not use old provider-only unique constraint', () => {
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const initial = files.find((file) => file.version === 1);

		// Old constraint should not appear in fresh schema
		expect(initial?.sql).not.toContain('UNIQUE (provider, provider_id)');
	});

	test('generates paymesh_sandbox_isolation as migration version 3', () => {
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const sandboxMigration = files.find((file) => file.version === 3);

		expect(sandboxMigration).toBeDefined();
		expect(sandboxMigration?.name).toBe('paymesh_sandbox_isolation');
		expect(sandboxMigration?.file).toBe('0003_paymesh_sandbox_isolation.sql');
	});

	test('paymesh_sandbox_isolation migration replaces old unique constraint with sandbox-aware one', () => {
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const sandboxMigration = files.find((file) => file.version === 3);

		expect(sandboxMigration?.sql).toContain(
			"pg_get_constraintdef(oid) = 'UNIQUE (provider, provider_id)'",
		);
		expect(sandboxMigration?.sql).toContain(
			'UNIQUE (provider, sandbox, provider_id)',
		);
		expect(sandboxMigration?.sql).toContain('provider_sandbox_provider_id_uniq');
	});

	test('paymesh_sandbox_isolation migration covers all built-in sandbox tables', () => {
		const schema = resolveDatabaseSchema();
		const files = getPaymeshMigrationFiles(schema);
		const sandboxMigration = files.find((file) => file.version === 3);

		// Each built-in sandbox table should have a DO $$ block for constraint replacement
		const doBlocks = (sandboxMigration?.sql.match(/DO \$\$/g) ?? []).length;
		// 11 built-in sandbox tables: customers, pix, checkouts, invoices,
		// paymentMethods, entitlements, usage, webhookEvents, subscriptions, products, prices
		expect(doBlocks).toBe(11);
	});

	test('schema sync migration includes sandbox column and constraint update', async () => {
		const directory = await createTempProject();
		const migrationsDir = path.join(directory, 'paymesh', 'migrations');
		const historyPath = resolveHistoryPath(directory);
		// Use an outdated schema snapshot that lacks the sandbox column marker
		// by writing the current files and then modifying the schema to add a field
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
						loyalty_tier: {
							type: 'string',
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
		// Schema sync migration should include sandbox column sync for built-in tables
		expect(plan.files[0]?.sql).toContain(
			'ADD COLUMN IF NOT EXISTS sandbox BOOLEAN NOT NULL DEFAULT FALSE',
		);
		// It should also include the constraint replacement
		expect(plan.files[0]?.sql).toContain(
			'provider_sandbox_provider_id_uniq',
		);
	});

	test('getPaymeshStatus uses sandbox filter in database queries', async () => {
		const executedQueries: Array<{ sql: string; params: unknown[] }> = [];
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
						return { data: [], total: 0, previous: null, next: null };
					},
					async upsert() {},
					async markDeleted() {},
				},
				pix: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
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
					async upsertMany() {},
				},
				prices: {
					async upsertMany() {},
				},
				migrations: {
					async ensureTable() {},
					async listApplied() {
						return [];
					},
					async recordApplied() {},
				},
			},
			async query<Row = unknown>(query: CompiledQuery) {
				executedQueries.push({ sql: query.sql, params: query.params });
				return [
					{
						pix_count: '0',
						product_count: '0',
						price_count: '0',
						webhook_event_count: '0',
					},
				] as Row[];
			},
			async execute() {},
			async transaction(callback) {
				return callback(database);
			},
		});
		const client = {
			provider: defineProvider({
				id: 'stub',
				isSandbox: () => false,
				capabilities: {
					checkout: true,
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
			schema: resolveDatabaseSchema(),
			database,
			isSandbox: () => false,
		};

		await getPaymeshStatus(client, [], [], {
			exists: true,
			valid: true,
			missingFiles: [],
			checksumMismatches: [],
			migrations: [],
		});

		// Status query should include sandbox parameter
		const statusQuery = executedQueries.find((q) =>
			q.sql.includes('pix_count'),
		);
		expect(statusQuery).toBeDefined();
		expect(statusQuery?.sql).toContain('WHERE sandbox = $1');
		expect(statusQuery?.params).toContain(false);
	});

	test('getPaymeshStatus passes sandbox=true when provider is sandbox', async () => {
		const executedQueries: Array<{ sql: string; params: unknown[] }> = [];
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
						return { data: [], total: 0, previous: null, next: null };
					},
					async upsert() {},
					async markDeleted() {},
				},
				pix: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
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
					async upsertMany() {},
				},
				prices: {
					async upsertMany() {},
				},
				migrations: {
					async ensureTable() {},
					async listApplied() {
						return [];
					},
					async recordApplied() {},
				},
			},
			async query<Row = unknown>(query: CompiledQuery) {
				executedQueries.push({ sql: query.sql, params: query.params });
				return [
					{
						pix_count: '5',
						product_count: '2',
						price_count: '3',
						webhook_event_count: '1',
					},
				] as Row[];
			},
			async execute() {},
			async transaction(callback) {
				return callback(database);
			},
		});
		const client = {
			provider: defineProvider({
				id: 'stub',
				isSandbox: () => true,
				capabilities: {
					checkout: true,
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
			schema: resolveDatabaseSchema(),
			database,
			isSandbox: () => true,
		};

		await getPaymeshStatus(client, [], [], {
			exists: true,
			valid: true,
			missingFiles: [],
			checksumMismatches: [],
			migrations: [],
		});

		const statusQuery = executedQueries.find((q) =>
			q.sql.includes('pix_count'),
		);
		expect(statusQuery?.params).toContain(true);
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
				pix: {
					async findByProviderId() {
						return null;
					},
					async upsert() {},
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
				isSandbox: () => false,
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
						products: [
							{ id: 'prod_1', sandbox: false, name: 'Starter', version: 'v2' },
						],
						prices: [
							{
								id: 'price_1',
								sandbox: false,
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
		isSandbox: () => false,
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
				email: event.data.email,
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

function createWebhookClient() {
	return {
		provider: defineProvider({
			id: 'stub',
			isSandbox: () => false,
			capabilities: {
				checkout: true,
				customers: true,
				webhooks: true,
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
			webhooks: {
				async verify({ request }) {
					return request.headers.get('x-paymesh-signature') === 'valid';
				},
				async handle({ request, includeRaw }) {
					const payload = (await request.json()) as {
						id: string;
						type: PaymeshEventType;
						data: {
							id: string;
							provider: string;
						};
					};

					return {
						deliveryId: `delivery_${payload.id}`,
						hook:
							payload.type === 'payment.succeeded'
								? 'onPaymentSucceeded'
								: 'onCheckoutCompleted',
						event: withRaw(
							{
								id: payload.id,
								type: payload.type,
								provider: 'stub',
								sandbox: false,
								data: payload.data,
							},
							payload,
							includeRaw,
						),
					};
				},
			},
		}),
		schema: resolveDatabaseSchema(),
	};
}

async function captureLogs(callback: () => Promise<void>) {
	const originalLog = console.log;
	const lines: string[] = [];

	console.log = (...args: unknown[]) => {
		lines.push(stripAnsi(args.map((value) => String(value)).join(' ')));
	};

	try {
		await callback();
	} finally {
		console.log = originalLog;
	}

	return lines.join('\n');
}

function stripAnsi(value: string) {
	let output = '';
	let i = 0;

	while (i < value.length) {
		const current = value.charAt(i);

		if (current !== '\u001b') {
			output += current;
			i += 1;
			continue;
		}

		i += 1;
		if (value.charAt(i) === '[') {
			i += 1;

			while (i < value.length) {
				const code = value.charAt(i);
				i += 1;
				if (code !== ';' && (code < '0' || code > '9')) break;
			}
		}
	}

	return output;
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
