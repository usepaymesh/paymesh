import type { ProviderDashboardSyncInput } from 'paymesh';
import { request, withRaw } from 'paymesh';
import type { DodoCustomer, DodoPayment, DodoSubscription } from '../types';
import { mapDodoCustomer, mapDodoPayment, mapDodoSubscription } from './mapper';

type RequestOptions = Parameters<typeof request>[1];

export const syncDodoCustomer = async ({
	id,
	schema,
	database,
	sandbox,
	requestOptions,
}: ProviderDashboardSyncInput & {
	requestOptions?: RequestOptions;
	sandbox: boolean;
}) => {
	const customer = await request<DodoCustomer>(
		`/customers/${encodeURIComponent(id)}`,
		{
			provider: 'dodo',
			...requestOptions,
		},
	);

	const normalized = withRaw(
		mapDodoCustomer(customer, sandbox),
		customer,
		true,
	);

	await database.repositories.customers.upsert(schema, normalized);

	return normalized;
};

export const syncDodoPayment = async ({
	id,
	schema,
	database,
	sandbox,
	requestOptions,
}: ProviderDashboardSyncInput & {
	requestOptions?: RequestOptions;
	sandbox: boolean;
}) => {
	const payment = await request<DodoPayment>(
		`/payments/${encodeURIComponent(id)}`,
		{
			provider: 'dodo',
			...requestOptions,
		},
	);
	const normalizedPayment = mapDodoPayment(payment, sandbox);
	const normalized = withRaw(normalizedPayment, payment, true);

	const promises = [database.repositories.invoices.upsert(schema, normalized)];

	if ('method' in normalizedPayment && normalizedPayment.method === 'pix')
		promises.push(
			database.repositories.pix.upsert(
				schema,
				normalized as Extract<typeof normalized, { method: 'pix' }>,
			),
		);

	await Promise.all(promises);

	return normalized;
};

export const syncDodoSubscription = async ({
	id,
	schema,
	database,
	sandbox,
	requestOptions,
}: ProviderDashboardSyncInput & {
	requestOptions?: RequestOptions;
	sandbox: boolean;
}) => {
	const subscription = await request<DodoSubscription>(
		`/subscriptions/${encodeURIComponent(id)}`,
		{
			provider: 'dodo',
			...requestOptions,
		},
	);
	const type =
		subscription.status === 'cancelled' || subscription.status === 'expired'
			? ('subscription.canceled' as const)
			: ('subscription.updated' as const);

	const event = withRaw(
		{
			id,
			type,
			sandbox,
			provider: 'dodo',
			data: withRaw(
				{
					...mapDodoSubscription(subscription, sandbox),
				},
				subscription,
				true,
			),
		},
		subscription,
		true,
	);

	await database.repositories.subscriptions.upsert(schema, event);

	return event.data as unknown as Record<string, unknown>;
};
