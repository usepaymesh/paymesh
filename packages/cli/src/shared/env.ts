import { existsSync, promises as fs } from 'node:fs';
import { join } from 'node:path';

export async function appendEnvVars(cwd: string, vars: string[]) {
	if (vars.length === 0) return;

	const envPath = join(cwd, '.env');

	const existing = existsSync(envPath)
		? await fs.readFile(envPath, 'utf-8')
		: '';

	const toAdd = vars
		.filter((v) => !existing.includes(v.split('=')[0] as string))
		.join('\n');

	if (toAdd) await fs.writeFile(envPath, `${existing}${toAdd}\n`);
}
