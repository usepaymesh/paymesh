import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';

export interface DrizzleDatabaseOptions {
	persistRaw?: boolean;
}

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
					message: 'Failed to execute database query',
				});
			});

	return defineDatabaseAdapter({
		persistRaw,
		id: 'drizzle',
		dialect: 'postgres',
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
						message: 'Failed to execute database transaction',
					});
				}),
	});
}
