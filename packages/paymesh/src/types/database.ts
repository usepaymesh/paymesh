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

export interface PaymeshDatabaseDriverDefinition {
	id: string;
	dialect: 'postgres';
	persistRaw?: boolean;
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
