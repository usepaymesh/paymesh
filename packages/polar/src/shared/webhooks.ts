import type { PaymeshEventType } from 'paymesh';
import { withRaw } from 'paymesh';
import type {
	PolarCheckout,
	PolarCustomer,
	PolarOrder,
	PolarSubscription,
	PolarWebhookEvent,
} from '../types';
import {
	mapPolarCheckoutPayment,
	mapPolarCustomer,
	mapPolarOrderPayment,
} from './mapper';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Resolves the normalized Paymesh event type for a Polar webhook event.
 */
export function resolvePolarWebhookType(
	event: PolarWebhookEvent,
): PaymeshEventType {
	switch (event.type) {
		case 'checkout.created':
			return 'payment.created';
		case 'checkout.updated': {
			const checkout = event.data as PolarCheckout;
			return checkout.status === 'succeeded'
				? 'checkout.completed'
				: checkout.status === 'expired'
					? 'payment.canceled'
					: 'payment.created';
		}
		case 'order.created':
			return 'payment.created';
		case 'order.paid':
			return 'payment.succeeded';
		case 'order.refunded':
			return 'payment.refunded';
		case 'customer.created':
			return 'customer.created';
		case 'customer.updated':
		case 'customer.state_changed':
			return 'customer.updated';
		case 'customer.deleted':
			return 'customer.deleted';
		case 'subscription.created':
			return 'subscription.created';
		case 'subscription.canceled':
		case 'subscription.revoked':
			return 'subscription.canceled';
		case 'subscription.updated': {
			const subscription = event.data as PolarSubscription;
			return subscription.canceled_at || subscription.ended_at
				? 'subscription.canceled'
				: 'subscription.updated';
		}
		default:
			return 'payment.created';
	}
}

/**
 * Resolves the normalized webhook payload for Polar events.
 */
export function resolvePolarWebhookData(
	type: PaymeshEventType,
	event: PolarWebhookEvent,
	includeRaw: boolean,
) {
	let data: unknown = event.data;

	if (
		type === 'checkout.completed' ||
		type === 'payment.created' ||
		type === 'payment.succeeded' ||
		type === 'payment.refunded' ||
		type === 'payment.canceled'
	) {
		if (isRecord(event.data) && 'status' in event.data) {
			const checkout = event.data as unknown as PolarCheckout;
			data = withRaw(mapPolarCheckoutPayment(checkout), checkout, includeRaw);
		} else if (isRecord(event.data)) {
			const order = event.data as unknown as PolarOrder;
			data = withRaw(mapPolarOrderPayment(order), order, includeRaw);
		}
	} else if (type === 'customer.created' || type === 'customer.updated') {
		const customer = event.data as PolarCustomer;
		data = withRaw(mapPolarCustomer(customer), customer, includeRaw);
	} else if (type === 'customer.deleted') {
		const customer = event.data as PolarCustomer;
		data = withRaw(
			{
				id: customer.id,
				provider: 'polar',
				deleted: true,
			},
			customer,
			includeRaw,
		);
	} else if (
		type === 'subscription.created' ||
		type === 'subscription.updated' ||
		type === 'subscription.canceled'
	) {
		const subscription = event.data as PolarSubscription;
		data = withRaw(subscription, subscription, includeRaw);
	}

	return data;
}

/**
 * Resolves the webhook delivery id from event data when available.
 */
export function resolvePolarWebhookId(event: PolarWebhookEvent) {
	let id = `${event.type}:${event.timestamp}`;
	if (
		event.data &&
		typeof event.data === 'object' &&
		'id' in event.data &&
		typeof event.data.id === 'string'
	) {
		id = event.data.id;
	}

	return id;
}

/**
 * Resolves the webhook hook name for a normalized Paymesh event type.
 */
export function resolvePolarWebhookHook(type: PaymeshEventType) {
	switch (type) {
		case 'payment.created':
			return 'onPaymentCreated';
		case 'payment.succeeded':
			return 'onPaymentSucceeded';
		case 'payment.canceled':
			return 'onPaymentCanceled';
		case 'payment.refunded':
			return 'onPaymentRefunded';
		case 'customer.created':
			return 'onCustomerCreated';
		case 'customer.updated':
			return 'onCustomerUpdated';
		case 'customer.deleted':
			return 'onCustomerDeleted';
		case 'subscription.created':
			return 'onSubscriptionCreated';
		case 'subscription.updated':
			return 'onSubscriptionUpdated';
		case 'subscription.canceled':
			return 'onSubscriptionCanceled';
		case 'checkout.completed':
			return 'onCheckoutCompleted';
		default:
			return undefined;
	}
}
