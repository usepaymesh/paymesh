import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { cancel, isCancel, select } from '@clack/prompts';
import type { Command } from 'commander';
import { resolveClientPath } from 'src/lib/client';
import {
	formatPath,
	logInfo,
	logSuccess,
	logTitle,
	logWarning,
} from 'src/lib/output';
import {
	buildMcpServerConfig,
	createCursorDeeplink,
	formatCodexToml,
	formatMcpCommand,
	type McpTarget,
	openUrl,
	readJsonFile,
	writeJsonFile,
} from 'src/shared/mcp';

const SERVER_NAME = 'paymesh';

export function registerMcpCommand(program: Command) {
	return program
		.command('mcp')
		.description('Configure Paymesh for MCP-capable clients')
		.option('--cwd <cwd>', 'Working directory', process.cwd())
		.option('--client <path>', 'Path to the Paymesh client module')
		.option('--export <name>', 'Named export to load from the client module')
		.option('--cursor', 'Configure Cursor', false)
		.option('--claude-code', 'Configure Claude Code', false)
		.option('--codex', 'Configure Codex', false)
		.option('--open-code', 'Configure Open Code', false)
		.option('--manual', 'Print the generated MCP config', false)
		.action(async (options) => {
			const cwd = path.resolve(options.cwd);
			const clientPath = await resolveClientPath(cwd, options.client);
			const exportName = options.export as string | undefined;
			const target = resolveTarget(options) ?? (await chooseTarget());
			const serverConfig = buildMcpServerConfig({
				clientPath,
				exportName,
			});
			const install = {
				target,
				clientPath,
				exportName,
				serverConfig,
			};

			switch (target) {
				case 'cursor':
					await setupCursor(install);
					return;
				case 'claude-code':
					await setupClaudeCode(install);
					return;
				case 'codex':
					await setupCodex(install);
					return;
				case 'open-code':
					await setupOpenCode(cwd, install);
					return;
				case 'manual':
					printManualConfig(install);
					return;
			}
		});
}

function resolveTarget(options: {
	cursor?: boolean;
	claudeCode?: boolean;
	codex?: boolean;
	openCode?: boolean;
	manual?: boolean;
}) {
	const selected = [
		options.cursor ? 'cursor' : null,
		options.claudeCode ? 'claude-code' : null,
		options.codex ? 'codex' : null,
		options.openCode ? 'open-code' : null,
		options.manual ? 'manual' : null,
	].filter(Boolean) as McpTarget[];

	if (selected.length === 1) return selected[0]!;

	if (selected.length > 1)
		throw new Error('Choose only one MCP target at a time.');

	return null;
}

async function chooseTarget() {
	const target = await select({
		message: 'Which client do you want to configure?',
		options: [
			{ value: 'cursor', label: 'Cursor' },
			{ value: 'claude-code', label: 'Claude Code' },
			{ value: 'codex', label: 'Codex' },
			{ value: 'open-code', label: 'Open Code' },
			{ value: 'manual', label: 'Manual JSON' },
		],
	});

	if (isCancel(target)) {
		cancel('Cancelled.');
		process.exit(0);
	}

	return target as McpTarget;
}

async function setupCursor({
	serverConfig,
}: {
	serverConfig: { command: string; args: string[] };
}) {
	const deeplink = createCursorDeeplink(SERVER_NAME, serverConfig);

	logTitle('Cursor MCP', 'deeplink install');
	logInfo(`Opening ${formatPath('Cursor')} install link`);

	const opened = openUrl(deeplink);
	if (opened.status !== 0) {
		logWarning('Could not open Cursor automatically.');
		console.log(deeplink);
		return;
	}

	logSuccess('Cursor should prompt to add the Paymesh MCP server.');
}

async function setupClaudeCode({
	serverConfig,
}: {
	serverConfig: { command: string; args: string[] };
}) {
	const command = {
		command: 'claude',
		args: [
			'mcp',
			'add',
			SERVER_NAME,
			'--',
			serverConfig.command,
			...serverConfig.args,
		],
	};

	logTitle('Claude Code MCP', 'automatic install');

	const result = spawnSync(command.command, command.args, {
		stdio: 'inherit',
	});

	if (result.status === 0) {
		logSuccess('Claude Code configured successfully.');
		return;
	}

	logWarning('Claude Code install failed. Run this command manually:');
	console.log(formatMcpCommand(command));
}

async function setupCodex({
	serverConfig,
}: {
	serverConfig: { command: string; args: string[] };
}) {
	const command = {
		command: 'codex',
		args: [
			'mcp',
			'add',
			SERVER_NAME,
			'--',
			serverConfig.command,
			...serverConfig.args,
		],
	};

	logTitle('Codex MCP', 'automatic install');

	const result = spawnSync(command.command, command.args, {
		stdio: 'inherit',
	});

	if (result.status === 0) {
		logSuccess('Codex configured successfully.');
		return;
	}

	logWarning('Codex install failed. Run this config manually:');
	console.log(formatCodexToml(serverConfig));
}

async function setupOpenCode(
	cwd: string,
	{
		serverConfig,
	}: {
		serverConfig: { command: string; args: string[] };
	},
) {
	const filePath = path.join(cwd, 'opencode.json');
	const existing = await readJsonFile<Record<string, unknown>>(filePath);
	const next = {
		...(existing ?? {}),
		mcpServers: {
			...(((existing?.mcpServers as Record<string, unknown> | undefined) ??
				{}) as Record<string, unknown>),
			[SERVER_NAME]: serverConfig,
		},
	};

	await writeJsonFile(filePath, next);

	logTitle('Open Code MCP', 'configuration updated');
	logSuccess(`Updated ${formatPath(path.relative(cwd, filePath))}`);
}

function printManualConfig({
	serverConfig,
}: {
	serverConfig: { command: string; args: string[] };
}) {
	logTitle('Manual MCP config');
	console.log(formatCodexToml(serverConfig));
}
