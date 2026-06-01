import type {
	PaymeshDatabaseDriver,
	PaymeshDatabaseDriverDefinition,
} from '../types/database';

export function defineDatabaseAdapter(
	definition: PaymeshDatabaseDriverDefinition,
) {
	return {
		...definition,
		type: 'database',
		persistRaw: definition.persistRaw ?? false,
	} satisfies PaymeshDatabaseDriver;
}
