import type { BaseAnyPayment, BasePayment, PaymentStatus } from 'paymesh';
import type {
	StripeCheckoutSession,
	StripeCustomer,
	StripePaymentObject,
} from '../types';
import { STRIPE_PAYMENT_STATUSES } from './constants';
import { getStripeExternalId, isStripePixPaymentIntent } from './utils';

export function mapStripeCustomer(customer: StripeCustomer, sandbox: boolean) {
	return {
		id: customer.id,
		provider: 'stripe' as const,
		sandbox,
		externalId: getStripeExternalId(customer.metadata),
		name: customer.name ?? undefined,
		email: customer.email ?? undefined,
		phone: customer.phone ?? undefined,
		metadata: customer.metadata ?? undefined,
	};
}

export function mapStripePaymentObject(
	payment: StripeCheckoutSession,
	sandbox: boolean,
): BasePayment;
export function mapStripePaymentObject(
	payment: StripePaymentObject,
	sandbox: boolean,
): BaseAnyPayment;

export function mapStripePaymentObject(
	payment: StripePaymentObject,
	sandbox: boolean,
): BaseAnyPayment {
	if (
		payment.object === 'payment_intent' &&
		isStripePixPaymentIntent(payment)
	) {
		return mapStripePixIntent(payment, sandbox);
	}

	const status: PaymentStatus =
		('payment_status' in payment &&
			STRIPE_PAYMENT_STATUSES[
				payment.payment_status ?? payment.status ?? ''
			]) ||
		('refunded' in payment && payment.refunded && 'refunded') ||
		STRIPE_PAYMENT_STATUSES[payment.status ?? ''] ||
		'pending';

	let customer:
		| {
				email?: string;
				externalId?: string;
				id?: string;
				name?: string;
				phone?: string;
		  }
		| undefined;

	if ('customer_details' in payment) {
		customer = {
			id: typeof payment.customer === 'string' ? payment.customer : undefined,
			externalId:
				'client_reference_id' in payment
					? (payment.client_reference_id ?? undefined)
					: undefined,
			name: payment.customer_details?.name ?? undefined,
			email:
				payment.customer_details?.email ?? payment.customer_email ?? undefined,
			phone: payment.customer_details?.phone ?? undefined,
		};
	} else if (payment.object === 'payment_intent') {
		if (
			typeof payment.customer === 'string' ||
			typeof payment.receipt_email === 'string' ||
			getStripeExternalId(payment.metadata)
		) {
			customer = {
				id: typeof payment.customer === 'string' ? payment.customer : undefined,
				email: payment.receipt_email ?? undefined,
				externalId: getStripeExternalId(payment.metadata),
			};
		}
	}

	return {
		id: payment.id,
		provider: 'stripe' as const,
		sandbox,
		amount:
			'amount_total' in payment
				? (payment.amount_total ?? 0)
				: 'amount' in payment
					? payment.amount
					: 0,
		currency: payment.currency ?? 'usd',
		status,
		checkoutUrl: 'url' in payment ? (payment.url ?? undefined) : undefined,
		customer,
		metadata: payment.metadata ?? undefined,
	};
}

export function mapStripePixIntent(
	payment: Extract<StripePaymentObject, { object: 'payment_intent' }>,
	sandbox: boolean,
): Extract<BaseAnyPayment, { method: 'pix' }> {
	const status: PaymentStatus =
		STRIPE_PAYMENT_STATUSES[payment.status ?? ''] ?? 'pending';

	const qrCode = payment.next_action?.pix_display_qr_code;

	return {
		id: payment.id,
		provider: 'stripe' as const,
		sandbox,
		amount: payment.amount,
		copyPasteCode: qrCode?.data ?? undefined,
		currency: payment.currency ?? 'brl',
		customer:
			typeof payment.customer === 'string' ||
			typeof payment.receipt_email === 'string' ||
			getStripeExternalId(payment.metadata)
				? {
						id:
							typeof payment.customer === 'string'
								? payment.customer
								: undefined,
						email: payment.receipt_email ?? undefined,
						externalId: getStripeExternalId(payment.metadata),
					}
				: undefined,
		expiresAt:
			typeof qrCode?.expires_at === 'number'
				? new Date(qrCode.expires_at * 1000).toISOString()
				: typeof payment.payment_method_options?.pix?.expires_at === 'number'
					? new Date(
							payment.payment_method_options.pix.expires_at * 1000,
						).toISOString()
					: undefined,
		instructionsUrl: qrCode?.hosted_instructions_url ?? undefined,
		metadata: payment.metadata ?? undefined,
		method: 'pix' as const,
		qrCodeImageUrlPng: qrCode?.image_url_png ?? undefined,
		qrCodeImageUrlSvg: qrCode?.image_url_svg ?? undefined,
		status,
	};
}
