import type { Command } from 'commander';
import { loadClient } from '../lib/client';
import {
	getAppliedPaymeshMigrations,
	getExpectedMigrationNames,
	resolveMigrationsDir,
} from '../lib/migrations';
import { getPaymeshStatus } from '../lib/status';

export function registerStatusCommand(program: Command) {
	program
		.command('status')
		.description(
			'Show provider, database, migrations, catalog, and webhook status',
		)
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.option('--dir <path>', 'Migrations directory')
		.action(async (options: { client?: string; dir?: string }) => {
			const client = await loadClient({
				cwd: process.cwd(),
				explicitPath: options.client,
			});

			try {
				const migrationsDir = resolveMigrationsDir(process.cwd(), options.dir);
				const [expected, applied] = await Promise.all([
					getExpectedMigrationNames(migrationsDir, client.schema),
					client.database == null
						? Promise.resolve<string[]>([])
						: getAppliedPaymeshMigrations(client.database, client.schema),
				]);
				const status = await getPaymeshStatus(client, applied, expected);

				console.log(`Provider: ${status.provider.id}`);
				console.log(
					`Database: ${status.database.configured ? (status.database.connected ? 'connected' : 'configured') : 'not configured'}`,
				);
				console.log(
					`Migrations: ${status.migrations.upToDate ? 'up to date' : `${status.migrations.pending.length} pending`}`,
				);
				console.log(
					`Catalog: ${status.catalog.supported ? `supported (${status.catalog.productCount ?? 0} products / ${status.catalog.priceCount ?? 0} prices)` : 'not supported'}`,
				);
				console.log(
					`Webhooks: ${status.webhooks.supported ? `supported (${status.webhooks.processedCount ?? 0} events persisted)` : 'not supported'}`,
				);
				console.log(
					`Schema prefix: ${status.schema.prefix} | customers table: ${status.schema.tables.customers.name}`,
				);
			} finally {
				await client.database?.close?.();
			}
		});
}
