import type {
	AuditLogEntry,
	AuditLogRuntimeState,
	ResolvedAuditLogOptions,
} from 'src/types';
import { insertEntries } from './database';
import { onAsyncFailure } from './utils';

export function enqueue(
	state: AuditLogRuntimeState,
	config: ResolvedAuditLogOptions,
	entry: AuditLogEntry,
) {
	state.queue.push(entry);

	if (!state.flushTimer) {
		state.flushTimer = setTimeout(() => {
			state.flushTimer = undefined;

			void flushQueue(state).catch((error) =>
				onAsyncFailure(config.failureMode, error),
			);
		}, config.batch.flushInterval);
	}

	if (state.queue.length < config.batch.size) {
		return Promise.resolve();
	}

	if (state.flushTimer) {
		clearTimeout(state.flushTimer);

		state.flushTimer = undefined;
	}

	return flushQueue(state);
}

export async function flushQueue(state: AuditLogRuntimeState) {
	if (!state.client || !state.tableName || state.queue.length === 0) return;

	await insertEntries(
		state.client,
		state.tableName,
		state.queue.splice(0, state.queue.length),
	);
}
