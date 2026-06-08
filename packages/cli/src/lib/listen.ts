import http from 'node:http';
import type { PaymeshClient } from 'paymesh';
import { PaymeshError } from 'paymesh';
import pc from 'picocolors';

type WebhookProvider = PaymeshClient<boolean>['provider'];

export interface ListenInspectionResult {
	status: 200 | 400 | 401;
	body: { received?: boolean; error?: string };
	event?: unknown;
	hook?: string;
	deliveryId?: string;
	rawBody: string;
	headers: Record<string, string>;
	source: 'provider' | 'trigger';
}

export interface ListenServer {
	close(): Promise<void>;
	port: number;
}

export async function inspectWebhookRequest(
	provider: WebhookProvider,
	request: Request,
): Promise<ListenInspectionResult> {
	if (!provider.webhooks || !provider.capabilities.webhooks) {
		throw new PaymeshError({
			code: 'unsupported_capability',
			message: `Provider "${provider.id}" does not support webhooks capability`,
			provider: provider.id,
		});
	}

	const rawBody = await request.clone().text();
	const headers = Object.fromEntries(request.headers.entries());

	if (headers['x-paymesh-source'] === 'trigger') {
		return inspectTriggeredEvent(rawBody, headers, provider.id);
	}

	const isValid = await provider.webhooks.verify({
		request: request.clone(),
	});

	if (!isValid) {
		return {
			status: 401,
			body: { error: 'invalid_webhook_signature' },
			rawBody,
			headers,
			source: 'provider',
		};
	}

	try {
		const handled = await provider.webhooks.handle({
			request,
			includeRaw: true,
		});

		return {
			status: 200,
			body: { received: true },
			deliveryId: handled.deliveryId,
			event: handled.event,
			hook: handled.hook,
			rawBody,
			headers,
			source: 'provider',
		};
	} catch {
		return {
			status: 400,
			body: { error: 'webhook_handle_error' },
			rawBody,
			headers,
			source: 'provider',
		};
	}
}

export async function startWebhookServer(options: {
	client: Pick<PaymeshClient<boolean>, 'provider'>;
	port: number;
	logger?: (message: string) => void;
}): Promise<ListenServer> {
	const {
		client: { provider },
		port,
		logger = console.log,
	} = options;

	if (!provider.webhooks || !provider.capabilities.webhooks)
		throw new PaymeshError({
			code: 'unsupported_capability',
			message: `Provider "${provider.id}" does not support webhooks capability`,
			provider: provider.id,
		});

	const server = http.createServer(async (req, res) => {
		if (req.method !== 'POST') {
			res.writeHead(405, {
				'content-type': 'application/json; charset=utf-8',
			});
			res.end(JSON.stringify({ error: 'method_not_allowed' }));
			logger(
				formatSummary({
					method: req.method ?? 'UNKNOWN',
					path: req.url ?? '/',
					providerId: provider.id,
					status: 405,
					source: 'provider',
				}),
			);
			return;
		}

		const body = await readRequestBody(req);
		const request = new Request(`http://127.0.0.1:${port}${req.url ?? '/'}`, {
			method: req.method,
			headers: toHeaders(req.headers),
			body,
		});

		const result = await inspectWebhookRequest(provider, request);

		res.writeHead(result.status, {
			'content-type': 'application/json; charset=utf-8',
		});
		res.end(JSON.stringify(result.body));

		const normalized = readNormalizedEvent(result.event);
		logger(
			formatSummary({
				deliveryId: result.deliveryId ?? normalized.id,
				eventType: normalized.type,
				method: req.method,
				path: req.url ?? '/',
				providerId: normalized.provider ?? provider.id,
				status: result.status,
				source: result.source,
			}),
		);
		logger(
			JSON.stringify(
				{
					headers: result.headers,
					normalizedEvent: result.event ?? null,
					rawBody: result.rawBody,
				},
				null,
				2,
			),
		);
	});

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '0.0.0.0', () => {
			server.off('error', reject);
			resolve();
		});
	});

	const address = server.address();

	const resolvedPort =
		typeof address === 'object' && address != null ? address.port : port;

	return {
		port: resolvedPort,
		close() {
			return new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) {
						reject(error);
						return;
					}

					resolve();
				});
			});
		},
	};
}

export function formatSummary(input: {
	status: number;
	providerId: string;
	method: string;
	path: string;
	eventType?: string;
	deliveryId?: string;
	source: 'provider' | 'trigger';
}) {
	const details = [
		`${pc.bold(input.method.toUpperCase())} ${pc.dim(input.path)}`,
		`${pc.dim('source')}=${input.source === 'trigger' ? pc.magenta(input.source) : pc.cyan(input.source)}`,
		`${pc.dim('provider')}=${pc.bold(input.providerId)}`,
	];

	if (input.eventType)
		details.push(`${pc.dim('event')}=${pc.green(input.eventType)}`);
	if (input.deliveryId)
		details.push(`${pc.dim('delivery')}=${pc.yellow(input.deliveryId)}`);

	const statusTone =
		input.status >= 400 ? pc.red : input.status >= 300 ? pc.yellow : pc.green;

	return `${statusTone('✦')} ${pc.bold(String(input.status))} ${details.join(' ')}`;
}

function inspectTriggeredEvent(
	rawBody: string,
	headers: Record<string, string>,
	providerId: string,
): ListenInspectionResult {
	try {
		const payload = JSON.parse(rawBody) as {
			event?: {
				id?: string;
				type?: string;
				provider?: string;
				context?: {
					deliveryId?: string;
					hook?: string;
				};
			};
			hook?: string;
		};
		const event = payload.event;

		if (
			typeof event !== 'object' ||
			event == null ||
			typeof event.id !== 'string' ||
			typeof event.type !== 'string' ||
			typeof event.provider !== 'string'
		) {
			return {
				status: 400,
				body: { error: 'invalid_trigger_payload' },
				rawBody,
				headers,
				source: 'trigger',
			};
		}

		if (event.provider !== providerId) {
			return {
				status: 400,
				body: { error: 'trigger_provider_mismatch' },
				rawBody,
				headers,
				source: 'trigger',
			};
		}

		return {
			status: 200,
			body: { received: true },
			event,
			hook:
				typeof payload.hook === 'string'
					? payload.hook
					: typeof event.context?.hook === 'string'
						? event.context.hook
						: undefined,
			deliveryId:
				typeof event.context?.deliveryId === 'string'
					? event.context.deliveryId
					: event.id,
			rawBody,
			headers,
			source: 'trigger',
		};
	} catch {
		return {
			status: 400,
			body: { error: 'invalid_trigger_payload' },
			rawBody,
			headers,
			source: 'trigger',
		};
	}
}

async function readRequestBody(request: http.IncomingMessage) {
	const chunks: Buffer[] = [];

	for await (const chunk of request) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
	}

	return Buffer.concat(chunks);
}

function toHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
	return Object.fromEntries(
		Object.entries(headers).flatMap(([key, value]) => {
			if (value == null) return [];
			return [[key, Array.isArray(value) ? value.join(', ') : value]];
		}),
	);
}

function readNormalizedEvent(event: unknown) {
	if (typeof event !== 'object' || event == null) {
		return {
			id: undefined,
			provider: undefined,
			type: undefined,
		};
	}

	const record = event as Record<string, unknown>;

	return {
		id: typeof record.id === 'string' ? record.id : undefined,
		provider: typeof record.provider === 'string' ? record.provider : undefined,
		type: typeof record.type === 'string' ? record.type : undefined,
	};
}
