import type { PaymeshEventType } from 'paymesh';

export function createFakeData(providerId: string, type: PaymeshEventType) {
	switch (type) {
		case 'payment.created':
			return payment(providerId, 'pending');
		case 'payment.succeeded':
			return payment(providerId, 'paid');
		case 'payment.failed':
			return payment(providerId, 'failed');
		case 'payment.canceled':
			return payment(providerId, 'canceled');
		case 'payment.refunded':
			return payment(providerId, 'refunded');
		case 'customer.created':
		case 'customer.updated':
			return {
				id: 'cus_trigger_demo',
				provider: providerId,
				email: 'trigger@example.com',
				name: 'Trigger Demo',
			};
		case 'customer.deleted':
			return {
				id: 'cus_trigger_demo',
				provider: providerId,
				deleted: true,
			};
		case 'subscription.created':
			return subscription(providerId, 'active');
		case 'subscription.updated':
			return subscription(providerId, 'past_due');
		case 'subscription.canceled':
			return subscription(providerId, 'canceled');
		case 'checkout.completed':
			return payment(providerId, 'paid');
	}
}

function payment(providerId: string, status: string) {
	return {
		id: 'pay_trigger_demo',
		provider: providerId,
		amount: 1990,
		currency: 'usd',
		status,
		customerId: 'cus_trigger_demo',
	};
}

function subscription(providerId: string, status: string) {
	return {
		id: 'sub_trigger_demo',
		provider: providerId,
		status,
		customerId: 'cus_trigger_demo',
		priceId: 'price_trigger_demo',
	};
}
