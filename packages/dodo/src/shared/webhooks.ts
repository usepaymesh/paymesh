import type { PaymeshEventType } from 'paymesh';
import { withRaw } from 'paymesh';
import type { DodoWebhookPayload } from '../types';
import { DODO_EVENTS, DODO_HOOKS } from './constants';
import {
	mapDodoPayment,
	mapDodoRefundToPayment,
	mapDodoSubscription,
} from './mapper';

function isDodoPaymentWebhook(event: DodoWebhookPayload): event is Extract<
	DodoWebhookPayload,
	{
		type:
			| 'payment.succeeded'
			| 'payment.failed'
			| 'payment.processing'
			| 'payment.cancelled';
	}
> {
	return (
		event.type === 'payment.succeeded' ||
		event.type === 'payment.failed' ||
		event.type === 'payment.processing' ||
		event.type === 'payment.cancelled'
	);
}

function isDodoRefundWebhook(
	event: DodoWebhookPayload,
): event is Extract<
	DodoWebhookPayload,
	{ type: 'refund.succeeded' | 'refund.failed' }
> {
	return event.type === 'refund.succeeded' || event.type === 'refund.failed';
}

function isDodoSubscriptionWebhook(event: DodoWebhookPayload): event is Extract<
	DodoWebhookPayload,
	{
		type:
			| 'subscription.active'
			| 'subscription.renewed'
			| 'subscription.on_hold'
			| 'subscription.paused'
			| 'subscription.cancelled'
			| 'subscription.failed'
			| 'subscription.expired'
			| 'subscription.plan_changed'
			| 'subscription.updated';
	}
> {
	return event.type.startsWith('subscription.');
}

export function resolveDodoWebhookType(type: string): PaymeshEventType {
	return DODO_EVENTS[type] ?? 'payment.created';
}

export function resolveDodoWebhookHook(type: PaymeshEventType) {
	return DODO_HOOKS[type];
}

export function resolveDodoWebhookData(
	event: DodoWebhookPayload,
	_type: PaymeshEventType,
	includeRaw: boolean,
	sandbox: boolean,
) {
	if (isDodoPaymentWebhook(event)) {
		return withRaw(mapDodoPayment(event.data, sandbox), event.data, includeRaw);
	}

	if (isDodoRefundWebhook(event)) {
		return withRaw(
			mapDodoRefundToPayment(event.data, sandbox),
			event.data,
			includeRaw,
		);
	}

	if (isDodoSubscriptionWebhook(event)) {
		return withRaw(
			mapDodoSubscription(event.data, sandbox),
			event.data,
			includeRaw,
		);
	}

	return withRaw(
		{
			...event.data,
			provider: 'dodo',
			sandbox,
		},
		event.data,
		includeRaw,
	);
}

export function resolveDodoWebhookEventId(event: DodoWebhookPayload) {
	if (isDodoPaymentWebhook(event)) return event.data.payment_id;
	if (isDodoRefundWebhook(event)) return event.data.refund_id;
	if (isDodoSubscriptionWebhook(event)) return event.data.subscription_id;
	return `${event.type}:${event.timestamp}`;
}
