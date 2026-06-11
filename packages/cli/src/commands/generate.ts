import { existsSync } from 'node:fs';
import path from 'node:path';
import { confirm, isCancel, log, text } from '@clack/prompts';
import type { Command } from 'commander';
import pc from 'picocolors';
import { loadClient } from '../lib/client';
import { isMemoryDatabase } from '../lib/database';
import {
	DEFAULT_MIGRATIONS_DIR,
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
		.option('--yes', 'Skip prompts and accept defaults', false)
		.action(
			async (options: { client?: string; dir?: string; yes?: boolean }) => {
				const client = await loadClient({
					cwd: process.cwd(),
					explicitPath: options.client,
				});

				if (isMemoryDatabase(client.database)) {
					logInfo(
						'Configured client uses @paymesh/memory. SQL migration generation does not apply.',
					);

					return;
				}

				const paymeshDir = path.join(process.cwd(), 'paymesh');
				const isFirstRun = !existsSync(paymeshDir);

				let migrationsDir: string;

				if (isFirstRun && !options.yes) {
					const dir = await text({
						message: 'Where should migration files be saved?',
						initialValue: DEFAULT_MIGRATIONS_DIR,
					});

					if (isCancel(dir)) {
						logInfo('Cancelled.');

						return;
					}

					migrationsDir = resolveMigrationsDir(
						process.cwd(),
						(dir as string).trim() || DEFAULT_MIGRATIONS_DIR,
					);
				} else {
					migrationsDir = resolveMigrationsDir(process.cwd(), options.dir);
				}

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

				if (options.yes) {
					await Promise.all([
						writeMigrationFiles(migrationsDir, plan.files),
						writeMigrationHistory(historyPath, plan.history),
					]);
				} else {
					const ok = await confirm({
						message: `Save ${plan.files.length} migration file(s)?`,
						initialValue: true,
					});

					if (isCancel(ok) || !ok) {
						logInfo('Cancelled.');

						return;
					}

					for (const file of plan.files)
						log.message(
							`  ${pc.dim('•')} ${path.relative(process.cwd(), path.join(migrationsDir, file.file))}`,
						);

					await Promise.all([
						writeMigrationFiles(migrationsDir, plan.files),
						writeMigrationHistory(historyPath, plan.history),
					]);
				}

				for (const file of plan.files)
					logSuccess(
						formatPath(
							path.relative(process.cwd(), path.join(migrationsDir, file.file)),
						),
					);

				logSuccess(formatPath(path.relative(process.cwd(), historyPath)));
			},
		);
}
