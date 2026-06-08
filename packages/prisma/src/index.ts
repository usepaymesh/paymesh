import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import { createRepositories } from './repositories';
import type { PrismaDatabase, PrismaDatabaseOptions } from './types';

export * from './types';

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
	{ persistRaw = false }: PrismaDatabaseOptions = {},
): PaymeshDatabaseDriver {
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
	if (error instanceof Error && error.message.length > 0)
		return `${prefix}: ${error.message}`;

	return prefix;
}
