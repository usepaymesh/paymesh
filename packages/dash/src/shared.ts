import type {
	AnyPaymeshPlugin,
	DatabaseSchemaOptions,
	PaymeshClient,
} from 'paymesh';
import { PaymeshError } from 'paymesh';
import type {
	DashActor,
	DashboardClientExtension,
	DashboardRuntimeConfig,
} from './types';

export const DASH_PLUGIN_ID = 'dash' as const;
export const DASH_AUDIT_TABLE_ID = `${DASH_PLUGIN_ID}.audit_log_entries`;

export function normalizeDashPath(path?: string) {
	if (!path || path === '/') {
		return '/admin/paymesh';
	}

	const trimmed = path.trim();
	const normalized = `/${trimmed.replaceAll(/^\/+|\/+$/g, '')}`;
	return normalized === '/' ? '/admin/paymesh' : normalized;
}

export function json(data: unknown, init?: ResponseInit) {
	return Response.json(data, init);
}

export function getDashboardConfig<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
>(client: PaymeshClient<boolean, Schema, Plugins>) {
	const config = (
		client as PaymeshClient<boolean, Schema, Plugins> & DashboardClientExtension
	).__paymeshDash;
	if (!config) {
		throw new PaymeshError({
			code: 'client_error',
			message:
				'Dashboard runtime metadata is missing. Register the @paymesh/dash plugin in createClient().',
		});
	}

	return config;
}

export function createDashboardConfig(path: string): DashboardRuntimeConfig {
	return {
		path,
		pluginId: DASH_PLUGIN_ID,
	};
}

export function isDashboardPath(pathname: string, basePath: string) {
	return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function isApiPath(pathname: string, basePath: string) {
	return (
		pathname === `${basePath}/api` || pathname.startsWith(`${basePath}/api/`)
	);
}

export function parseJson<TBody>(request: Request) {
	return request.json() as Promise<TBody>;
}

export function toContentType(pathname: string) {
	if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
	if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
	return 'text/html; charset=utf-8';
}

export function ensureDatabase<
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
>(client: PaymeshClient<boolean, Schema, Plugins>) {
	if (!client.database) {
		throw new PaymeshError({
			code: 'plugin_configuration_error',
			message: 'The @paymesh/dash plugin requires a configured database.',
			provider: client.provider.id,
		});
	}

	return client.database;
}

export function assertDashActor(value: unknown): DashActor {
	if (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof value.id === 'string' &&
		value.id.length > 0
	) {
		return value as DashActor;
	}

	throw new PaymeshError({
		code: 'plugin_error',
		message:
			'Dashboard auth() must return an actor object with a non-empty "id".',
		status: 500,
	});
}

export function serializeForScript(value: unknown) {
	return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function errorPayload(error: unknown) {
	if (error instanceof PaymeshError) {
		return {
			error: error.code,
			message: error.message,
			status: error.status ?? 400,
		};
	}

	return {
		error: 'plugin_error',
		message: error instanceof Error ? error.message : 'Request failed',
		status: 500,
	};
}
