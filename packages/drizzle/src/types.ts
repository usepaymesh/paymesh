import type { CompiledQuery } from 'paymesh';

export interface SqlExecutor {
	persistRaw: boolean;
	execute(query: CompiledQuery): Promise<void>;
	query<Row = unknown>(query: CompiledQuery): Promise<Row[]>;
}
