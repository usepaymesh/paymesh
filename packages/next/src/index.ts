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
	return async (request: Request) => {
		const result = await client.webhooks.handle({
			request,
			includeRaw,
			hooks,
		});

		return Response.json(result.body, { status: result.status });
	};
}
