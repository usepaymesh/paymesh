import type { PaymeshClient } from 'paymesh';
import type { PaymeshToolDefinition, ResolvedPaymeshMcpConfig } from '../types';
import { getCapabilitiesTools } from './capabilities';
import { getCustomerTools } from './customers';
import { getPaymentTools } from './payments';
import { getPixTools } from './pix';
import { getPluginTools } from './plugins';
import { getProviderInfoTools } from './provider-info';

export function getTools({
	client,
	config,
}: {
	client: PaymeshClient<boolean>;
	config: ResolvedPaymeshMcpConfig;
}): Array<PaymeshToolDefinition<Record<string, unknown>>> {
	const tools: Array<PaymeshToolDefinition<Record<string, unknown>>> = [];

	tools.push(...getCapabilitiesTools({ client, config }));
	tools.push(...getProviderInfoTools({ client, config }));

	if (config.tools.customers) {
		tools.push(...getCustomerTools({ client, config }));
	}

	if (config.tools.payments) {
		tools.push(...getPaymentTools({ client, config }));
	}

	if (config.tools.pix) {
		tools.push(...getPixTools({ client, config }));
	}

	if (config.tools.plugins) {
		tools.push(...getPluginTools({ client, config }));
	}

	return tools;
}
