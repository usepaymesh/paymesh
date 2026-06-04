import type {
	AnyWebhookEvent,
	PluginRuntimeClient,
	WebhookHookEvent,
} from 'paymesh';

export type AuditEventPattern = string;

export interface AuditActor {
	type: string;
	id?: string;
	email?: string;
	name?: string;
}

export interface AuditResource {
	type: string;
	id?: string;
	name?: string;
}

export interface AuditLogEntry {
	id: string;
	action: string;
	category: string | null;
	actor: AuditActor | null;
	resource: AuditResource;
	customerId: string | null;
	organizationId: string | null;
	provider: string | null;
	providerAccountId: string | null;
	providerResourceId: string | null;
	source: string;
	status: string;
	severity: string;
	message: string | null;
	changes: Record<string, unknown> | unknown[] | null;
	metadata: Record<string, unknown> | unknown[] | null;
	requestId: string | null;
	correlationId: string | null;
	idempotencyKey: string | null;
	webhookEventId: string | null;
	providerEventId: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	occurredAt: string;
	createdAt: string | null;
	hash: string | null;
	previousHash: string | null;
}

export interface AuditLogCreateInput {
	action: string;
	category?: string;
	actor?: AuditActor | null;
	resource: AuditResource;
	customerId?: string;
	organizationId?: string;
	provider?: string;
	providerAccountId?: string;
	providerResourceId?: string;
	source?: string;
	status?: string;
	severity?: string;
	message?: string;
	changes?: Record<string, unknown> | unknown[] | null;
	metadata?: Record<string, unknown> | unknown[] | null;
	requestId?: string;
	correlationId?: string;
	idempotencyKey?: string;
	webhookEventId?: string;
	providerEventId?: string;
	ipAddress?: string;
	userAgent?: string;
	occurredAt?: string | Date;
	hash?: string;
	previousHash?: string;
}

export interface AuditLogListOptions {
	customerId?: string;
	organizationId?: string;
	resourceType?: string;
	resourceId?: string;
	action?: string;
	provider?: string;
	status?: string;
	severity?: string;
	correlationId?: string;
	limit?: number;
	after?: string;
	before?: string;
}

export interface AuditLogListResult {
	data: AuditLogEntry[];
	total: number;
	previous: string | null;
	next: string | null;
}

export interface AuditActorResolverContext {
	event?: WebhookHookEvent<AnyWebhookEvent<boolean>>;
	request?: Request;
	input?: AuditLogCreateInput;
	client: PluginRuntimeClient;
}

export type AuditActorResolver = (
	context: AuditActorResolverContext,
) => AuditActor | null | Promise<AuditActor | null>;

export interface AuditLogOptions {
	events?: AuditEventPattern[];
	exclude?: AuditEventPattern[];
	mode?: 'sync' | 'async';
	failureMode?: 'throw' | 'warn' | 'ignore';
	retention?: '30d' | '90d' | '180d' | '1y' | 'forever';
	redact?:
		| boolean
		| string[]
		| ((entry: AuditLogEntry) => AuditLogEntry | Promise<AuditLogEntry>);
	includeDiff?: boolean;
	includeProviderMetadata?: boolean;
	includeRequestInfo?: boolean;
	actor?: AuditActorResolver;
	tamperEvident?: boolean;
	batch?: {
		enabled?: boolean;
		size?: number;
		flushInterval?: number;
	};
}

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

export interface AuditLogRuntimeState {
	client?: PluginRuntimeClient;
	tableName?: string;
	queue: AuditLogEntry[];
	flushTimer?: ReturnType<typeof setTimeout>;
}

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
