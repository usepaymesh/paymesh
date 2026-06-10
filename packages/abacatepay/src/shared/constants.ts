import type {
	PaymentStatus,
	PaymeshEventType,
	ProviderCapabilities,
} from 'paymesh';

export const SANDBOXED_API_KEY_PREFIX = 'abc_dev_';

export const ABACATEPAY_CAPABILITIES = {
	checkout: true,
	pix: true,
	webhooks: true,
	customers: true,
	coupons: false,
	subscriptions: false,
	refunds: false,
	customerPortal: false,
} satisfies ProviderCapabilities;

export const ABACATEPAY_EVENTS: Record<string, PaymeshEventType> = {
	'checkout.completed': 'payment.succeeded',
	'checkout.refunded': 'payment.refunded',
	'checkout.disputed': 'payment.failed',
	'checkout.lost': 'payment.failed',
	'transparent.completed': 'payment.succeeded',
	'transparent.refunded': 'payment.refunded',
	'transparent.disputed': 'payment.failed',
	'transparent.lost': 'payment.failed',
	'customer.created': 'customer.created',
	'customer.updated': 'customer.updated',
	'customer.deleted': 'customer.deleted',
	'subscription.completed': 'subscription.created',
	'subscription.cancelled': 'subscription.canceled',
	'subscription.renewed': 'subscription.updated',
	'subscription.trial_started': 'subscription.created',
};

export const ABACATEPAY_HOOKS: Record<PaymeshEventType, string> = {
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

export const ABACATEPAY_PAYMENT_STATUSES: Record<string, PaymentStatus> = {
	PENDING: 'pending',
	PAID: 'paid',
	REFUNDED: 'refunded',
	CANCELLED: 'canceled',
	EXPIRED: 'failed',
};

export const ABACATEPAY_BASE_URL = 'https://api.abacatepay.com';

export const ABACATEPAY_PUBLIC_HMAC_KEY =
	't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';
