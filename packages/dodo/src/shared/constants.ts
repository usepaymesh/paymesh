import type {
	PaymentStatus,
	PaymeshEventType,
	ProviderCapabilities,
} from 'paymesh';

export const DODO_LIVE_BASE_URL = 'https://live.dodopayments.com';
export const DODO_TEST_BASE_URL = 'https://test.dodopayments.com';

export const DODO_CAPABILITIES = {
	checkout: true,
	pix: false,
	coupons: false,
	refunds: false,
	subscriptions: true,
	webhooks: true,
	customerPortal: false,
	customers: true,
} satisfies ProviderCapabilities;

export const DODO_PAYMENT_STATUSES: Record<string, PaymentStatus> = {
	succeeded: 'paid',
	failed: 'failed',
	cancelled: 'canceled',
	processing: 'processing',
	requires_customer_action: 'pending',
	requires_merchant_action: 'pending',
	requires_payment_method: 'failed',
	requires_confirmation: 'pending',
	requires_capture: 'processing',
	partially_captured: 'processing',
	partially_captured_and_capturable: 'processing',
	pending: 'pending',
	active: 'paid',
	on_hold: 'processing',
	expired: 'canceled',
};

export const DODO_EVENTS: Record<string, PaymeshEventType> = {
	'payment.succeeded': 'payment.succeeded',
	'payment.failed': 'payment.failed',
	'payment.processing': 'payment.created',
	'payment.cancelled': 'payment.canceled',
	'refund.succeeded': 'payment.refunded',
	'refund.failed': 'payment.failed',
	'subscription.active': 'subscription.created',
	'subscription.renewed': 'subscription.updated',
	'subscription.on_hold': 'subscription.updated',
	'subscription.paused': 'subscription.updated',
	'subscription.cancelled': 'subscription.canceled',
	'subscription.failed': 'subscription.updated',
	'subscription.expired': 'subscription.canceled',
	'subscription.plan_changed': 'subscription.updated',
	'subscription.updated': 'subscription.updated',
} satisfies Record<string, PaymeshEventType>;

export const DODO_HOOKS: Record<PaymeshEventType, string> = {
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

export const DODO_PIX_METHOD_TYPES = ['pix', 'credit', 'debit'] as const;
