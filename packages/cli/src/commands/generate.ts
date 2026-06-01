import path from 'node:path';
import type { Command } from 'commander';
import { loadClient } from '../lib/client';
import {
	createMigrationHistory,
	getPaymeshMigrationFiles,
	resolveHistoryPath,
	resolveMigrationsDir,
	writeMigrationFiles,
	writeMigrationHistory,
} from '../lib/migrations';

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
			const files = getPaymeshMigrationFiles(client.schema);

			await Promise.all([
				writeMigrationFiles(migrationsDir, files),
				writeMigrationHistory(historyPath, createMigrationHistory(files)),
			]);

			for (const file of files) {
				console.log(
					path.relative(process.cwd(), path.join(migrationsDir, file.file)),
				);
			}
			console.log(path.relative(process.cwd(), historyPath));
		});
}
