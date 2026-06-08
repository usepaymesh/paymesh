import { randomUUID } from 'node:crypto';
import {
	type AnyWebhookEvent,
	definePlugin,
	lazy,
	PaymeshError,
	type WebhookHookEvent,
} from 'paymesh';
import {
	getTableName,
	insertEntries,
	listEntries,
	pruneEntries,
} from './shared/database';
import { enqueue } from './shared/queue';
import { applyRedaction } from './shared/redaction';
import {
	getRequestInfo,
	matchesPattern,
	onAsyncFailure,
	readRecord,
	readString,
	toIsoString,
} from './shared/utils';
import type {
	AuditLogCreateInput,
	AuditLogEntry,
	AuditLogListOptions,
	AuditLogOptions,
	AuditLogRuntimeState,
	AuditResource,
	ResolvedAuditLogOptions,
} from './types';

export type * from './types';

/**
 * Creates the Audit Logs plugin, which persists normalized Paymesh events into a database table.
 *
 * @example
 * ```ts
 * export const auditLogs = auditLog({
 *   events: ['payment.*', 'customer.*'],
 *   includeRequestInfo: true,
 * });
 * ```
 */
export function auditLog(options: AuditLogOptions = {}) {
	if (options.tamperEvident)
		throw new PaymeshError({
			code: 'plugin_configuration_error',
			message: 'Audit log tamper-evident mode is not supported in the MVP.',
		});

	const config = {
		/** Defaults to `['*']`. */
		events: options.events ?? ['*'],
		/** Defaults to `[]`. */
		exclude: options.exclude ?? [],
		/** Defaults to `'async'`. */
		mode: options.mode ?? 'async',
		/** Defaults to `'warn'`. */
		failureMode: options.failureMode ?? 'warn',
		/** Defaults to `'1y'`. */
		retention: options.retention ?? '1y',
		/** Defaults to `true`. */
		redact: options.redact ?? true,
		/** Defaults to `true`. */
		includeDiff: options.includeDiff ?? true,
		/** Defaults to `true`. */
		includeProviderMetadata: options.includeProviderMetadata ?? true,
		/** Defaults to `true`. */
		includeRequestInfo: options.includeRequestInfo ?? true,
		actor: options.actor,
		batch: {
			/** Defaults to `false`. */
			enabled: options.batch?.enabled ?? false,
			/** Defaults to `100`. */
			size: options.batch?.size ?? 100,
			/** Defaults to `1_000`. */
			flushInterval: options.batch?.flushInterval ?? 1_000,
		},
	} satisfies ResolvedAuditLogOptions;

	const state: AuditLogRuntimeState = { queue: [] };

	return definePlugin({
		id: 'audit-logs',
		name: 'Audit Logs',
		version: '0.0.0',
		description: 'Persists normalized Paymesh events as audit log entries.',
		config: {
			database: true,
		},
		schema: {
			customTables: {
				audit_logs: {
					name: 'audit_logs',
					primaryKey: { type: 'text' },
					timestamps: { createdAt: true, updatedAt: false },
					fields: {
						action: { type: 'string', required: true },
						category: { type: 'string' },
						actor_type: { type: 'string' },
						actor_id: { type: 'string' },
						actor_email: { type: 'string' },
						actor_name: { type: 'string' },
						resource_type: { type: 'string', required: true },
						resource_id: { type: 'string' },
						resource_name: { type: 'string' },
						customer_id: { type: 'string' },
						organization_id: { type: 'string' },
						provider: { type: 'string' },
						provider_account_id: { type: 'string' },
						provider_resource_id: { type: 'string' },
						source: { type: 'string', required: true },
						status: { type: 'string', default: 'success' },
						severity: { type: 'string', default: 'info' },
						message: { type: 'string' },
						changes: { type: 'json' },
						metadata: { type: 'json' },
						request_id: { type: 'string' },
						correlation_id: { type: 'string' },
						idempotency_key: { type: 'string' },
						webhook_event_id: { type: 'string' },
						provider_event_id: { type: 'string' },
						ip_address: { type: 'string' },
						user_agent: { type: 'string' },
						occurred_at: { type: 'date', required: true },
						hash: { type: 'string' },
						previous_hash: { type: 'string' },
					},
					indexes: [
						{
							name: 'paymesh_audit_logs_customer_id_idx',
							columns: ['customer_id'],
						},
						{
							name: 'paymesh_audit_logs_resource_idx',
							columns: ['resource_type', 'resource_id'],
						},
						{
							name: 'paymesh_audit_logs_action_idx',
							columns: ['action'],
						},
						{
							name: 'paymesh_audit_logs_provider_idx',
							columns: ['provider'],
						},
						{
							name: 'paymesh_audit_logs_occurred_at_idx',
							columns: ['occurred_at'],
						},
						{
							name: 'paymesh_audit_logs_correlation_id_idx',
							columns: ['correlation_id'],
						},
					],
				},
			},
		},
		setup(context) {
			state.client = context.client;
			state.tableName = getTableName(context.client);
		},
		hooks: {
			async onEvent(event: WebhookHookEvent<AnyWebhookEvent<boolean>>) {
				if (
					!state.client ||
					!state.tableName ||
					!config.events.some((pattern) =>
						matchesPattern(event.type, pattern),
					) ||
					config.exclude.some((pattern) => matchesPattern(event.type, pattern))
				)
					return;

				const resource: AuditResource = {
					type:
						event.type === 'checkout.completed'
							? 'checkout'
							: (event.type.split('.')[0] ?? 'event'),
					id: readString(event.data, 'id') ?? undefined,
					name:
						readString(event.data, 'name') ??
						readString(event.data, 'title') ??
						undefined,
				};

				const requestInfo = config.includeRequestInfo
					? getRequestInfo(event.context.request)
					: {
							requestId: null,
							correlationId: null,
							idempotencyKey: null,
							ipAddress: null,
							userAgent: null,
						};

				const metadata: Record<string, unknown> = { eventType: event.type };

				if (config.includeProviderMetadata) {
					metadata.provider = event.provider;
					metadata.providerEventId = event.id;
				}

				let entry: AuditLogEntry = {
					id: `alog_${randomUUID().replaceAll('-', '')}`,
					action: event.type,
					category: event.type.split('.')[0] ?? null,
					actor:
						(await config.actor?.({
							client: state.client,
							event,
							request: event.context.request,
						})) ?? null,
					resource,
					customerId: event.type.startsWith('customer.')
						? readString(event.data, 'id')
						: (readString(readRecord(event.data, 'customer'), 'id') ??
							readString(event.data, 'customerId') ??
							readString(event.data, 'customer_id') ??
							null),
					organizationId: null,
					provider: event.provider,
					providerAccountId: null,
					providerResourceId: resource.id ?? null,
					source: 'webhook',
					status: 'success',
					severity: 'info',
					message: event.type
						.split('.')
						.map(
							(segment) => segment.charAt(0).toUpperCase() + segment.slice(1),
						)
						.join(' '),
					changes: config.includeDiff ? null : null,
					metadata,
					requestId: requestInfo.requestId,
					correlationId: requestInfo.correlationId,
					idempotencyKey: requestInfo.idempotencyKey,
					webhookEventId: event.context.deliveryId,
					providerEventId: event.id,
					ipAddress: requestInfo.ipAddress,
					userAgent: requestInfo.userAgent,
					occurredAt: new Date().toISOString(),
					createdAt: null,
					hash: null,
					previousHash: null,
				};

				entry = await applyRedaction(config, entry);

				const persist =
					config.batch.enabled && config.mode === 'async'
						? enqueue(state, config, entry)
						: insertEntries(state.client, state.tableName, [entry]);

				if (config.mode === 'sync' || config.failureMode === 'throw') {
					await persist;

					return;
				}

				void persist.catch((error) =>
					onAsyncFailure(config.failureMode, error),
				);
			},
		},
		extends(context) {
			const { client } = context;
			const tableName = getTableName(client);

			return {
				auditLog: lazy(() => ({
					create: async (input: AuditLogCreateInput) => {
						let entry: AuditLogEntry = {
							id: `alog_${randomUUID().replaceAll('-', '')}`,
							action: input.action,
							category:
								input.category ??
								(input.action.includes('.')
									? (input.action.split('.')[0] ?? null)
									: null),
							actor:
								input.actor ??
								(await config.actor?.({ client, input })) ??
								null,
							resource: {
								type: input.resource.type,
								id: input.resource.id ?? undefined,
								name: input.resource.name ?? undefined,
							},
							customerId: input.customerId ?? null,
							organizationId: input.organizationId ?? null,
							provider: input.provider ?? null,
							providerAccountId: input.providerAccountId ?? null,
							providerResourceId:
								input.providerResourceId ?? input.resource.id ?? null,
							source: input.source ?? 'manual',
							status: input.status ?? 'success',
							severity: input.severity ?? 'info',
							message: input.message ?? null,
							changes: input.changes ?? null,
							metadata: input.metadata ?? null,
							requestId: input.requestId ?? null,
							correlationId: input.correlationId ?? null,
							idempotencyKey: input.idempotencyKey ?? null,
							webhookEventId: input.webhookEventId ?? null,
							providerEventId: input.providerEventId ?? null,
							ipAddress: input.ipAddress ?? null,
							userAgent: input.userAgent ?? null,
							occurredAt: toIsoString(input.occurredAt ?? new Date()),
							createdAt: null,
							hash: input.hash ?? null,
							previousHash: input.previousHash ?? null,
						};

						entry = await applyRedaction(config, entry);

						await insertEntries(client, tableName, [entry]);

						return entry;
					},
					list: (listOptions: AuditLogListOptions = {}) =>
						listEntries(client, tableName, listOptions),
					prune: (pruneOptions?: {
						before?: string | Date;
						retention?: AuditLogOptions['retention'];
					}) => pruneEntries(client, tableName, config, pruneOptions),
				})),
			};
		},
	});
}
