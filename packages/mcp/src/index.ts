import {
	configureProgram,
	createProgram,
	main,
	parseCliOptions,
	startServerFromCli,
} from './cli';
import { createMcpServer, getRegisteredTools } from './server';
import { loadPaymeshClient, resolveClientPath } from './shared/client';
import { resolveMcpConfig } from './shared/config';
import { assertServerCanStart } from './shared/tool';
import { DEFAULT_MCP_CONFIG } from './types';

export type * from './types';
export {
	assertServerCanStart,
	configureProgram,
	createMcpServer,
	createProgram,
	DEFAULT_MCP_CONFIG,
	getRegisteredTools,
	loadPaymeshClient,
	main,
	parseCliOptions,
	resolveClientPath,
	resolveMcpConfig,
	startServerFromCli,
};
