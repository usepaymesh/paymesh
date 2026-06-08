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

export interface DatabaseTableConfig {
	name?: string;
	fields?: DatabaseExtraTableFields;
}

export interface CustomDatabaseTablePrimaryKeyConfig {
	name?: string;
	type?: 'bigserial' | 'text';
}

export interface CustomDatabaseTableTimestampsConfig {
	createdAt?: boolean;
	updatedAt?: boolean;
}

export interface CustomDatabaseTableIndexConfig {
	name?: string;
	columns: string[];
	unique?: boolean;
}

export interface CustomDatabaseTableConfig {
	name?: string;
	fields?: DatabaseExtraTableFields;
	pluginId?: string;
	primaryKey?: CustomDatabaseTablePrimaryKeyConfig;
	timestamps?: CustomDatabaseTableTimestampsConfig;
	indexes?: CustomDatabaseTableIndexConfig[];
}

export type DatabaseExtraTableFields = Record<
	string,
	DatabaseExtraTableFieldOptions
>;

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

export type DatabaseEnumTableFieldOptions<
	Enum extends readonly string[] = readonly string[],
> = Simplify<
	DatabaseExtraTableFieldOptionsBase & {
		type: typeof DatabaseExtraTableFieldType.Enum;
		enum: Enum;
		default?: Enum[number];
	}
>;

export type DatabaseExtraTableFieldOptions<
	Enum extends readonly string[] = readonly string[],
> = DatabaseScalarTableFieldOptions | DatabaseEnumTableFieldOptions<Enum>;

export interface DatabaseSchemaOptions {
	prefix?: string;
	tables?: Partial<Record<DatabaseTableKey, DatabaseTableConfig>>;
	customTables?: Record<string, CustomDatabaseTableConfig>;
}

export interface ResolvedDatabaseTable {
	key: DatabaseTableKey;
	name: string;
	fields: ResolvedDatabaseExtraTableFields;
}

export interface ResolvedCustomDatabaseTable {
	id: string;
	key: string;
	name: string;
	fields: ResolvedDatabaseExtraTableFields;
	pluginId?: string;
	primaryKey: Required<CustomDatabaseTablePrimaryKeyConfig>;
	timestamps: Required<CustomDatabaseTableTimestampsConfig>;
	indexes: ResolvedCustomDatabaseTableIndex[];
}

export interface ResolvedCustomDatabaseTableIndex {
	name?: string;
	columns: string[];
	unique: boolean;
}

export interface ResolvedDatabaseSchema {
	prefix: string;
	tables: Record<DatabaseTableKey, ResolvedDatabaseTable>;
	customTables: Record<string, ResolvedCustomDatabaseTable>;
}

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

export interface ResolvedDatabaseExtraTableField
	extends Omit<DatabaseExtraTableFieldOptions, 'column'> {
	key: string;
	column: string;
}

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

export interface CompiledQuery {
	sql: string;
	params: SqlValue[];
}

export interface PaymeshRepositoryReadOptions<
	IncludeRaw extends boolean = false,
> {
	includeRaw?: IncludeRaw;
}

export interface PaymeshCustomerListOptions<
	IncludeRaw extends boolean = false,
> {
	limit?: number;
	after?: string;
	before?: string;
	includeRaw?: IncludeRaw;
}

export interface PaymeshCustomerListResult<
	IncludeRaw extends boolean = false,
	TCustomer = Customer<IncludeRaw>,
> {
	data: TCustomer[];
	total: number;
	previous: string | null;
	next: string | null;
}

export interface PaymeshCustomersRepository {
	findByProviderId<
		IncludeRaw extends boolean = false,
		TCustomer extends Customer<IncludeRaw> = Customer<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		id: string,
		options?: PaymeshRepositoryReadOptions<IncludeRaw>,
	): Promise<TCustomer | null>;
	upsert<TCustomer extends BaseCustomer = BaseCustomer>(
		schema: ResolvedDatabaseSchema,
		customer: TCustomer,
	): Promise<void>;
	list<
		IncludeRaw extends boolean = false,
		TCustomer extends Customer<IncludeRaw> = Customer<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		options?: PaymeshCustomerListOptions<IncludeRaw>,
	): Promise<PaymeshCustomerListResult<IncludeRaw, TCustomer>>;
	markDeleted(
		schema: ResolvedDatabaseSchema,
		customer: BaseCustomerDeleteResult,
	): Promise<void>;
}

export interface PaymeshCheckoutsRepository {
	findByProviderId<TPayment extends BasePayment = BasePayment>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		id: string,
	): Promise<TPayment | null>;
	upsert<TPayment extends BasePayment = BasePayment>(
		schema: ResolvedDatabaseSchema,
		payment: TPayment,
	): Promise<void>;
}

export interface PaymeshPixRepository {
	findByProviderId<
		IncludeRaw extends boolean = false,
		TPix extends Pix<IncludeRaw> = Pix<IncludeRaw>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		id: string,
		options?: PaymeshRepositoryReadOptions<IncludeRaw>,
	): Promise<TPix | null>;
	upsert<TPix extends BasePix = BasePix>(
		schema: ResolvedDatabaseSchema,
		pix: TPix,
	): Promise<void>;
}

export interface PaymeshInvoicesRepository {
	findByProviderId<
		TPayment extends BaseAnyPayment | AnyPayment<boolean> =
			| BaseAnyPayment
			| AnyPayment<boolean>,
	>(
		schema: ResolvedDatabaseSchema,
		provider: string,
		id: string,
	): Promise<TPayment | null>;
	upsert<
		TPayment extends BaseAnyPayment | AnyPayment<boolean> =
			| BaseAnyPayment
			| AnyPayment<boolean>,
	>(schema: ResolvedDatabaseSchema, payment: TPayment): Promise<void>;
}

export interface PaymeshSubscriptionsRepository {
	findByProviderId(
		schema: ResolvedDatabaseSchema,
		provider: string,
		id: string,
	): Promise<Record<string, unknown> | null>;
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
	pix: PaymeshPixRepository;
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
