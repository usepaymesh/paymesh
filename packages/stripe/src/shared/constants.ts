import type {
	PaymentStatus,
	PaymeshEventType,
	ProviderCapabilities,
} from 'paymesh';

export const STRIPE_CAPABILITIES = {
	checkout: true,
	coupons: true,
	pix: true,
	refunds: true,
	subscriptions: true,
	webhooks: true,
	customerPortal: true,
	customers: true,
} satisfies ProviderCapabilities;

export const STRIPE_EVENTS: Record<string, PaymeshEventType> = {
	'checkout.session.completed': 'checkout.completed',
	'checkout.session.expired': 'payment.canceled',
	'payment_intent.created': 'payment.created',
	'payment_intent.succeeded': 'payment.succeeded',
	'payment_intent.payment_failed': 'payment.failed',
	'payment_intent.canceled': 'payment.canceled',
	'charge.refunded': 'payment.refunded',
	'customer.created': 'customer.created',
	'customer.updated': 'customer.updated',
	'customer.deleted': 'customer.deleted',
};

export const STRIPE_HOOKS: Record<PaymeshEventType, string> = {
	'payment.created': 'onPaymentCreated',
	'payment.succeeded': 'onPaymentSucceeded',
	'payment.failed': 'onPaymentFailed',
	'payment.canceled': 'onPaymentCanceled',
	'payment.refunded': 'onPaymentRefunded',
	'customer.created': 'onCustomerCreated',
	'customer.updated': 'onCustomerUpdated',
	'customer.deleted': 'onCustomerDeleted',
	'subscription.created': 'onSubscriptionCreated',
	'subscription.updated': 'onSubscriptionUpdated',
	'subscription.canceled': 'onSubscriptionCanceled',
	'checkout.completed': 'onCheckoutCompleted',
};

export const STRIPE_PAYMENT_STATUSES: Record<string, PaymentStatus> = {
	processing: 'processing',
	paid: 'paid',
	expired: 'canceled',
	requires_action: 'pending',
	requires_payment_method: 'failed',
	succeeded: 'paid',
	failed: 'failed',
	canceled: 'canceled',
};

export const STRIPE_BASE_URL = 'https://api.stripe.com';
