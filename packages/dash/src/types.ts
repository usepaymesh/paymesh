import type {
	PaymeshClient,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from 'paymesh';

export interface DashActor {
	id: string;
	type?: 'user' | 'customer';
	name?: string;
	email?: string;
	[key: string]: unknown;
}

export interface DashOptions {
	path?: `/${string}`;
	auth(args: {
		request: Request;
		client: PaymeshClient<boolean>;
	}): Promise<DashActor> | DashActor;
}

export interface DashboardRuntimeConfig {
	path: string;
	pluginId: 'dash';
}

export interface DashboardClientExtension {
	__paymeshDash?: DashboardRuntimeConfig;
}

export interface DashboardRequestContext {
	actor: DashActor;
	client: PaymeshClient<boolean>;
	database: PaymeshDatabaseDriver;
	schema: ResolvedDatabaseSchema;
}

export interface DashboardAssetConfig {
	actor: DashActor;
	basePath: string;
	currentPath: string;
	providerId: string;
}
