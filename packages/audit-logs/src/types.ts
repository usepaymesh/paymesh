import type {
	AnyWebhookEvent,
	PluginRuntimeClient,
	WebhookHookEvent,
} from 'paymesh';

/**
 * Event selector used by the Audit Logs plugin.
 */
export type AuditEventPattern = string;

/**
 * Actor metadata captured in an audit log entry.
 */
export interface AuditActor {
	/** Actor type, such as `user` or `system`. */
	type: string;
	/** Stable actor identifier, when available. */
	id?: string;
	/** Actor email address, when available. */
	email?: string;
	/** Actor display name, when available. */
	name?: string;
}

/**
 * Resource metadata captured in an audit log entry.
 */
export interface AuditResource {
	/** Resource type, such as `payment` or `customer`. */
	type: string;
	/** Resource identifier, when available. */
	id?: string;
	/** Human-friendly resource name, when available. */
	name?: string;
}

/**
 * Fully normalized audit log entry persisted by the plugin.
 */
export interface AuditLogEntry {
	/** Unique audit log entry identifier. */
	id: string;
	/** Primary audit action, usually the Paymesh event type. */
	action: string;
	/** High-level action category. */
	category: string | null;
	/** Actor responsible for the event, if known. */
	actor: AuditActor | null;
	/** Resource affected by the event. */
	resource: AuditResource;
	/** Associated customer identifier, if known. */
	customerId: string | null;
	/** Associated organization identifier, if known. */
	organizationId: string | null;
	/** Provider that emitted the event. */
	provider: string | null;
	/** Provider account identifier, when available. */
	providerAccountId: string | null;
	/** Provider-side resource identifier, when available. */
	providerResourceId: string | null;
	/** Event source, such as `webhook` or `manual`. */
	source: string;
	/** Result status. */
	status: string;
	/** Severity label. */
	severity: string;
	/** Human-readable message. */
	message: string | null;
	/** Structured change set. */
	changes: Record<string, unknown> | unknown[] | null;
	/** Structured metadata. */
	metadata: Record<string, unknown> | unknown[] | null;
	/** Request id extracted from headers. */
	requestId: string | null;
	/** Correlation id extracted from headers. */
	correlationId: string | null;
	/** Idempotency key extracted from headers. */
	idempotencyKey: string | null;
	/** Webhook delivery id. */
	webhookEventId: string | null;
	/** Provider event id. */
	providerEventId: string | null;
	/** Request IP address. */
	ipAddress: string | null;
	/** Request user agent. */
	userAgent: string | null;
	/** Event occurrence timestamp. */
	occurredAt: string;
	/** Row creation timestamp. */
	createdAt: string | null;
	/** Integrity hash when tamper-evident mode is used. */
	hash: string | null;
	/** Previous integrity hash when tamper-evident mode is used. */
	previousHash: string | null;
}

/**
 * Input accepted when manually creating an audit log entry.
 */
export interface AuditLogCreateInput {
	/** Primary audit action. */
	action: string;
	/** Optional action category. */
	category?: string;
	/** Actor metadata. */
	actor?: AuditActor | null;
	/** Resource metadata. */
	resource: AuditResource;
	/** Associated customer id. */
	customerId?: string;
	/** Associated organization id. */
	organizationId?: string;
	/** Provider id. */
	provider?: string;
	/** Provider account id. */
	providerAccountId?: string;
	/** Provider resource id. */
	providerResourceId?: string;
	/** Event source. */
	source?: string;
	/** Result status. */
	status?: string;
	/** Severity label. */
	severity?: string;
	/** Human-readable message. */
	message?: string;
	/** Structured change set. */
	changes?: Record<string, unknown> | unknown[] | null;
	/** Structured metadata. */
	metadata?: Record<string, unknown> | unknown[] | null;
	/** Request id. */
	requestId?: string;
	/** Correlation id. */
	correlationId?: string;
	/** Idempotency key. */
	idempotencyKey?: string;
	/** Webhook delivery id. */
	webhookEventId?: string;
	/** Provider event id. */
	providerEventId?: string;
	/** Request IP address. */
	ipAddress?: string;
	/** Request user agent. */
	userAgent?: string;
	/** Event occurrence timestamp. */
	occurredAt?: string | Date;
	/** Integrity hash. */
	hash?: string;
	/** Previous integrity hash. */
	previousHash?: string;
}

/**
 * Filters used when listing audit log entries.
 */
export interface AuditLogListOptions {
	/** Restrict results to a specific customer. */
	customerId?: string;
	/** Restrict results to a specific organization. */
	organizationId?: string;
	/** Restrict results to a specific resource type. */
	resourceType?: string;
	/** Restrict results to a specific resource id. */
	resourceId?: string;
	/** Restrict results to a specific action. */
	action?: string;
	/** Restrict results to a specific provider. */
	provider?: string;
	/** Restrict results to a specific status. */
	status?: string;
	/** Restrict results to a specific severity. */
	severity?: string;
	/** Restrict results to a specific correlation id. */
	correlationId?: string;
	/** Maximum number of rows to return. */
	limit?: number;
	/** Cursor after the current page. */
	after?: string;
	/** Cursor before the current page. */
	before?: string;
}

/**
 * Paginated audit log list response.
 */
export interface AuditLogListResult {
	data: AuditLogEntry[];
	total: number;
	previous: string | null;
	next: string | null;
}

/**
 * Context passed to an actor resolver.
 */
export interface AuditActorResolverContext {
	event?: WebhookHookEvent<AnyWebhookEvent<boolean>>;
	request?: Request;
	input?: AuditLogCreateInput;
	client: PluginRuntimeClient;
}

/**
 * Resolves the actor associated with an audit log entry.
 */
export type AuditActorResolver = (
	context: AuditActorResolverContext,
) => AuditActor | null | Promise<AuditActor | null>;

/**
 * Configuration accepted by the Audit Logs plugin.
 */
export interface AuditLogOptions {
	/** Event patterns to include. Defaults to `['*']`. */
	events?: AuditEventPattern[];
	/** Event patterns to exclude. Defaults to `[]`. */
	exclude?: AuditEventPattern[];
	/** Persistence mode. Defaults to `'async'`. */
	mode?: 'sync' | 'async';
	/** Error handling strategy. Defaults to `'warn'`. */
	failureMode?: 'throw' | 'warn' | 'ignore';
	/** Retention window. Defaults to `'1y'`. */
	retention?: '30d' | '90d' | '180d' | '1y' | 'forever';
	/** Redaction policy. Defaults to `true`. */
	redact?:
		| boolean
		| string[]
		| ((entry: AuditLogEntry) => AuditLogEntry | Promise<AuditLogEntry>);
	/** Include diff data. Defaults to `true`. */
	includeDiff?: boolean;
	/** Include provider metadata. Defaults to `true`. */
	includeProviderMetadata?: boolean;
	/** Include request metadata. Defaults to `true`. */
	includeRequestInfo?: boolean;
	actor?: AuditActorResolver;
	tamperEvident?: boolean;
	batch?: {
		/** Enable batching. Defaults to `false`. */
		enabled?: boolean;
		/** Batch size. Defaults to `100`. */
		size?: number;
		/** Flush interval in milliseconds. Defaults to `1_000`. */
		flushInterval?: number;
	};
}

/**
 * Raw database row shape used by the plugin's persistence layer.
 */
export interface AuditLogRow {
	id: string;
	action: string;
	category: string | null;
	actor_type: string | null;
	actor_id: string | null;
	actor_email: string | null;
	actor_name: string | null;
	resource_type: string;
	resource_id: string | null;
	resource_name: string | null;
	customer_id: string | null;
	organization_id: string | null;
	provider: string | null;
	provider_account_id: string | null;
	provider_resource_id: string | null;
	source: string;
	status: string;
	severity: string;
	message: string | null;
	changes: Record<string, unknown> | unknown[] | null;
	metadata: Record<string, unknown> | unknown[] | null;
	request_id: string | null;
	correlation_id: string | null;
	idempotency_key: string | null;
	webhook_event_id: string | null;
	provider_event_id: string | null;
	ip_address: string | null;
	user_agent: string | null;
	occurred_at: string | Date;
	created_at: string | Date | null;
	hash: string | null;
	previous_hash: string | null;
}

/**
 * Runtime state for the Audit Logs plugin.
 */
export interface AuditLogRuntimeState {
	client?: PluginRuntimeClient;
	tableName?: string;
	queue: AuditLogEntry[];
	flushTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Resolved and normalized Audit Logs plugin configuration.
 */
export interface ResolvedAuditLogOptions {
	events: AuditEventPattern[];
	exclude: AuditEventPattern[];
	mode: 'sync' | 'async';
	failureMode: 'throw' | 'warn' | 'ignore';
	retention: NonNullable<AuditLogOptions['retention']>;
	redact: NonNullable<AuditLogOptions['redact']>;
	includeDiff: boolean;
	includeProviderMetadata: boolean;
	includeRequestInfo: boolean;
	actor?: AuditActorResolver;
	batch: {
		enabled: boolean;
		size: number;
		flushInterval: number;
	};
}
