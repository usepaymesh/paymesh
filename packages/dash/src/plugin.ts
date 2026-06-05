import { definePlugin } from 'paymesh';
import { createDashboardMiddleware, createDashboardRoutes } from './routes';
import { createDashboardConfig, normalizeDashPath } from './shared';
import type { DashOptions } from './types';

export function dash(options: DashOptions) {
	const path = normalizeDashPath(options.path);

	return definePlugin({
		id: 'dash',
		name: '@paymesh/dash',
		description: 'Standalone localhost-ready admin dashboard for Paymesh.',
		config: {
			database: true,
		},
		schema: {
			customTables: {
				audit_log_entries: {
					fields: {
						action: {
							type: 'string',
							required: true,
						},
						actor_email: {
							type: 'string',
						},
						actor_id: {
							type: 'string',
							required: true,
						},
						actor_name: {
							type: 'string',
						},
						actor_type: {
							type: 'string',
						},
						error: {
							type: 'string',
						},
						metadata: {
							type: 'json',
						},
						outcome: {
							type: 'string',
							required: true,
						},
						provider: {
							type: 'string',
							required: true,
						},
						resource_id: {
							type: 'string',
						},
						resource_type: {
							type: 'string',
							required: true,
						},
					},
					indexes: [
						{
							columns: ['provider', 'resource_type', 'resource_id'],
							name: 'dash_audit_resource_idx',
						},
						{
							columns: ['provider', 'created_at'],
							name: 'dash_audit_provider_created_idx',
						},
					],
				},
			},
		},
		routes: createDashboardRoutes(path),
		middleware: [
			createDashboardMiddleware({
				auth: options.auth,
				path,
			}),
		],
		extends() {
			return {
				__paymeshDash: createDashboardConfig(path),
			};
		},
	});
}
