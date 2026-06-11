import type { PaymeshClient } from 'paymesh';
import { emptyInputSchema } from '../shared/schema';
import { createToolResult, runTool } from '../shared/tool';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';

export function getPluginTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	return [
		{
			name: 'plugins_list',
			description: 'List registered Paymesh plugins.',
			inputSchema: emptyInputSchema,
			handler: async () =>
				createToolResult(
					await runTool({
						client,
						config,
						run: () => Promise.resolve(client.plugins.list()),
					}),
				),
		},
	];
}
