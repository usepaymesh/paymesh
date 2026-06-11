import type { PaymeshClient } from 'paymesh';
import { dataInputSchema } from '../shared/schema';
import { createToolResult, runTool } from '../shared/tool';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';

type PaymentCreateInput = {
	data: Record<string, unknown>;
	includeRaw?: boolean;
	sandbox?: boolean;
};

export function getPaymentTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	if (config.readonly) return [];

	return [
		{
			name: 'payments_create',
			description: 'Create a Paymesh payment.',
			inputSchema: dataInputSchema,
			handler: async (input) => {
				const values = input as PaymentCreateInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							client.payments.create(values.data as never, {
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
	];
}
