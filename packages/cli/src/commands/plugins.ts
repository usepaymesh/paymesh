import type { Command } from 'commander';
import pc from 'picocolors';
import { loadClient } from 'src/lib/client';

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

			if (!plugins.length)
				return console.log('Currenct client does not have any plugin');

			const maxNameLength = Math.max(...plugins.map(({ id }) => id.length));

			const content = plugins
				.map(
					({ id, name, version, description }) =>
						`${pc.magenta('✦')} ${pc.bold((name ?? id).padEnd(maxNameLength))} (${version ?? 'No version'}): ${pc.dim(description ?? 'No description')}`,
				)
				.join('\n');

			console.log(content);
		});
}
