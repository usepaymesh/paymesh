import type { PaymeshClient } from 'paymesh';
import type { PaymeshMigrationHistoryStatus } from './migrations';
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
	history: PaymeshMigrationHistoryStatus;
	catalog: {
		supported: boolean;
		productCount?: number;
		priceCount?: number;
	};
	pix: {
		supported: boolean;
		count?: number;
	};
	webhooks: {
		supported: boolean;
		processedCount?: number;
	};
	schema: PaymeshClient<boolean>['schema'];
}

export async function getPaymeshStatus(
	client: Pick<
		PaymeshClient<boolean>,
		'provider' | 'database' | 'schema' | 'isSandbox'
	>,
	appliedMigrations: string[],
	expectedMigrations: string[],
	history: PaymeshMigrationHistoryStatus,
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
		history,
		catalog: {
			supported: Boolean(client.provider.catalog),
		},
		pix: {
			supported: Boolean(
				client.provider.capabilities.pix && client.provider.pix,
			),
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
		pix_count: string;
		product_count: string;
		price_count: string;
		webhook_event_count: string;
	}>(
		compileQuery(
			`SELECT
				pix.pix_count,
				products.product_count,
				prices.price_count,
				webhook_events.webhook_event_count
			FROM
				(SELECT COUNT(*)::text AS pix_count FROM ${tableName(client.schema, 'pix')} WHERE sandbox = $1) pix,
				(SELECT COUNT(*)::text AS product_count FROM ${tableName(client.schema, 'products')} WHERE sandbox = $1) products,
				(SELECT COUNT(*)::text AS price_count FROM ${tableName(client.schema, 'prices')} WHERE sandbox = $1) prices,
				(SELECT COUNT(*)::text AS webhook_event_count FROM ${tableName(client.schema, 'webhookEvents')} WHERE sandbox = $1) webhook_events`,
			[client.isSandbox()],
		),
	);

	status.database.connected = true;
	status.pix.count = Number(counts?.pix_count ?? 0);
	status.catalog.productCount = Number(counts?.product_count ?? 0);
	status.catalog.priceCount = Number(counts?.price_count ?? 0);
	status.webhooks.processedCount = Number(counts?.webhook_event_count ?? 0);

	return status;
}
