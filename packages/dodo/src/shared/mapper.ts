import type { BaseCustomer, BasePayment, BasePix } from 'paymesh';
import type {
	DodoCustomer,
	DodoPayment,
	DodoProductListResponse,
	DodoRefund,
	DodoSubscription,
} from '../types';
import {
	getDodoExternalId,
	isDodoPixPayment,
	mapDodoIntentStatus,
	mapDodoRefundStatusToPaymentStatus,
} from './utils';

export function mapDodoCustomer(
	customer: DodoCustomer,
	sandbox: boolean,
): BaseCustomer {
	return {
		id: customer.customer_id,
		provider: 'dodo',
		sandbox,
		externalId: getDodoExternalId(customer.metadata),
		name: customer.name,
		email: customer.email,
		phone: customer.phone_number ?? void 0,
		metadata: customer.metadata ?? void 0,
	};
}

export function mapDodoPayment(
	payment: DodoPayment,
	sandbox: boolean,
): BasePayment | BasePix {
	const customer = payment.customer
		? {
				id: payment.customer.customer_id,
				externalId: getDodoExternalId(payment.customer.metadata),
				name: payment.customer?.name,
				email: payment.customer.email,
				phone: payment.customer.phone_number ?? void 0,
			}
		: void 0;

	if (isDodoPixPayment(payment)) {
		return {
			id: payment.payment_id,
			provider: 'dodo',
			sandbox,
			amount: payment.total_amount,
			currency: payment.currency.toLowerCase(),
			status: mapDodoIntentStatus(payment.status),
			method: 'pix',
			customer,
			metadata: payment.metadata ?? void 0,
			checkoutUrl: payment.payment_link ?? void 0,
		};
	}

	return {
		id: payment.payment_id,
		provider: 'dodo',
		sandbox,
		amount: payment.total_amount,
		currency: payment.currency.toLowerCase(),
		status: mapDodoIntentStatus(payment.status),
		checkoutUrl: payment.payment_link ?? void 0,
		customer,
		metadata: payment.metadata ?? void 0,
	};
}

export function mapDodoRefundToPayment(
	refund: DodoRefund,
	sandbox: boolean,
): BasePayment {
	return {
		id: refund.payment_id,
		provider: 'dodo',
		sandbox,
		amount: refund.amount ?? 0,
		currency: refund.currency?.toLowerCase() ?? 'usd',
		status: mapDodoRefundStatusToPaymentStatus(refund.status),
		customer: refund.customer
			? {
					id: refund.customer.customer_id,
					externalId: getDodoExternalId(refund.customer.metadata),
					name: refund.customer.name,
					email: refund.customer.email,
					phone: refund.customer.phone_number ?? void 0,
				}
			: void 0,
		metadata: {
			...(refund.metadata ?? {}),
			refundId: refund.refund_id,
		},
	};
}

export function mapDodoSubscription(
	subscription: DodoSubscription,
	sandbox: boolean,
) {
	return {
		id: subscription.subscription_id,
		provider: 'dodo' as const,
		sandbox,
		customer: subscription.customer
			? {
					id: subscription.customer.customer_id,
					externalId: getDodoExternalId(subscription.customer.metadata),
					name: subscription?.customer?.name,
					email: subscription.customer.email,
					phone: subscription.customer.phone_number ?? void 0,
				}
			: void 0,
		productId: subscription.product_id,
		amount: subscription.recurring_pre_tax_amount,
		currency: subscription.currency.toLowerCase(),
		status: subscription.status,
		cancelAtPeriodEnd: subscription.cancel_at_next_billing_date,
		metadata: subscription.metadata ?? void 0,
		raw: subscription,
	};
}

export function mapDodoCatalogProduct(
	product: DodoProductListResponse,
	sandbox: boolean,
) {
	return {
		id: product.product_id,
		sandbox,
		name: product.name ?? void 0,
		description: product.description ?? void 0,
		active: true,
		metadata: product.metadata ?? void 0,
		version: product.metadata?.version ?? void 0,
		raw: product,
	};
}

export function mapDodoCatalogPrice(
	product: DodoProductListResponse,
	sandbox: boolean,
) {
	const price = product.price_detail;
	const type =
		price?.type === 'recurring_price'
			? 'recurring'
			: price?.type === 'usage_based_price'
				? 'usage_based'
				: 'one_time';

	return {
		id: `${product.product_id}_price`,
		sandbox,
		productId: product.product_id,
		active: true,
		type,
		currency: (price?.currency ?? product.currency ?? void 0)?.toLowerCase(),
		amount: price?.price ?? product.price ?? void 0,
		interval:
			price?.type === 'recurring_price' || price?.type === 'usage_based_price'
				? price.payment_frequency_interval?.toLowerCase()
				: void 0,
		intervalCount:
			price?.type === 'recurring_price' || price?.type === 'usage_based_price'
				? price.payment_frequency_count
				: void 0,
		metadata: product.metadata ?? void 0,
		version: product.metadata?.version ?? void 0,
		raw: product,
	};
}
