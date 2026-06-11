import type { PaymeshDatabaseDriver } from 'paymesh';

export function isMemoryDatabase(
	database: Pick<PaymeshDatabaseDriver, 'id'> | null | undefined,
) {
	return database?.id === 'memory';
}
