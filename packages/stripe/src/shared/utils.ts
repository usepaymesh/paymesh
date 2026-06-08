import type { StripePaymentObject } from '../types';

export function getStripeExternalId(metadata?: Record<string, string> | null) {
	return typeof metadata?.externalId === 'string' &&
		metadata.externalId.length > 0
		? metadata.externalId
		: undefined;
}

export function isStripePixPaymentIntent(
	payment: Extract<StripePaymentObject, { object: 'payment_intent' }>,
) {
	return (
		payment.payment_method_types?.includes('pix') === true ||
		payment.payment_method_options?.pix != null ||
		payment.next_action?.type === 'pix_display_qr_code'
	);
}
