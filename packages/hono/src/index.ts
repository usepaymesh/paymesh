import type { Context } from 'hono';
import {
	type PaymeshClient,
	PaymeshError,
	type PaymeshHook,
	type PaymeshHooks,
} from 'paymesh';

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
			code: 'unsupported_capability',
			message: `Provider "${client.provider.id}" does not support webhooks capability`,
			provider: client.provider.id,
		});

	return async (context: Context) => {
		const { webhooks } = client.provider;
		const request = context.req.raw;

		if (!webhooks)
			return context.json({ error: 'unsupported_capability' }, 501);

		const isValid = await webhooks.verify({
			request: request.clone(),
		});

		if (!isValid)
			return context.json({ error: 'invalid_webhook_signature' }, 401);

		let payload: Record<string, unknown>;

		try {
			payload = await webhooks.parse(request);
		} catch {
			return context.json({ error: 'webhook_parse_error' }, 400);
		}

		let event: Awaited<ReturnType<typeof webhooks.map>>;

		try {
			event = (await webhooks.map(payload, {
				includeRaw: (includeRaw ?? client.includeRaw ?? false) as IncludeRaw,
			})) as Awaited<ReturnType<typeof webhooks.map>>;
		} catch {
			return context.json({ error: 'webhook_mapping_error' }, 400);
		}

		const hookName = webhooks.hook(event as never);

		const hook = hookName
			? (getHook(hooks, hookName) ?? getHook(client.hooks, hookName))
			: undefined;

		try {
			await hook?.(event);
		} catch {
			return context.json({ error: 'hook_error' }, 500);
		}

		return context.json({ received: true }, 200);
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
