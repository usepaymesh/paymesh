import { Command } from 'commander';
import { registerGenerateCommand } from './commands/generate';
import { registerInitCommand } from './commands/init';
import { registerListenCommand } from './commands/listen';
import { registerMigrateCommand } from './commands/migrate';
import { registerPluginsCommand } from './commands/plugins';
import { registerPushCommand } from './commands/push';
import { registerStatusCommand } from './commands/status';
import { registerTriggerCommand } from './commands/trigger';

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
	planGenerateMigrations,
	readMigrationFiles,
	readMigrationHistory,
	resolveHistoryPath,
	writeMigrationFiles,
	writeMigrationHistory,
} from './lib/migrations';

import packageJson from 'package.json';

export { type CliStatus, getPaymeshStatus } from './lib/status';

export const version = packageJson.version;

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
	registerInitCommand(program);
	registerListenCommand(program);
	registerMigrateCommand(program);
	registerPushCommand(program);
	registerStatusCommand(program);
	registerPluginsCommand(program);
	registerTriggerCommand(program);

	return program;
}

export async function main(argv = process.argv) {
	await createProgram().parseAsync(argv);
}
