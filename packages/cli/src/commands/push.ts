import type { Command } from 'commander';
import { PaymeshError } from 'paymesh';
import { pushProviderCatalog } from '../lib/catalog';
import { loadClient } from '../lib/client';

export function registerPushCommand(program: Command) {
	program
		.command('push')
		.description(
			'Synchronize the provider catalog into the configured database',
		)
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.action(async (options: { client?: string }) => {
			const client = await loadClient({
				cwd: process.cwd(),
				explicitPath: options.client,
			});

			if (!client.database)
				throw new PaymeshError({
					code: 'client_error',
					message: 'The configured client does not define a database',
				});

			try {
				const summary = await pushProviderCatalog(client);
				console.log(`Products: ${summary.products}`);
				console.log(`Prices: ${summary.prices}`);
			} finally {
				await client.database.close?.();
			}
		});
}
