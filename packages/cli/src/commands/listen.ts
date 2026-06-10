import type { Command } from 'commander';
import { PaymeshError } from 'paymesh';
import { version } from 'src';
import { printWelcome } from 'src/lib/style';
import { loadClient } from '../lib/client';
import { startWebhookServer } from '../lib/listen';
import { formatPath, logInfo, logSuccess } from '../lib/output';

export function registerListenCommand(program: Command) {
	program
		.command('listen')
		.description('Listen for provider webhooks and print normalized events')
		.argument('[port]', 'Port to bind the local webhook listener', '3000')
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.action(async (portInput: string, options: { client?: string }) => {
			const port = Number.parseInt(portInput, 10);

			if (!Number.isInteger(port) || port < 0 || port > 65_535)
				throw new PaymeshError({
					code: 'cli_error',
					message: `Invalid port "${portInput}". Expected 0-65535.`,
				});

			const client = await loadClient({
				cwd: process.cwd(),
				explicitPath: options.client,
			});

			const server = await startWebhookServer({ client, port });

			printWelcome({
				version,
			});

			logSuccess(
				`Listening for ${client.provider.id} webhooks on ${formatPath(`http://127.0.0.1:${server.port}`)}`,
			);

			await waitForShutdown(async () => {
				await server.close();
				await client.database?.close?.();

				logInfo('Webhook listener stopped');
			});
		});
}

async function waitForShutdown(close: () => Promise<void>) {
	await new Promise<void>((resolve, reject) => {
		let closed = false;

		const handleSignal = (signal: NodeJS.Signals) => {
			logInfo(`Received ${signal}, shutting down...`);
			void shutdown(signal);
		};
		const handleError = (error: unknown) => {
			void shutdown('error', error);
		};

		const cleanup = () => {
			process.off('SIGINT', handleSignal);
			process.off('SIGTERM', handleSignal);
			process.off('uncaughtException', handleError);
		};

		const shutdown = async (_reason: string, error?: unknown) => {
			if (closed) return;
			closed = true;
			cleanup();

			try {
				await close();
				if (error) {
					reject(error);
					return;
				}
				resolve();
			} catch (closeError) {
				reject(closeError);
			}
		};

		process.on('SIGINT', handleSignal);
		process.on('SIGTERM', handleSignal);
		process.on('uncaughtException', handleError);
	});
}
