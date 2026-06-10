import type { Command } from 'commander';
import { version } from 'src';
import { printWelcome } from 'src/lib/style';
import { loadClient } from '../lib/client';
import {
	getAppliedPaymeshMigrations,
	getMigrationHistoryStatus,
	resolveHistoryPath,
	resolveMigrationsDir,
} from '../lib/migrations';
import { formatState, formatValue, logTitle } from '../lib/output';
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

				printWelcome({
					version,
				});

				logTitle('Paymesh status', `provider ${status.provider.id}`);

				console.log(`  Provider    ${formatValue(status.provider.id)}`);
				console.log(
					`  Database    ${status.database.configured ? formatState(status.database.connected ? 'connected' : 'configured') : formatState('not configured', 'warn')}`,
				);
				console.log(
					`  History     ${status.history.exists ? (status.history.valid ? formatState('valid') : formatState('invalid', 'bad')) : formatState('missing', 'warn')}`,
				);
				console.log(
					`  Migrations  ${status.migrations.upToDate ? formatState('up to date') : formatState(`${status.migrations.pending.length} pending`, 'warn')}`,
				);
				console.log(
					`  Catalog     ${status.catalog.supported ? formatState(`${status.catalog.productCount ?? 0} products / ${status.catalog.priceCount ?? 0} prices`) : formatState('not supported', 'warn')}`,
				);
				console.log(
					`  PIX         ${status.pix.supported ? formatState(`${status.pix.count ?? 0} persisted`) : formatState('not supported', 'warn')}`,
				);
				console.log(
					`  Webhooks    ${status.webhooks.supported ? formatState(`${status.webhooks.processedCount ?? 0} events persisted`) : formatState('not supported', 'warn')}`,
				);
				console.log(`  Schema      ${formatValue(status.schema.prefix)}`);
			} finally {
				await client.database?.close?.();
			}
		});
}
