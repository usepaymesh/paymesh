import path from 'node:path';
import type { Command } from 'commander';
import { loadClient } from '../lib/client';
import {
	planGenerateMigrations,
	resolveHistoryPath,
	resolveMigrationsDir,
	writeMigrationFiles,
	writeMigrationHistory,
} from '../lib/migrations';
import { formatPath, logInfo, logSuccess } from '../lib/output';

export function registerGenerateCommand(program: Command) {
	program
		.command('generate')
		.description('Generate SQL migrations for the configured Paymesh schema')
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
			const migrationsDir = resolveMigrationsDir(process.cwd(), options.dir);
			const historyPath = resolveHistoryPath(process.cwd());
			const plan = await planGenerateMigrations(
				migrationsDir,
				historyPath,
				client.schema,
			);

			if (!plan.changed) {
				if (plan.historyChanged)
					await writeMigrationHistory(historyPath, plan.history);

				logInfo('No schema changes detected');

				return;
			}

			await Promise.all([
				writeMigrationFiles(migrationsDir, plan.files),
				writeMigrationHistory(historyPath, plan.history),
			]);

			for (const file of plan.files)
				logSuccess(
					formatPath(
						path.relative(process.cwd(), path.join(migrationsDir, file.file)),
					),
				);

			logSuccess(formatPath(path.relative(process.cwd(), historyPath)));
		});
}
