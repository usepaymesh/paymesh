import type { PaymeshClient } from 'paymesh';
import { PaymeshError } from 'paymesh';
import {
	customersListSchema,
	dataInputSchema,
	idInputSchema,
} from '../shared/schema';
import { createToolResult, runTool } from '../shared/tool';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';

type CustomersListInput = {
	limit?: number;
	after?: string;
	before?: string;
	includeRaw?: boolean;
	sandbox?: boolean;
};

type CustomerIdInput = {
	id: string;
	includeRaw?: boolean;
	sandbox?: boolean;
};

type CustomerDataInput = {
	data: Record<string, unknown>;
	includeRaw?: boolean;
	sandbox?: boolean;
};

export function getCustomerTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	const tools: Array<PaymeshToolDefinition<Record<string, unknown>>> = [
		{
			name: 'customers_list',
			description: 'List Paymesh customers.',
			inputSchema: customersListSchema,
			handler: async (input) => {
				const values = input as CustomersListInput;

				if (
					typeof values.limit === 'number' &&
					values.limit > config.maxListLimit
				)
					throw new PaymeshError({
						code: 'mcp_error',
						message: `Requested list limit ${String(values.limit)} exceeds the configured maxListLimit ${String(config.maxListLimit)}.`,
					});

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							client.customers.list({
								limit: values.limit,
								after: values.after,
								before: values.before,
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
		{
			name: 'customers_get',
			description: 'Get a Paymesh customer by id.',
			inputSchema: idInputSchema,
			handler: async (input) => {
				const values = input as CustomerIdInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							client.customers.get(values.id, {
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
	];

	if (config.readonly) return tools;

	tools.push(
		{
			name: 'customers_upsert',
			description: 'Create or update a Paymesh customer.',
			inputSchema: dataInputSchema,
			handler: async (input) => {
				const values = input as CustomerDataInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							client.customers.upsert(values.data as never, {
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
		{
			name: 'customers_delete',
			description: 'Delete a Paymesh customer by id.',
			inputSchema: idInputSchema,
			handler: async (input) => {
				const values = input as CustomerIdInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							client.customers.delete(values.id, {
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
	);

	return tools;
}
