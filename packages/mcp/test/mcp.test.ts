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
			'customers_list',
			'customers_get',
			'pix_get',
			'plugins_list',
		]);
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
