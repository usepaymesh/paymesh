import type { Command } from 'commander';
import { PaymeshError } from 'paymesh';
import { loadClient } from '../lib/client';
import {
	getAppliedPaymeshMigrations,
	getExpectedMigrations,
	resolveHistoryPath,
	resolveMigrationsDir,
} from '../lib/migrations';
import { compileQuery } from '../lib/sql';

export function registerMigrateCommand(program: Command) {
	program
		.command('migrate')
		.description('Apply local SQL migrations and record them in the database')
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

			if (!client.database)
				throw new PaymeshError({
					code: 'client_error',
					message: 'The configured client does not define a database',
				});

			try {
				const migrationsDir = resolveMigrationsDir(process.cwd(), options.dir);
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
					console.log(`Applied ${file.file}`);
				}

				if (pending.length === 0) {
					console.log('Database already up to date');
				}
			} finally {
				await client.database.close?.();
			}
		});
}
