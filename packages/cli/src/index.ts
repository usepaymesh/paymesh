import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generate';
import { registerMigrateCommand } from './commands/migrate';
import { registerPushCommand } from './commands/push';
import { registerStatusCommand } from './commands/status';

export { pushProviderCatalog } from './lib/catalog';
export { loadClient, resolveClientPath } from './lib/client';
export {
	createMigrationHistory,
	DEFAULT_HISTORY_FILE,
	DEFAULT_MIGRATIONS_DIR,
	getAppliedPaymeshMigrations,
	getExpectedMigrationNames,
	getExpectedMigrations,
	getMigrationHistoryStatus,
	getPaymeshMigrationFiles,
	type PaymeshMigrationFile,
	type PaymeshMigrationHistory,
	type PaymeshMigrationHistoryEntry,
	type PaymeshMigrationHistoryStatus,
	readMigrationFiles,
	readMigrationHistory,
	resolveHistoryPath,
	writeMigrationFiles,
	writeMigrationHistory,
} from './lib/migrations';

import packageJson from 'package.json';

export { type CliStatus, getPaymeshStatus } from './lib/status';

export function createProgram() {
	const program = new Command();

	program
		.name('paymesh')
		.description(
			'Paymesh CLI for database migrations, catalog sync, and status checks',
		)
		.version(packageJson.version)
		.showHelpAfterError();

	registerGenerateCommand(program);
	registerMigrateCommand(program);
	registerPushCommand(program);
	registerStatusCommand(program);

	return program;
}

export async function main(argv = process.argv) {
	await createProgram().parseAsync(argv);
}
