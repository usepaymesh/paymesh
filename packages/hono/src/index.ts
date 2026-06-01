import type { Context } from 'hono';
import type { PaymeshClient, PaymeshHooks } from 'paymesh';

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
	return async (context: Context) => {
		const result = await client.webhooks.handle({
			request: context.req.raw,
			includeRaw,
			hooks,
		});

		return context.json(result.body, result.status);
	};
}
