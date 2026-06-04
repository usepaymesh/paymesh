import type { AuditLogEntry, ResolvedAuditLogOptions } from 'src/types';
import { redactPaths } from './utils';

const DEFAULT_REDACT_PATHS = [
	'metadata.password',
	'metadata.secret',
	'metadata.token',
	'metadata.accessToken',
	'metadata.refreshToken',
	'metadata.authorization',
];

export async function applyRedaction(
	config: ResolvedAuditLogOptions,
	entry: AuditLogEntry,
) {
	if (typeof config.redact === 'function') {
		return config.redact(entry);
	}

	if (config.redact === false) {
		return entry;
	}

	const clone = structuredClone(entry);

	redactPaths(
		clone as unknown as Record<string, unknown>,
		config.redact === true ? DEFAULT_REDACT_PATHS : config.redact,
	);

	return clone;
}
