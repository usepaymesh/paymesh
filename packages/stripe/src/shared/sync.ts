import type { ProviderDashboardSyncInput } from 'paymesh';
import { PaymeshError, request, withRaw } from 'paymesh';
import type {
	StripeCheckoutSession,
	StripePaymentObject,
	StripeSubscription,
} from '../types';
import { mapStripePaymentObject, mapStripePixIntent } from './mapper';
import { isStripePixPaymentIntent } from './utils';

type RequestOptions = Parameters<typeof request>[1];

export const syncStripePix = async ({
	id,
	schema,
	database,
	requestOptions,
}: ProviderDashboardSyncInput & { requestOptions?: RequestOptions }) => {
	if (!id.startsWith('pi_'))
		throw new PaymeshError({
			code: 'invalid_request',
			message:
				'Provider "stripe" requires a PaymentIntent id when fetching PIX payments',
			provider: 'stripe',
		});

	const paymentIntent = await request<
		Extract<StripePaymentObject, { object: 'payment_intent' }>
	>(`/v1/payment_intents/${encodeURIComponent(id)}`, {
		provider: 'stripe',
		...requestOptions,
	});

	if (!isStripePixPaymentIntent(paymentIntent))
		throw new PaymeshError({
			code: 'provider_not_found',
			message: `PIX payment "${id}" was not found on Stripe`,
			provider: 'stripe',
		});

	const normalized = withRaw(
		mapStripePixIntent(paymentIntent),
		paymentIntent,
		true,
	);

	await Promise.all([
		database.repositories.pix.upsert(schema, normalized),
		database.repositories.invoices.upsert(schema, normalized),
	]);

	return normalized;
};

export const syncStripeSubscription = async ({
	id,
	schema,
	database,
	requestOptions,
}: ProviderDashboardSyncInput & { requestOptions?: RequestOptions }) => {
	const subscription = await request<StripeSubscription>(
		`/v1/subscriptions/${encodeURIComponent(id)}`,
		{
			provider: 'stripe',
			...requestOptions,
		},
	);
	const eventType =
		subscription.status === 'canceled'
			? ('subscription.canceled' as const)
			: ('subscription.updated' as const);
	const event = withRaw(
		{
			id,
			provider: 'stripe',
			type: eventType,
			data: withRaw(subscription, subscription, true),
		},
		subscription,
		true,
	);

	await database.repositories.subscriptions.upsert(schema, event);

	return event.data as unknown as Record<string, unknown>;
};

export const syncStripePayment = async ({
	id,
	schema,
	database,
	requestOptions,
}: ProviderDashboardSyncInput & { requestOptions: RequestOptions }) => {
	const payment = await readStripePayment(id, requestOptions);

	if (payment.kind === 'checkout') {
		const checkout = payment.raw as StripeCheckoutSession;
		const normalized = withRaw(
			mapStripePaymentObject(checkout),
			checkout,
			true,
		);

		await database.repositories.checkouts.upsert(schema, normalized);

		return normalized;
	}

	const paymentObject = payment.raw as StripePaymentObject;
	const normalizedPayment = mapStripePaymentObject(paymentObject);
	const normalized = withRaw(normalizedPayment, paymentObject, true);

	const promises = [database.repositories.invoices.upsert(schema, normalized)];

	if ('method' in normalizedPayment && normalizedPayment.method === 'pix') {
		promises.push(
			database.repositories.pix.upsert(
				schema,
				normalized as Extract<typeof normalized, { method: 'pix' }>,
			),
		);
	}

	await Promise.all(promises);

	return normalized;
};

const readStripePayment = async (
	id: string,
	requestOptions: RequestOptions,
) => {
	if (id.startsWith('cs_'))
		return {
			kind: 'checkout' as const,
			raw: await request<StripeCheckoutSession>(
				`/v1/checkout/sessions/${encodeURIComponent(id)}`,
				{
					provider: 'stripe',
					...requestOptions,
				},
			),
		};

	if (id.startsWith('pi_'))
		return {
			kind: 'invoice' as const,
			raw: await request<
				Extract<StripePaymentObject, { object: 'payment_intent' }>
			>(`/v1/payment_intents/${encodeURIComponent(id)}`, {
				provider: 'stripe',
				...requestOptions,
			}),
		};

	return {
		kind: 'invoice' as const,
		raw: await request<Extract<StripePaymentObject, { object: 'charge' }>>(
			`/v1/charges/${encodeURIComponent(id)}`,
			{
				provider: 'stripe',
				...requestOptions,
			},
		),
	};
};
