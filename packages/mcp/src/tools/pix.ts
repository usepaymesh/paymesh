import type { PaymeshClient } from 'paymesh';
import { dataInputSchema, idInputSchema } from '../shared/schema';
import { createToolResult, runTool } from '../shared/tool';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';

type PixInput = {
	data: Record<string, unknown>;
	includeRaw?: boolean;
	sandbox?: boolean;
};

type PixIdInput = {
	id: string;
	includeRaw?: boolean;
	sandbox?: boolean;
};

export function getPixTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	const tools: Array<PaymeshToolDefinition<Record<string, unknown>>> = [
		{
			name: 'pix_get',
			description: 'Get a Paymesh PIX payment by id.',
			inputSchema: idInputSchema,
			handler: async (input) => {
				const values = input as PixIdInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							client.pix.get(values.id, {
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
	];

	if (config.readonly) return tools;

	tools.unshift({
		name: 'pix_create',
		description: 'Create a Paymesh PIX payment.',
		inputSchema: dataInputSchema,
		handler: async (input) => {
			const values = input as PixInput;

			return createToolResult(
				await runTool({
					client,
					config,
					sandbox: values.sandbox,
					run: () =>
						client.pix.create(values.data as never, {
							includeRaw: values.includeRaw ?? config.includeRaw,
							sandbox: values.sandbox,
						}),
				}),
			);
		},
	});

	return tools;
}
