import type { ProviderDashboardSyncInput } from 'paymesh';
import { PaymeshError, request, withRaw } from 'paymesh';
import type { PolarCheckout, PolarOrder, PolarSubscription } from '../types';
import { mapPolarCheckoutPayment, mapPolarOrderPayment } from './mapper';

type RequestOptions = Parameters<typeof request>[1];

/**
 * Synchronizes a Polar payment into the Paymesh database.
 */
export const syncPolarPayment = async ({
	id,
	schema,
	database,
	requestOptions,
}: ProviderDashboardSyncInput & { requestOptions?: RequestOptions }) => {
	try {
		const order = await request<PolarOrder>(
			`/v1/orders/${encodeURIComponent(id)}`,
			{
				provider: 'polar',
				...requestOptions,
			},
		);
		const normalized = withRaw(mapPolarOrderPayment(order), order, true);

		await database.repositories.invoices.upsert(schema, normalized);
		return normalized;
	} catch (error) {
		if (!(error instanceof PaymeshError) || error.status !== 404) throw error;
	}

	const checkout = await request<PolarCheckout>(
		`/v1/checkouts/${encodeURIComponent(id)}`,
		{
			provider: 'polar',
			...requestOptions,
		},
	);
	const normalized = withRaw(mapPolarCheckoutPayment(checkout), checkout, true);

	await database.repositories.checkouts.upsert(schema, normalized);
	return normalized;
};

/**
 * Synchronizes a Polar subscription into the Paymesh database.
 */
export const syncPolarSubscription = async ({
	id,
	schema,
	database,
	requestOptions,
}: ProviderDashboardSyncInput & { requestOptions?: RequestOptions }) => {
	const subscription = await request<PolarSubscription>(
		`/v1/subscriptions/${encodeURIComponent(id)}`,
		{
			provider: 'polar',
			...requestOptions,
		},
	);
	const type =
		subscription.canceled_at || subscription.ended_at
			? ('subscription.canceled' as const)
			: ('subscription.updated' as const);
	const event = withRaw(
		{
			id,
			provider: 'polar',
			type,
			data: withRaw(subscription, subscription, true),
		},
		subscription,
		true,
	);

	await database.repositories.subscriptions.upsert(schema, event);
	return event.data as unknown as Record<string, unknown>;
};
