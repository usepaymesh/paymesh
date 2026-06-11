import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { isPaymeshClient, type PaymeshClient, PaymeshError } from 'paymesh';
import type { LoadPaymeshClientOptions } from '../types';

export async function loadPaymeshClient({
	cwd,
	clientPath,
	exportName,
}: LoadPaymeshClientOptions) {
	const resolvedPath = await resolveClientPath(cwd, clientPath);
	const module = (await loadModule(cwd, resolvedPath)) as Record<
		string,
		unknown
	>;

	const client = exportName
		? module[exportName]
		: (module.default ?? module.paymesh);

	if (!isPaymeshClient(client))
		throw new PaymeshError({
			code: 'client_error',
			message: `The client module "${resolvedPath}" must export the Paymesh client as ${exportName ? `named export "${exportName}"` : 'default export or named export "paymesh"'}.`,
		});

	return client as PaymeshClient<boolean>;
}

export async function resolveClientPath(cwd: string, explicitPath?: string) {
	const candidate =
		explicitPath ??
		process.env.PAYMESH_PATH ??
		(await readClientPathFromPackageJson(cwd));

	if (!candidate)
		throw new PaymeshError({
			code: 'client_error',
			message:
				'Unable to resolve the Paymesh client path. Use --client, PAYMESH_PATH, or package.json.paymesh.path.',
		});

	return path.resolve(cwd, candidate);
}

async function loadModule(cwd: string, resolvedPath: string) {
	if (/\.(?:[cm]?ts|tsx)$/.test(resolvedPath)) {
		const jiti = createJiti(path.join(cwd, 'package.json'), {
			interopDefault: false,
		});

		return jiti.import(resolvedPath);
	}

	return import(pathToFileURL(resolvedPath).href);
}

async function readClientPathFromPackageJson(cwd: string) {
	try {
		const packageJson = JSON.parse(
			await fs.readFile(path.join(cwd, 'package.json'), 'utf8'),
		) as {
			paymesh?: {
				path?: string;
			};
		};

		return packageJson.paymesh?.path;
	} catch {
		return undefined;
	}
}
