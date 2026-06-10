import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	select,
	spinner,
	text,
} from '@clack/prompts';
import type { Command } from 'commander';
import pc from 'picocolors';
import { version } from 'src';
import { printWelcome } from 'src/lib/style';
import { DATABASE_ADAPTERS } from '../shared/database';
import { appendEnvVars } from '../shared/env';
import {
	detectFramework,
	generateWebhookCode,
	getWebhookPath,
} from '../shared/framework';
import { generateClientCode } from '../shared/generators';
import { getPkgManager, installDeps } from '../shared/managers';
import { detectProviderFromDeps, PROVIDERS } from '../shared/providers';

export function registerInitCommand(program: Command) {
	program
		.command('init')
		.description('Initialize Paymesh in your project')
		.option('--cwd <cwd>', 'Working directory', process.cwd())
		.option('--package-manager <manager>', 'Package manager to use')
		.option('--skip-install', 'Skip dependency installation', false)
		.action(
			async (options: {
				cwd: string;
				packageManager?: string;
				skipInstall: boolean;
			}) => {
				const cwd = path.resolve(options.cwd);

				printWelcome({ version });

				intro(pc.bold('Paymesh Init'));

				const pkgPath = path.join(cwd, 'package.json');

				if (!existsSync(pkgPath)) {
					cancel('No package.json found. Run your package manager init first.');

					process.exit(1);
				}

				const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

				const packageManager = options.packageManager ?? getPkgManager();

				const deps = { ...pkg.dependencies, ...pkg.devDependencies };

				let step = 0;

				const heading = (text: string) =>
					log.message(`${pc.cyan(`${++step}.`)} ${text}`);

				const files = [];
				const install = new Map<string, 'prod' | 'dev'>();

				if (!deps.paymesh) {
					heading('Install Paymesh');

					const ok = await confirm({
						message: `Would you like to install paymesh using ${pc.bold(packageManager)}?`,
						initialValue: true,
					});

					if (isCancel(ok)) {
						cancel('Cancelled.');

						process.exit(0);
					}

					if (ok) install.set('paymesh', 'prod');
				}

				const envPath = path.join(cwd, '.env');
				const envExists = existsSync(envPath);
				const envContent = envExists ? await fs.readFile(envPath, 'utf-8') : '';

				if (!envContent.includes('PAYMESH_NAME')) {
					heading('Set Environment Variables');

					let proceed = true;

					if (!envExists) {
						const ok = await confirm({
							message: 'Would you like to set environment variables?',
							initialValue: true,
						});

						if (isCancel(ok)) {
							cancel('Cancelled.');

							process.exit(0);
						}

						proceed = !!ok;
					}

					if (proceed) {
						const name = await text({
							message: 'Paymesh client display name:',
							initialValue: 'Paymesh Client',
						});

						if (isCancel(name)) {
							cancel('Cancelled.');

							process.exit(0);
						}

						files.push(() =>
							appendEnvVars(cwd, [
								`PAYMESH_NAME="${(name as string) || 'Paymesh Client'}"`,
							]),
						);
					}
				}

				let clientPath: string | null = null;

				{
					const candidates = [
						'src/lib/paymesh.ts',
						'lib/paymesh.ts',
						'src/paymesh.ts',
						'paymesh.ts',
					];

					const found = candidates.find((c) => existsSync(path.join(cwd, c)));

					if (found) {
						clientPath = path.join(cwd, found);
					} else {
						heading('Create a Paymesh Client');

						const hasSrc = existsSync(path.join(cwd, 'src'));
						const def = hasSrc ? 'src/lib/paymesh.ts' : 'lib/paymesh.ts';

						const fp = await text({
							message:
								'Where would you like to create the Paymesh client instance?',
							initialValue: def,
						});
						if (isCancel(fp)) {
							cancel('Cancelled.');

							process.exit(0);
						}

						const raw = (fp || def).trim();

						const clean = raw.startsWith('/') ? raw.slice(1) : raw;

						clientPath = path.isAbsolute(clean) ? clean : path.join(cwd, clean);

						files.push(async () => {
							await fs.mkdir(path.dirname(clientPath!), { recursive: true });
							await fs.writeFile(
								clientPath!,
								`import { createClient } from 'paymesh';\n\nexport const paymesh = createClient({\n  provider: stripe(),\n});\n`,
							);
						});
					}
				}

				let dbChoice: 'yes' | 'skip' | null = null;
				let dbAdapter: string | null = null;
				{
					heading('Configure Database');

					const choice = await select({
						message: 'Would you like to configure a database?',
						options: [
							{ value: 'yes', label: 'Yes — Configure a database' },
							{ value: 'skip', label: 'Skip — Do not setup database now' },
						],
					});

					if (isCancel(choice)) {
						cancel('Cancelled.');

						process.exit(0);
					}

					dbChoice = choice as 'yes' | 'skip';

					if (dbChoice === 'yes') {
						const adapter = await select({
							message: 'Select the database adapter:',
							options: DATABASE_ADAPTERS.map((a) => ({
								value: a.value,
								label: a.label,
							})),
						});

						if (isCancel(adapter)) {
							cancel('Cancelled.');

							process.exit(0);
						}

						dbAdapter = adapter;

						const cfg = DATABASE_ADAPTERS.find((a) => a.value === dbAdapter)!;

						install.set(cfg.package, 'prod');

						for (const d of cfg.deps) install.set(d, 'prod');
						for (const d of cfg.devDeps) install.set(d, 'dev');

						const dbUrl = await text({
							message:
								'Database connection URL (Optional, press Enter to skip):',
							placeholder: 'postgresql://user:pass@localhost:5432/paymesh',
						});

						if (isCancel(dbUrl)) {
							cancel('Cancelled.');

							process.exit(0);
						}

						if ((dbUrl as string).trim())
							files.push(() =>
								appendEnvVars(cwd, [
									`PAYMESH_DATABASE_URL="${(dbUrl as string).trim()}"`,
								]),
							);
					}
				}

				let provider: string | null = null;
				let providerConfig: {
					apiKeyEnv: string;
					webhookSecretEnv: string;
					paramName: string;
				} | null = null;

				heading('Configure Payment Provider');

				const existing = await detectProviderFromDeps(deps);

				if (existing) {
					provider = existing;

					log.info(`Detected provider: ${pc.bold(existing)}`);
				} else {
					const sel = await select({
						message: 'Select the payment provider:',
						options: [
							{ value: 'stripe', label: 'Stripe' },
							{ value: 'polar', label: 'Polar' },
							{ value: 'custom', label: 'Custom — I will configure later' },
						],
					});
					if (isCancel(sel)) {
						cancel('Cancelled.');

						process.exit(0);
					}
					provider = sel as string;

					if (provider !== 'custom') {
						const cfg = PROVIDERS[provider as keyof typeof PROVIDERS];

						install.set(cfg.package!, 'prod');

						const apiKey = await text({
							message: `Enter your ${cfg.apiKeyEnv} (optional):`,
							placeholder: provider === 'stripe' ? 'sk_...' : 'polar_...',
						});
						if (isCancel(apiKey)) {
							cancel('Cancelled.');
							process.exit(0);
						}

						const webhookSecret = await text({
							message: `Enter your ${cfg.webhookSecretEnv} (optional):`,
							placeholder: 'whsec_...',
						});
						if (isCancel(webhookSecret)) {
							cancel('Cancelled.');
							process.exit(0);
						}

						const envVars: string[] = [];
						if ((apiKey as string).trim())
							envVars.push(`${cfg.apiKeyEnv}="${(apiKey as string).trim()}"`);
						if ((webhookSecret as string).trim())
							envVars.push(
								`${cfg.webhookSecretEnv}="${(webhookSecret as string).trim()}"`,
							);
						if (envVars.length > 0)
							files.push(() => appendEnvVars(cwd, envVars));

						providerConfig = {
							apiKeyEnv: cfg.apiKeyEnv!,
							webhookSecretEnv: cfg.webhookSecretEnv!,
							paramName: cfg.paramName!,
						};
					}
				}

				let framework: string | null = null;

				framework = detectFramework(deps);

				if (framework && clientPath) {
					const handlerPath = getWebhookPath(framework, cwd);

					if (!existsSync(path.join(cwd, handlerPath))) {
						heading('Generate Webhook Handler');

						const fp = await text({
							message: 'Enter the path to the webhook handler file:',
							initialValue: handlerPath,
						});

						if (isCancel(fp)) {
							cancel('Cancelled.');

							process.exit(0);
						}

						const raw = (fp || handlerPath).trim();
						const clean = raw.startsWith('/') ? raw.slice(1) : raw;

						const resolved = path.isAbsolute(clean)
							? clean
							: path.join(cwd, clean);

						const rel = path
							.relative(path.dirname(resolved), clientPath)
							.replace(/\.(ts|tsx|js|jsx)$/, '');

						files.push(async () => {
							await fs.mkdir(path.dirname(resolved), { recursive: true });
							await fs.writeFile(
								resolved,
								generateWebhookCode(
									framework!,
									rel.startsWith('.') ? rel : `./${rel}`,
								),
							);
						});
					}
				}

				if (clientPath && provider) {
					const code = generateClientCode(
						provider,
						dbChoice === 'yes' ? dbAdapter : null,
						providerConfig,
					);

					files.push(() => fs.writeFile(clientPath!, code));
				}

				if (files.length > 0) {
					heading('Generate Files');

					const spnner = spinner();

					spnner.start('Writing files...');

					for (const f of files) await f();

					spnner.stop('Files generated!');
				}

				if (install.size > 0) {
					if (options.skipInstall) {
						note(
							`Run ${pc.cyan(`${packageManager} add ${[...install.keys()].join(' ')}`)} manually.`,
							'Skipped',
						);
					} else {
						heading('Install Dependencies');

						const prod: string[] = [];
						const dev: string[] = [];

						for (const [dep, type] of install) {
							if (type === 'dev') dev.push(dep);
							else prod.push(dep);
						}

						const spnner = spinner();

						spnner.start('Installing...');

						try {
							spnner.stop();

							installDeps(cwd, packageManager, prod, dev);

							spnner.start('');

							spnner.stop('Dependencies installed!');
						} catch {
							spnner.stop('Installation failed');

							log.error(
								`Run ${pc.cyan(`${packageManager} add ${[...install.keys()].join(' ')}`)} manually.`,
							);
						}
					}
				}

				outro(`${pc.green('✔')} ${pc.bold('Paymesh initialized!')}`);
			},
		);
}
