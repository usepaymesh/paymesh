import { PaymeshError } from '../errors';
import type { HandleWebhookResult } from '../types/client';
import type {
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { PaymeshEvent, Provider } from '../types/providers';

interface HandleClientWebhookOptions<IncludeRaw extends boolean = false> {
	provider: Provider<string>;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	request: Request;
	dispatchHook?: (hook: string, event: unknown) => Promise<void>;
	hasHook?: (hook: string) => boolean;
	includeRaw?: IncludeRaw;
	skipVerify?: boolean;
}

export async function handleClientWebhook<IncludeRaw extends boolean = false>({
	provider,
	database,
	schema,
	request,
	dispatchHook,
	hasHook,
	includeRaw,
	skipVerify,
}: HandleClientWebhookOptions<IncludeRaw>): Promise<
	HandleWebhookResult<IncludeRaw>
> {
	if (!provider.webhooks || !provider.capabilities.webhooks) {
		throw new PaymeshError({
			cause: provider,
			code: 'unsupported_capability',
			message: `Provider "${provider.id}" does not support webhooks capability`,
			provider: provider.id,
		});
	}

	if (!skipVerify) {
		const isValid = await provider.webhooks.verify({
			request: request.clone(),
		});

		if (!isValid) {
			return {
				status: 401,
				body: { error: 'invalid_webhook_signature' },
			};
		}
	}

	let handled: Awaited<ReturnType<typeof provider.webhooks.handle>>;

	try {
		handled = await provider.webhooks.handle({
			request,
			includeRaw,
		});
	} catch {
		return {
			status: 400,
			body: { error: 'webhook_handle_error' },
		};
	}

	const event = handled.event as PaymeshEvent<unknown, IncludeRaw>;
	const deliveryId = handled.deliveryId ?? event.id;
	const acquired = database
		? await database.repositories.webhookEvents.acquire(
				schema,
				event as PaymeshEvent<unknown, boolean>,
				deliveryId,
			)
		: { duplicate: false as const };

	if (acquired.duplicate) {
		return {
			status: 200,
			body: { received: true, duplicate: true },
			event,
		};
	}

	try {
		if (database) {
			await persistEvent(
				database,
				schema,
				event as PaymeshEvent<unknown, boolean>,
			);
		}

		if (dispatchHook) {
			const context = {
				request: request.clone(),
				deliveryId,
				dispatchedAt: new Date().toISOString(),
				hook: handled.hook,
			};
			const hookedEvent = withHookContext(event, context);
			const specificHook =
				handled.hook && hasHook?.(handled.hook) ? handled.hook : undefined;

			if (specificHook) {
				await dispatchHook(specificHook, hookedEvent);
			} else if (hasHook?.('onEvent')) {
				await dispatchHook('onEvent', hookedEvent);
			} else if (hasHook?.('onUnhandledEvent')) {
				await dispatchHook('onUnhandledEvent', hookedEvent);
			}
		}

		if (database) {
			await database.repositories.webhookEvents.markProcessed(
				schema,
				event as PaymeshEvent<unknown, boolean>,
				deliveryId,
			);
		}
	} catch (error) {
		if (database) {
			await database.repositories.webhookEvents.markFailed(
				schema,
				event as PaymeshEvent<unknown, boolean>,
				deliveryId,
				error,
			);
		}

		return {
			status: 500,
			body: { error: 'hook_error' },
			event,
		};
	}

	return {
		status: 200,
		body: { received: true },
		event,
	};
}

function withHookContext<TEvent extends PaymeshEvent<unknown, boolean>>(
	event: TEvent,
	context: {
		request: Request;
		deliveryId: string;
		dispatchedAt: string;
		hook?: string;
	},
) {
	return Object.assign(event, { context });
}

async function persistEvent(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	event: PaymeshEvent<unknown, boolean>,
) {
	if (event.type === 'customer.created' || event.type === 'customer.updated') {
		await database.repositories.customers.upsert(
			schema,
			event.data as Parameters<
				PaymeshDatabaseDriver['repositories']['customers']['upsert']
			>[1],
		);
		return;
	}

	if (event.type === 'customer.deleted') {
		await database.repositories.customers.markDeleted(
			schema,
			event.data as Parameters<
				PaymeshDatabaseDriver['repositories']['customers']['markDeleted']
			>[1],
		);
		return;
	}

	if (event.type === 'checkout.completed') {
		await database.repositories.checkouts.upsert(
			schema,
			event.data as Parameters<
				PaymeshDatabaseDriver['repositories']['checkouts']['upsert']
			>[1],
		);
		return;
	}

	if (
		event.type === 'payment.created' ||
		event.type === 'payment.succeeded' ||
		event.type === 'payment.failed' ||
		event.type === 'payment.canceled' ||
		event.type === 'payment.refunded'
	) {
		await database.repositories.invoices.upsert(
			schema,
			event.data as Parameters<
				PaymeshDatabaseDriver['repositories']['invoices']['upsert']
			>[1],
		);
		return;
	}

	if (
		event.type === 'subscription.created' ||
		event.type === 'subscription.updated' ||
		event.type === 'subscription.canceled'
	) {
		await database.repositories.subscriptions.upsert(
			schema,
			event as PaymeshEvent<unknown, boolean>,
		);
	}
}
