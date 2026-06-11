import type { PaymeshClient } from 'paymesh';
import { PaymeshError } from 'paymesh';
import {
	customersListSchema,
	dataInputSchema,
	emailInputSchema,
	externalIdInputSchema,
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

type CustomerEmailInput = {
	email: string;
	includeRaw?: boolean;
	sandbox?: boolean;
};

type CustomerExternalIdInput = {
	externalId: string;
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
		{
			name: 'customers_get_by_email',
			description: 'Get a Paymesh customer by email.',
			inputSchema: emailInputSchema,
			handler: async (input) => {
				const values = input as CustomerEmailInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							resolveCustomerByField({
								client,
								field: 'email',
								value: values.email,
								includeRaw: values.includeRaw ?? config.includeRaw,
								sandbox: values.sandbox,
							}),
					}),
				);
			},
		},
		{
			name: 'customers_get_by_external_id',
			description: 'Get a Paymesh customer by external id.',
			inputSchema: externalIdInputSchema,
			handler: async (input) => {
				const values = input as CustomerExternalIdInput;

				return createToolResult(
					await runTool({
						client,
						config,
						sandbox: values.sandbox,
						run: () =>
							resolveCustomerByField({
								client,
								field: 'externalId',
								value: values.externalId,
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

async function resolveCustomerByField({
	client,
	field,
	value,
	includeRaw,
	sandbox,
}: {
	client: PaymeshClient<boolean>;
	field: 'email' | 'externalId';
	value: string;
	includeRaw?: boolean;
	sandbox?: boolean;
}) {
	const database = client.database;

	if (!database)
		throw new PaymeshError({
			code: 'unsupported_capability',
			message:
				'Customer lookup by email or external id requires a configured database adapter.',
			provider: client.provider.id,
		});

	const targetSandbox = sandbox ?? client.isSandbox();
	const repository = database.repositories.customers;

	if (field === 'email' && repository.findByEmail) {
		const customer = await repository.findByEmail(
			client.schema,
			client.provider.id,
			targetSandbox,
			value,
			{
				includeRaw,
			},
		);
		if (customer) return customer;
	} else if (field === 'externalId' && repository.findByExternalId) {
		const customer = await repository.findByExternalId(
			client.schema,
			client.provider.id,
			targetSandbox,
			value,
			{
				includeRaw,
			},
		);
		if (customer) return customer;
	}

	return findCustomerByField({
		list: (options) =>
			repository.list(
				client.schema,
				client.provider.id,
				targetSandbox,
				options,
			),
		field,
		value,
		includeRaw,
	});
}

async function findCustomerByField({
	list,
	field,
	value,
	includeRaw,
}: {
	list: (options?: {
		limit?: number;
		after?: string;
		before?: string;
		includeRaw?: boolean;
		// biome-ignore lint/suspicious/noExplicitAny: any
	}) => Promise<any>;
	field: 'email' | 'externalId';
	value: string;
	includeRaw?: boolean;
}) {
	let after: string | undefined;

	for (;;) {
		const page = await list({
			limit: 100,
			after,
			includeRaw,
		});

		const match = page.data.find(
			(customer: Record<string, unknown>) => customer[field] === value,
		);
		if (match) return match;

		if (!page.next) return null;
		after = page.next;
	}
}
