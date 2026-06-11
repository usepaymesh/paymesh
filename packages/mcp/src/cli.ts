#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/server';
import { Command } from 'commander';
import packageJson from 'package.json';
import { PaymeshError } from 'paymesh';
import { createMcpServer } from './server';
import { loadPaymeshClient } from './shared/client';
import { resolveMcpConfig } from './shared/config';
import type { PaymeshMcpCliOptions } from './types';

export function createProgram() {
	const program = new Command();

	configureProgram(program);

	return program;
}

export function configureProgram(program: Command) {
	program
		.name('paymesh-mcp')
		.description('Expose a Paymesh client as an MCP server over stdio')
		.version(packageJson.version)
		.showHelpAfterError()
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.option(
			'--export <name>',
			'Named export to load from the client module. Defaults to default or "paymesh".',
		)
		.option('--enabled', 'Enable the MCP server')
		.option('--no-enabled', 'Disable the MCP server')
		.option('--readonly', 'Expose only readonly MCP tools')
		.option('--no-readonly', 'Allow mutating MCP tools')
		.option('--include-raw', 'Include raw provider payloads by default')
		.option('--no-include-raw', 'Hide raw provider payloads by default')
		.option(
			'--allow-live-mode',
			'Allow startup and requests against live-mode providers',
		)
		.option(
			'--no-allow-live-mode',
			'Block startup and requests against live-mode providers',
		)
		.option(
			'--max-list-limit <n>',
			'Maximum allowed limit for list tools',
			parsePositiveInteger,
		)
		.option(
			'--max-list-lines <n>',
			'Alias for --max-list-limit',
			parsePositiveInteger,
		)
		.option('--customers', 'Enable customer tools')
		.option('--no-customers', 'Disable customer tools')
		.option('--payments', 'Enable payment tools')
		.option('--no-payments', 'Disable payment tools')
		.option('--pix', 'Enable PIX tools')
		.option('--no-pix', 'Disable PIX tools')
		.option('--plugins', 'Enable plugin tools')
		.option('--no-plugins', 'Disable plugin tools')
		.action(async (options: Record<string, unknown>) => {
			await startServerFromCli(mapCommandOptions(options));
		});

	return program;
}

export function parseCliOptions(
	raw: Record<string, unknown>,
): PaymeshMcpCliOptions {
	return mapCommandOptions(raw);
}

export async function main(argv = process.argv) {
	await createProgram().parseAsync(argv);
}

export async function startServerFromCli(cliOptions: PaymeshMcpCliOptions) {
	const client = await loadPaymeshClient({
		cwd: process.cwd(),
		clientPath: cliOptions.client,
		exportName: cliOptions.export,
	});
	const config = resolveMcpConfig(client, cliOptions);
	const server = createMcpServer({ client, config });
	const transport = new StdioServerTransport();

	await server.connect(transport);
	await waitForShutdown(async () => {
		await server.close();
		await client.database?.close?.();
	});
}

function mapCommandOptions(raw: Record<string, unknown>): PaymeshMcpCliOptions {
	return {
		client: asOptionalString(raw.client),
		export: asOptionalString(raw.export),
		enabled: asOptionalBoolean(raw.enabled),
		readonly: asOptionalBoolean(raw.readonly),
		includeRaw: asOptionalBoolean(raw.includeRaw),
		allowLiveMode: asOptionalBoolean(raw.allowLiveMode),
		maxListLimit: asOptionalNumber(raw.maxListLimit),
		maxListLines: asOptionalNumber(raw.maxListLines),
		tools: {
			customers: asOptionalBoolean(raw.customers),
			payments: asOptionalBoolean(raw.payments),
			pix: asOptionalBoolean(raw.pix),
			plugins: asOptionalBoolean(raw.plugins),
		},
	};
}

function parsePositiveInteger(value: string) {
	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new PaymeshError({
			code: 'cli_error',
			message: `Invalid integer "${value}". Expected a positive integer.`,
		});
	}

	return parsed;
}

async function waitForShutdown(close: () => Promise<void>) {
	await new Promise<void>((resolve, reject) => {
		let closed = false;

		const finish = async (error?: unknown) => {
			if (closed) return;
			closed = true;
			process.off('SIGINT', handleSignal);
			process.off('SIGTERM', handleSignal);
			process.off('uncaughtException', handleError);

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

		const handleSignal = () => {
			void finish();
		};
		const handleError = (error: unknown) => {
			void finish(error);
		};

		process.on('SIGINT', handleSignal);
		process.on('SIGTERM', handleSignal);
		process.on('uncaughtException', handleError);
	});
}

function asOptionalString(value: unknown) {
	return typeof value === 'string' ? value : undefined;
}

function asOptionalBoolean(value: unknown) {
	return typeof value === 'boolean' ? value : undefined;
}

function asOptionalNumber(value: unknown) {
	return typeof value === 'number' ? value : undefined;
}

if (isCliEntrypoint(process.argv[1])) {
	void main();
}

function isCliEntrypoint(entrypoint?: string) {
	if (!entrypoint) return false;

	return /(?:^|\/)(paymesh-mcp|cli)(?:\.[cm]?[jt]s)?$/.test(entrypoint);
}
