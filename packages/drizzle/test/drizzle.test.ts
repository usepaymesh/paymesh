import { describe, expect, mock, test } from 'bun:test';
import { type DrizzleDatabase, drizzle } from '../src/index';

describe('@paymesh/drizzle', () => {
	test('passes compiled queries straight to drizzle session', async () => {
		const execute = mock(async () => ({
			rows: [{ id: 'cus_123' }],
		}));
		const prepareQuery = mock(() => ({ execute }));
		const driver = drizzle(createDatabase({ prepareQuery }), {
			persistRaw: true,
		});
		const query = {
			sql: 'select * from "paymesh_customers" where "id" = $1',
			params: ['cus_123'],
		};

		const rows = await driver.query<{ id: string }>(query);

		expect(driver.persistRaw).toBe(true);
		expect(rows).toEqual([{ id: 'cus_123' }]);
		expect(prepareQuery).toHaveBeenCalledWith(
			query,
			undefined,
			undefined,
			false,
		);
	});

	test('normalizes array results returned by drizzle drivers', async () => {
		const driver = drizzle(
			createDatabase({
				prepareQuery: () => ({
					execute: async () => [{ id: 'cus_456' }],
				}),
			}),
		);

		const rows = await driver.query<{ id: string }>({
			sql: 'select * from "paymesh_customers"',
			params: [],
		});

		expect(rows).toEqual([{ id: 'cus_456' }]);
	});

	test('creates a tx driver from drizzle transaction', async () => {
		const execute = mock(async () => undefined);
		const driver = drizzle(
			createDatabase({
				transaction: async (callback) =>
					callback(
						createDatabase({
							prepareQuery: () => ({ execute }),
						}),
					),
			}),
		);

		const result = await driver.transaction(async (tx) => {
			expect(tx.id).toBe('drizzle');
			await tx.execute({
				sql: 'update "paymesh_customers" set "provider" = $1 where "id" = $2',
				params: ['polar', 'cus_123'],
			});

			return 'ok';
		});

		expect(result).toBe('ok');
		expect(execute).toHaveBeenCalledTimes(1);
	});

	test('wraps query errors as PaymeshError', async () => {
		const driver = drizzle(
			createDatabase({
				prepareQuery: () => ({
					execute: async () => {
						throw new Error('boom');
					},
				}),
			}),
		);

		await expect(
			driver.execute({
				sql: 'select 1',
				params: [],
			}),
		).rejects.toMatchObject({
			name: 'PaymeshError',
			code: 'database_error',
			message: 'Failed to execute database query: boom',
		});
	});

	test('wraps transaction errors as PaymeshError', async () => {
		const driver = drizzle(
			createDatabase({
				transaction: async () => {
					throw new Error('tx failed');
				},
			}),
		);

		await expect(driver.transaction(async () => 'ok')).rejects.toMatchObject({
			name: 'PaymeshError',
			code: 'database_error',
			message: 'Failed to execute database transaction: tx failed',
		});
	});
});

function createDatabase(overrides?: {
	prepareQuery?: DrizzleDatabase['_']['session']['prepareQuery'];
	transaction?: DrizzleDatabase['transaction'];
}): DrizzleDatabase {
	const database: DrizzleDatabase = {
		_: {
			session: {
				prepareQuery:
					overrides?.prepareQuery ??
					(() => ({
						execute: async () => ({ rows: [] }),
					})),
			},
		},
		transaction:
			overrides?.transaction ?? (async (callback) => callback(database)),
	};

	return database;
}
