import type { Context } from 'elysia';
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

	return async ({ request, status }: Context) => {
		const { webhooks } = client.provider;

		if (!webhooks) return status(501, { error: 'unsupported_capability' });

		const isValid = await webhooks.verify({
			request: request.clone(),
		});

		if (!isValid) return status(401, { error: 'invalid_webhook_signature' });

		let payload: Record<string, unknown>;

		try {
			payload = await webhooks.parse(request);
		} catch {
			return status(400, { error: 'webhook_parse_error' });
		}

		let event: Awaited<ReturnType<typeof webhooks.map>>;

		try {
			event = (await webhooks.map(payload, {
				includeRaw: (includeRaw ?? client.includeRaw ?? false) as IncludeRaw,
			})) as Awaited<ReturnType<typeof webhooks.map>>;
		} catch {
			return status(400, { error: 'webhook_mapping_error' });
		}

		const hookName = webhooks.hook(event as never);

		const hook = hookName
			? (getHook(hooks, hookName) ?? getHook(client.hooks, hookName))
			: undefined;

		try {
			await hook?.(event);
		} catch {
			return status(500, { error: 'hook_error' });
		}

		return status(200, { received: true });
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
