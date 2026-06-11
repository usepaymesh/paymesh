import type { CallToolResult } from '@modelcontextprotocol/server';
import { type PaymeshClient, PaymeshError } from 'paymesh';
import type { ResolvedPaymeshMcpConfig } from '../types';

export function assertServerCanStart(
	client: PaymeshClient<boolean>,
	config: ResolvedPaymeshMcpConfig,
) {
	if (!config.enabled)
		throw new PaymeshError({
			code: 'mcp_error',
			message: 'The Paymesh MCP server is disabled by configuration.',
		});

	if (!config.allowLiveMode && !client.isSandbox())
		throw new PaymeshError({
			code: 'mcp_error',
			message:
				'The Paymesh MCP server refuses to start in live mode unless allowLiveMode is enabled.',
			provider: client.provider.id,
		});
}

export async function runTool<T>({
	run,
	client,
	config,
	sandbox,
}: {
	sandbox?: boolean;
	run: () => Promise<T>;
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}) {
	const targetSandbox = sandbox ?? client.isSandbox();

	if (!config.allowLiveMode && targetSandbox === false)
		throw new PaymeshError({
			code: 'mcp_error',
			message:
				'This MCP server blocks live-mode requests. Enable allowLiveMode to override it.',
			provider: client.provider.id,
		});

	try {
		return await run();
	} catch (error) {
		throw PaymeshError.wrap(error, {
			code: 'mcp_error',
			message:
				error instanceof Error
					? error.message
					: 'The MCP tool execution failed.',
		});
	}
}

export function createToolResult(result: unknown): CallToolResult {
	const structuredContent = JSON.parse(
		JSON.stringify(result, (_key, value) =>
			value instanceof Date ? value.toISOString() : value,
		),
	) as Record<string, unknown>;

	return {
		content: [{ type: 'text', text: 'Structured JSON result.' }],
		structuredContent,
	};
}
