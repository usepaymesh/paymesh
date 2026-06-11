import type { PaymeshClient } from 'paymesh';
import { PaymeshError } from 'paymesh';
import {
	DEFAULT_MCP_CONFIG,
	MCP_TOOL_AREAS,
	type PaymeshMcpCliOptions,
	type PaymeshMcpToolArea,
	type ResolvedPaymeshMcpConfig,
} from '../types';

export function resolveMcpConfig(
	client: Pick<PaymeshClient<boolean>, '$mcp'>,
	cliOverrides: PaymeshMcpCliOptions = {},
): ResolvedPaymeshMcpConfig {
	const tools = cliOverrides.tools ?? {};
	const metadata = client.$mcp ?? DEFAULT_MCP_CONFIG;
	const maxListLimit = cliOverrides.maxListLimit ?? cliOverrides.maxListLines;

	if (metadata.tools) {
		const unsupported = Object.entries(metadata.tools)
			.filter(
				([key, enabled]) =>
					!MCP_TOOL_AREAS.includes(key as PaymeshMcpToolArea) && enabled,
			)
			.map(([key]) => key)
			.sort();

		if (unsupported.length > 0)
			throw new PaymeshError({
				code: 'mcp_error',
				message: `Unsupported MCP tool areas requested by the client: ${unsupported.join(', ')}.`,
			});
	}

	const config = {
		enabled:
			cliOverrides.enabled ?? metadata.enabled ?? DEFAULT_MCP_CONFIG.enabled,
		readonly:
			cliOverrides.readonly ?? metadata.readonly ?? DEFAULT_MCP_CONFIG.readonly,
		includeRaw:
			cliOverrides.includeRaw ??
			metadata.includeRaw ??
			DEFAULT_MCP_CONFIG.includeRaw,
		allowLiveMode:
			cliOverrides.allowLiveMode ??
			metadata.allowLiveMode ??
			DEFAULT_MCP_CONFIG.allowLiveMode,
		maxListLimit:
			maxListLimit ?? metadata.maxListLimit ?? DEFAULT_MCP_CONFIG.maxListLimit,
		tools: {
			customers:
				tools.customers ??
				metadata.tools?.customers ??
				DEFAULT_MCP_CONFIG.tools.customers,
			payments:
				tools.payments ??
				metadata.tools?.payments ??
				DEFAULT_MCP_CONFIG.tools.payments,
			pix: tools.pix ?? metadata.tools?.pix ?? DEFAULT_MCP_CONFIG.tools.pix,
			plugins:
				tools.plugins ??
				metadata.tools?.plugins ??
				DEFAULT_MCP_CONFIG.tools.plugins,
		},
	} satisfies ResolvedPaymeshMcpConfig;

	if (!Number.isInteger(config.maxListLimit) || config.maxListLimit < 1)
		throw new PaymeshError({
			code: 'mcp_error',
			message: `Invalid MCP maxListLimit "${String(config.maxListLimit)}". Expected a positive integer.`,
		});

	return config;
}
