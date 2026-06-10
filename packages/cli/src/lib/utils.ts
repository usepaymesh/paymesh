import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PaymeshError } from 'paymesh';

export function parseJson(input: string, param = 'data') {
	try {
		if (input.startsWith('@')) {
			if (!input.endsWith('.json'))
				throw new PaymeshError({
					code: 'client_error',
					message: `File passed to --${param} must start with "@" and end with ".json"`,
				});

			return JSON.parse(
				readFileSync(path.resolve(process.cwd(), input.slice(1)), 'utf8'),
			);
		}

		return JSON.parse(input);
	} catch (error) {
		if (error instanceof PaymeshError) throw error;

		throw new PaymeshError({
			code: 'client_error',
			message: `Invalid JSON from ${param}: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

export function parseObjectJson(input: string, param = 'data') {
	const data = parseJson(input, param);

	if (typeof data !== 'object' || data === null || Array.isArray(data))
		throw new PaymeshError({
			code: 'client_error',
			message: `Built-in events require a JSON object from ${param}`,
		});

	return data;
}
