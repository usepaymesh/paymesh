import { type PaymeshDatabaseDriver, resolveDatabaseSchema } from 'paymesh';
import { createMemoryDriver } from './shared/driver';
import { applySeed, createEmptyState, type StateRef } from './state';
import type { MemoryDatabaseOptions } from './types';

export type * from './types';

/**
 * Creates a Paymesh database adapter backed by in-memory storage.
 *
 * Intended for tests, CI, demos, and local development. Supports transactions
 * via state cloning and rollback, but rejects arbitrary SQL queries.
 *
 * @example
 * ```ts
 * const db = memory();
 *
 * const dbWithSeed = memory({
 *   strict: false,
 *   persistRaw: true,
 *   seed: {
 *     customers: [
 *       { id: 'cus_1', provider: 'stripe', sandbox: true, email: 'test@example.com' },
 *     ],
 *   },
 * });
 * ```
 */
export function memory(
	options: MemoryDatabaseOptions = {},
): PaymeshDatabaseDriver {
	const { strict = true, persistRaw = false } = options;

	const stateRef: StateRef = {
		current: createEmptyState(),
	};

	applySeed(
		stateRef.current,
		resolveDatabaseSchema(),
		options.seed,
		strict,
		persistRaw,
	);

	return createMemoryDriver({
		strict,
		stateRef,
		persistRaw,
		transactional: false,
	});
}
