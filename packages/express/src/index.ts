import type { Response } from 'express';
import type { PaymeshClient, PaymeshHooks } from 'paymesh';
import { createWebhookRequest, type ExpressRequestWithRawBody } from './utils';

/**
 * Options for mounting the Paymesh webhook handler in Express.
 */
export interface WebhooksOptions<IncludeRaw extends boolean = false>
	extends PaymeshHooks<IncludeRaw> {
	/** Preconfigured Paymesh client instance. */
	client: PaymeshClient<IncludeRaw>;
	/** Propagates raw payloads to webhook handlers when enabled. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/**
 * Creates an Express-compatible webhook handler for Paymesh.
 *
 * @example
 * ```ts
 * app.post('/webhooks/paymesh', Webhooks({ client }));
 * ```
 */
export function Webhooks<IncludeRaw extends boolean = false>({
	client,
	includeRaw,
	...hooks
}: WebhooksOptions<IncludeRaw>) {
	return async (request: ExpressRequestWithRawBody, response: Response) => {
		const webhookRequest = await createWebhookRequest(request);

		const result = await client.webhooks.handle({
			request: webhookRequest,
			includeRaw,
			hooks,
		});

		return response.status(result.status).json(result.body);
	};
}
