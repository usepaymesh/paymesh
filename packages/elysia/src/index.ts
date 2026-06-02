import type { Context } from 'elysia';
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
	return async ({ request, status }: Context) => {
		const result = await client.webhooks.handle({
			request,
			includeRaw,
			hooks,
		});

		return status(result.status, result.body);
	};
}
