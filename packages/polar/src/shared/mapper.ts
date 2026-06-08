import type { PaymentStatus } from 'paymesh';
import type { PolarCheckout, PolarCustomer, PolarOrder } from '../types';

/**
 * Maps a Polar customer payload into a normalized Paymesh customer.
 */
export function mapPolarCustomer(customer: PolarCustomer) {
	return {
		id: customer.id,
		provider: 'polar' as const,
		externalId: customer.external_id ?? undefined,
		name: customer.name ?? undefined,
		email: customer.email ?? undefined,
		metadata: customer.metadata ?? undefined,
	};
}

/**
 * Maps a Polar checkout into a normalized Paymesh payment.
 */
export function mapPolarCheckoutPayment(checkout: PolarCheckout) {
	let status: PaymentStatus = 'pending';
	if (checkout.status === 'succeeded') status = 'paid';
	if (checkout.status === 'expired') status = 'canceled';
	if (checkout.status === 'failed') status = 'failed';

	return {
		id: checkout.id,
		provider: 'polar' as const,
		amount: checkout.total_amount ?? checkout.amount ?? 0,
		currency: checkout.currency ?? 'usd',
		status,
		checkoutUrl: checkout.url ?? undefined,
		customer:
			checkout.customer_id != null ||
			checkout.external_customer_id != null ||
			checkout.customer_name != null ||
			checkout.customer_email != null
				? {
						id: checkout.customer_id ?? undefined,
						externalId: checkout.external_customer_id ?? undefined,
						name: checkout.customer_name ?? undefined,
						email: checkout.customer_email ?? undefined,
					}
				: undefined,
		metadata: checkout.metadata ?? undefined,
	};
}

/**
 * Maps a Polar order into a normalized Paymesh payment.
 */
export function mapPolarOrderPayment(order: PolarOrder) {
	const status: PaymentStatus =
		order.status === 'refunded'
			? 'refunded'
			: order.status === 'void'
				? 'canceled'
				: order.paid
					? 'paid'
					: 'pending';

	return {
		id: order.id,
		provider: 'polar' as const,
		amount: order.total_amount ?? 0,
		currency: order.currency ?? 'usd',
		status,
		customer: order.customer
			? {
					id: order.customer.id,
					externalId: order.customer.external_id ?? undefined,
					name: order.customer.name ?? undefined,
					email: order.customer.email ?? undefined,
				}
			: order.customer_id
				? { id: order.customer_id }
				: undefined,
		metadata: order.metadata ?? undefined,
	};
}
