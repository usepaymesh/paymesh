import type { BaseCustomer, BasePayment, BasePix } from 'paymesh';
import type {
	AbacatePayCheckout,
	AbacatePayCustomer,
	AbacatePayTransparentCharge,
} from '../types';
import { ABACATEPAY_PAYMENT_STATUSES } from './constants';

function resolveStatus(raw?: string) {
	if (!raw) return 'pending';

	return ABACATEPAY_PAYMENT_STATUSES[raw] ?? 'pending';
}

export function mapAbacatePayCheckout(
	checkout: AbacatePayCheckout,
	sandbox: boolean,
): BasePayment {
	return {
		id: checkout.id,
		provider: 'abacatepay',
		sandbox,
		amount: checkout.amount,
		currency: 'BRL',
		status: resolveStatus(checkout.status),
		checkoutUrl: checkout.url,
		customer: checkout.customerId ? { id: checkout.customerId } : undefined,
		metadata: checkout.externalId
			? { externalId: checkout.externalId }
			: undefined,
	};
}

export function mapAbacatePayTransparentCharge(
	charge: AbacatePayTransparentCharge,
	sandbox: boolean,
): BasePix {
	return {
		id: charge.id,
		provider: 'abacatepay',
		sandbox,
		amount: charge.amount,
		currency: 'BRL',
		status: resolveStatus(charge.status),
		method: 'pix',
		copyPasteCode: charge.brCode ?? undefined,
		qrCodeImageUrlPng: charge.brCodeBase64 ?? undefined,
		expiresAt: charge.expiresAt ?? undefined,
		metadata: charge.metadata ?? undefined,
	};
}

export function mapAbacatePayCustomer(
	customer: AbacatePayCustomer,
	sandbox: boolean,
): BaseCustomer {
	return {
		id: customer.id,
		provider: 'abacatepay',
		sandbox,
		externalId: undefined,
		name: customer.name ?? undefined,
		email: customer.email ?? undefined,
		phone: customer.cellphone ?? undefined,
		metadata: customer.metadata ?? undefined,
	};
}
