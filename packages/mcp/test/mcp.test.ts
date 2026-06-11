import { afterEach, describe, expect, mock, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PaymeshClient } from 'paymesh';
import {
	DEFAULT_MCP_CONFIG,
	getRegisteredTools,
	loadPaymeshClient,
	parseCliOptions,
	resolveClientPath,
	resolveMcpConfig,
} from '../src';
import { createToolResult } from '../src/shared/tool';

const tempDirectories: string[] = [];

afterEach(async () => {
	for (const directory of tempDirectories.splice(0)) {
		await fs.rm(directory, { recursive: true, force: true });
	}
});

// biome-ignore lint/suspicious/noExplicitAny: Any
type Any = any;

describe('@paymesh/mcp', () => {
	test('resolves the client path from package.json', async () => {
		const directory = await createTempProject();
		await fs.writeFile(
			path.join(directory, 'package.json'),
			JSON.stringify({ paymesh: { path: './src/paymesh-client.mjs' } }),
		);
		await fs.mkdir(path.join(directory, 'src'), { recursive: true });
		await fs.writeFile(
			path.join(directory, 'src/paymesh-client.mjs'),
			'export default {};',
		);

		expect(await resolveClientPath(directory)).toBe(
			path.join(directory, 'src/paymesh-client.mjs'),
		);
	});

	test('loads default and named paymesh client exports', async () => {
		const defaultDirectory = await createTempProject();
		await writeModule(
			defaultDirectory,
			'default-client.mjs',
			'export default { provider: { id: "stub" }, schema: { prefix: "paymesh_", tables: {} } };',
		);
		const namedDirectory = await createTempProject();
		await writeModule(
			namedDirectory,
			'named-client.mjs',
			'export const billing = { provider: { id: "stub" }, schema: { prefix: "paymesh_", tables: {} } };',
		);

		const defaultClient = await loadPaymeshClient({
			cwd: defaultDirectory,
			clientPath: './default-client.mjs',
		});
		const namedClient = await loadPaymeshClient({
			cwd: namedDirectory,
			clientPath: './named-client.mjs',
			exportName: 'billing',
		});

		expect(defaultClient.provider.id).toBe('stub');
		expect(namedClient.provider.id).toBe('stub');
	});

	test('loads a TypeScript client module', async () => {
		const directory = await createTempProject();
		await writeModule(
			directory,
			'ts-client.ts',
			'export const billing = { provider: { id: "stub" }, schema: { prefix: "paymesh_", tables: {} } };',
		);

		const client = await loadPaymeshClient({
			cwd: directory,
			clientPath: './ts-client.ts',
			exportName: 'billing',
		});

		expect(client.provider.id).toBe('stub');
	});

	test('rejects invalid named exports', async () => {
		const directory = await createTempProject();
		await writeModule(
			directory,
			'named-client.mjs',
			'export const billing = { nope: true };',
		);

		expect(
			loadPaymeshClient({
				cwd: directory,
				clientPath: './named-client.mjs',
				exportName: 'billing',
			}),
		).rejects.toThrow('named export "billing"');
	});

	test('merges client metadata with CLI overrides', () => {
		const client = createTestClient({
			$mcp: {
				enabled: true,
				readonly: false,
				includeRaw: false,
				allowLiveMode: false,
				maxListLimit: 20,
				tools: {
					customers: true,
					payments: false,
					pix: true,
					plugins: true,
				},
			},
		});

		const config = resolveMcpConfig(client, {
			readonly: true,
			maxListLines: 10,
			tools: {
				payments: true,
				plugins: false,
			},
		});

		expect(config).toMatchObject({
			readonly: true,
			maxListLimit: 10,
			tools: {
				customers: true,
				payments: true,
				pix: true,
				plugins: false,
			},
		});
	});

	test('rejects unsupported tool metadata when enabled', () => {
		const client = createTestClient({
			$mcp: {
				...DEFAULT_MCP_CONFIG,
				tools: {
					...DEFAULT_MCP_CONFIG.tools,
					subscriptions: true,
				},
			} as PaymeshClient<boolean>['$mcp'],
		});

		expect(() => resolveMcpConfig(client)).toThrow(
			'Unsupported MCP tool areas requested by the client: subscriptions.',
		);
	});

	test('builds readonly tool definitions', () => {
		const client = createTestClient();
		const tools = getRegisteredTools(
			client,
			resolveMcpConfig(client, { readonly: true }),
		);

		expect(tools.map((tool) => tool.name)).toEqual([
			'capabilities_list',
			'provider_info',
			'customers_list',
			'customers_get',
			'customers_get_by_email',
			'customers_get_by_external_id',
			'pix_get',
			'plugins_list',
		]);
	});

	test('capabilities_list returns the enabled capabilities', async () => {
		const client = createTestClient({
			capabilities: {
				customers: true,
				pix: false,
				checkout: true,
			},
		});
		const tools = getRegisteredTools(client, resolveMcpConfig(client));
		const tool = tools.find((entry) => entry.name === 'capabilities_list');

		const result = await tool!.handler({});

		expect(result.structuredContent).toEqual({
			capabilities: ['checkout', 'customers'],
		});
	});

	test('provider_info returns provider and sandbox details', async () => {
		const client = createTestClient({
			isSandbox: () => false,
			$mcp: {
				...DEFAULT_MCP_CONFIG,
				allowLiveMode: true,
			},
			provider: {
				id: 'provider_x',
				capabilities: {
					customers: true,
					pix: true,
				},
			} as PaymeshClient<boolean>['provider'],
			capabilities: {
				customers: true,
				pix: true,
			},
		});
		const tools = getRegisteredTools(client, resolveMcpConfig(client));
		const tool = tools.find((entry) => entry.name === 'provider_info');

		const result = await tool!.handler({});

		expect(result.structuredContent).toEqual({
			client: {
				sandbox: false,
			},
			provider: {
				id: 'provider_x',
				capabilities: ['customers', 'pix'],
			},
		});
	});

	test('customers_list delegates to client.customers.list', async () => {
		const list = mock(() =>
			Promise.resolve({
				data: [{ id: 'cus_123' }],
				total: 1,
				next: null,
				previous: null,
			}),
		);
		const client = createTestClient({
			customers: {
				...createTestClient().customers,
				list,
			} as unknown as PaymeshClient<boolean>['customers'],
		});
		const tools = getRegisteredTools(client, resolveMcpConfig(client));
		const tool = tools.find((entry) => entry.name === 'customers_list');

		expect(tool).toBeDefined();

		await tool!.handler({ limit: 25 });

		expect(list).toHaveBeenCalledWith({
			after: undefined,
			before: undefined,
			includeRaw: false,
			limit: 25,
			sandbox: undefined,
		});
	});

	test('customers_get_by_email delegates to client.customers.getByEmail', async () => {
		const findByEmail = mock(() => Promise.resolve({ id: 'cus_123' }));
		const client = createTestClient({
			database: createTestClient().database,
		});
		client.database!.repositories.customers.findByEmail = findByEmail as Any;
		const tools = getRegisteredTools(client, resolveMcpConfig(client));
		const tool = tools.find((entry) => entry.name === 'customers_get_by_email');

		await tool!.handler({ email: 'ada@example.com' });

		expect(findByEmail).toHaveBeenCalledWith(
			client.schema,
			'stub',
			true,
			'ada@example.com',
			{ includeRaw: false },
		);
	});

	test('customers_get_by_external_id delegates to client.customers.getByExternalId', async () => {
		const findByExternalId = mock(() => Promise.resolve({ id: 'cus_123' }));
		const client = createTestClient({
			database: createTestClient().database,
		});
		client.database!.repositories.customers.findByExternalId =
			findByExternalId as Any;
		const tools = getRegisteredTools(client, resolveMcpConfig(client));
		const tool = tools.find(
			(entry) => entry.name === 'customers_get_by_external_id',
		);

		await tool!.handler({ externalId: 'user_123' });

		expect(findByExternalId).toHaveBeenCalledWith(
			client.schema,
			'stub',
			true,
			'user_123',
			{ includeRaw: false },
		);
	});

	test('payments_create delegates to client.payments.create', async () => {
		const create = mock(() => Promise.resolve({ id: 'pay_123' }));
		const client = createTestClient({
			payments: {
				create,
			} as unknown as PaymeshClient<boolean>['payments'],
		});
		const tools = getRegisteredTools(client, resolveMcpConfig(client));
		const tool = tools.find((entry) => entry.name === 'payments_create');

		await tool!.handler({
			data: { amount: 1000, currency: 'USD', productIds: ['prod_123'] },
			includeRaw: true,
		});

		expect(create).toHaveBeenCalledWith(
			{ amount: 1000, currency: 'USD', productIds: ['prod_123'] },
			{ includeRaw: true, sandbox: undefined },
		);
	});

	test('blocks requests above max list limit', async () => {
		const client = createTestClient();
		const tools = getRegisteredTools(
			client,
			resolveMcpConfig(client, { maxListLimit: 5 }),
		);
		const tool = tools.find((entry) => entry.name === 'customers_list');

		expect(tool!.handler({ limit: 6 })).rejects.toThrow(
			'Requested list limit 6 exceeds the configured maxListLimit 5.',
		);
	});

	test('blocks live-mode servers unless allowLiveMode is enabled', () => {
		const client = createTestClient({
			isSandbox: () => false,
		});

		expect(() => getRegisteredTools(client, resolveMcpConfig(client))).toThrow(
			'The Paymesh MCP server refuses to start in live mode unless allowLiveMode is enabled.',
		);
	});

	test('maps CLI options into MCP config overrides', () => {
		const cliOptions = parseCliOptions({
			client: './client.mjs',
			export: 'billing',
			readonly: true,
			maxListLimit: 10,
			plugins: false,
		});

		expect(cliOptions).toEqual({
			client: './client.mjs',
			export: 'billing',
			enabled: undefined,
			readonly: true,
			includeRaw: undefined,
			allowLiveMode: undefined,
			maxListLimit: 10,
			maxListLines: undefined,
			tools: {
				customers: undefined,
				payments: undefined,
				pix: undefined,
				plugins: false,
			},
		});
	});

	test('returns structured JSON without serializing the full payload into text', () => {
		const result = createToolResult({
			id: 'cus_123',
			total: 1,
		});

		expect(result.structuredContent).toEqual({
			id: 'cus_123',
			total: 1,
		});
		expect(result.content).toEqual([
			{
				type: 'text',
				text: 'Structured JSON result.',
			},
		]);
	});
});

function createTestClient(
	overrides: Partial<PaymeshClient<boolean>> = {},
): PaymeshClient<boolean> {
	const base = {
		provider: { id: 'stub' },
		schema: { prefix: 'paymesh_', tables: {} },
		isSandbox: () => true,
		$mcp: structuredClone(DEFAULT_MCP_CONFIG),
		customers: {
			list: async () => ({ data: [], total: 0, next: null, previous: null }),
			get: async () => ({ id: 'cus_123' }),
			getByEmail: async () => ({ id: 'cus_123' }),
			getByExternalId: async () => ({ id: 'cus_123' }),
			upsert: async (data: unknown) => data,
			delete: async (id: string) => ({ id }),
		},
		payments: {
			create: async (data: unknown) => data,
		},
		pix: {
			create: async (data: unknown) => data,
			get: async (id: string) => ({ id }),
		},
		plugins: {
			byId: {},
			list: () => [],
		},
		webhooks: {
			handle: async () => ({ status: 200, body: { received: true } }),
		},
		routes: {
			list: () => [],
			handle: async () => new Response(null, { status: 404 }),
		},
		capabilities: {},
		database: {
			close: async () => {},
			repositories: {
				customers: {
					list: async () => ({
						data: [],
						total: 0,
						next: null,
						previous: null,
					}),
					findByProviderId: async () => null,
					upsert: async () => {},
					markDeleted: async () => {},
					findByEmail: async () => null,
					findByExternalId: async () => null,
				},
				payments: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				pix: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				invoices: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				checkouts: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				subscriptions: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				webhookEvents: {
					acquire: async () => ({ duplicate: false }),
					markProcessed: async () => {},
					markFailed: async () => {},
				},
				products: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				prices: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				paymentMethods: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				entitlements: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				usage: {
					findByProviderId: async () => null,
					upsert: async () => {},
				},
				migrations: {
					list: async () => [],
					apply: async () => {},
				},
			},
		},
	} as unknown as PaymeshClient<boolean>;

	return {
		...base,
		...overrides,
	};
}

async function createTempProject() {
	const directory = await fs.mkdtemp(path.join(tmpdir(), 'paymesh-mcp-'));
	tempDirectories.push(directory);
	return directory;
}

async function writeModule(
	directory: string,
	relativePath: string,
	contents: string,
) {
	await fs.writeFile(path.join(directory, relativePath), contents);
}
