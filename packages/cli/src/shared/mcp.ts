import { spawnSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

export type McpTarget =
	| 'cursor'
	| 'claude-code'
	| 'codex'
	| 'open-code'
	| 'manual';

export function buildMcpServerConfig({
	clientPath,
	exportName,
}: {
	clientPath: string;
	exportName?: string;
}) {
	const args = ['-y', '@paymesh/mcp', '--client', clientPath];

	if (exportName) args.push('--export', exportName);

	return {
		command: 'npx',
		args,
	};
}

export function createCursorDeeplink(
	serverName: string,
	config: {
		command: string;
		args: string[];
	},
) {
	const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
	return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(encoded)}`;
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
	if (!existsSync(filePath)) return null;

	try {
		return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
	} catch {
		return null;
	}
}

export async function writeJsonFile(filePath: string, value: unknown) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function openUrl(url: string) {
	const platform = process.platform;
	const command =
		platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
	const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];

	return spawnSync(command, args, { stdio: 'ignore' });
}

export function formatMcpCommand(config: { command: string; args: string[] }) {
	return [config.command, ...config.args]
		.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
		.join(' ');
}

export function formatCodexToml(config: { command: string; args: string[] }) {
	const args = config.args.map((arg) => JSON.stringify(arg)).join(', ');

	return [
		'[mcp_servers.paymesh]',
		`command = ${JSON.stringify(config.command)}`,
		`args = [${args}]`,
	].join('\n');
}
