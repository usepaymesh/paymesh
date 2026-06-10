import { execSync } from 'node:child_process';

export function getPkgManager(): string {
	const userAgent = process.env.npm_config_user_agent;
	if (userAgent) {
		if (userAgent.includes('bun')) return 'bun';
		if (userAgent.includes('pnpm')) return 'pnpm';
		if (userAgent.includes('yarn')) return 'yarn';
	}
	return 'npm';
}

export function installDeps(
	cwd: string,
	pm: string,
	prod: string[],
	dev: string[],
) {
	const run = (deps: string[], flag: string) => {
		if (deps.length === 0) return;
		const cmd =
			pm === 'bun'
				? `bun add ${flag} ${deps.join(' ')}`
				: pm === 'pnpm'
					? `pnpm add ${flag} ${deps.join(' ')}`
					: pm === 'yarn'
						? `yarn add ${flag} ${deps.join(' ')}`
						: `npm install ${flag} ${deps.join(' ')}`;

		execSync(cmd, { cwd, stdio: 'inherit', timeout: 120_000 });
	};

	if (prod.length > 0) run(prod, '');
	if (dev.length > 0) run(dev, pm === 'bun' ? '-d' : '-D');
}
