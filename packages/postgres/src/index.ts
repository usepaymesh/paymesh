import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import {
	Pool,
	type PoolClient,
	type PoolConfig,
	type QueryResultRow,
} from 'pg';
import { createRepositories } from './repositories';

/**
 * Options for the Postgres adapter.
 *
 * In addition to `persistRaw`, you may pass any `PoolConfig` option
 * (e.g. `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`).
 * These are forwarded to the internal `Pool` when a connection string is given,
 * and ignored when an existing `Pool` instance is passed.
 */
export interface PostgresDatabaseOptions extends Partial<PoolConfig> {
	/** Keeps raw provider payloads attached to stored rows when enabled. Defaults to `false`. */
	persistRaw?: boolean;
}

/**
 * Creates a Paymesh database adapter backed by `pg`.
 *
 * @example
 * ```ts
 * export const database = postgres(process.env.DATABASE_URL, {
 *   persistRaw: true,
 * });
 * ```
 *
 * @example
 * ```ts
 * export const database = postgres(process.env.DATABASE_URL, {
 *   max: 10,
 *   idleTimeoutMillis: 30000,
 * });
 * ```
 *
 * @example
 * ```ts
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * export const database = postgres(pool, { persistRaw: true });
 * ```
 */
export function postgres(
	connection: string | Pool,
	options?: PostgresDatabaseOptions,
) {
	const { persistRaw: raw, ...poolOptions } = options ?? {};
	const persistRaw = raw ?? false;

	const pool =
		typeof connection === 'string'
			? new Pool({ connectionString: connection, ...poolOptions })
			: connection;
	const ownsPool = typeof connection === 'string';
	const query = <Row = unknown>(compiledQuery: CompiledQuery) =>
		executeQuery<Row>(pool, compiledQuery.sql, compiledQuery.params);
	const execute = (compiledQuery: CompiledQuery) =>
		executeQuery(pool, compiledQuery.sql, compiledQuery.params).then(
			() => undefined,
		);

	return defineDatabaseAdapter({
		id: 'pg',
		dialect: 'postgres',
		persistRaw,
		repositories: createRepositories({
			query,
			execute,
			persistRaw,
		}),
		query,
		execute,
		async transaction<T>(
			callback: (database: PaymeshDatabaseDriver) => Promise<T>,
		) {
			const client = await pool.connect();
			const tx = createTransactionDriver(client, persistRaw);

			try {
				await client.query('BEGIN');
				const result = await callback(tx);
				await client.query('COMMIT');

				return result;
			} catch (error) {
				await client.query('ROLLBACK').catch(() => undefined);
				throw PaymeshError.wrap(error, {
					code: 'database_error',
					message: formatDatabaseErrorMessage(
						'Failed to execute database transaction',
						error,
					),
				});
			} finally {
				client.release();
			}
		},
		async close() {
			if (!ownsPool) return;

			await pool.end();
		},
	});
}

function createTransactionDriver(client: PoolClient, persistRaw: boolean) {
	const query = <Row = unknown>(compiledQuery: CompiledQuery) =>
		executeQuery<Row>(client, compiledQuery.sql, compiledQuery.params);
	const execute = (compiledQuery: CompiledQuery) =>
		executeQuery(client, compiledQuery.sql, compiledQuery.params).then(
			() => undefined,
		);
	const tx: PaymeshDatabaseDriver = defineDatabaseAdapter({
		id: 'pg:tx',
		dialect: 'postgres',
		persistRaw,
		repositories: createRepositories({
			query,
			execute,
			persistRaw,
		}),
		query,
		execute,
		transaction<T>(callback: (database: PaymeshDatabaseDriver) => Promise<T>) {
			return callback(tx);
		},
	});

	return tx;
}

async function executeQuery<Row = unknown>(
	client: Pick<Pool, 'query'> | Pick<PoolClient, 'query'>,
	sql: string,
	params: readonly unknown[],
) {
	try {
		const result = await client.query<QueryResultRow>(sql, [...params]);
		return result.rows as Row[];
	} catch (error) {
		throw PaymeshError.wrap(error, {
			code: 'database_error',
			message: formatDatabaseErrorMessage(
				'Failed to execute database query',
				error,
			),
		});
	}
}

function formatDatabaseErrorMessage(prefix: string, error: unknown) {
	if (error instanceof Error && error.message.length > 0) {
		return `${prefix}: ${error.message}`;
	}

	return prefix;
}
