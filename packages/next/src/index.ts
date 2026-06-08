import type { PaymeshClient, PaymeshHooks } from 'paymesh';

/**
 * Options for mounting the Paymesh webhook handler in a Next.js route handler.
 */
export interface WebhooksOptions<IncludeRaw extends boolean = false>
	extends PaymeshHooks<IncludeRaw> {
	/** Preconfigured Paymesh client instance. */
	client: PaymeshClient<IncludeRaw>;
	/** Propagates raw payloads to webhook handlers when enabled. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/**
 * Creates a Next.js-compatible webhook handler for Paymesh.
 *
 * @example
 * ```ts
 * export const POST = Webhooks({ client });
 * ```
 */
export function Webhooks<IncludeRaw extends boolean = false>({
	client,
	includeRaw,
	...hooks
}: WebhooksOptions<IncludeRaw>) {
	return async (request: Request) => {
		const result = await client.webhooks.handle({
			request,
			includeRaw,
			hooks,
		});

		return Response.json(result.body, { status: result.status });
	};
}
