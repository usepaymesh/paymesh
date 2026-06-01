import {
	type CompiledQuery,
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

export interface PostgresDatabaseOptions {
	persistRaw?: boolean;
}

export function postgres(
	connection: string | Pool,
	options?: PostgresDatabaseOptions,
) {
	const pool =
		typeof connection === 'string'
			? new Pool({ connectionString: connection })
			: connection;
	const ownsPool = typeof connection === 'string';

	return defineDatabaseAdapter({
		id: 'pg',
		dialect: 'postgres',
		persistRaw: options?.persistRaw ?? false,
		query: <Row = unknown>(query: CompiledQuery) =>
			executeQuery<Row>(pool, query.sql, query.params),
		async execute(query) {
			await executeQuery(pool, query.sql, query.params);
		},
		async transaction<T>(
			callback: (database: PaymeshDatabaseDriver) => Promise<T>,
		) {
			const client = await pool.connect();
			const tx = createTransactionDriver(client, options?.persistRaw ?? false);

			try {
				await client.query('BEGIN');
				const result = await callback(tx);
				await client.query('COMMIT');

				return result;
			} catch (error) {
				await client.query('ROLLBACK').catch(() => undefined);
				throw PaymeshError.wrap(error, {
					code: 'database_error',
					message: 'Failed to execute database transaction',
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
	const tx: PaymeshDatabaseDriver = defineDatabaseAdapter({
		id: 'pg:tx',
		dialect: 'postgres',
		persistRaw,
		query: <Row = unknown>(query: CompiledQuery) =>
			executeQuery<Row>(client, query.sql, query.params),
		async execute(query) {
			await executeQuery(client, query.sql, query.params);
		},
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
			message: 'Failed to execute database query',
		});
	}
}
