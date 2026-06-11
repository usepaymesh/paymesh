import type {
	BaseAnyPayment,
	BasePix,
	PaymeshDatabaseRepositories,
	PaymeshRepositoryReadOptions,
	ResolvedDatabaseSchema,
} from 'paymesh';
import { PaymeshError, withRaw } from 'paymesh';
import { decodeCustomerCursor, encodeCustomerCursor } from './shared/cursor';
import {
	asRecord,
	getPersistableCatalogRaw,
	getPersistableRaw,
	getVersion,
	withoutRaw,
} from './shared/raw';
import {
	applyTableFieldDefaults,
	cloneValue,
	stripTableFieldKeys,
	validateRequiredTableFields,
} from './shared/schema';
import {
	ensureCustomerExists,
	ensureProductExists,
	entityKey,
	type MemoryDatabaseState,
	validateRequiredBoolean,
	validateRequiredNumber,
	validateRequiredString,
	validateSubscriptionReferences,
} from './state';

/** Internal options passed to repository implementations. */
interface RepositoryOptions {
	/** Returns the current in-memory database state. */
	getState(): MemoryDatabaseState;
	/** Whether to persist raw provider payloads. */
	persistRaw: boolean;
	/** Whether strict validation is enabled. */
	strict: boolean;
}

/**
 * Builds the full set of in-memory repository implementations.
 *
 * Returns a `PaymeshDatabaseRepositories` object with methods for customers,
 * pix, checkouts, invoices, subscriptions, webhook events, products, prices,
 * and migrations -- all backed by `Map`/`Set` structures.
 */
export function createRepositories(
	options: RepositoryOptions,
): PaymeshDatabaseRepositories {
	return {
		customers: {
			async findByProviderId(_schema, provider, sandbox, id, readOptions) {
				const customer = options
					.getState()
					.customers.get(entityKey(provider, sandbox, id));
				if (!customer || customer.deletedAt) return null;

				return mapStoredCustomer(customer, readOptions);
			},
			async findByEmail(_schema, provider, sandbox, email, readOptions) {
				const customer = [...options.getState().customers.values()].find(
					(row) =>
						row.provider === provider &&
						row.sandbox === sandbox &&
						row.deletedAt === null &&
						row.email === email,
				);
				if (!customer) return null;

				return mapStoredCustomer(customer, readOptions);
			},
			async findByExternalId(
				_schema,
				provider,
				sandbox,
				externalId,
				readOptions,
			) {
				const customer = [...options.getState().customers.values()].find(
					(row) =>
						row.provider === provider &&
						row.sandbox === sandbox &&
						row.deletedAt === null &&
						row.externalId === externalId,
				);
				if (!customer) return null;

				return mapStoredCustomer(customer, readOptions);
			},
			async upsert(schema, customer) {
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

				const prepared = applyTableFieldDefaults(
					schema.tables.customers,
					customer as Record<string, unknown>,
				);
				validateRequiredTableFields(schema, 'customers', prepared);
				const customerRecord = prepared as Record<string, unknown>;

				const key = entityKey(
					customerRecord.provider as string,
					customerRecord.sandbox as boolean,
					customerRecord.id as string,
				);
				const existing = options.getState().customers.get(key);
				const createdAt = existing?.createdAt ?? new Date().toISOString();
				options.getState().customers.set(key, {
					...stripTableFieldKeys(
						withoutRaw(customerRecord),
						schema,
						'customers',
					),
					...customerRecord,
					createdAt,
					updatedAt: new Date().toISOString(),
					deletedAt: null,
					raw: getPersistableRaw(options.persistRaw, customer),
					version: getVersion(customer, getPersistableRaw(true, customer)),
				} as never);
			},
			async list(_schema, provider, sandbox, listOptions) {
				const limit = listOptions?.limit ?? 20;
				if (!Number.isInteger(limit) || limit <= 0) {
					throw new PaymeshError({
						code: 'invalid_request',
						message: 'Customer list limit must be a positive integer',
					});
				}
				if (listOptions?.after && listOptions?.before) {
					throw new PaymeshError({
						code: 'invalid_request',
						message:
							'Customer list accepts either "after" or "before", not both',
					});
				}

				const cursor = decodeCustomerCursor(
					listOptions?.before ?? listOptions?.after,
					listOptions?.before ? 'before' : 'after',
				);
				const filtered = [...options.getState().customers.values()]
					.filter(
						(customer) =>
							customer.provider === provider &&
							customer.sandbox === sandbox &&
							customer.deletedAt === null,
					)
					.sort(compareCustomerRows);

				let pageSource = filtered;
				if (cursor?.mode === 'after') {
					pageSource = filtered.filter(
						(customer) =>
							compareCustomerRowToCursor(customer, cursor.value) > 0,
					);
				} else if (cursor?.mode === 'before') {
					pageSource = filtered
						.filter(
							(customer) =>
								compareCustomerRowToCursor(customer, cursor.value) < 0,
						)
						.sort((left, right) => compareCustomerRows(right, left));
				}

				const hasExtra = pageSource.length > limit;
				const windowRows = hasExtra ? pageSource.slice(0, limit) : pageSource;
				const pageRows =
					cursor?.mode === 'before' ? [...windowRows].reverse() : windowRows;
				const data = pageRows.map((customer) =>
					mapStoredCustomer(customer, listOptions),
				);

				return {
					data,
					total: filtered.length,
					previous:
						data.length === 0
							? null
							: cursor?.mode === 'before'
								? hasExtra
									? encodeCustomerCursor({
											createdAt: pageRows[0]!.createdAt,
											providerId: pageRows[0]!.id,
										})
									: null
								: cursor
									? encodeCustomerCursor({
											createdAt: pageRows[0]!.createdAt,
											providerId: pageRows[0]!.id,
										})
									: null,
					next:
						data.length === 0
							? null
							: cursor?.mode === 'before'
								? encodeCustomerCursor({
										createdAt: pageRows[pageRows.length - 1]!.createdAt,
										providerId: pageRows[pageRows.length - 1]!.id,
									})
								: hasExtra
									? encodeCustomerCursor({
											createdAt: pageRows[pageRows.length - 1]!.createdAt,
											providerId: pageRows[pageRows.length - 1]!.id,
										})
									: null,
				};
			},
			async markDeleted(_schema, customer) {
				const key = entityKey(customer.provider, customer.sandbox, customer.id);
				const existing = options.getState().customers.get(key);
				options.getState().customers.set(key, {
					id: customer.id,
					provider: customer.provider,
					sandbox: customer.sandbox,
					createdAt: existing?.createdAt ?? new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					deletedAt: new Date().toISOString(),
					raw: getPersistableRaw(options.persistRaw, customer),
					deleted: true,
					version: getVersion(customer, getPersistableRaw(true, customer)),
				});
			},
		},
		pix: {
			async findByProviderId(_schema, provider, sandbox, id, readOptions) {
				const pix = options
					.getState()
					.pix.get(entityKey(provider, sandbox, id));
				if (!pix) return null;

				return mapStoredPayment(pix, readOptions) as never;
			},
			async upsert(schema, pix) {
				validateAndStorePayment(schema, 'pix', pix, options);
			},
		},
		checkouts: {
			async findByProviderId(_schema, provider, sandbox, id) {
				const payment = options
					.getState()
					.checkouts.get(entityKey(provider, sandbox, id));
				if (!payment) return null;

				return cloneValue(withoutRaw(payment)) as never;
			},
			async upsert(schema, payment) {
				validateAndStorePayment(schema, 'checkouts', payment, options);
			},
		},
		invoices: {
			async findByProviderId(_schema, provider, sandbox, id) {
				const payment = options
					.getState()
					.invoices.get(entityKey(provider, sandbox, id));
				if (!payment) return null;

				return cloneValue(withoutRaw(payment)) as never;
			},
			async upsert(schema, payment) {
				validateAndStorePayment(schema, 'invoices', payment, options);
			},
		},
		subscriptions: {
			async findByProviderId(_schema, provider, sandbox, id) {
				const subscription = options
					.getState()
					.subscriptions.get(entityKey(provider, sandbox, id));
				if (!subscription) return null;

				return cloneValue(asRecord(subscription.data));
			},
			async upsert(schema, event) {
				validateRequiredString(
					event.id,
					'id',
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
				validateRequiredString(
					event.type,
					'type',
					schema.tables.subscriptions.name,
				);

				validateSubscriptionReferences(
					options.getState(),
					schema,
					event,
					options.strict,
				);

				const data = asRecord(event.data);
				const providerId =
					typeof data.id === 'string' && data.id.length > 0
						? data.id
						: event.id;
				const key = entityKey(event.provider, event.sandbox, providerId);
				const existing = options.getState().subscriptions.get(key);
				options.getState().subscriptions.set(key, {
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
					createdAt: existing?.createdAt ?? new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					data: cloneValue(data),
					raw: getPersistableRaw(options.persistRaw, event),
					version: getVersion(event.data, getPersistableRaw(true, event.data)),
				});
			},
		},
		webhookEvents: {
			async acquire(_schema, event, deliveryId) {
				const key = entityKey(event.provider, event.sandbox, deliveryId);
				const existing = options.getState().webhookEvents.get(key);
				if (!existing) {
					options.getState().webhookEvents.set(key, {
						deliveryId,
						provider: event.provider,
						sandbox: event.sandbox,
						type: event.type,
						status: 'processing',
						attempts: 1,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						processedAt: null,
						lastError: null,
						data: cloneValue(withoutRaw(event)),
						raw: getPersistableRaw(options.persistRaw, event),
						version: getVersion(event, getPersistableRaw(true, event)),
					});
					return { duplicate: false };
				}

				if (existing.status === 'failed') {
					options.getState().webhookEvents.set(key, {
						...existing,
						status: 'processing',
						attempts: existing.attempts + 1,
						updatedAt: new Date().toISOString(),
						lastError: null,
						data: cloneValue(withoutRaw(event)),
						raw: getPersistableRaw(options.persistRaw, event),
					});
					return { duplicate: false };
				}

				return { duplicate: true };
			},
			async markProcessed(_schema, event, deliveryId) {
				const key = entityKey(event.provider, event.sandbox, deliveryId);
				const existing = options.getState().webhookEvents.get(key);
				if (!existing) return;

				options.getState().webhookEvents.set(key, {
					...existing,
					status: 'processed',
					processedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					lastError: null,
				});
			},
			async markFailed(_schema, event, deliveryId, error) {
				const key = entityKey(event.provider, event.sandbox, deliveryId);
				const existing = options.getState().webhookEvents.get(key);
				if (!existing) return;

				options.getState().webhookEvents.set(key, {
					...existing,
					status: 'failed',
					updatedAt: new Date().toISOString(),
					lastError:
						error instanceof Error ? error.message : 'Webhook handling failed',
				});
			},
		},
		products: {
			async upsertMany(_schema, provider, products) {
				for (const product of products) {
					validateRequiredString(product.id, 'id', 'products');
					validateRequiredBoolean(product.sandbox, 'sandbox', 'products');
					const key = entityKey(provider, product.sandbox, product.id);
					const existing = options.getState().products.get(key);
					options.getState().products.set(key, {
						...cloneValue(product),
						provider,
						createdAt: existing?.createdAt ?? new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						raw: getPersistableCatalogRaw(options.persistRaw, product.raw),
						version: product.version ?? 'v1',
					});
				}
			},
		},
		prices: {
			async upsertMany(schema, provider, prices) {
				for (const price of prices) {
					validateRequiredString(price.id, 'id', 'prices');
					validateRequiredBoolean(price.sandbox, 'sandbox', 'prices');
					if (
						typeof price.productId === 'string' &&
						price.productId.length > 0
					) {
						ensureProductExists(
							options.getState(),
							options.strict,
							schema,
							provider,
							price.sandbox,
							price.productId,
						);
					}
					const key = entityKey(provider, price.sandbox, price.id);
					const existing = options.getState().prices.get(key);
					options.getState().prices.set(key, {
						...cloneValue(price),
						provider,
						createdAt: existing?.createdAt ?? new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						raw: getPersistableCatalogRaw(options.persistRaw, price.raw),
						version: price.version ?? 'v1',
					});
				}
			},
		},
		migrations: {
			async ensureTable() {},
			async listApplied() {
				return [...options.getState().migrations].sort();
			},
			async recordApplied(_schema, name) {
				options.getState().migrations.add(name);
			},
		},
	};
}

function validateAndStorePayment(
	schema: ResolvedDatabaseSchema,
	tableKey: 'pix' | 'checkouts' | 'invoices',
	payment: BasePix | BaseAnyPayment,
	options: RepositoryOptions,
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

	if (payment.method === 'pix' && tableKey === 'pix') {
		validateRequiredString(payment.method, 'method', schema.tables.pix.name);
	}

	const prepared = applyTableFieldDefaults(
		schema.tables[tableKey],
		payment as unknown as Record<string, unknown>,
	);
	validateRequiredTableFields(schema, tableKey, prepared);
	const paymentRecord = prepared as Record<string, unknown>;
	if (
		paymentRecord.customer &&
		typeof paymentRecord.customer === 'object' &&
		'id' in paymentRecord.customer
	) {
		const customerId = (paymentRecord.customer as { id?: unknown }).id;
		if (typeof customerId === 'string' && customerId.length > 0) {
			ensureCustomerExists(
				options.getState(),
				options.strict,
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
	const existing = options.getState()[tableKey].get(key);
	options.getState()[tableKey].set(key, {
		...stripTableFieldKeys(withoutRaw(paymentRecord), schema, tableKey),
		...paymentRecord,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		raw: getPersistableRaw(options.persistRaw, payment),
		version: getVersion(payment, getPersistableRaw(true, payment)),
	} as never);
}

function mapStoredCustomer(
	customer: Record<string, unknown> & {
		id: string;
		provider: string;
		sandbox: boolean;
		raw: unknown;
	},
	readOptions?: PaymeshRepositoryReadOptions<boolean>,
) {
	const {
		raw,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		deletedAt: _deletedAt,
		...data
	} = customer;
	return withRaw(cloneValue(data), raw, readOptions?.includeRaw) as never;
}

function mapStoredPayment(
	payment: Record<string, unknown> & {
		raw: unknown;
	},
	readOptions?: PaymeshRepositoryReadOptions<boolean>,
) {
	const {
		raw,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...data
	} = payment;
	return withRaw(cloneValue(data), raw, readOptions?.includeRaw) as never;
}

function compareCustomerRows(
	left: { createdAt: string; id: string },
	right: { createdAt: string; id: string },
) {
	const createdDiff = left.createdAt.localeCompare(right.createdAt);
	if (createdDiff !== 0) return createdDiff;

	return left.id.localeCompare(right.id);
}

function compareCustomerRowToCursor(
	row: { createdAt: string; id: string },
	cursor: { createdAt: string; providerId: string },
) {
	const createdDiff = row.createdAt.localeCompare(cursor.createdAt);
	if (createdDiff !== 0) return createdDiff;

	return row.id.localeCompare(cursor.providerId);
}
