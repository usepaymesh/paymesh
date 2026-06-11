import type { PaymeshClient } from 'paymesh';
import { emptyInputSchema } from '../shared/schema';
import { createToolResult, runTool } from '../shared/tool';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';

export function getProviderInfoTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	return [
		{
			name: 'provider_info',
			description: 'Show the active provider, sandbox mode, and capabilities.',
			inputSchema: emptyInputSchema,
			handler: async () =>
				createToolResult(
					await runTool({
						client,
						config,
						run: () =>
							Promise.resolve({
								client: {
									sandbox: client.isSandbox(),
								},
								provider: {
									id: client.provider.id,
									capabilities: Object.entries(client.capabilities)
										.filter(([, enabled]) => enabled)
										.map(([name]) => name)
										.sort(),
								},
							}),
					}),
				),
		},
	];
}
