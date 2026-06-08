import type { Command } from 'commander';
import { loadClient } from 'src/lib/client';
import {
	formatBadge,
	formatPath,
	formatValue,
	logInfo,
	logTitle,
} from '../lib/output';

export function registerPluginsCommand(program: Command) {
	return program
		.command('plugins')
		.description('List all plugins registered in the client')
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.action(async (options) => {
			const client = await loadClient({
				cwd: process.cwd(),
				explicitPath: options.client,
			});

			const plugins = client.plugins.list();

			if (!plugins.length) {
				logInfo('Current client does not have any plugins');

				return;
			}

			const maxNameLength = Math.max(...plugins.map(({ id }) => id.length));

			const content = plugins
				.map(
					({ id, name, version, description }) =>
						`${formatBadge('✦')} ${formatValue((name ?? id).padEnd(maxNameLength))} ${formatPath(`(${version ?? 'no version'})`)} ${description ? `- ${description}` : formatPath('no description')}`,
				)
				.join('\n');

			logTitle('Registered plugins', `${plugins.length} total`);

			console.log(content);
		});
}
