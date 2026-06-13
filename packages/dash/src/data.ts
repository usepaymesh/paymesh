import type {
	PaymeshClient,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
	SqlValue,
} from 'paymesh';
import { PaymeshError } from 'paymesh';
import { DASH_AUDIT_TABLE_ID } from './shared';
import { compileQuery, customTableName, tableName } from './sql';
import type { DashActor, DashboardRequestContext } from './types';

interface DashboardRow {
	created_at: string | Date;
	updated_at?: string | Date | null;
}

interface AuditEntryRow extends DashboardRow {
	action: string;
	actor_email: string | null;
	actor_id: string;
	actor_name: string | null;
	actor_type: string | null;
	error: string | null;
	metadata: unknown;
	outcome: string;
	provider: string;
	resource_id: string | null;
	resource_type: string;
}

interface DashboardRouteContextShape {
	client: PaymeshClient<boolean>;
	database: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
}

export async function getOverviewData(context: DashboardRequestContext) {
	const providerParams = [
		context.client.provider.id,
		context.client.isSandbox(),
	];
	const [countsResult, recentWebhooks, balance] = await Promise.all([
		context.database.query<{
			checkout_count: number | string;
			customer_count: number | string;
			failed_webhook_count: number | string;
			invoice_count: number | string;
			pix_count: number | string;
			price_count: number | string;
			product_count: number | string;
			subscription_count: number | string;
			webhook_count: number | string;
		}>(
			compileQuery(
				`SELECT
					customers.customer_count,
					pix.pix_count,
					checkouts.checkout_count,
					invoices.invoice_count,
					subscriptions.subscription_count,
					webhooks.webhook_count,
					webhooks.failed_webhook_count,
					products.product_count,
					prices.price_count
				FROM
					(SELECT COUNT(*)::text AS customer_count FROM ${tableName(context.schema, 'customers')} WHERE provider = $1 AND sandbox = $2 AND deleted_at IS NULL) customers,
					(SELECT COUNT(*)::text AS pix_count FROM ${tableName(context.schema, 'pix')} WHERE provider = $1 AND sandbox = $2) pix,
					(SELECT COUNT(*)::text AS checkout_count FROM ${tableName(context.schema, 'checkouts')} WHERE provider = $1 AND sandbox = $2) checkouts,
					(SELECT COUNT(*)::text AS invoice_count FROM ${tableName(context.schema, 'invoices')} WHERE provider = $1 AND sandbox = $2) invoices,
					(SELECT COUNT(*)::text AS subscription_count FROM ${tableName(context.schema, 'subscriptions')} WHERE provider = $1 AND sandbox = $2) subscriptions,
					(SELECT COUNT(*)::text AS webhook_count, COUNT(*) FILTER (WHERE status = 'failed')::text AS failed_webhook_count FROM ${tableName(context.schema, 'webhookEvents')} WHERE provider = $1 AND sandbox = $2) webhooks,
					(SELECT COUNT(*)::text AS product_count FROM ${tableName(context.schema, 'products')} WHERE provider = $1 AND sandbox = $2) products,
					(SELECT COUNT(*)::text AS price_count FROM ${tableName(context.schema, 'prices')} WHERE provider = $1 AND sandbox = $2) prices`,
				providerParams,
			),
		),
		listWebhooksData(context, 6),
		getProviderBalance(context.client),
	]);
	const counts = countsResult[0];

	return {
		balance,
		counts: {
			checkouts: toNumber(counts?.checkout_count),
			customers: toNumber(counts?.customer_count),
			failedWebhooks: toNumber(counts?.failed_webhook_count),
			invoices: toNumber(counts?.invoice_count),
			pix: toNumber(counts?.pix_count),
			prices: toNumber(counts?.price_count),
			products: toNumber(counts?.product_count),
			subscriptions: toNumber(counts?.subscription_count),
			webhooks: toNumber(counts?.webhook_count),
		},
		provider: {
			capabilities: context.client.capabilities,
			id: context.client.provider.id,
		},
		recentWebhooks,
	};
}

export async function listCustomersData(
	context: DashboardRequestContext,
	limit = 50,
) {
	const rows = await context.database.query<CustomerRow>(
		compileQuery(
			`SELECT provider, provider_id, external_id, name, email, phone, metadata, data, raw, created_at, updated_at
				, sandbox
				FROM ${tableName(context.schema, 'customers')}
				WHERE provider = $1 AND sandbox = $2 AND deleted_at IS NULL
				ORDER BY created_at DESC
				LIMIT $3`,
			[context.client.provider.id, context.client.isSandbox(), limit],
		),
	);

	return rows.map((row) => normalizeCustomerRow(row));
}

export async function getCustomerData(
	context: DashboardRequestContext,
	id: string,
) {
	const [row] = await context.database.query<CustomerRow>(
		compileQuery(
			`SELECT provider, provider_id, external_id, name, email, phone, metadata, data, raw, created_at, updated_at
				, sandbox
				FROM ${tableName(context.schema, 'customers')}
				WHERE provider = $1 AND sandbox = $2 AND provider_id = $3 AND deleted_at IS NULL
				LIMIT 1`,
			[context.client.provider.id, context.client.isSandbox(), id],
		),
	);
	if (!row) return null;

	const [actions, timeline] = await Promise.all([
		getActions(context.client, 'customer', row.provider_id),
		getAuditTrail(context, 'customer', row.provider_id),
	]);

	return {
		actions,
		resource: normalizeCustomerRow(row),
		timeline,
	};
}

export async function listPaymentsData(
	context: DashboardRequestContext,
	limit = 50,
) {
	const rows = await context.database.query<PaymentRow>(
		compileQuery(
			`SELECT *
				FROM (
					SELECT 'invoice'::text AS source, 1 AS source_order, provider, provider_id, sandbox, customer_provider_id, amount, currency, status, metadata, data, raw, NULL::text AS checkout_url, created_at, updated_at
					FROM ${tableName(context.schema, 'invoices')}
					WHERE provider = $1 AND sandbox = $2
					UNION ALL
					SELECT 'checkout'::text AS source, 2 AS source_order, provider, provider_id, sandbox, customer_provider_id, amount, currency, status, metadata, data, raw, checkout_url, created_at, updated_at
					FROM ${tableName(context.schema, 'checkouts')}
					WHERE provider = $1 AND sandbox = $2
				) payments
				ORDER BY created_at DESC, source_order ASC
				LIMIT $3`,
			[context.client.provider.id, context.client.isSandbox(), limit],
		),
	);

	return rows.map((row) => normalizePaymentRow(row));
}

export async function listPixData(
	context: DashboardRequestContext,
	limit = 50,
) {
	const rows = await context.database.query<PixRow>(
		compileQuery(
			`SELECT provider, provider_id, sandbox, customer_provider_id, amount, currency, status, method, copy_paste_code, qr_code_image_url_png, qr_code_image_url_svg, instructions_url, expires_at, metadata, data, raw, created_at, updated_at
				FROM ${tableName(context.schema, 'pix')}
				WHERE provider = $1 AND sandbox = $2
				ORDER BY created_at DESC
				LIMIT $3`,
			[context.client.provider.id, context.client.isSandbox(), limit],
		),
	);

	return rows.map((row) => normalizePixRow(row));
}

export async function getPaymentData(
	context: DashboardRequestContext,
	id: string,
) {
	const [row] = await context.database.query<PaymentRow>(
		compileQuery(
			`SELECT *
				FROM (
					SELECT 'invoice'::text AS source, 1 AS source_order, provider, provider_id, sandbox, customer_provider_id, amount, currency, status, metadata, data, raw, NULL::text AS checkout_url, created_at, updated_at
					FROM ${tableName(context.schema, 'invoices')}
					WHERE provider = $1 AND sandbox = $2 AND provider_id = $3
					UNION ALL
					SELECT 'checkout'::text AS source, 2 AS source_order, provider, provider_id, sandbox, customer_provider_id, amount, currency, status, metadata, data, raw, checkout_url, created_at, updated_at
					FROM ${tableName(context.schema, 'checkouts')}
					WHERE provider = $1 AND sandbox = $2 AND provider_id = $3
				) payments
				ORDER BY source_order ASC
				LIMIT 1`,
			[context.client.provider.id, context.client.isSandbox(), id],
		),
	);
	if (!row) return null;

	const [actions, timeline] = await Promise.all([
		getActions(context.client, 'payment', row.provider_id),
		getAuditTrail(context, 'payment', row.provider_id),
	]);

	return {
		actions,
		resource: normalizePaymentRow(row),
		timeline,
	};
}

export async function getPixData(context: DashboardRequestContext, id: string) {
	const [row] = await context.database.query<PixRow>(
		compileQuery(
			`SELECT provider, provider_id, sandbox, customer_provider_id, amount, currency, status, method, copy_paste_code, qr_code_image_url_png, qr_code_image_url_svg, instructions_url, expires_at, metadata, data, raw, created_at, updated_at
				FROM ${tableName(context.schema, 'pix')}
				WHERE provider = $1 AND sandbox = $2 AND provider_id = $3
				LIMIT 1`,
			[context.client.provider.id, context.client.isSandbox(), id],
		),
	);
	if (!row) return null;

	const [actions, timeline] = await Promise.all([
		getActions(context.client, 'pix', row.provider_id),
		getAuditTrail(context, 'pix', row.provider_id),
	]);

	return {
		actions,
		resource: normalizePixRow(row),
		timeline,
	};
}

export async function listSubscriptionsData(
	context: DashboardRequestContext,
	limit = 50,
) {
	const rows = await context.database.query<SubscriptionRow>(
		compileQuery(
			`SELECT provider, provider_id, sandbox, customer_provider_id, product_provider_id, price_provider_id, status, amount, currency, cancel_at_period_end, data, raw, created_at, updated_at
				FROM ${tableName(context.schema, 'subscriptions')}
				WHERE provider = $1 AND sandbox = $2
				ORDER BY created_at DESC
				LIMIT $3`,
			[context.client.provider.id, context.client.isSandbox(), limit],
		),
	);

	return rows.map((row) => normalizeSubscriptionRow(row));
}

export async function getSubscriptionData(
	context: DashboardRequestContext,
	id: string,
) {
	const [row] = await context.database.query<SubscriptionRow>(
		compileQuery(
			`SELECT provider, provider_id, sandbox, customer_provider_id, product_provider_id, price_provider_id, status, amount, currency, cancel_at_period_end, data, raw, created_at, updated_at
				FROM ${tableName(context.schema, 'subscriptions')}
				WHERE provider = $1 AND sandbox = $2 AND provider_id = $3
				LIMIT 1`,
			[context.client.provider.id, context.client.isSandbox(), id],
		),
	);
	if (!row) return null;

	const [actions, timeline] = await Promise.all([
		getActions(context.client, 'subscription', row.provider_id),
		getAuditTrail(context, 'subscription', row.provider_id),
	]);

	return {
		actions,
		resource: normalizeSubscriptionRow(row),
		timeline,
	};
}

export async function listWebhooksData(
	context: DashboardRequestContext,
	limit = 50,
) {
	const rows = await context.database.query<WebhookRow>(
		compileQuery(
			`SELECT provider, provider_id, event_type, status, attempts, last_error, data, raw, processed_at, created_at, updated_at
				, sandbox
				FROM ${tableName(context.schema, 'webhookEvents')}
				WHERE provider = $1 AND sandbox = $2
				ORDER BY created_at DESC
				LIMIT $3`,
			[context.client.provider.id, context.client.isSandbox(), limit],
		),
	);

	return rows.map((row) => normalizeWebhookRow(row));
}

export async function getWebhookData(
	context: DashboardRequestContext,
	id: string,
) {
	const [row] = await context.database.query<WebhookRow>(
		compileQuery(
			`SELECT provider, provider_id, event_type, status, attempts, last_error, data, raw, processed_at, created_at, updated_at
				, sandbox
				FROM ${tableName(context.schema, 'webhookEvents')}
				WHERE provider = $1 AND sandbox = $2 AND provider_id = $3
				LIMIT 1`,
			[context.client.provider.id, context.client.isSandbox(), id],
		),
	);
	if (!row) return null;

	const [actions, timeline] = await Promise.all([
		getActions(context.client, 'webhook', row.provider_id),
		getAuditTrail(context, 'webhook', row.provider_id),
	]);

	return {
		actions,
		resource: normalizeWebhookRow(row),
		timeline,
	};
}

export async function getProviderData(context: DashboardRequestContext) {
	const [countsResult, balance] = await Promise.all([
		context.database.query<{
			price_count: number | string;
			product_count: number | string;
		}>(
			compileQuery(
				`SELECT
					products.product_count,
					prices.price_count
				FROM
					(SELECT COUNT(*)::text AS product_count FROM ${tableName(context.schema, 'products')} WHERE provider = $1 AND sandbox = $2) products,
					(SELECT COUNT(*)::text AS price_count FROM ${tableName(context.schema, 'prices')} WHERE provider = $1 AND sandbox = $2) prices`,
				[context.client.provider.id, context.client.isSandbox()],
			),
		),
		getProviderBalance(context.client),
	]);
	const counts = countsResult[0];

	return {
		balance,
		capabilities: context.client.capabilities,
		catalog: {
			prices: toNumber(counts?.price_count),
			products: toNumber(counts?.product_count),
		},
		id: context.client.provider.id,
	};
}

export async function getDatabaseData(context: DashboardRequestContext) {
	const [counts] = await context.database.query<
		Record<string, number | string>
	>(
		compileQuery(
			`SELECT
				customers.customers,
				pix.pix,
				checkouts.checkouts,
				invoices.invoices,
				subscriptions.subscriptions,
				webhook_events.webhook_events,
				products.products,
				prices.prices,
				migrations.migrations
			FROM
				(SELECT COUNT(*)::text AS customers FROM ${tableName(context.schema, 'customers')} WHERE sandbox = $1) customers,
				(SELECT COUNT(*)::text AS pix FROM ${tableName(context.schema, 'pix')} WHERE sandbox = $1) pix,
				(SELECT COUNT(*)::text AS checkouts FROM ${tableName(context.schema, 'checkouts')} WHERE sandbox = $1) checkouts,
				(SELECT COUNT(*)::text AS invoices FROM ${tableName(context.schema, 'invoices')} WHERE sandbox = $1) invoices,
				(SELECT COUNT(*)::text AS subscriptions FROM ${tableName(context.schema, 'subscriptions')} WHERE sandbox = $1) subscriptions,
				(SELECT COUNT(*)::text AS webhook_events FROM ${tableName(context.schema, 'webhookEvents')} WHERE sandbox = $1) webhook_events,
				(SELECT COUNT(*)::text AS products FROM ${tableName(context.schema, 'products')} WHERE sandbox = $1) products,
				(SELECT COUNT(*)::text AS prices FROM ${tableName(context.schema, 'prices')} WHERE sandbox = $1) prices,
				(SELECT COUNT(*)::text AS migrations FROM ${tableName(context.schema, 'migrations')}) migrations`,
			[context.client.isSandbox()],
		),
	);

	return {
		counts: Object.fromEntries(
			Object.entries(counts ?? {}).map(([key, value]) => [
				key,
				toNumber(value),
			]),
		),
		customTables: Object.values(context.schema.customTables).map((table) => ({
			fields: Object.values(table.fields),
			id: table.id,
			name: table.name,
			pluginId: table.pluginId ?? null,
		})),
		persistRaw: context.database.persistRaw,
		schema: {
			prefix: context.schema.prefix,
			tables: Object.values(context.schema.tables).map((table) => ({
				fields: Object.values(table.fields),
				key: table.key,
				name: table.name,
			})),
		},
	};
}

export function getPluginsData(context: DashboardRequestContext) {
	return context.client.plugins.list().map((plugin) => ({
		customTables: plugin.customTables.map((table) => ({
			id: table.id,
			name: table.name,
		})),
		description: plugin.description ?? null,
		error:
			plugin.error instanceof Error
				? plugin.error.message
				: plugin.error
					? String(plugin.error)
					: null,
		eventHooks: plugin.eventHooks,
		id: plugin.id,
		name: plugin.name ?? null,
		routes: plugin.routes,
		status: plugin.status,
		version: plugin.version ?? null,
	}));
}

export async function createCustomer(
	context: DashboardRequestContext,
	body: {
		email?: string;
		externalId?: string;
		metadata?: Record<string, string | number | boolean | null>;
		name?: string;
		phone?: string;
	},
) {
	return context.client.customers.upsert(body);
}

export async function deleteCustomer(
	context: DashboardRequestContext,
	id: string,
) {
	return context.client.customers.delete(id);
}

export async function syncCustomer(
	context: DashboardRequestContext,
	id: string,
) {
	const customer = await context.client.provider.customers.get(id, {
		includeRaw: true,
	});
	await context.database.repositories.customers.upsert(
		context.schema,
		customer,
	);
	return customer;
}

export async function createPayment(
	context: DashboardRequestContext,
	body: {
		amount: number;
		cancelUrl?: string;
		currency: string;
		customer?: {
			email?: string;
			externalId?: string;
			id?: string;
			name?: string;
			phone?: string;
		};
		description?: string;
		metadata?: Record<string, string | number | boolean | null>;
		productIds?: string[];
		returnUrl?: string;
		successUrl?: string;
	},
) {
	return context.client.payments.create({
		...body,
		cancelUrl: context.resolveTrustedUrl(body.cancelUrl),
		returnUrl: context.resolveTrustedUrl(body.returnUrl),
		successUrl: context.resolveTrustedUrl(body.successUrl),
	});
}

export async function createPix(
	context: DashboardRequestContext,
	body: {
		amount: number;
		currency: string;
		customer?: {
			email?: string;
			externalId?: string;
			id?: string;
			name?: string;
			phone?: string;
		};
		description?: string;
		metadata?: Record<string, string | number | boolean | null>;
		pix?: {
			amountIncludesIof?: 'always' | 'never';
			expiresAfterSeconds?: number;
			expiresAt?: string;
		};
	},
) {
	return context.client.pix.create(body);
}

export async function syncPayment(
	context: DashboardRequestContext,
	id: string,
) {
	const adapter = context.client.provider.dashboard;
	if (!adapter?.syncPayment) {
		throw new PaymeshError({
			code: 'unsupported_capability',
			message: `Provider "${context.client.provider.id}" does not support payment sync from the dashboard.`,
			provider: context.client.provider.id,
			status: 501,
		});
	}

	return adapter.syncPayment({
		database: context.database,
		id,
		schema: context.schema,
	});
}

export async function syncPix(context: DashboardRequestContext, id: string) {
	const adapter = context.client.provider.dashboard;
	if (!adapter?.syncPix) {
		throw new PaymeshError({
			code: 'unsupported_capability',
			message: `Provider "${context.client.provider.id}" does not support PIX sync from the dashboard.`,
			provider: context.client.provider.id,
			status: 501,
		});
	}

	return adapter.syncPix({
		database: context.database,
		id,
		schema: context.schema,
	});
}

export async function syncSubscription(
	context: DashboardRequestContext,
	id: string,
) {
	const adapter = context.client.provider.dashboard;
	if (!adapter?.syncSubscription) {
		throw new PaymeshError({
			code: 'unsupported_capability',
			message: `Provider "${context.client.provider.id}" does not support subscription sync from the dashboard.`,
			provider: context.client.provider.id,
			status: 501,
		});
	}

	return adapter.syncSubscription({
		database: context.database,
		id,
		schema: context.schema,
	});
}

export async function retryWebhook(
	context: DashboardRequestContext,
	_id: string,
) {
	throw new PaymeshError({
		code: 'unsupported_capability',
		message: `Provider "${context.client.provider.id}" does not support webhook retries from the dashboard.`,
		provider: context.client.provider.id,
		status: 501,
	});
}

export async function writeAuditEntry(
	context: DashboardRouteContextShape,
	actor: DashActor,
	input: {
		action: string;
		error?: string;
		metadata?: Record<string, unknown> | null;
		outcome: 'success' | 'error';
		resourceId?: string | null;
		resourceType: 'customer' | 'payment' | 'pix' | 'subscription' | 'webhook';
	},
) {
	const params: SqlValue[] = [
		actor.id,
		actor.type ?? null,
		typeof actor.name === 'string' ? actor.name : null,
		typeof actor.email === 'string' ? actor.email : null,
		input.action,
		input.resourceType,
		input.resourceId ?? null,
		context.client.provider.id,
		input.outcome,
		input.metadata ?? null,
		input.error ?? null,
	];

	await context.database.execute(
		compileQuery(
			`INSERT INTO ${customTableName(context.schema, DASH_AUDIT_TABLE_ID)}
				(actor_id, actor_type, actor_name, actor_email, action, resource_type, resource_id, provider, outcome, metadata, error)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			params,
		),
	);
}

async function getAuditTrail(
	context: DashboardRequestContext,
	resourceType: 'customer' | 'payment' | 'pix' | 'subscription' | 'webhook',
	resourceId: string,
) {
	const rows = await context.database.query<AuditEntryRow>(
		compileQuery(
			`SELECT actor_id, actor_type, actor_name, actor_email, action, resource_type, resource_id, provider, outcome, metadata, error, created_at, updated_at
				FROM ${customTableName(context.schema, DASH_AUDIT_TABLE_ID)}
				WHERE provider = $1 AND resource_type = $2 AND resource_id = $3
				ORDER BY created_at DESC
				LIMIT 50`,
			[context.client.provider.id, resourceType, resourceId],
		),
	);

	return rows.map((row) => ({
		action: row.action,
		actor: {
			email: row.actor_email,
			id: row.actor_id,
			name: row.actor_name,
			type: row.actor_type,
		},
		createdAt: toIsoDate(row.created_at),
		error: row.error,
		metadata: row.metadata,
		outcome: row.outcome,
		resourceId: row.resource_id,
		resourceType: row.resource_type,
	}));
}

async function getActions(
	client: PaymeshClient<boolean>,
	type: 'customer' | 'payment' | 'pix' | 'subscription' | 'webhook',
	id: string,
) {
	const providerUrl = await client.provider.dashboard?.getResourceUrl?.({
		id,
		type,
	});
	let canSync = false;

	if (type === 'customer') canSync = true;
	if (type === 'payment')
		canSync = Boolean(client.provider.dashboard?.syncPayment);
	if (type === 'pix') canSync = Boolean(client.provider.dashboard?.syncPix);
	if (type === 'subscription') {
		canSync = Boolean(client.provider.dashboard?.syncSubscription);
	}

	return {
		canRetryWebhook: type === 'webhook' && false,
		canSync,
		openInProvider: providerUrl,
	};
}

async function getProviderBalance(client: PaymeshClient<boolean>) {
	return (await client.provider.dashboard?.getBalance?.()) ?? null;
}

function normalizeCustomerRow(row: CustomerRow) {
	return {
		createdAt: toIsoDate(row.created_at),
		email: row.email,
		externalId: row.external_id,
		id: row.provider_id,
		metadata: row.metadata,
		name: row.name,
		normalized: {
			...asRecord(row.data),
			email: row.email ?? undefined,
			externalId: row.external_id ?? undefined,
			id: row.provider_id,
			metadata: row.metadata ?? undefined,
			name: row.name ?? undefined,
			phone: row.phone ?? undefined,
			provider: row.provider,
			sandbox: row.sandbox,
		},
		phone: row.phone,
		provider: row.provider,
		raw: row.raw,
		sandbox: row.sandbox,
		updatedAt: toIsoDate(row.updated_at),
	};
}

function normalizePaymentRow(row: PaymentRow) {
	return {
		amount: toNumber(row.amount),
		checkoutUrl: row.checkout_url,
		createdAt: toIsoDate(row.created_at),
		currency: row.currency,
		customerId: row.customer_provider_id,
		id: row.provider_id,
		metadata: row.metadata,
		normalized: {
			...asRecord(row.data),
			amount: toNumber(row.amount),
			checkoutUrl: row.checkout_url ?? undefined,
			currency: row.currency ?? undefined,
			id: row.provider_id,
			metadata: row.metadata ?? undefined,
			provider: row.provider,
			sandbox: row.sandbox,
			status: row.status ?? undefined,
		},
		provider: row.provider,
		raw: row.raw,
		sandbox: row.sandbox,
		source: row.source,
		status: row.status,
		updatedAt: toIsoDate(row.updated_at),
	};
}

function normalizePixRow(row: PixRow) {
	return {
		amount: toNumber(row.amount),
		copyPasteCode: row.copy_paste_code,
		createdAt: toIsoDate(row.created_at),
		currency: row.currency,
		customerId: row.customer_provider_id,
		expiresAt: toIsoDate(row.expires_at),
		id: row.provider_id,
		instructionsUrl: row.instructions_url,
		metadata: row.metadata,
		method: row.method,
		normalized: {
			...asRecord(row.data),
			amount: toNumber(row.amount),
			copyPasteCode: row.copy_paste_code ?? undefined,
			currency: row.currency ?? undefined,
			customer:
				row.customer_provider_id != null
					? { id: row.customer_provider_id }
					: undefined,
			expiresAt: toIsoDate(row.expires_at) ?? undefined,
			id: row.provider_id,
			instructionsUrl: row.instructions_url ?? undefined,
			metadata: row.metadata ?? undefined,
			method: row.method ?? undefined,
			provider: row.provider,
			qrCodeImageUrlPng: row.qr_code_image_url_png ?? undefined,
			qrCodeImageUrlSvg: row.qr_code_image_url_svg ?? undefined,
			sandbox: row.sandbox,
			status: row.status ?? undefined,
		},
		provider: row.provider,
		qrCodeImageUrlPng: row.qr_code_image_url_png,
		qrCodeImageUrlSvg: row.qr_code_image_url_svg,
		raw: row.raw,
		sandbox: row.sandbox,
		status: row.status,
		updatedAt: toIsoDate(row.updated_at),
	};
}

function normalizeSubscriptionRow(row: SubscriptionRow) {
	return {
		amount: toNumber(row.amount),
		cancelAtPeriodEnd: row.cancel_at_period_end,
		createdAt: toIsoDate(row.created_at),
		currency: row.currency,
		customerId: row.customer_provider_id,
		id: row.provider_id,
		normalized: {
			...asRecord(row.data),
			amount: toNumber(row.amount),
			cancelAtPeriodEnd: row.cancel_at_period_end ?? undefined,
			currency: row.currency ?? undefined,
			id: row.provider_id,
			provider: row.provider,
			sandbox: row.sandbox,
			status: row.status ?? undefined,
		},
		priceId: row.price_provider_id,
		productId: row.product_provider_id,
		provider: row.provider,
		raw: row.raw,
		sandbox: row.sandbox,
		status: row.status,
		updatedAt: toIsoDate(row.updated_at),
	};
}

function normalizeWebhookRow(row: WebhookRow) {
	return {
		attempts: row.attempts,
		createdAt: toIsoDate(row.created_at),
		error: row.last_error,
		eventType: row.event_type,
		id: row.provider_id,
		normalized: row.data,
		processedAt: toIsoDate(row.processed_at),
		provider: row.provider,
		raw: row.raw,
		sandbox: row.sandbox,
		status: row.status,
		updatedAt: toIsoDate(row.updated_at),
	};
}

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

function toIsoDate(value: string | Date | null | undefined) {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : String(value);
}

function toNumber(value: string | number | null | undefined) {
	if (typeof value === 'number') return value;
	if (typeof value === 'string' && value.length > 0) return Number(value);
	return null;
}

interface CustomerRow extends DashboardRow {
	data: unknown;
	email: string | null;
	external_id: string | null;
	metadata: unknown;
	name: string | null;
	phone: string | null;
	provider: string;
	provider_id: string;
	raw: unknown;
	sandbox: boolean;
}

interface PaymentRow extends DashboardRow {
	amount: string | number | null;
	checkout_url: string | null;
	currency: string | null;
	customer_provider_id: string | null;
	data: unknown;
	metadata: unknown;
	provider: string;
	provider_id: string;
	raw: unknown;
	sandbox: boolean;
	source: 'invoice' | 'checkout';
	source_order: 1 | 2;
	status: string | null;
}

interface PixRow extends DashboardRow {
	amount: string | number | null;
	copy_paste_code: string | null;
	currency: string | null;
	customer_provider_id: string | null;
	data: unknown;
	expires_at: string | Date | null;
	instructions_url: string | null;
	metadata: unknown;
	method: string | null;
	provider: string;
	provider_id: string;
	qr_code_image_url_png: string | null;
	qr_code_image_url_svg: string | null;
	raw: unknown;
	sandbox: boolean;
	status: string | null;
}

interface SubscriptionRow extends DashboardRow {
	amount: string | number | null;
	cancel_at_period_end: boolean | null;
	currency: string | null;
	customer_provider_id: string | null;
	data: unknown;
	price_provider_id: string | null;
	product_provider_id: string | null;
	provider: string;
	provider_id: string;
	raw: unknown;
	sandbox: boolean;
	status: string | null;
}

interface WebhookRow extends DashboardRow {
	attempts: number;
	data: unknown;
	event_type: string;
	last_error: string | null;
	processed_at: string | Date | null;
	provider: string;
	provider_id: string;
	raw: unknown;
	sandbox: boolean;
	status: string;
}
