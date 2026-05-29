import { PaymeshError } from '../errors';

export interface RetryOptions {
	max: number;
	delay?(options: { attempt: number; response: Response }): number;
}

interface RequestOptions {
	baseUrl?: string;
	body?: BodyInit | Record<string, unknown>;
	query?: Record<string, unknown>;
	method?: string;
	provider?: string;
	retry?: RetryOptions;
	timeout?: number;
	fetch?: typeof fetch;
	headers?: Record<string, string>;
}

export const request = async <Response>(
	url: string,
	options: RequestOptions,
) => {
	const fetcher = options.fetch ?? fetch;
	const endpoint = buildUrl(url, options);
	const maxRetries = options.retry?.max ?? 0;

	for (let attempt = 0; ; attempt += 1) {
		const response = await fetcher(endpoint, {
			method: options.method,
			headers: options.headers,
			body: bodify(options.body),
			signal: AbortSignal.timeout(options.timeout ?? 10_000),
		}).catch((error: unknown) => {
			throw PaymeshError.wrap(error, {
				code: getRequestErrorCode(error),
				provider: options.provider,
				url: endpoint.toString(),
			});
		});

		if (shouldRetry(response, attempt, maxRetries)) {
			const delay = options.retry?.delay?.({ attempt, response }) ?? 0;

			if (delay > 0) await sleep(delay);

			continue;
		}

		const body = await readBody(response);

		if (!response.ok) {
			throw new PaymeshError({
				code: 'provider_error',
				message: getErrorMessage(body, response),
				provider: options.provider,
				status: response.status,
				statusText: response.statusText,
				url: endpoint.toString(),
				body,
			});
		}

		return body as Response;
	}
};

function buildUrl(url: string, options: RequestOptions) {
	const endpoint = new URL(url, options.baseUrl);

	for (const [key, value] of Object.entries(options.query ?? {})) {
		if (value === null || value === undefined) continue;

		if (Array.isArray(value)) {
			for (const item of value) endpoint.searchParams.append(key, String(item));

			continue;
		}

		endpoint.searchParams.set(key, String(value));
	}

	return endpoint;
}

function bodify(body: RequestOptions['body']) {
	if (!body) return;

	if (
		typeof body === 'string' ||
		body instanceof Blob ||
		body instanceof FormData ||
		body instanceof URLSearchParams ||
		body instanceof ArrayBuffer
	)
		return body;

	return JSON.stringify(body);
}

function shouldRetry(response: Response, attempt: number, maxRetries: number) {
	return (
		attempt < maxRetries && (response.status === 429 || response.status >= 500)
	);
}

async function readBody(response: Response) {
	if (response.status === 204) return;

	if (response.headers.get('content-type')?.includes('application/json')) {
		return response
			.clone()
			.json()
			.catch(() => response.text());
	}

	return response.text();
}

function getErrorMessage(body: unknown, response: Response) {
	if (typeof body === 'string' && body.trim()) return body;

	if (isRecord(body)) {
		if (typeof body.message === 'string') return body.message;
		if (typeof body.error === 'string') return body.error;

		if (isRecord(body.error)) {
			if (typeof body.error.message === 'string') return body.error.message;
			if (typeof body.error.code === 'string') return body.error.code;
		}
	}

	return response.statusText || `Request failed with status ${response.status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRequestErrorCode(error: unknown) {
	if (error instanceof DOMException && error.name === 'TimeoutError') {
		return 'timeout' as const;
	}

	if (
		error instanceof Error &&
		(error.name === 'TimeoutError' || error.name === 'AbortError')
	) {
		return 'timeout' as const;
	}

	return 'network_error' as const;
}
