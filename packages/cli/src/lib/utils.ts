import { PaymeshError } from 'paymesh';

export function parseJson(input: string, param = 'data') {
	try {
		return JSON.parse(input);
	} catch (error) {
		throw new PaymeshError({
			code: 'client_error',
			message: `Invalid JSON passed to --${param}: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

export function parseObjectJson(input: string, param = 'data') {
	const data = parseJson(input);

	if (typeof data !== 'object' || data === null || Array.isArray(data))
		throw new PaymeshError({
			code: 'client_error',
			message: `Built-in events require --${param} to be a JSON object`,
		});

	return data;
}
