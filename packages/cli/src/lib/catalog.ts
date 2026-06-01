import { type PaymeshClient, PaymeshError } from 'paymesh';

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

	await database.transaction(async (tx) => {
		if (catalog.products.length > 0) {
			await tx.repositories.products.upsertMany(
				client.schema,
				client.provider.id,
				catalog.products,
			);
		}

		if (catalog.prices.length > 0) {
			await tx.repositories.prices.upsertMany(
				client.schema,
				client.provider.id,
				catalog.prices,
			);
		}
	});

	return {
		products: catalog.products.length,
		prices: catalog.prices.length,
	};
}
