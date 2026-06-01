import { PaymeshError } from '../errors';
import { getInternalRaw } from '../shared/raw';
import type { HandleWebhookResult, PaymeshHooks } from '../types/client';
import type {
	DatabaseTableKey,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type { PaymeshEvent, Provider } from '../types/providers';
import {
	getVersion,
	upsertCheckout,
	upsertCustomer,
	upsertInvoice,
	upsertSubscription,
} from './persistence';

type AnyHook = (event: unknown) => void | Promise<void>;

interface HandleClientWebhookOptions<IncludeRaw extends boolean = false> {
	provider: Provider<string>;
	database?: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
	request: Request;
	hooks?: PaymeshHooks<IncludeRaw>;
	includeRaw?: IncludeRaw;
	skipVerify?: boolean;
}

export async function handleClientWebhook<IncludeRaw extends boolean = false>({
	provider,
	database,
	schema,
	request,
	hooks,
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
		? await acquireWebhookEvent(database, schema, event, deliveryId)
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

		const hook = handled.hook ? getHook(hooks, handled.hook) : undefined;
		await hook?.(event);

		if (database) {
			await markWebhookEventProcessed(database, schema, event, deliveryId);
		}
	} catch (error) {
		if (database) {
			await markWebhookEventFailed(database, schema, event, deliveryId, error);
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

async function persistEvent(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	event: PaymeshEvent<unknown, boolean>,
) {
	if (
		event.type === 'customer.created' ||
		event.type === 'customer.updated' ||
		event.type === 'customer.deleted'
	) {
		await upsertCustomer(
			database,
			schema,
			event.data as Parameters<typeof upsertCustomer>[2],
			event.type === 'customer.deleted',
		);
		return;
	}

	if (event.type === 'checkout.completed') {
		await upsertCheckout(
			database,
			schema,
			event.data as Parameters<typeof upsertCheckout>[2],
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
		await upsertInvoice(
			database,
			schema,
			event.data as Parameters<typeof upsertInvoice>[2],
		);
		return;
	}

	if (
		event.type === 'subscription.created' ||
		event.type === 'subscription.updated' ||
		event.type === 'subscription.canceled'
	) {
		await upsertSubscription(database, schema, event);
	}
}

async function acquireWebhookEvent(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	event: PaymeshEvent<unknown, boolean>,
	deliveryId: string,
) {
	const [result] = await database.query<{
		inserted: boolean;
		retried: boolean;
	}>({
		sql: `WITH inserted AS (
			INSERT INTO ${tableName(schema, 'webhookEvents')} (provider, provider_id, version, event_type, status, attempts, data, raw, updated_at)
			VALUES ($1, $2, $3, $4, 'processing', 1, $5, $6, NOW())
			ON CONFLICT (provider, provider_id) DO NOTHING
			RETURNING 1
		),
		retried AS (
			UPDATE ${tableName(schema, 'webhookEvents')}
			SET status = 'processing', attempts = attempts + 1, last_error = NULL, event_type = $4, data = $5, raw = $6, updated_at = NOW()
			WHERE provider = $1 AND provider_id = $2 AND status = 'failed'
			RETURNING 1
		)
		SELECT
			EXISTS(SELECT 1 FROM inserted) AS inserted,
			EXISTS(SELECT 1 FROM retried) AS retried`,
		params: [
			event.provider,
			deliveryId,
			getVersion(event, getInternalRaw(event)),
			event.type,
			event,
			database.persistRaw ? getInternalRaw(event) : null,
		],
	});

	return result?.inserted || result?.retried
		? { duplicate: false as const }
		: { duplicate: true as const };
}

async function markWebhookEventProcessed(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	event: PaymeshEvent<unknown, boolean>,
	deliveryId: string,
) {
	await database.execute({
		sql: `UPDATE ${tableName(schema, 'webhookEvents')}
		 SET status = 'processed', processed_at = NOW(), updated_at = NOW(), last_error = NULL
		 WHERE provider = $1 AND provider_id = $2`,
		params: [event.provider, deliveryId],
	});
}

async function markWebhookEventFailed(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	event: PaymeshEvent<unknown, boolean>,
	deliveryId: string,
	error: unknown,
) {
	await database.execute({
		sql: `UPDATE ${tableName(schema, 'webhookEvents')}
		 SET status = 'failed', last_error = $3, updated_at = NOW()
		 WHERE provider = $1 AND provider_id = $2`,
		params: [
			event.provider,
			deliveryId,
			error instanceof Error ? error.message : 'Webhook handling failed',
		],
	});
}

function getHook<IncludeRaw extends boolean>(
	hooks: PaymeshHooks<IncludeRaw> | undefined,
	name: string,
): AnyHook | undefined {
	return (hooks as Record<string, AnyHook | undefined> | undefined)?.[name];
}

function tableName(schema: ResolvedDatabaseSchema, key: DatabaseTableKey) {
	return `"${schema.tables[key].name.replaceAll('"', '""')}"`;
}
