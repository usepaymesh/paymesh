import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PaymeshClient } from 'paymesh';

export async function loadClient({
	cwd,
	explicitPath,
}: {
	cwd: string;
	explicitPath?: string;
}) {
	const clientPath = await resolveClientPath(cwd, explicitPath);
	const moduleUrl = pathToFileURL(clientPath).href;
	const loaded = (await import(moduleUrl)) as {
		default?: unknown;
		paymesh?: unknown;
	};
	const client = loaded.default ?? loaded.paymesh;

	if (!isPaymeshClient(client)) {
		throw new Error(
			`The client module "${clientPath}" must export the Paymesh client as default or named export "paymesh"`,
		);
	}

	return client;
}

export async function resolveClientPath(cwd: string, explicitPath?: string) {
	const candidate =
		explicitPath ??
		process.env.PAYMESH_PATH ??
		(await readClientPathFromPackageJson(cwd));

	if (!candidate) {
		throw new Error(
			'Unable to resolve the Paymesh client path. Use --client, PAYMESH_PATH, or package.json.paymesh.path.',
		);
	}

	return path.resolve(cwd, candidate);
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

function isPaymeshClient(value: unknown): value is PaymeshClient<boolean> {
	return (
		typeof value === 'object' &&
		value !== null &&
		'provider' in value &&
		'schema' in value
	);
}
