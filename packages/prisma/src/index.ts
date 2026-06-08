import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import { createRepositories } from './repositories';

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

/**
 * Creates a Paymesh database adapter backed by a Prisma client.
 *
 * @example
 * ```ts
 * export const database = prisma(prismaClient, { persistRaw: true });
 * ```
 */
export function prisma(
	database: PrismaDatabase,
	options?: PrismaDatabaseOptions,
): PaymeshDatabaseDriver {
	const persistRaw = options?.persistRaw ?? false;

	return defineDatabaseAdapter({
		persistRaw,
		id: 'prisma',
		dialect: 'postgres',
		repositories: createRepositories({
			query: <Row = unknown>(query: CompiledQuery) =>
				database.$queryRawUnsafe<Row>(query.sql, ...query.params),
			execute: (query: CompiledQuery) =>
				database
					.$executeRawUnsafe(query.sql, ...query.params)
					.then(() => undefined),
			persistRaw,
		}),
		query: <Row = unknown>(query: CompiledQuery) =>
			database
				.$queryRawUnsafe<Row>(query.sql, ...query.params)
				.catch((error) => {
					throw PaymeshError.wrap(error, {
						code: 'database_error',
						message: formatDatabaseErrorMessage(
							'Failed to execute database query',
							error,
						),
					});
				}),
		execute: (query: CompiledQuery) =>
			database
				.$executeRawUnsafe(query.sql, ...query.params)
				.then(() => undefined)
				.catch((error) => {
					throw PaymeshError.wrap(error, {
						code: 'database_error',
						message: formatDatabaseErrorMessage(
							'Failed to execute database query',
							error,
						),
					});
				}),
		transaction: <T>(
			callback: (database: PaymeshDatabaseDriver) => Promise<T>,
		) =>
			database
				.$transaction((tx) => callback(prisma(tx, { persistRaw })))
				.catch((error) => {
					throw PaymeshError.wrap(error, {
						code: 'database_error',
						message: formatDatabaseErrorMessage(
							'Failed to execute database transaction',
							error,
						),
					});
				}),
	});
}

function formatDatabaseErrorMessage(prefix: string, error: unknown) {
	if (error instanceof Error && error.message.length > 0) {
		return `${prefix}: ${error.message}`;
	}

	return prefix;
}
