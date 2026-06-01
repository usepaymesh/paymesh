import type {
	BaseCustomer,
	BaseCustomerDeleteResult,
	BasePayment,
	BasePaymeshEvent,
	ProviderCatalogPrice,
	ProviderCatalogProduct,
} from './providers';

export type DatabaseTableKey =
	| 'customers'
	| 'checkouts'
	| 'invoices'
	| 'paymentMethods'
	| 'entitlements'
	| 'usage'
	| 'webhookEvents'
	| 'subscriptions'
	| 'products'
	| 'prices'
	| 'migrations';

export interface DatabaseTableConfig {
	name?: string;
}

export interface DatabaseSchemaOptions {
	prefix?: string;
	tables?: Partial<Record<DatabaseTableKey, DatabaseTableConfig>>;
}

export interface ResolvedDatabaseTable {
	key: DatabaseTableKey;
	name: string;
}

export interface ResolvedDatabaseSchema {
	prefix: string;
	tables: Record<DatabaseTableKey, ResolvedDatabaseTable>;
}

export type SqlValue =
	| string
	| number
	| boolean
	| Date
	| null
	| object
	| Record<string, unknown>
	| unknown[];

export interface CompiledQuery {
	sql: string;
	params: SqlValue[];
}

export interface PaymeshCustomersRepository {
	upsert(
		schema: ResolvedDatabaseSchema,
		customer: BaseCustomer | BaseCustomerDeleteResult,
		options?: { deleted?: boolean },
	): Promise<void>;
}

export interface PaymeshCheckoutsRepository {
	upsert(schema: ResolvedDatabaseSchema, payment: BasePayment): Promise<void>;
}

export interface PaymeshInvoicesRepository {
	upsert(schema: ResolvedDatabaseSchema, payment: BasePayment): Promise<void>;
}

export interface PaymeshSubscriptionsRepository {
	upsert(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
	): Promise<void>;
}

export interface PaymeshWebhookEventsRepository {
	acquire(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
		deliveryId: string,
	): Promise<{ duplicate: boolean }>;
	markProcessed(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
		deliveryId: string,
	): Promise<void>;
	markFailed(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
		deliveryId: string,
		error: unknown,
	): Promise<void>;
}

export interface PaymeshProductsRepository {
	upsertMany(
		schema: ResolvedDatabaseSchema,
		provider: string,
		products: ProviderCatalogProduct[],
	): Promise<void>;
}

export interface PaymeshPricesRepository {
	upsertMany(
		schema: ResolvedDatabaseSchema,
		provider: string,
		prices: ProviderCatalogPrice[],
	): Promise<void>;
}

export interface PaymeshMigrationsRepository {
	ensureTable(schema: ResolvedDatabaseSchema): Promise<void>;
	listApplied(schema: ResolvedDatabaseSchema): Promise<string[]>;
	recordApplied(schema: ResolvedDatabaseSchema, name: string): Promise<void>;
}

export interface PaymeshDatabaseRepositories {
	customers: PaymeshCustomersRepository;
	checkouts: PaymeshCheckoutsRepository;
	invoices: PaymeshInvoicesRepository;
	subscriptions: PaymeshSubscriptionsRepository;
	webhookEvents: PaymeshWebhookEventsRepository;
	products: PaymeshProductsRepository;
	prices: PaymeshPricesRepository;
	migrations: PaymeshMigrationsRepository;
}

export interface PaymeshDatabaseDriverDefinition {
	id: string;
	dialect: 'postgres';
	persistRaw?: boolean;
	repositories: PaymeshDatabaseRepositories;
	query<Row = unknown>(query: CompiledQuery): Promise<Row[]>;
	execute(query: CompiledQuery): Promise<void>;
	transaction<T>(
		callback: (database: PaymeshDatabaseDriver) => Promise<T>,
	): Promise<T>;
	close?(): Promise<void>;
}

export interface PaymeshDatabaseDriver
	extends Omit<PaymeshDatabaseDriverDefinition, 'persistRaw'> {
	readonly type: 'database';
	readonly persistRaw: boolean;
}

export type RelationalDatabaseAdapterDefinition =
	PaymeshDatabaseDriverDefinition;
export type RelationalDatabaseAdapter = PaymeshDatabaseDriver;
