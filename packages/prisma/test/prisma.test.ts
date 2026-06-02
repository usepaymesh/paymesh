import { describe, expect, mock, test } from 'bun:test';
import { type PrismaDatabase, prisma } from '../src/index';

describe('@paymesh/prisma', () => {
	test('passes compiled queries straight to prisma raw query', async () => {
		const calls: unknown[][] = [];
		const $queryRawUnsafe: PrismaDatabase['$queryRawUnsafe'] = async <Row>(
			...args: Parameters<PrismaDatabase['$queryRawUnsafe']>
		) => {
			calls.push(args);
			return [{ id: 'cus_123' }] as Row[];
		};
		const driver = prisma(
			createDatabase({
				$queryRawUnsafe,
			}),
			{ persistRaw: true },
		);
		const query = {
			sql: 'select * from "paymesh_customers" where "id" = $1',
			params: ['cus_123'],
		};

		const rows = await driver.query<{ id: string }>(query);

		expect(driver.persistRaw).toBe(true);
		expect(rows).toEqual([{ id: 'cus_123' }]);
		expect(calls).toEqual([[query.sql, ...query.params]]);
	});

	test('uses executeRaw for non-select queries', async () => {
		const $executeRawUnsafe = mock(async () => 1);
		const driver = prisma(
			createDatabase({
				$executeRawUnsafe,
			}),
		);

		await driver.execute({
			sql: 'update "paymesh_customers" set "provider" = $1 where "id" = $2',
			params: ['polar', 'cus_123'],
		});

		expect($executeRawUnsafe).toHaveBeenCalledWith(
			'update "paymesh_customers" set "provider" = $1 where "id" = $2',
			'polar',
			'cus_123',
		);
	});

	test('creates a tx driver from prisma transaction', async () => {
		const $executeRawUnsafe = mock(async () => 1);
		const driver = prisma(
			createDatabase({
				$transaction: async (callback) =>
					callback(
						createDatabase({
							$executeRawUnsafe,
						}),
					),
			}),
		);

		const result = await driver.transaction(async (tx) => {
			expect(tx.id).toBe('prisma');
			await tx.execute({
				sql: 'update "paymesh_customers" set "provider" = $1 where "id" = $2',
				params: ['polar', 'cus_123'],
			});

			return 'ok';
		});

		expect(result).toBe('ok');
		expect($executeRawUnsafe).toHaveBeenCalledTimes(1);
	});

	test('wraps query errors as PaymeshError', async () => {
		const driver = prisma(
			createDatabase({
				$queryRawUnsafe: async () => {
					throw new Error('boom');
				},
			}),
		);

		await expect(
			driver.query({
				sql: 'select 1',
				params: [],
			}),
		).rejects.toMatchObject({
			name: 'PaymeshError',
			code: 'database_error',
			message: 'Failed to execute database query',
		});
	});

	test('wraps transaction errors as PaymeshError', async () => {
		const driver = prisma(
			createDatabase({
				$transaction: async () => {
					throw new Error('tx failed');
				},
			}),
		);

		await expect(driver.transaction(async () => 'ok')).rejects.toMatchObject({
			name: 'PaymeshError',
			code: 'database_error',
			message: 'Failed to execute database transaction',
		});
	});
});

function createDatabase(overrides?: Partial<PrismaDatabase>): PrismaDatabase {
	const database: PrismaDatabase = {
		$queryRawUnsafe:
			overrides?.$queryRawUnsafe ??
			(async <Row = unknown>() => [{ id: 'cus_default' }] as Row[]),
		$executeRawUnsafe: overrides?.$executeRawUnsafe ?? (async () => 0),
		$transaction:
			overrides?.$transaction ?? (async (callback) => callback(database)),
	};

	return database;
}
