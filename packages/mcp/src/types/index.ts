import type { CallToolResult } from '@modelcontextprotocol/server';
import type { PaymeshClient } from 'paymesh';
import type { ZodObject } from 'zod/v4';

export const MCP_TOOL_AREAS = [
	'customers',
	'payments',
	'pix',
	'plugins',
] as const;

export type PaymeshMcpToolArea = (typeof MCP_TOOL_AREAS)[number];

export interface PaymeshMcpCliOptions {
	client?: string;
	export?: string;
	enabled?: boolean;
	readonly?: boolean;
	includeRaw?: boolean;
	allowLiveMode?: boolean;
	maxListLimit?: number;
	maxListLines?: number;
	tools?: Partial<Record<PaymeshMcpToolArea, boolean>>;
}

export interface ResolvedPaymeshMcpConfig {
	enabled: boolean;
	readonly: boolean;
	includeRaw: boolean;
	allowLiveMode: boolean;
	maxListLimit: number;
	tools: Record<PaymeshMcpToolArea, boolean>;
}

export interface LoadPaymeshClientOptions {
	cwd: string;
	clientPath?: string;
	exportName?: string;
}

export interface CreatePaymeshMcpServerOptions {
	client: PaymeshClient<boolean>;
	config?: ResolvedPaymeshMcpConfig;
}

export interface PaymeshToolDefinition<TInput extends Record<string, unknown>> {
	name: string;
	description: string;
	inputSchema: ZodObject;
	handler: (input: TInput) => Promise<CallToolResult>;
}

export const DEFAULT_MCP_CONFIG: ResolvedPaymeshMcpConfig = {
	enabled: true,
	readonly: false,
	includeRaw: false,
	allowLiveMode: false,
	maxListLimit: 50,
	tools: {
		customers: true,
		payments: true,
		pix: true,
		plugins: true,
	},
};
