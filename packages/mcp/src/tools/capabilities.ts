import type { PaymeshClient } from 'paymesh';
import { emptyInputSchema } from '../shared/schema';
import { createToolResult, runTool } from '../shared/tool';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';

export function getCapabilitiesTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	return [
		{
			name: 'capabilities_list',
			description: 'List the active Paymesh client capabilities.',
			inputSchema: emptyInputSchema,
			handler: async () =>
				createToolResult(
					await runTool({
						client,
						config,
						run: () =>
							Promise.resolve({
								capabilities: Object.entries(client.capabilities)
									.filter(([, enabled]) => enabled)
									.map(([name]) => name)
									.sort(),
							}),
					}),
				),
		},
	];
}
