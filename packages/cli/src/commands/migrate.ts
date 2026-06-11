import type { Command } from 'commander';
import { PaymeshError } from 'paymesh';
import { loadClient } from '../lib/client';
import { isMemoryDatabase } from '../lib/database';
import {
	getAppliedPaymeshMigrations,
	getExpectedMigrations,
	resolveHistoryPath,
	resolveMigrationsDir,
} from '../lib/migrations';
import { formatPath, logInfo, logSuccess } from '../lib/output';
import { compileQuery } from '../lib/sql';

export function registerMigrateCommand(program: Command) {
	program
		.command('migrate')
		.description('Apply local SQL migrations and record them in the database')
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.option('--export <name>', 'Named export to load from the client module')
		.option('--dir <path>', 'Migrations directory')
		.action(
			async (options: { client?: string; dir?: string; export?: string }) => {
				const client = await loadClient({
					cwd: process.cwd(),
					explicitPath: options.client,
					exportName: options.export,
				});

				if (!client.database)
					throw new PaymeshError({
						code: 'client_error',
						message: 'The configured client does not define a database',
					});

				if (isMemoryDatabase(client.database)) {
					logInfo(
						'Configured client uses @paymesh/memory. SQL migrations do not apply.',
					);

					return;
				}

				try {
					const migrationsDir = resolveMigrationsDir(
						process.cwd(),
						options.dir,
					);
					const historyPath = resolveHistoryPath(process.cwd());
					const [localFiles, applied] = await Promise.all([
						getExpectedMigrations(migrationsDir, historyPath, client.schema),
						getAppliedPaymeshMigrations(client.database, client.schema),
					]);
					const pending = localFiles.filter(
						(file) => !applied.includes(file.file),
					);

					for (const file of pending) {
						await client.database.transaction(async (tx) => {
							await tx.execute(compileQuery(file.sql));
							await tx.repositories.migrations.recordApplied(
								client.schema,
								file.file,
							);
						});
						logSuccess(`Applied ${formatPath(file.file)}`);
					}

					if (pending.length === 0) {
						logInfo('Database already up to date');
					}
				} finally {
					await client.database.close?.();
				}
			},
		);
}
