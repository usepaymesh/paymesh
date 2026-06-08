import { PaymeshError, type PluginRuntimeClient, type SqlValue } from 'paymesh';
import type {
	AuditLogEntry,
	AuditLogListOptions,
	AuditLogListResult,
	AuditLogOptions,
	AuditLogRow,
	ResolvedAuditLogOptions,
} from 'src/types';
import { quoteIdentifier, toIsoString } from './utils';

const INSERT_COLUMNS = [
	'id',
	'action',
	'category',
	'actor_type',
	'actor_id',
	'actor_email',
	'actor_name',
	'resource_type',
	'resource_id',
	'resource_name',
	'customer_id',
	'organization_id',
	'provider',
	'provider_account_id',
	'provider_resource_id',
	'source',
	'status',
	'severity',
	'message',
	'changes',
	'metadata',
	'request_id',
	'correlation_id',
	'idempotency_key',
	'webhook_event_id',
	'provider_event_id',
	'ip_address',
	'user_agent',
	'occurred_at',
	'hash',
	'previous_hash',
];

const RETENTION_MS = {
	'30d': 30 * 24 * 60 * 60 * 1000,
	'90d': 90 * 24 * 60 * 60 * 1000,
	'180d': 180 * 24 * 60 * 60 * 1000,
	'1y': 365 * 24 * 60 * 60 * 1000,
} as const;

export async function insertEntries(
	client: PluginRuntimeClient,
	tableName: string,
	entries: AuditLogEntry[],
) {
	if (entries.length === 0) return;
	const database = getDatabase(client);

	await database.transaction(async (tx) => {
		for (const entry of entries) {
			await tx.execute({
				sql: `INSERT INTO ${quoteIdentifier(tableName)} (${INSERT_COLUMNS.map(
					quoteIdentifier,
				).join(', ')})
VALUES (${INSERT_COLUMNS.map((_, index) => `$${index + 1}`).join(', ')})`,
				params: [
					entry.id,
					entry.action,
					entry.category,
					entry.actor?.type ?? null,
					entry.actor?.id ?? null,
					entry.actor?.email ?? null,
					entry.actor?.name ?? null,
					entry.resource.type,
					entry.resource.id ?? null,
					entry.resource.name ?? null,
					entry.customerId,
					entry.organizationId,
					entry.provider,
					entry.providerAccountId,
					entry.providerResourceId,
					entry.source,
					entry.status,
					entry.severity,
					entry.message,
					entry.changes,
					entry.metadata,
					entry.requestId,
					entry.correlationId,
					entry.idempotencyKey,
					entry.webhookEventId,
					entry.providerEventId,
					entry.ipAddress,
					entry.userAgent,
					entry.occurredAt,
					entry.hash,
					entry.previousHash,
				],
			});
		}
	});
}

export async function listEntries(
	client: PluginRuntimeClient,
	tableName: string,
	options: AuditLogListOptions,
): Promise<AuditLogListResult> {
	const database = getDatabase(client);
	const limit = options.limit ?? 20;

	if (!Number.isInteger(limit) || limit <= 0)
		throw new PaymeshError({
			code: 'invalid_request',
			message: 'Audit log list limit must be a positive integer',
		});

	if (options.after && options.before)
		throw new PaymeshError({
			code: 'invalid_request',
			message: 'Audit log list accepts either "after" or "before", not both',
		});

	const filters = [
		['customer_id', options.customerId],
		['organization_id', options.organizationId],
		['resource_type', options.resourceType],
		['resource_id', options.resourceId],
		['action', options.action],
		['provider', options.provider],
		['status', options.status],
		['severity', options.severity],
		['correlation_id', options.correlationId],
	] as const;
	const filterParams: SqlValue[] = [];
	const whereParts = filters.flatMap(([column, value]) => {
		if (value == null) return [];
		filterParams.push(value);
		return [`${quoteIdentifier(column)} = $${filterParams.length}`];
	});
	const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
	const [{ total = 0 } = { total: 0 }] = await database.query<{
		total: number | string;
	}>({
		sql: `SELECT COUNT(*) AS total FROM ${quoteIdentifier(tableName)} ${whereSql}`,
		params: filterParams,
	});

	const params: SqlValue[] = [...filterParams];

	let cursorSql = '';
	let order = 'DESC';
	const cursorValue = options.before ?? options.after;

	if (cursorValue) {
		if (!cursorValue.startsWith('al1.'))
			throw new PaymeshError({
				code: 'invalid_request',
				message: 'Invalid audit log list cursor',
			});

		let occurredAt = '';
		let id = '';
		try {
			const parsed = JSON.parse(
				Buffer.from(cursorValue.slice(4), 'base64url').toString('utf8'),
			) as Record<string, unknown>;
			if (
				typeof parsed.occurredAt !== 'string' ||
				typeof parsed.id !== 'string'
			) {
				throw new Error('invalid_cursor_payload');
			}
			occurredAt = parsed.occurredAt;
			id = parsed.id;
		} catch {
			throw new PaymeshError({
				code: 'invalid_request',
				message: 'Invalid audit log list cursor',
			});
		}

		params.push(occurredAt, id);
		cursorSql = options.after
			? `${whereSql ? ' AND' : 'WHERE'} (occurred_at, id) < ($${params.length - 1}, $${params.length})`
			: `${whereSql ? ' AND' : 'WHERE'} (occurred_at, id) > ($${params.length - 1}, $${params.length})`;
		order = options.before ? 'ASC' : 'DESC';
	}

	params.push(limit + 1);
	const rows = await database.query<AuditLogRow>({
		sql: `SELECT *
FROM ${quoteIdentifier(tableName)}
${whereSql}
${cursorSql}
ORDER BY occurred_at ${order}, id ${order}
LIMIT $${params.length}`,
		params,
	});
	const hasExtra = rows.length > limit;
	const pageRows = options.before
		? [...(hasExtra ? rows.slice(0, limit) : rows)].reverse()
		: hasExtra
			? rows.slice(0, limit)
			: rows;

	return {
		data: pageRows.map((row) => ({
			id: row.id,
			action: row.action,
			category: row.category,
			actor: row.actor_type
				? {
						type: row.actor_type,
						id: row.actor_id ?? undefined,
						email: row.actor_email ?? undefined,
						name: row.actor_name ?? undefined,
					}
				: null,
			resource: {
				type: row.resource_type,
				id: row.resource_id ?? undefined,
				name: row.resource_name ?? undefined,
			},
			customerId: row.customer_id,
			organizationId: row.organization_id,
			provider: row.provider,
			providerAccountId: row.provider_account_id,
			providerResourceId: row.provider_resource_id,
			source: row.source,
			status: row.status,
			severity: row.severity,
			message: row.message,
			changes: row.changes,
			metadata: row.metadata,
			requestId: row.request_id,
			correlationId: row.correlation_id,
			idempotencyKey: row.idempotency_key,
			webhookEventId: row.webhook_event_id,
			providerEventId: row.provider_event_id,
			ipAddress: row.ip_address,
			userAgent: row.user_agent,
			occurredAt: toIsoString(row.occurred_at),
			createdAt: row.created_at == null ? null : toIsoString(row.created_at),
			hash: row.hash,
			previousHash: row.previous_hash,
		})),
		total: Number(total),
		previous:
			pageRows.length === 0
				? null
				: options.before
					? hasExtra
						? encodeCursor(pageRows[0]!)
						: null
					: cursorValue
						? encodeCursor(pageRows[0]!)
						: null,
		next:
			pageRows.length === 0
				? null
				: options.before
					? encodeCursor(pageRows[pageRows.length - 1]!)
					: hasExtra
						? encodeCursor(pageRows[pageRows.length - 1]!)
						: null,
	};
}

export async function pruneEntries(
	client: PluginRuntimeClient,
	tableName: string,
	config: ResolvedAuditLogOptions,
	pruneOptions?: {
		before?: string | Date;
		retention?: AuditLogOptions['retention'];
	},
) {
	const before =
		pruneOptions?.before != null
			? toIsoString(pruneOptions.before)
			: pruneOptions?.retention === 'forever' || config.retention === 'forever'
				? null
				: new Date(
						Date.now() -
							RETENTION_MS[
								(pruneOptions?.retention ??
									config.retention) as keyof typeof RETENTION_MS
							],
					).toISOString();
	if (!before) {
		return { deleted: 0 };
	}

	const rows = await getDatabase(client).query<{ id: string }>({
		sql: `DELETE FROM ${quoteIdentifier(tableName)}
WHERE occurred_at < $1
RETURNING id`,
		params: [before],
	});

	return { deleted: rows.length };
}

function getDatabase(client: PluginRuntimeClient) {
	if (!client.database)
		throw new PaymeshError({
			code: 'plugin_error',
			message: 'Audit logs require a configured database.',
			provider: client.provider.id,
		});

	return client.database;
}

export function getTableName(client: PluginRuntimeClient) {
	const table = client.schema.customTables['audit-logs.audit_logs'];

	if (!table)
		throw new PaymeshError({
			code: 'plugin_error',
			message:
				'Audit logs table is not available in the resolved client schema.',
			provider: client.provider.id,
		});

	return table.name;
}

function encodeCursor(row: AuditLogRow | AuditLogEntry) {
	const occurredAt =
		('occurredAt' in row ? row.occurredAt : row.occurred_at) ?? new Date();
	return `al1.${Buffer.from(
		JSON.stringify({
			occurredAt: toIsoString(occurredAt),
			id: row.id,
		}),
	).toString('base64url')}`;
}
