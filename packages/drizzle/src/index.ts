import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import { createRepositories } from './repositories';

/**
 * Options for the Drizzle adapter.
 */
export interface DrizzleDatabaseOptions {
	/** Keeps raw provider payloads attached to stored rows when enabled. Defaults to `false`. */
	persistRaw?: boolean;
}

/**
 * Minimal Drizzle database contract required by the adapter.
 */
export interface DrizzleDatabase {
	_: {
		session: {
			prepareQuery(
				query: CompiledQuery,
				fields: undefined,
				name: undefined,
				isResponseInArrayMode: boolean,
			): {
				execute(): Promise<unknown>;
			};
		};
	};
	transaction<T>(
		callback: (database: DrizzleDatabase) => Promise<T>,
	): Promise<T>;
}

/**
 * Creates a Paymesh database adapter backed by a Drizzle database instance.
 *
 * @example
 * ```ts
 * export const database = drizzle(db, { persistRaw: false });
 * ```
 */
export function drizzle(
	database: DrizzleDatabase,
	options?: DrizzleDatabaseOptions,
): PaymeshDatabaseDriver {
	const persistRaw = options?.persistRaw ?? false;

	const run = (query: CompiledQuery) =>
		database._.session
			.prepareQuery(query, undefined, undefined, false)
			.execute()
			.catch((error) => {
				throw PaymeshError.wrap(error, {
					code: 'database_error',
					message: formatDatabaseErrorMessage(
						'Failed to execute database query',
						error,
					),
				});
			});

	return defineDatabaseAdapter({
		persistRaw,
		id: 'drizzle',
		dialect: 'postgres',
		repositories: createRepositories({
			query: <Row = unknown>(query: CompiledQuery) =>
				run(query).then((result) =>
					Array.isArray(result)
						? (result as Row[])
						: 'rows' in Object(result)
							? ((result as { rows: Row[] }).rows ?? [])
							: [],
				),
			execute: (query: CompiledQuery) => run(query).then(() => undefined),
			persistRaw,
		}),
		query: <Row = unknown>(query: CompiledQuery) =>
			run(query).then((result) =>
				Array.isArray(result)
					? (result as Row[])
					: 'rows' in Object(result)
						? ((result as { rows: Row[] }).rows ?? [])
						: [],
			),
		execute: (query: CompiledQuery) => run(query).then(() => undefined),
		transaction: <T>(
			callback: (database: PaymeshDatabaseDriver) => Promise<T>,
		) =>
			database
				.transaction((tx) => callback(drizzle(tx, { persistRaw })))
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
