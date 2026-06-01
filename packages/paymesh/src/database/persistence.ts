import { getInternalRaw } from '../shared/raw';
import type {
	DatabaseTableKey,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
	SqlValue,
} from '../types/database';
import type {
	BaseCustomer,
	BaseCustomerDeleteResult,
	BasePayment,
	BasePaymeshEvent,
} from '../types/providers';

export async function upsertCustomer(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	customer: BaseCustomer | BaseCustomerDeleteResult,
	deleted = false,
) {
	const row = {
		provider: customer.provider,
		provider_id: customer.id,
		version: getVersion(customer, getInternalRaw(customer)),
		external_id:
			'externalId' in customer ? (customer.externalId ?? null) : null,
		name: 'name' in customer ? (customer.name ?? null) : null,
		email: 'email' in customer ? (customer.email ?? null) : null,
		phone: 'phone' in customer ? (customer.phone ?? null) : null,
		metadata: 'metadata' in customer ? (customer.metadata ?? null) : null,
		data: customer,
		raw: getPersistableRaw(database, customer),
		deleted_at: deleted ? new Date().toISOString() : null,
		updated_at: new Date().toISOString(),
	};

	await upsertByProviderId(database, schema, 'customers', row, [
		'external_id',
		'name',
		'email',
		'phone',
		'metadata',
		'data',
		'raw',
		'deleted_at',
		'updated_at',
		'version',
	]);
}

export async function upsertCheckout(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	payment: BasePayment,
) {
	const row = {
		provider: payment.provider,
		provider_id: payment.id,
		version: getVersion(payment, getInternalRaw(payment)),
		customer_provider_id: payment.customer?.id ?? null,
		amount: payment.amount,
		currency: payment.currency,
		status: payment.status,
		checkout_url: payment.checkoutUrl ?? null,
		metadata: payment.metadata ?? null,
		data: payment,
		raw: getPersistableRaw(database, payment),
		updated_at: new Date().toISOString(),
	};

	await upsertByProviderId(database, schema, 'checkouts', row, [
		'customer_provider_id',
		'amount',
		'currency',
		'status',
		'checkout_url',
		'metadata',
		'data',
		'raw',
		'updated_at',
		'version',
	]);
}

export async function upsertInvoice(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	payment: BasePayment,
) {
	const row = {
		provider: payment.provider,
		provider_id: payment.id,
		version: getVersion(payment, getInternalRaw(payment)),
		customer_provider_id: payment.customer?.id ?? null,
		checkout_provider_id: payment.checkoutUrl ? payment.id : null,
		subscription_provider_id: null,
		amount: payment.amount,
		currency: payment.currency,
		status: payment.status,
		metadata: payment.metadata ?? null,
		data: payment,
		raw: getPersistableRaw(database, payment),
		updated_at: new Date().toISOString(),
	};

	await upsertByProviderId(database, schema, 'invoices', row, [
		'customer_provider_id',
		'checkout_provider_id',
		'subscription_provider_id',
		'amount',
		'currency',
		'status',
		'metadata',
		'data',
		'raw',
		'updated_at',
		'version',
	]);
}

export async function upsertSubscription(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	event: BasePaymeshEvent<unknown>,
) {
	const data = asRecord(event.data);
	const row = {
		provider: event.provider,
		provider_id:
			typeof data.id === 'string' && data.id.length > 0 ? data.id : event.id,
		version: getVersion(data, getInternalRaw(event.data)),
		customer_provider_id:
			typeof data.customer_id === 'string' ? data.customer_id : null,
		product_provider_id:
			typeof data.product_id === 'string' ? data.product_id : null,
		price_provider_id: typeof data.price_id === 'string' ? data.price_id : null,
		status:
			event.type === 'subscription.canceled'
				? 'canceled'
				: typeof data.status === 'string'
					? data.status
					: 'active',
		amount: typeof data.amount === 'number' ? data.amount : null,
		currency: typeof data.currency === 'string' ? data.currency : null,
		cancel_at_period_end:
			typeof data.cancel_at_period_end === 'boolean'
				? data.cancel_at_period_end
				: null,
		data,
		raw: getPersistableRaw(database, event.data),
		updated_at: new Date().toISOString(),
	};

	await upsertByProviderId(database, schema, 'subscriptions', row, [
		'customer_provider_id',
		'product_provider_id',
		'price_provider_id',
		'status',
		'amount',
		'currency',
		'cancel_at_period_end',
		'data',
		'raw',
		'updated_at',
		'version',
	]);
}

export async function upsertByProviderId(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	tableKey: DatabaseTableKey,
	row: Record<string, SqlValue>,
	updateColumns: string[],
) {
	const entries = Object.entries(row);
	const columns = entries.map(([key]) => quoteIdentifier(key));
	const params = entries.map(([, value]) => value);
	const placeholders = params.map((_, index) => `$${index + 1}`);
	const updates = updateColumns.map(
		(column) =>
			`${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`,
	);

	await database.execute({
		sql: `INSERT INTO ${tableName(schema, tableKey)} (${columns.join(', ')})
		 VALUES (${placeholders.join(', ')})
		 ON CONFLICT (provider, provider_id) DO UPDATE SET ${updates.join(', ')}`,
		params,
	});
}

export function getPersistableRaw(
	database:
		| Pick<PaymeshDatabaseDriver, 'persistRaw'>
		| Pick<PaymeshDatabaseDriver, 'execute' | 'query' | 'transaction'>,
	value: unknown,
) {
	if (!('persistRaw' in database) || !database.persistRaw) return null;

	return getInternalRaw(value);
}

export function getVersion(value: unknown, raw: unknown) {
	const candidates = [value, raw];

	for (const candidate of candidates) {
		const record = asRecord(candidate);
		const directVersion = record.version;
		if (typeof directVersion === 'string' && directVersion.length > 0) {
			return directVersion;
		}

		const metadata = asRecord(record.metadata);
		if (typeof metadata.version === 'string' && metadata.version.length > 0) {
			return metadata.version;
		}
	}

	return 'v1';
}

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: {};
}

function tableName(schema: ResolvedDatabaseSchema, key: DatabaseTableKey) {
	return quoteIdentifier(schema.tables[key].name);
}

function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}
