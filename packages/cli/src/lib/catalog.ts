import {
	type PaymeshClient,
	type PaymeshDatabaseDriver,
	PaymeshError,
	type ProviderCatalogPrice,
	type ProviderCatalogProduct,
	type ResolvedDatabaseSchema,
	type SqlValue,
} from 'paymesh';
import { upsertManyByProviderIdQuery } from './sql';

export async function pushProviderCatalog(
	client: Pick<PaymeshClient<boolean>, 'provider' | 'database' | 'schema'>,
) {
	if (!client.database) {
		throw new PaymeshError({
			code: 'invalid_request',
			message: 'A configured database is required to push the provider catalog',
			provider: client.provider.id,
		});
	}

	if (!client.provider.catalog) {
		throw new PaymeshError({
			code: 'unsupported_capability',
			message: `Provider "${client.provider.id}" does not support catalog sync`,
			provider: client.provider.id,
		});
	}

	const database = client.database;
	const catalog = await client.provider.catalog.list();
	const products = catalog.products.map((product) =>
		createProductRow(client.provider.id, database, product),
	);
	const prices = catalog.prices.map((price) =>
		createPriceRow(client.provider.id, database, price),
	);

	await database.transaction(async (tx) => {
		if (products.length > 0) {
			await upsertManyByProviderId(tx, client.schema, 'products', products, [
				'name',
				'description',
				'active',
				'metadata',
				'data',
				'raw',
				'updated_at',
				'version',
			]);
		}

		if (prices.length > 0) {
			await upsertManyByProviderId(tx, client.schema, 'prices', prices, [
				'product_provider_id',
				'active',
				'type',
				'currency',
				'amount',
				'interval',
				'interval_count',
				'metadata',
				'data',
				'raw',
				'updated_at',
				'version',
			]);
		}
	});

	return {
		products: catalog.products.length,
		prices: catalog.prices.length,
	};
}

function createProductRow(
	provider: string,
	database: Pick<PaymeshDatabaseDriver, 'persistRaw'>,
	product: ProviderCatalogProduct,
) {
	return {
		provider,
		provider_id: product.id,
		version: product.version ?? 'v1',
		name: product.name ?? null,
		description: product.description ?? null,
		active: product.active ?? null,
		metadata: product.metadata ?? null,
		data: product,
		raw: getPersistableCatalogRaw(database, product.raw),
		updated_at: new Date().toISOString(),
	};
}

function createPriceRow(
	provider: string,
	database: Pick<PaymeshDatabaseDriver, 'persistRaw'>,
	price: ProviderCatalogPrice,
) {
	return {
		provider,
		provider_id: price.id,
		version: price.version ?? 'v1',
		product_provider_id: price.productId ?? null,
		active: price.active ?? null,
		type: price.type ?? null,
		currency: price.currency ?? null,
		amount: price.amount ?? null,
		interval: price.interval ?? null,
		interval_count: price.intervalCount ?? null,
		metadata: price.metadata ?? null,
		data: price,
		raw: getPersistableCatalogRaw(database, price.raw),
		updated_at: new Date().toISOString(),
	};
}

async function upsertManyByProviderId(
	database: PaymeshDatabaseDriver,
	schema: ResolvedDatabaseSchema,
	tableKey: 'products' | 'prices',
	rows: Array<Record<string, SqlValue>>,
	updateColumns: string[],
) {
	const query = upsertManyByProviderIdQuery(
		schema,
		tableKey,
		rows,
		updateColumns,
	);

	if (!query) return;

	await database.execute(query);
}

function getPersistableCatalogRaw(
	database:
		| Pick<PaymeshDatabaseDriver, 'persistRaw'>
		| Pick<PaymeshDatabaseDriver, 'execute' | 'query' | 'transaction'>,
	value: unknown,
) {
	if (!('persistRaw' in database) || !database.persistRaw) return null;

	return value ?? null;
}
