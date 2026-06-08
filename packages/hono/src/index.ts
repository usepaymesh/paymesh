import type { Context } from 'hono';
import type { PaymeshClient, PaymeshHooks } from 'paymesh';

/**
 * Options for mounting the Paymesh webhook handler in Hono.
 */
export interface WebhooksOptions<IncludeRaw extends boolean = false>
	extends PaymeshHooks<IncludeRaw> {
	/** Preconfigured Paymesh client instance. */
	client: PaymeshClient<IncludeRaw>;
	/** Propagates raw payloads to webhook handlers when enabled. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/**
 * Creates a Hono-compatible webhook handler for Paymesh.
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
	return async (context: Context) => {
		const result = await client.webhooks.handle({
			hooks,
			includeRaw,
			request: context.req.raw,
		});

		return context.json(result.body, result.status);
	};
}
