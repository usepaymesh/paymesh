import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import { createRepositories } from './repositories';

export interface PrismaDatabaseOptions {
	persistRaw?: boolean;
}

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
						message: 'Failed to execute database query',
					});
				}),
		execute: (query: CompiledQuery) =>
			database
				.$executeRawUnsafe(query.sql, ...query.params)
				.then(() => undefined)
				.catch((error) => {
					throw PaymeshError.wrap(error, {
						code: 'database_error',
						message: 'Failed to execute database query',
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
						message: 'Failed to execute database transaction',
					});
				}),
	});
}
