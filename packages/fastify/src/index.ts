import type { FastifyReply, FastifyRequest } from 'fastify';
import {
	type PaymeshClient,
	PaymeshError,
	type PaymeshHook,
	type PaymeshHooks,
} from 'paymesh';

interface FastifyRequestWithRawBody extends FastifyRequest {
	rawBody?: unknown;
}

type AnyHook = (event: unknown) => void | Promise<void>;

export interface WebhooksOptions<IncludeRaw extends boolean = false>
	extends PaymeshHooks<IncludeRaw> {
	client: PaymeshClient<IncludeRaw>;
	includeRaw?: IncludeRaw;
}

export function Webhooks<IncludeRaw extends boolean = false>({
	client,
	includeRaw,
	...hooks
}: WebhooksOptions<IncludeRaw>) {
	if (!client.provider.webhooks || !client.provider.capabilities.webhooks)
		throw new PaymeshError({
			cause: client.provider,
			type: 'unsupported_capacity',
			message: `Provider "${client.provider.id}" does not support webhooks feature`,
		});

	return async (request: FastifyRequestWithRawBody, reply: FastifyReply) => {
		const { webhooks } = client.provider;

		if (!webhooks) return reply.code(501).send({ error: 'unsupported' });

		const headers = new Headers();

		for (const [key, value] of Object.entries(request.headers)) {
			if (value === undefined) continue;

			if (Array.isArray(value)) {
				for (const item of value) {
					headers.append(key, item);
				}
				continue;
			}

			headers.set(key, String(value));
		}

		let body: BodyInit | undefined;

		if (request.method !== 'GET' && request.method !== 'HEAD') {
			if (typeof request.rawBody === 'string') {
				body = request.rawBody;
			} else if (request.rawBody instanceof Uint8Array) {
				body = request.rawBody.slice().buffer;
			} else if (request.rawBody instanceof ArrayBuffer) {
				body = request.rawBody.slice(0);
			} else if (ArrayBuffer.isView(request.rawBody)) {
				body = new Uint8Array(
					request.rawBody.buffer,
					request.rawBody.byteOffset,
					request.rawBody.byteLength,
				).slice().buffer;
			} else if (typeof request.body === 'string') {
				body = request.body;
			} else if (request.body instanceof Uint8Array) {
				body = request.body.slice().buffer;
			} else if (request.body instanceof ArrayBuffer) {
				body = request.body.slice(0);
			} else if (ArrayBuffer.isView(request.body)) {
				body = new Uint8Array(
					request.body.buffer,
					request.body.byteOffset,
					request.body.byteLength,
				).slice().buffer;
			} else if (request.body !== undefined && request.body !== null) {
				body = JSON.stringify(request.body);
			} else {
				const chunks: Uint8Array[] = [];

				for await (const chunk of request.raw) {
					if (typeof chunk === 'string') {
						chunks.push(new TextEncoder().encode(chunk));
					} else if (chunk instanceof Uint8Array) {
						chunks.push(chunk);
					} else if (chunk instanceof ArrayBuffer) {
						chunks.push(new Uint8Array(chunk));
					} else if (ArrayBuffer.isView(chunk)) {
						chunks.push(
							new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
						);
					} else {
						chunks.push(new TextEncoder().encode(String(chunk)));
					}
				}

				if (chunks.length > 0) {
					const size = chunks.reduce(
						(total, chunk) => total + chunk.byteLength,
						0,
					);
					const merged = new Uint8Array(size);
					let offset = 0;

					for (const chunk of chunks) {
						merged.set(chunk, offset);
						offset += chunk.byteLength;
					}

					body = merged.buffer;
				}
			}
		}

		const webhookRequest = new Request(
			new URL(
				request.raw.url ?? request.url,
				`${request.protocol ?? headers.get('x-forwarded-proto') ?? 'http'}://${headers.get('host') ?? 'localhost'}`,
			),
			{
				method: request.raw.method ?? request.method,
				headers,
				body,
			},
		);

		const isValid = await webhooks.verify({
			request: webhookRequest.clone(),
		});

		if (!isValid) return reply.code(401).send({ error: 'unauthorized' });

		const payload = await webhooks.parse(webhookRequest);

		const event = await webhooks.map(payload, {
			includeRaw: (includeRaw ?? client.includeRaw ?? false) as IncludeRaw,
		});

		const hookName = webhooks.hook(event);

		const hook = hookName
			? (getHook(hooks, hookName) ?? getHook(client.hooks, hookName))
			: undefined;

		try {
			await hook?.(event);
		} catch {
			return reply.code(500).send({ error: 'hook_error' });
		}

		return reply.code(200).send({ received: true });
	};
}

function getHook<IncludeRaw extends boolean>(
	hooks: PaymeshHooks<IncludeRaw> | undefined,
	name: string,
): AnyHook | undefined {
	return (hooks as Record<string, PaymeshHook | undefined> | undefined)?.[
		name
	] as AnyHook | undefined;
}
