import { handleClientWebhook } from '../database/webhooks';
import type { HandleWebhookOptions } from '../types/client';
import type {
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { AnyPaymeshPlugin } from '../types/plugins';
import type { Provider } from '../types/providers';
import { type RuntimeHookDispatcher, resolveIncludeRaw } from './helpers';

export function createWebhookClient<
	P extends Provider<string>,
	IncludeRaw extends boolean,
	Plugins extends readonly AnyPaymeshPlugin[],
>({
	baseIncludeRaw,
	database,
	provider,
	schema,
	getDispatchHook,
	getHasHook,
}: {
	baseIncludeRaw: boolean;
	database?: PaymeshDatabaseDriver;
	provider: P;
	schema: ResolvedDatabaseSchema;
	getDispatchHook: (localHooks?: unknown) => RuntimeHookDispatcher | undefined;
	getHasHook: (localHooks?: unknown) => ((hook: string) => boolean) | undefined;
}) {
	return {
		handle: async <CallIncludeRaw extends boolean = IncludeRaw>(
			webhookOptions: HandleWebhookOptions<CallIncludeRaw, Plugins>,
		) => {
			const localHooks = webhookOptions.hooks as unknown;
			const dispatchHook = getDispatchHook(localHooks);
			const hasHook = getHasHook(localHooks);

			return handleClientWebhook({
				provider,
				database,
				schema,
				request: webhookOptions.request,
				dispatchHook,
				hasHook,
				includeRaw: resolveIncludeRaw(
					webhookOptions.includeRaw,
					baseIncludeRaw,
				) as CallIncludeRaw,
				skipVerify: webhookOptions.skipVerify ?? false,
			});
		},
	};
}
