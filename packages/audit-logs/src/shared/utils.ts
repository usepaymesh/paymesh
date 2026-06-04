import type { ResolvedAuditLogOptions } from 'src/types';

export function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export function toIsoString(value: string | Date) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRecord(value: unknown, key: string) {
	if (!isRecord(value)) return null;

	const nested = value[key];

	return isRecord(nested) ? nested : null;
}

export function readString(value: unknown, key: string) {
	if (!isRecord(value)) return null;

	const nested = value[key];
	return typeof nested === 'string' ? nested : null;
}

export function getRequestInfo(request: Request) {
	return {
		requestId:
			request.headers.get('x-request-id') ??
			request.headers.get('request-id') ??
			null,
		correlationId:
			request.headers.get('x-correlation-id') ??
			request.headers.get('correlation-id') ??
			null,
		idempotencyKey: request.headers.get('idempotency-key') ?? null,
		ipAddress:
			request.headers.get('cf-connecting-ip') ??
			request.headers.get('x-real-ip') ??
			request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
			null,
		userAgent: request.headers.get('user-agent') ?? null,
	};
}

export function redactPaths(value: Record<string, unknown>, paths: string[]) {
	for (const path of paths) {
		const segments = path.split('.');
		let current: Record<string, unknown> | undefined = value;

		for (const segment of segments.slice(0, -1)) {
			const next: unknown = current?.[segment];
			if (!isRecord(next)) {
				current = undefined;
				break;
			}
			current = next;
		}

		const leaf = segments[segments.length - 1];
		if (current && leaf && leaf in current) {
			current[leaf] = '[REDACTED]';
		}
	}
}

export function onAsyncFailure(
	failureMode: ResolvedAuditLogOptions['failureMode'],
	error: unknown,
) {
	if (failureMode === 'ignore') return;
	if (failureMode === 'warn') {
		console.warn('[paymesh:audit-logs] failed to persist audit log', error);

		return;
	}

	throw error;
}

export function matchesPattern(eventType: string, pattern: string) {
	if (pattern === '*') return true;
	if (pattern.endsWith('.*')) return eventType.startsWith(pattern.slice(0, -1));

	return eventType === pattern;
}
