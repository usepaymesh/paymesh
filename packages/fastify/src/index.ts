import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PaymeshClient, PaymeshHooks } from 'paymesh';
import { headerfy, readBody } from './utils';

/**
 * Options for mounting the Paymesh webhook handler in Fastify.
 */
export interface WebhooksOptions<IncludeRaw extends boolean = false>
	extends PaymeshHooks<IncludeRaw> {
	/** Preconfigured Paymesh client instance. */
	client: PaymeshClient<IncludeRaw>;
	/** Propagates raw payloads to webhook handlers when enabled. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/**
 * Creates a Fastify-compatible webhook handler for Paymesh.
 *
 * @example
 * ```ts
 * fastify.post('/webhooks/paymesh', Webhooks({ client }));
 * ```
 */
export function Webhooks<IncludeRaw extends boolean = false>({
	client,
	includeRaw,
	...hooks
}: WebhooksOptions<IncludeRaw>) {
	return async (
		request: FastifyRequest & { rawBody?: unknown },
		reply: FastifyReply,
	) => {
		// @ts-expect-error
		const headers = headerfy({ headers: request.headers });

		const webhookRequest = new Request(
			new URL(
				request.raw.url ?? request.url,
				`${request.protocol ?? headers.get('x-forwarded-proto') ?? 'http'}://${headers.get('host') ?? 'localhost'}`,
			),
			{
				headers,
				body: await readBody(request),
				method: request.raw.method ?? request.method,
			},
		);

		const result = await client.webhooks.handle({
			hooks,
			includeRaw,
			request: webhookRequest,
		});

		return reply.code(result.status).send(result.body);
	};
}
