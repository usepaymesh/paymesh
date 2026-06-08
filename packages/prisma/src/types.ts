import type { CompiledQuery } from 'paymesh';

/**
 * Options for the Prisma adapter.
 */
export interface PrismaDatabaseOptions {
	/** Keeps raw provider payloads attached to stored rows when enabled. Defaults to `false`. */
	persistRaw?: boolean;
}

/**
 * Minimal Prisma client contract required by the adapter.
 */
export interface PrismaDatabase {
	$queryRawUnsafe<Row = unknown>(
		query: string,
		...values: CompiledQuery['params']
	): Promise<Row[]>;
	$executeRawUnsafe(
		query: string,
		...values: CompiledQuery['params']
	): Promise<number>;
	$transaction<T>(
		callback: (database: PrismaDatabase) => Promise<T>,
	): Promise<T>;
}
