import type {
	AnyPayment,
	BaseAnyPayment,
	BaseCustomer,
	BaseCustomerDeleteResult,
	BasePayment,
	BasePaymeshEvent,
	BasePix,
	Customer,
	Pix,
	ProviderCatalogPrice,
	ProviderCatalogProduct,
} from './providers';

/**
 * Built-in table keys managed by the Paymesh schema.
 */
export type DatabaseTableKey =
	| 'customers'
	| 'pix'
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

/**
 * User-provided configuration for a built-in table.
 */
export interface DatabaseTableConfig {
	/** Override the generated table name. */
	name?: string;
	/** Extra fields added to the table. */
	fields?: DatabaseExtraTableFields;
}

/**
 * Primary key settings for a custom table.
 */
export interface CustomDatabaseTablePrimaryKeyConfig {
	/** Override the primary key column name. */
	name?: string;
	/** Primary key column type. */
	type?: 'bigserial' | 'text';
}

/**
 * Timestamp settings for a custom table.
 */
export interface CustomDatabaseTableTimestampsConfig {
	/** Enable created-at timestamp column. */
	createdAt?: boolean;
	/** Enable updated-at timestamp column. */
	updatedAt?: boolean;
}

/**
 * Secondary index definition for a custom table.
 */
export interface CustomDatabaseTableIndexConfig {
	/** Index name. */
	name?: string;
	/** Columns included in the index. */
	columns: string[];
	/** Whether the index is unique. */
	unique?: boolean;
}

/**
 * User-facing configuration for a custom table.
 */
export interface CustomDatabaseTableConfig {
	/** Override the generated table name. */
	name?: string;
	/** Extra fields added to the table. */
	fields?: DatabaseExtraTableFields;
	/** Owning plugin id. */
	pluginId?: string;
	/** Custom primary key configuration. */
	primaryKey?: CustomDatabaseTablePrimaryKeyConfig;
	/** Timestamp configuration. */
	timestamps?: CustomDatabaseTableTimestampsConfig;
	/** Secondary indexes. */
	indexes?: CustomDatabaseTableIndexConfig[];
}

/**
 * Extra fields added to a built-in or custom table.
 */
export type DatabaseExtraTableFields = Record<
	string,
	DatabaseExtraTableFieldOptions
>;

/**
 * Supported field types for extra table columns.
 */
export const DatabaseExtraTableFieldType = {
	String: 'string',
	Number: 'number',
	BigInt: 'bigint',
	Boolean: 'boolean',
	Date: 'date',
	JSON: 'json',
	Decimal: 'decimal',
	Enum: 'enum',
} as const;

/**
 * Literal union of supported extra table field types.
 */
export type DatabaseExtraTableFieldType =
	(typeof DatabaseExtraTableFieldType)[keyof typeof DatabaseExtraTableFieldType];

interface DatabaseExtraTableFieldOptionsBase {
	required?: boolean;
	column?: string;
	index?: boolean;
	unique?: boolean;
}

type DatabaseScalarTableFieldOptions = {
	[Type in keyof MappedDatabaseExtraTableFieldType]: Simplify<
		DatabaseExtraTableFieldOptionsBase & {
			type: Type;
			default?: MappedDatabaseExtraTableFieldType[Type];
		}
	>;
}[keyof MappedDatabaseExtraTableFieldType];

/**
 * Configuration for enum-based extra table fields.
 */
export type DatabaseEnumTableFieldOptions<
	Enum extends readonly string[] = readonly string[],
> = Simplify<
	DatabaseExtraTableFieldOptionsBase & {
		type: typeof DatabaseExtraTableFieldType.Enum;
		enum: Enum;
		default?: Enum[number];
	}
>;

/**
 * Configuration for an extra table field.
 */
export type DatabaseExtraTableFieldOptions<
	Enum extends readonly string[] = readonly string[],
> = DatabaseScalarTableFieldOptions | DatabaseEnumTableFieldOptions<Enum>;

/**
 * High-level database schema configuration accepted by Paymesh.
 */
export interface DatabaseSchemaOptions {
	/** Prefix used for generated table names. */
	prefix?: string;
	/** Built-in table overrides. */
	tables?: Partial<Record<DatabaseTableKey, DatabaseTableConfig>>;
	/** Custom plugin-owned tables. */
	customTables?: Record<string, CustomDatabaseTableConfig>;
}

/**
 * Fully resolved built-in table metadata.
 */
export interface ResolvedDatabaseTable {
	/** Built-in table key. */
	key: DatabaseTableKey;
	/** Fully resolved table name. */
	name: string;
	/** Resolved extra fields. */
	fields: ResolvedDatabaseExtraTableFields;
}

/**
 * Fully resolved custom table metadata.
 */
export interface ResolvedCustomDatabaseTable {
	/** Fully qualified custom table id. */
	id: string;
	/** Local table key without plugin prefix. */
	key: string;
	/** Fully resolved table name. */
	name: string;
	/** Resolved extra fields. */
	fields: ResolvedDatabaseExtraTableFields;
	/** Owning plugin id, when the table comes from a plugin. */
	pluginId?: string;
	/** Resolved primary key settings. */
	primaryKey: Required<CustomDatabaseTablePrimaryKeyConfig>;
	/** Resolved timestamp settings. */
	timestamps: Required<CustomDatabaseTableTimestampsConfig>;
	/** Resolved index definitions. */
	indexes: ResolvedCustomDatabaseTableIndex[];
}

/**
 * Fully resolved custom table index metadata.
 */
export interface ResolvedCustomDatabaseTableIndex {
	/** Index name, when provided. */
	name?: string;
	/** Indexed columns. */
	columns: string[];
	/** Whether the index enforces uniqueness. */
	unique: boolean;
}

/**
 * Fully resolved database schema.
 */
export interface ResolvedDatabaseSchema {
	/** Schema table prefix. */
	prefix: string;
	/** Resolved built-in tables. */
	tables: Record<DatabaseTableKey, ResolvedDatabaseTable>;
	/** Resolved custom tables. */
	customTables: Record<string, ResolvedCustomDatabaseTable>;
}

/**
 * Serializable value accepted in compiled SQL parameters.
 */
export type SqlValue =
	| string
	| number
	| bigint
	| boolean
	| Date
	| null
	| object
	| Record<string, unknown>
	| unknown[];

/**
 * Resolved extra field metadata used by repositories and schema resolvers.
 */
export interface ResolvedDatabaseExtraTableField
	extends Omit<DatabaseExtraTableFieldOptions, 'column'> {
	/** Field key. */
	key: string;
	/** Physical column name. */
	column: string;
}

/**
 * Resolved field map for a table.
 */
export type ResolvedDatabaseExtraTableFields = Record<
	string,
	ResolvedDatabaseExtraTableField
>;

type DatabaseSchemaTableConfig<
	Schema,
	TableKey extends DatabaseTableKey,
> = Schema extends {
	tables?: infer Tables;
}
	? Tables extends Partial<Record<DatabaseTableKey, DatabaseTableConfig>>
		? NonNullable<Tables[TableKey]>
		: never
	: never;

type DatabaseSchemaTableFields<Schema, TableKey extends DatabaseTableKey> =
	DatabaseSchemaTableConfig<Schema, TableKey> extends {
		fields?: infer Fields;
	}
		? Fields extends DatabaseExtraTableFields
			? string extends keyof Fields
				? Record<never, never>
				: Fields
			: Record<never, never>
		: Record<never, never>;

type DatabaseExtraFieldValue<Field extends DatabaseExtraTableFieldOptions> =
	Field extends {
		type: infer Type;
	}
		? Type extends keyof MappedDatabaseExtraTableFieldType
			? MappedDatabaseExtraTableFieldType[Type]
			: Type extends typeof DatabaseExtraTableFieldType.Enum
				? Field extends {
						enum: readonly (infer Value extends string)[];
					}
					? Value
					: never
				: never
		: never;

interface MappedDatabaseExtraTableFieldType {
	[DatabaseExtraTableFieldType.BigInt]: bigint;
	[DatabaseExtraTableFieldType.String]: string;
	[DatabaseExtraTableFieldType.Number]: number;
	[DatabaseExtraTableFieldType.JSON]: Record<string, unknown>;
	[DatabaseExtraTableFieldType.Decimal]: number;
	[DatabaseExtraTableFieldType.Date]: Date;
	[DatabaseExtraTableFieldType.Boolean]: boolean;
}

type DatabaseFieldHasDefault<Field extends DatabaseExtraTableFieldOptions> =
	Field extends {
		default: unknown;
	}
		? true
		: false;

type DatabaseRequiredExtraFieldKeys<Fields extends DatabaseExtraTableFields> = {
	[K in keyof Fields]-?: Fields[K] extends {
		required: true;
	}
		? DatabaseFieldHasDefault<Fields[K]> extends true
			? never
			: K
		: never;
}[keyof Fields];

type DatabaseOptionalExtraFieldKeys<Fields extends DatabaseExtraTableFields> =
	Exclude<keyof Fields, DatabaseRequiredExtraFieldKeys<Fields>>;

type Simplify<T> = {
	[K in keyof T]: T[K];
} & {};

export type DatabaseTableInputExtraFields<
	Schema,
	TableKey extends DatabaseTableKey,
	Fields extends DatabaseExtraTableFields = DatabaseSchemaTableFields<
		Schema,
		TableKey
	>,
> = Simplify<
	{
		[K in DatabaseRequiredExtraFieldKeys<Fields>]: DatabaseExtraFieldValue<
			Fields[K]
		>;
	} & {
		[K in DatabaseOptionalExtraFieldKeys<Fields>]?: DatabaseExtraFieldValue<
			Fields[K]
		>;
	}
>;

/**
 * Output shape for additional table columns.
 */
export type DatabaseTableOutputExtraFields<
	Schema,
	TableKey extends DatabaseTableKey,
	Fields extends DatabaseExtraTableFields = DatabaseSchemaTableFields<
		Schema,
		TableKey
	>,
> = Simplify<
	{
		[K in DatabaseRequiredExtraFieldKeys<Fields>]: DatabaseExtraFieldValue<
			Fields[K]
		>;
	} & {
		[K in DatabaseOptionalExtraFieldKeys<Fields>]?: DatabaseExtraFieldValue<
			Fields[K]
		>;
	}
>;

/**
 * SQL query and parameter bundle used by database adapters.
 */
export interface CompiledQuery {
	sql: string;
	params: SqlValue[];
}

/**
 * Read options for database repositories.
 */
export interface PaymeshRepositoryReadOptions<
	IncludeRaw extends boolean = false,
> {
	/** Include raw payloads in returned values. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/**
 * Cursor and paging options for customer lists.
 */
export interface PaymeshCustomerListOptions<
	IncludeRaw extends boolean = false,
> {
	/** Page size. */
	limit?: number;
	/** Cursor for results after the given page. */
	after?: string;
	/** Cursor for results before the given page. */
	before?: string;
	/** Include raw payloads in returned values. Defaults to `false`. */
	includeRaw?: IncludeRaw;
	/** Overrides the sandbox mode for this query. Defaults to the provider sandbox mode. */
	sandbox?: boolean;
}

/**
 * Paginated customer list response.
 */
export interface PaymeshCustomerListResult<
	IncludeRaw extends boolean = false,
	TCustomer = Customer<IncludeRaw>,
> {
	/** Page items. */
	data: TCustomer[];
	/** Total matching count. */
	total: number;
	/** Cursor for the previous page. */
	previous: string | null;
	/** Cursor for the next page. */
	next: string | null;
}

/**
 * Repository interface for customer persistence.
 */
export interface PaymeshCustomersRepository {
	/** Finds a customer by provider id. */
	findByProviderId<
		IncludeRaw extends boolean = false,
		TCustomer extends Customer<IncludeRaw> = Customer<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		id: string,
		options?: PaymeshRepositoryReadOptions<IncludeRaw>,
	): Promise<TCustomer | null>;
	/** Finds a customer by email. */
	findByEmail?<
		IncludeRaw extends boolean = false,
		TCustomer extends Customer<IncludeRaw> = Customer<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		email: string,
		options?: PaymeshRepositoryReadOptions<IncludeRaw>,
	): Promise<TCustomer | null>;
	/** Finds a customer by external id. */
	findByExternalId?<
		IncludeRaw extends boolean = false,
		TCustomer extends Customer<IncludeRaw> = Customer<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		externalId: string,
		options?: PaymeshRepositoryReadOptions<IncludeRaw>,
	): Promise<TCustomer | null>;
	/** Inserts or updates a customer row. */
	upsert<TCustomer extends BaseCustomer = BaseCustomer>(
		schema: ResolvedDatabaseSchema,
		customer: TCustomer,
	): Promise<void>;
	/** Lists customers for a provider. */
	list<
		IncludeRaw extends boolean = false,
		TCustomer extends Customer<IncludeRaw> = Customer<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		options?: PaymeshCustomerListOptions<IncludeRaw>,
	): Promise<PaymeshCustomerListResult<IncludeRaw, TCustomer>>;
	/** Marks a customer as deleted. */
	markDeleted(
		schema: ResolvedDatabaseSchema,
		customer: BaseCustomerDeleteResult,
	): Promise<void>;
}

/**
 * Repository interface for checkout persistence.
 */
export interface PaymeshCheckoutsRepository {
	/** Finds a checkout by provider id. */
	findByProviderId<TPayment extends BasePayment = BasePayment>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		id: string,
	): Promise<TPayment | null>;
	/** Inserts or updates a checkout row. */
	upsert<TPayment extends BasePayment = BasePayment>(
		schema: ResolvedDatabaseSchema,
		payment: TPayment,
	): Promise<void>;
}

/**
 * Repository interface for PIX persistence.
 */
export interface PaymeshPixRepository {
	/** Finds a PIX payment by provider id. */
	findByProviderId<
		IncludeRaw extends boolean = false,
		TPix extends Pix<IncludeRaw> = Pix<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		id: string,
		options?: PaymeshRepositoryReadOptions<IncludeRaw>,
	): Promise<TPix | null>;
	/** Inserts or updates a PIX row. */
	upsert<TPix extends BasePix = BasePix>(
		schema: ResolvedDatabaseSchema,
		pix: TPix,
	): Promise<void>;
}

/**
 * Repository interface for invoice persistence.
 */
export interface PaymeshInvoicesRepository {
	/** Finds an invoice or payment by provider id. */
	findByProviderId<
		TPayment extends BaseAnyPayment | AnyPayment<boolean> =
			| BaseAnyPayment
			| AnyPayment<boolean>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		id: string,
	): Promise<TPayment | null>;
	/** Inserts or updates an invoice or payment row. */
	upsert<
		TPayment extends BaseAnyPayment | AnyPayment<boolean> =
			| BaseAnyPayment
			| AnyPayment<boolean>,
	>(schema: ResolvedDatabaseSchema, payment: TPayment): Promise<void>;
}

/**
 * Repository interface for subscription persistence.
 */
export interface PaymeshSubscriptionsRepository {
	/** Finds a subscription by provider id. */
	findByProviderId(
		schema: ResolvedDatabaseSchema,
		provider: string,
		sandbox: boolean,
		id: string,
	): Promise<Record<string, unknown> | null>;
	/** Inserts or updates a subscription row. */
	upsert(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
	): Promise<void>;
}

/**
 * Repository interface for webhook event idempotency tracking.
 */
export interface PaymeshWebhookEventsRepository {
	/** Reserves a webhook delivery id for processing. */
	acquire(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
		deliveryId: string,
	): Promise<{ duplicate: boolean }>;
	/** Marks a webhook event as processed. */
	markProcessed(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
		deliveryId: string,
	): Promise<void>;
	/** Marks a webhook event as failed. */
	markFailed(
		schema: ResolvedDatabaseSchema,
		event: BasePaymeshEvent<unknown>,
		deliveryId: string,
		error: unknown,
	): Promise<void>;
}

/**
 * Repository interface for provider catalog persistence.
 */
export interface PaymeshProductsRepository {
	/** Inserts or updates many catalog products. */
	upsertMany(
		schema: ResolvedDatabaseSchema,
		provider: string,
		products: ProviderCatalogProduct[],
	): Promise<void>;
}

/**
 * Repository interface for provider price persistence.
 */
export interface PaymeshPricesRepository {
	/** Inserts or updates many catalog prices. */
	upsertMany(
		schema: ResolvedDatabaseSchema,
		provider: string,
		prices: ProviderCatalogPrice[],
	): Promise<void>;
}

/**
 * Repository interface for migration bookkeeping.
 */
export interface PaymeshMigrationsRepository {
	/** Ensures that the migrations table exists. */
	ensureTable(schema: ResolvedDatabaseSchema): Promise<void>;
	/** Lists applied migration names. */
	listApplied(schema: ResolvedDatabaseSchema): Promise<string[]>;
	/** Records a migration as applied. */
	recordApplied(schema: ResolvedDatabaseSchema, name: string): Promise<void>;
}

/**
 * Container for every repository exposed by a database driver.
 */
export interface PaymeshDatabaseRepositories {
	customers: PaymeshCustomersRepository;
	pix: PaymeshPixRepository;
	checkouts: PaymeshCheckoutsRepository;
	invoices: PaymeshInvoicesRepository;
	subscriptions: PaymeshSubscriptionsRepository;
	webhookEvents: PaymeshWebhookEventsRepository;
	products: PaymeshProductsRepository;
	prices: PaymeshPricesRepository;
	migrations: PaymeshMigrationsRepository;
}

/**
 * Raw database driver definition used internally by adapters.
 */
export interface PaymeshDatabaseDriverDefinition {
	/** Adapter identifier. */
	id: string;
	/** Database dialect. */
	dialect: 'postgres';
	/** Whether raw payloads should be persisted. Defaults to `false`. */
	persistRaw?: boolean;
	/** Repository implementations. */
	repositories: PaymeshDatabaseRepositories;
	/** Query executor. */
	query<Row = unknown>(query: CompiledQuery): Promise<Row[]>;
	/** Executes a statement that does not return rows. */
	execute(query: CompiledQuery): Promise<void>;
	/** Runs a callback inside a database transaction. */
	transaction<T>(
		callback: (database: PaymeshDatabaseDriver) => Promise<T>,
	): Promise<T>;
	/** Closes the adapter if it owns its underlying connection. */
	close?(): Promise<void>;
}

/**
 * Public database driver exposed to Paymesh consumers.
 */
export interface PaymeshDatabaseDriver
	extends Omit<PaymeshDatabaseDriverDefinition, 'persistRaw'> {
	/** Runtime type marker. */
	readonly type: 'database';
	/** Whether raw payloads are persisted. Defaults to `false` when using `defineDatabaseAdapter`. */
	readonly persistRaw: boolean;
}

/**
 * Alias for relational database adapter definitions.
 */
export type RelationalDatabaseAdapterDefinition =
	PaymeshDatabaseDriverDefinition;
/**
 * Alias for relational database adapters.
 */
export type RelationalDatabaseAdapter = PaymeshDatabaseDriver;
