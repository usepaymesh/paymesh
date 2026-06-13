import type { BasePaymeshEvent, ResolvedDatabaseSchema } from 'paymesh';
import { PaymeshError } from 'paymesh';
import { getInternalRaw } from './shared/raw';
import {
	applyTableFieldDefaults,
	cloneValue,
	stripTableFieldKeys,
	validateRequiredTableFields,
} from './shared/schema';
import type {
	MemoryDatabaseSeed,
	MemorySeedCoupon,
	MemorySeedCustomer,
	MemorySeedPayment,
	MemorySeedPix,
	MemorySeedPrice,
	MemorySeedProduct,
	MemorySeedSubscription,
	MemorySeedWebhookEvent,
} from './types';

/** Mutable reference wrapper that enables transactional state swapping. */
export interface StateRef {
	/** The current in-memory database state. */
	current: MemoryDatabaseState;
}

/** Shape of a customer record as stored in the in-memory database. */
export interface StoredCustomer extends Record<string, unknown> {
	/** Unique customer identifier assigned by the provider. */
	id: string;
	/** Provider identifier that owns this customer. */
	provider: string;
	/** Whether this record belongs to the sandbox environment. */
	sandbox: boolean;
	/** ISO-8601 creation timestamp. */
	createdAt: string;
	/** ISO-8601 last update timestamp. */
	updatedAt: string;
	/** ISO-8601 soft-deletion timestamp, or `null` if active. */
	deletedAt: string | null;
	/** Persisted raw provider payload, or `null` when `persistRaw` is disabled. */
	raw: unknown;
}

/** Shape of a coupon record as stored in the in-memory database. */
export interface StoredCoupon extends Record<string, unknown> {
	/** Unique coupon identifier assigned by the provider. */
	id: string;
	/** Provider identifier that owns this coupon. */
	provider: string;
	/** Whether this record belongs to the sandbox environment. */
	sandbox: boolean;
	/** Coupon code shown to end users. */
	code: string;
	/** ISO-8601 creation timestamp. */
	createdAt: string;
	/** ISO-8601 last update timestamp. */
	updatedAt: string;
	/** ISO-8601 soft-deletion timestamp, or `null` if active. */
	deletedAt: string | null;
	/** Persisted raw provider payload, or `null` when `persistRaw` is disabled. */
	raw: unknown;
}

/** Shape of a payment record (pix, checkout, or invoice) as stored in memory. */
export interface StoredPayment extends Record<string, unknown> {
	/** Unique payment identifier assigned by the provider. */
	id: string;
	/** Provider identifier that owns this payment. */
	provider: string;
	/** Whether this record belongs to the sandbox environment. */
	sandbox: boolean;
	/** Payment amount in the smallest currency unit. */
	amount: number;
	/** ISO-4217 currency code. */
	currency: string;
	/** Normalized payment status. */
	status: string;
	/** ISO-8601 creation timestamp. */
	createdAt: string;
	/** ISO-8601 last update timestamp. */
	updatedAt: string;
	/** Persisted raw provider payload, or `null` when `persistRaw` is disabled. */
	raw: unknown;
}

/** Shape of a subscription event record as stored in memory. */
export interface StoredSubscription extends Record<string, unknown> {
	/** Provider-assigned subscription identifier. */
	id: string;
	/** Provider identifier that owns this subscription. */
	provider: string;
	/** Whether this record belongs to the sandbox environment. */
	sandbox: boolean;
	/** Unique event identifier from the provider. */
	eventId: string;
	/** Event type (e.g. `subscription.created`, `subscription.canceled`). */
	type: string;
	/** Normalized subscription status. */
	status: string;
	/** ISO-8601 creation timestamp. */
	createdAt: string;
	/** ISO-8601 last update timestamp. */
	updatedAt: string;
	/** Persisted raw provider payload, or `null` when `persistRaw` is disabled. */
	raw: unknown;
}

/** Shape of a webhook delivery event record as stored in memory. */
export interface StoredWebhookEvent extends Record<string, unknown> {
	/** Unique delivery identifier used as the idempotency key. */
	deliveryId: string;
	/** Provider identifier that owns this event. */
	provider: string;
	/** Whether this record belongs to the sandbox environment. */
	sandbox: boolean;
	/** Webhook event type (e.g. `payment.paid`). */
	type: string;
	/** Current processing status of the delivery. */
	status: 'processing' | 'processed' | 'failed';
	/** Number of delivery attempts made so far. */
	attempts: number;
	/** ISO-8601 creation timestamp. */
	createdAt: string;
	/** ISO-8601 last update timestamp. */
	updatedAt: string;
	/** ISO-8601 timestamp of successful processing, or `null` if not yet processed. */
	processedAt: string | null;
	/** Error message from the last failed attempt, or `null` if no error. */
	lastError: string | null;
	/** Persisted raw provider payload, or `null` when `persistRaw` is disabled. */
	raw: unknown;
}

/** Shape of a catalog record (product or price) as stored in memory. */
export interface StoredCatalogRecord extends Record<string, unknown> {
	/** Unique catalog record identifier assigned by the provider. */
	id: string;
	/** Provider identifier that owns this catalog record. */
	provider: string;
	/** Whether this record belongs to the sandbox environment. */
	sandbox: boolean;
	/** ISO-8601 creation timestamp. */
	createdAt: string;
	/** ISO-8601 last update timestamp. */
	updatedAt: string;
	/** Persisted raw provider payload, or `null` when `persistRaw` is disabled. */
	raw: unknown;
}

/**
 * Complete in-memory database state.
 *
 * Each entity collection is stored in a `Map` keyed by a composite
 * `"provider:sandbox:id"` string. Migrations are tracked in a `Set`.
 */
export interface MemoryDatabaseState {
	/** Customer records indexed by composite entity key. */
	customers: Map<string, StoredCustomer>;
	/** Coupon records indexed by composite entity key. */
	coupons: Map<string, StoredCoupon>;
	/** Pix payment records indexed by composite entity key. */
	pix: Map<string, StoredPayment>;
	/** Checkout payment records indexed by composite entity key. */
	checkouts: Map<string, StoredPayment>;
	/** Invoice payment records indexed by composite entity key. */
	invoices: Map<string, StoredPayment>;
	/** Subscription event records indexed by composite entity key. */
	subscriptions: Map<string, StoredSubscription>;
	/** Webhook delivery event records indexed by composite entity key. */
	webhookEvents: Map<string, StoredWebhookEvent>;
	/** Catalog product records indexed by composite entity key. */
	products: Map<string, StoredCatalogRecord>;
	/** Catalog price records indexed by composite entity key. */
	prices: Map<string, StoredCatalogRecord>;
	/** Set of applied migration names. */
	migrations: Set<string>;
}

/** Creates a fresh, empty in-memory database state with all collections cleared. */
export function createEmptyState(): MemoryDatabaseState {
	return {
		customers: new Map(),
		coupons: new Map(),
		pix: new Map(),
		checkouts: new Map(),
		invoices: new Map(),
		subscriptions: new Map(),
		webhookEvents: new Map(),
		products: new Map(),
		prices: new Map(),
		migrations: new Set(),
	};
}

/**
 * Deep-clones an existing database state for transactional isolation.
 *
 * Each map entry is cloned via `structuredClone` so mutations inside a
 * transaction do not affect the original state.
 */
export function cloneState(state: MemoryDatabaseState): MemoryDatabaseState {
	return {
		customers: cloneMap(state.customers),
		coupons: cloneMap(state.coupons),
		pix: cloneMap(state.pix),
		checkouts: cloneMap(state.checkouts),
		invoices: cloneMap(state.invoices),
		subscriptions: cloneMap(state.subscriptions),
		webhookEvents: cloneMap(state.webhookEvents),
		products: cloneMap(state.products),
		prices: cloneMap(state.prices),
		migrations: new Set(state.migrations),
	};
}

function cloneMap<T>(map: Map<string, T>) {
	return new Map(
		[...map.entries()].map(([key, value]) => [key, cloneValue(value)]),
	);
}

/**
 * Builds a composite string key from provider, sandbox flag, and entity id.
 *
 * The key format is `"provider:sandbox:id"` and is used as the Map key
 * for all in-memory entity lookups.
 */
export function entityKey(provider: string, sandbox: boolean, id: string) {
	return `${provider}:${String(sandbox)}:${id}`;
}

/**
 * Throws a `PaymeshError` if the provided value is not a non-empty string.
 */
export function validateRequiredString(
	value: unknown,
	label: string,
	tableName: string,
) {
	if (typeof value !== 'string' || value.length === 0) {
		throw new PaymeshError({
			code: 'database_error',
			message: `Missing required field "${label}" for table "${tableName}".`,
		});
	}
}

/**
 * Throws a `PaymeshError` if the provided value is not a boolean.
 */
export function validateRequiredBoolean(
	value: unknown,
	label: string,
	tableName: string,
) {
	if (typeof value !== 'boolean') {
		throw new PaymeshError({
			code: 'database_error',
			message: `Missing required field "${label}" for table "${tableName}".`,
		});
	}
}

/**
 * Throws a `PaymeshError` if the provided value is not a non-NaN number.
 */
export function validateRequiredNumber(
	value: unknown,
	label: string,
	tableName: string,
) {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		throw new PaymeshError({
			code: 'database_error',
			message: `Missing required field "${label}" for table "${tableName}".`,
		});
	}
}

/**
 * Throws a `PaymeshError` on duplicate insert when strict mode is enabled
 * and the record already exists.
 */
export function validateUniqueInsert(
	strict: boolean,
	exists: boolean,
	tableName: string,
	id: string,
) {
	if (!strict || !exists) return;

	throw new PaymeshError({
		code: 'database_error',
		message: `Duplicate unique id "${id}" for table "${tableName}".`,
	});
}

/**
 * In strict mode, throws a `PaymeshError` if the referenced customer
 * does not exist or has been soft-deleted.
 */
export function ensureCustomerExists(
	state: MemoryDatabaseState,
	strict: boolean,
	schema: ResolvedDatabaseSchema,
	provider: string,
	sandbox: boolean,
	id: string,
) {
	if (!strict) return;

	const customer = state.customers.get(entityKey(provider, sandbox, id));
	if (!customer || customer.deletedAt) {
		throw new PaymeshError({
			code: 'database_error',
			message: `Related customer "${id}" does not exist in table "${schema.tables.customers.name}".`,
		});
	}
}

/**
 * In strict mode, throws a `PaymeshError` if the referenced product
 * does not exist in the in-memory catalog.
 */
export function ensureProductExists(
	state: MemoryDatabaseState,
	strict: boolean,
	schema: ResolvedDatabaseSchema,
	provider: string,
	sandbox: boolean,
	id: string,
) {
	if (!strict) return;

	if (!state.products.has(entityKey(provider, sandbox, id))) {
		throw new PaymeshError({
			code: 'database_error',
			message: `Related product "${id}" does not exist in table "${schema.tables.products.name}".`,
		});
	}
}

/**
 * In strict mode, throws a `PaymeshError` if the referenced price
 * does not exist in the in-memory catalog.
 */
export function ensurePriceExists(
	state: MemoryDatabaseState,
	strict: boolean,
	schema: ResolvedDatabaseSchema,
	provider: string,
	sandbox: boolean,
	id: string,
) {
	if (!strict) return;

	if (!state.prices.has(entityKey(provider, sandbox, id))) {
		throw new PaymeshError({
			code: 'database_error',
			message: `Related price "${id}" does not exist in table "${schema.tables.prices.name}".`,
		});
	}
}

/**
 * Populates a database state from a seed configuration object.
 *
 * Inserts all entity types (customers, products, prices, pix, checkouts,
 * invoices, subscriptions, webhook events, migrations) with full validation.
 * Skipped silently when `seed` is `undefined`.
 */
export function applySeed(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	seed: MemoryDatabaseSeed | undefined,
	strict: boolean,
	persistRaw: boolean,
) {
	if (!seed) return;

	for (const customer of seed.customers ?? []) {
		insertSeedCustomer(state, schema, customer, strict, persistRaw);
	}

	for (const coupon of seed.coupons ?? []) {
		insertSeedCoupon(state, schema, coupon, strict, persistRaw);
	}

	for (const product of seed.products ?? []) {
		insertSeedProduct(state, schema, product, strict, persistRaw);
	}

	for (const price of seed.prices ?? []) {
		insertSeedPrice(state, schema, price, strict, persistRaw);
	}

	for (const pix of seed.pix ?? []) {
		insertSeedPayment(state, schema, 'pix', pix, strict, persistRaw);
	}

	for (const checkout of seed.checkouts ?? []) {
		insertSeedPayment(state, schema, 'checkouts', checkout, strict, persistRaw);
	}

	for (const invoice of seed.invoices ?? []) {
		insertSeedPayment(state, schema, 'invoices', invoice, strict, persistRaw);
	}

	for (const subscription of seed.subscriptions ?? []) {
		insertSeedSubscription(state, schema, subscription, strict, persistRaw);
	}

	for (const event of seed.webhookEvents ?? []) {
		insertSeedWebhookEvent(state, event, strict, persistRaw);
	}

	for (const name of seed.migrations ?? []) {
		validateRequiredString(name, 'name', schema.tables.migrations.name);
		validateUniqueInsert(
			strict,
			state.migrations.has(name),
			schema.tables.migrations.name,
			name,
		);
		state.migrations.add(name);
	}
}

function insertSeedCustomer(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	customer: MemorySeedCustomer,
	strict: boolean,
	persistRaw: boolean,
) {
	validateRequiredString(customer.id, 'id', schema.tables.customers.name);
	validateRequiredString(
		customer.provider,
		'provider',
		schema.tables.customers.name,
	);
	validateRequiredBoolean(
		customer.sandbox,
		'sandbox',
		schema.tables.customers.name,
	);

	const next = applyTableFieldDefaults(
		schema.tables.customers,
		customer as unknown as Record<string, unknown>,
	);
	validateRequiredTableFields(schema, 'customers', next);
	const customerRecord = next as Record<string, unknown>;

	const key = entityKey(
		customerRecord.provider as string,
		customerRecord.sandbox as boolean,
		customerRecord.id as string,
	);
	validateUniqueInsert(
		strict,
		state.customers.has(key),
		schema.tables.customers.name,
		customerRecord.id as string,
	);
	const now =
		typeof customerRecord.createdAt === 'string'
			? customerRecord.createdAt
			: new Date().toISOString();
	state.customers.set(key, {
		...stripTableFieldKeys(customerRecord, schema, 'customers'),
		...customerRecord,
		createdAt: now,
		updatedAt:
			typeof customerRecord.updatedAt === 'string'
				? customerRecord.updatedAt
				: now,
		deletedAt: customerRecord.deleted ? now : null,
		raw: persistRaw
			? (customerRecord.raw ?? getInternalRaw(customerRecord) ?? null)
			: null,
	} as never);
}

function insertSeedCoupon(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	coupon: MemorySeedCoupon,
	strict: boolean,
	persistRaw: boolean,
) {
	validateRequiredString(coupon.id, 'id', schema.tables.coupons.name);
	validateRequiredString(
		coupon.provider,
		'provider',
		schema.tables.coupons.name,
	);
	validateRequiredBoolean(
		coupon.sandbox,
		'sandbox',
		schema.tables.coupons.name,
	);
	validateRequiredString(coupon.code, 'code', schema.tables.coupons.name);

	const next = applyTableFieldDefaults(
		schema.tables.coupons,
		coupon as unknown as Record<string, unknown>,
	);
	validateRequiredTableFields(schema, 'coupons', next);
	const couponRecord = next as Record<string, unknown>;

	const key = entityKey(
		couponRecord.provider as string,
		couponRecord.sandbox as boolean,
		couponRecord.id as string,
	);
	validateUniqueInsert(
		strict,
		state.coupons.has(key),
		schema.tables.coupons.name,
		couponRecord.id as string,
	);
	const now =
		typeof couponRecord.createdAt === 'string'
			? couponRecord.createdAt
			: new Date().toISOString();
	state.coupons.set(key, {
		...stripTableFieldKeys(couponRecord, schema, 'coupons'),
		...couponRecord,
		createdAt: now,
		updatedAt:
			typeof couponRecord.updatedAt === 'string' ? couponRecord.updatedAt : now,
		deletedAt: couponRecord.deleted ? now : null,
		raw: persistRaw
			? (couponRecord.raw ?? getInternalRaw(couponRecord) ?? null)
			: null,
	} as never);
}

function insertSeedPayment(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	tableKey: 'pix' | 'checkouts' | 'invoices',
	payment: MemorySeedPix | MemorySeedPayment,
	strict: boolean,
	persistRaw: boolean,
) {
	validateRequiredString(payment.id, 'id', schema.tables[tableKey].name);
	validateRequiredString(
		payment.provider,
		'provider',
		schema.tables[tableKey].name,
	);
	validateRequiredBoolean(
		payment.sandbox,
		'sandbox',
		schema.tables[tableKey].name,
	);
	validateRequiredNumber(
		payment.amount,
		'amount',
		schema.tables[tableKey].name,
	);
	validateRequiredString(
		payment.currency,
		'currency',
		schema.tables[tableKey].name,
	);
	validateRequiredString(
		payment.status,
		'status',
		schema.tables[tableKey].name,
	);

	const next = applyTableFieldDefaults(
		schema.tables[tableKey],
		payment as unknown as Record<string, unknown>,
	);
	validateRequiredTableFields(schema, tableKey, next);
	const paymentRecord = next as Record<string, unknown>;

	if (
		paymentRecord.customer &&
		typeof paymentRecord.customer === 'object' &&
		'id' in paymentRecord.customer
	) {
		const customerId = (paymentRecord.customer as { id?: unknown }).id;
		if (typeof customerId === 'string' && customerId.length > 0) {
			ensureCustomerExists(
				state,
				strict,
				schema,
				paymentRecord.provider as string,
				paymentRecord.sandbox as boolean,
				customerId,
			);
		}
	}

	const key = entityKey(
		paymentRecord.provider as string,
		paymentRecord.sandbox as boolean,
		paymentRecord.id as string,
	);
	validateUniqueInsert(
		strict,
		state[tableKey].has(key),
		schema.tables[tableKey].name,
		paymentRecord.id as string,
	);

	const now =
		typeof paymentRecord.createdAt === 'string'
			? paymentRecord.createdAt
			: new Date().toISOString();
	state[tableKey].set(key, {
		...stripTableFieldKeys(paymentRecord, schema, tableKey),
		...paymentRecord,
		createdAt: now,
		updatedAt:
			typeof paymentRecord.updatedAt === 'string'
				? paymentRecord.updatedAt
				: now,
		raw: persistRaw
			? (paymentRecord.raw ?? getInternalRaw(paymentRecord) ?? null)
			: null,
	} as never);
}

function insertSeedSubscription(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	event: MemorySeedSubscription,
	strict: boolean,
	persistRaw: boolean,
) {
	validateSubscriptionReferences(state, schema, event, strict);
	const data = asEventRecord(event.data);
	const providerId =
		typeof data.id === 'string' && data.id.length > 0 ? data.id : event.id;

	validateRequiredString(
		providerId,
		'provider_id',
		schema.tables.subscriptions.name,
	);
	validateRequiredString(
		event.provider,
		'provider',
		schema.tables.subscriptions.name,
	);
	validateRequiredBoolean(
		event.sandbox,
		'sandbox',
		schema.tables.subscriptions.name,
	);
	validateRequiredString(event.type, 'type', schema.tables.subscriptions.name);

	const key = entityKey(event.provider, event.sandbox, providerId);
	validateUniqueInsert(
		strict,
		state.subscriptions.has(key),
		schema.tables.subscriptions.name,
		providerId,
	);

	const now = event.createdAt ?? new Date().toISOString();
	state.subscriptions.set(key, {
		id: providerId,
		provider: event.provider,
		sandbox: event.sandbox,
		eventId: event.id,
		type: event.type,
		status:
			event.type === 'subscription.canceled'
				? 'canceled'
				: typeof data.status === 'string'
					? data.status
					: 'active',
		createdAt: now,
		updatedAt: event.updatedAt ?? now,
		data: cloneValue(data),
		raw: persistRaw ? (event.raw ?? getInternalRaw(event) ?? null) : null,
	});
}

function insertSeedWebhookEvent(
	state: MemoryDatabaseState,
	event: MemorySeedWebhookEvent,
	strict: boolean,
	persistRaw: boolean,
) {
	validateRequiredString(event.deliveryId, 'deliveryId', 'webhookEvents');
	validateRequiredString(event.provider, 'provider', 'webhookEvents');
	validateRequiredBoolean(event.sandbox, 'sandbox', 'webhookEvents');
	validateRequiredString(event.type, 'type', 'webhookEvents');

	const key = entityKey(event.provider, event.sandbox, event.deliveryId);
	validateUniqueInsert(
		strict,
		state.webhookEvents.has(key),
		'webhookEvents',
		event.deliveryId,
	);
	const now = event.createdAt ?? new Date().toISOString();
	state.webhookEvents.set(key, {
		deliveryId: event.deliveryId,
		provider: event.provider,
		sandbox: event.sandbox,
		type: event.type,
		status: event.status ?? 'processing',
		attempts: event.attempts ?? 1,
		createdAt: now,
		updatedAt: event.updatedAt ?? now,
		processedAt: event.processedAt ?? null,
		lastError: event.lastError ?? null,
		data: cloneValue(event.data),
		raw: persistRaw ? (event.raw ?? getInternalRaw(event) ?? null) : null,
	});
}

function insertSeedProduct(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	product: MemorySeedProduct,
	strict: boolean,
	persistRaw: boolean,
) {
	validateRequiredString(product.id, 'id', schema.tables.products.name);
	validateRequiredString(
		product.provider,
		'provider',
		schema.tables.products.name,
	);
	validateRequiredBoolean(
		product.sandbox,
		'sandbox',
		schema.tables.products.name,
	);

	const key = entityKey(product.provider, product.sandbox, product.id);
	validateUniqueInsert(
		strict,
		state.products.has(key),
		schema.tables.products.name,
		product.id,
	);
	const now = product.createdAt ?? new Date().toISOString();
	state.products.set(key, {
		...product,
		createdAt: now,
		updatedAt: product.updatedAt ?? now,
		raw: persistRaw ? (product.raw ?? null) : null,
	});
}

function insertSeedPrice(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	price: MemorySeedPrice,
	strict: boolean,
	persistRaw: boolean,
) {
	validateRequiredString(price.id, 'id', schema.tables.prices.name);
	validateRequiredString(price.provider, 'provider', schema.tables.prices.name);
	validateRequiredBoolean(price.sandbox, 'sandbox', schema.tables.prices.name);

	if (typeof price.productId === 'string' && price.productId.length > 0) {
		ensureProductExists(
			state,
			strict,
			schema,
			price.provider,
			price.sandbox,
			price.productId,
		);
	}

	const key = entityKey(price.provider, price.sandbox, price.id);
	validateUniqueInsert(
		strict,
		state.prices.has(key),
		schema.tables.prices.name,
		price.id,
	);
	const now = price.createdAt ?? new Date().toISOString();
	state.prices.set(key, {
		...price,
		createdAt: now,
		updatedAt: price.updatedAt ?? now,
		raw: persistRaw ? (price.raw ?? null) : null,
	});
}

/**
 * In strict mode, validates that the `customer_id`, `product_id`, and `price_id`
 * referenced by a subscription event exist in the current state.
 */
export function validateSubscriptionReferences(
	state: MemoryDatabaseState,
	schema: ResolvedDatabaseSchema,
	event: BasePaymeshEvent<unknown>,
	strict: boolean,
) {
	const data = asEventRecord(event.data);

	if (typeof data.customer_id === 'string' && data.customer_id.length > 0) {
		ensureCustomerExists(
			state,
			strict,
			schema,
			event.provider,
			event.sandbox,
			data.customer_id,
		);
	}

	if (typeof data.product_id === 'string' && data.product_id.length > 0) {
		ensureProductExists(
			state,
			strict,
			schema,
			event.provider,
			event.sandbox,
			data.product_id,
		);
	}

	if (typeof data.price_id === 'string' && data.price_id.length > 0) {
		ensurePriceExists(
			state,
			strict,
			schema,
			event.provider,
			event.sandbox,
			data.price_id,
		);
	}
}

function asEventRecord(value: unknown) {
	return typeof value === 'object' && value !== null
		? (cloneValue(value) as Record<string, unknown>)
		: {};
}
