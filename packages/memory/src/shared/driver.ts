import {
	defineDatabaseAdapter,
	type PaymeshDatabaseDriver,
	PaymeshError,
} from 'paymesh';
import { createRepositories } from '../repositories';
import { cloneState, type StateRef } from '../state';

export function createMemoryDriver({
	strict,
	stateRef,
	persistRaw,
	transactional,
}: {
	strict: boolean;
	stateRef: StateRef;
	persistRaw: boolean;
	transactional: boolean;
}): PaymeshDatabaseDriver {
	const getState = () => stateRef.current;

	const driver = defineDatabaseAdapter({
		id: 'memory',
		dialect: 'postgres',
		persistRaw,
		repositories: createRepositories({
			getState,
			persistRaw,
			strict,
		}),
		async query() {
			throw new PaymeshError({
				code: 'database_error',
				message:
					'@paymesh/memory does not execute arbitrary SQL. Use repository methods instead.',
			});
		},
		async execute() {
			throw new PaymeshError({
				code: 'database_error',
				message:
					'@paymesh/memory does not execute arbitrary SQL. Use repository methods instead.',
			});
		},
		async transaction<T>(
			callback: (database: PaymeshDatabaseDriver) => Promise<T>,
		) {
			if (transactional) {
				return callback(driver);
			}

			const nextStateRef: StateRef = {
				current: cloneState(stateRef.current),
			};

			const tx = createMemoryDriver({
				strict,
				persistRaw,
				transactional: true,
				stateRef: nextStateRef,
			});

			const result = await callback(tx);

			stateRef.current = nextStateRef.current;

			return result;
		},
	});

	return driver;
}
