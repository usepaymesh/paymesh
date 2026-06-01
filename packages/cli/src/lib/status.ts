import type { PaymeshClient } from 'paymesh';
import { compileQuery, tableName } from './sql';

export interface CliStatus {
	provider: {
		id: string;
		hasCatalog: boolean;
		hasWebhooks: boolean;
	};
	database: {
		configured: boolean;
		connected: boolean;
		persistRaw: boolean;
	};
	migrations: {
		applied: string[];
		pending: string[];
		upToDate: boolean;
	};
	catalog: {
		supported: boolean;
		productCount?: number;
		priceCount?: number;
	};
	webhooks: {
		supported: boolean;
		processedCount?: number;
	};
	schema: PaymeshClient<boolean>['schema'];
}

export async function getPaymeshStatus(
	client: Pick<PaymeshClient<boolean>, 'provider' | 'database' | 'schema'>,
	appliedMigrations: string[],
	expectedMigrations: string[],
) {
	const pending = expectedMigrations.filter(
		(name) => !appliedMigrations.includes(name),
	);

	const status: CliStatus = {
		provider: {
			id: client.provider.id,
			hasCatalog: Boolean(client.provider.catalog),
			hasWebhooks: Boolean(
				client.provider.webhooks && client.provider.capabilities.webhooks,
			),
		},
		database: {
			configured: Boolean(client.database),
			connected: false,
			persistRaw: client.database?.persistRaw ?? false,
		},
		migrations: {
			applied: appliedMigrations,
			pending,
			upToDate: pending.length === 0,
		},
		catalog: {
			supported: Boolean(client.provider.catalog),
		},
		webhooks: {
			supported: Boolean(
				client.provider.webhooks && client.provider.capabilities.webhooks,
			),
		},
		schema: client.schema,
	};

	if (!client.database) return status;

	const [counts] = await client.database.query<{
		product_count: string;
		price_count: string;
		webhook_event_count: string;
	}>(
		compileQuery(
			`SELECT
				(SELECT COUNT(*)::text FROM ${tableName(client.schema, 'products')}) AS product_count,
				(SELECT COUNT(*)::text FROM ${tableName(client.schema, 'prices')}) AS price_count,
				(SELECT COUNT(*)::text FROM ${tableName(client.schema, 'webhookEvents')}) AS webhook_event_count`,
		),
	);

	status.database.connected = true;
	status.catalog.productCount = Number(counts?.product_count ?? 0);
	status.catalog.priceCount = Number(counts?.price_count ?? 0);
	status.webhooks.processedCount = Number(counts?.webhook_event_count ?? 0);

	return status;
}
