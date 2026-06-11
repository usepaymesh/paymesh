import { McpServer } from '@modelcontextprotocol/server';
import packageJson from 'package.json';
import type { PaymeshClient } from 'paymesh';
import { resolveMcpConfig } from './shared/config';
import { assertServerCanStart } from './shared/tool';
import { getTools } from './tools';
import type { CreatePaymeshMcpServerOptions } from './types';

export function createMcpServer({
	client,
	config = resolveMcpConfig(client),
}: CreatePaymeshMcpServerOptions) {
	assertServerCanStart(client, config);

	const server = new McpServer({
		name: '@paymesh/mcp',
		version: packageJson.version,
	});

	for (const tool of getTools({ client, config })) {
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				inputSchema: tool.inputSchema,
			},
			tool.handler,
		);
	}

	return server;
}

export function getRegisteredTools(
	client: PaymeshClient<boolean>,
	config = resolveMcpConfig(client),
) {
	assertServerCanStart(client, config);
	return getTools({ client, config });
}
