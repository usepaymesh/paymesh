import type { Command } from 'commander';
import { loadClient } from '../lib/client';
import {
	getAppliedPaymeshMigrations,
	getMigrationHistoryStatus,
	resolveHistoryPath,
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
				const historyPath = resolveHistoryPath(process.cwd());
				const [history, applied] = await Promise.all([
					getMigrationHistoryStatus(migrationsDir, historyPath, client.schema),
					client.database == null
						? Promise.resolve<string[]>([])
						: getAppliedPaymeshMigrations(client.database, client.schema),
				]);
				const expected = history.migrations;
				const status = await getPaymeshStatus(
					client,
					applied,
					expected,
					history,
				);

				console.log(`Provider: ${status.provider.id}`);
				console.log(
					`Database: ${status.database.configured ? (status.database.connected ? 'connected' : 'configured') : 'not configured'}`,
				);
				console.log(
					`History: ${status.history.exists ? (status.history.valid ? 'valid' : 'invalid') : 'missing'}`,
				);
				console.log(
					`Migrations: ${status.migrations.upToDate ? 'up to date' : `${status.migrations.pending.length} pending`}`,
				);
				console.log(
					`Catalog: ${status.catalog.supported ? `supported (${status.catalog.productCount ?? 0} products / ${status.catalog.priceCount ?? 0} prices)` : 'not supported'}`,
				);
				console.log(
					`PIX: ${status.pix.supported ? `supported (${status.pix.count ?? 0} persisted)` : 'not supported'}`,
				);
				console.log(
					`Webhooks: ${status.webhooks.supported ? `supported (${status.webhooks.processedCount ?? 0} events persisted)` : 'not supported'}`,
				);
				console.log(`Schema prefix: ${status.schema.prefix}`);
			} finally {
				await client.database?.close?.();
			}
		});
}
