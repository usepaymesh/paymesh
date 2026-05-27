import { createHmac, timingSafeEqual } from 'node:crypto';
import { request } from '../shared/request';
import type {
	Payment,
	PaymentStatus,
	PaymeshEvent,
	PaymeshEventType,
	ProviderCapabilities,
	ProviderRequestOptions,
} from '../types/providers';
import type {
	StripeCheckoutSession,
	StripeEvent,
	StripePaymentObject,
	StripeProviderOptions,
} from '../types/providers/stripe';
import { defineProvider } from '.';

const STRIPE_BASE_URL = 'https://api.stripe.com';

const STRIPE_CAPABILITIES = {
	checkout: true,
	coupons: true,
	pix: false,
	refunds: true,
	subscriptions: true,
	webhooks: true,
	customerPortal: true,
} satisfies ProviderCapabilities;

const STRIPE_EVENTS: Record<string, PaymeshEventType> = {
	'checkout.session.completed': 'checkout.completed',
	'checkout.session.expired': 'payment.canceled',
	'payment_intent.created': 'payment.created',
	'payment_intent.succeeded': 'payment.succeeded',
	'payment_intent.payment_failed': 'payment.failed',
	'payment_intent.canceled': 'payment.canceled',
	'charge.refunded': 'payment.refunded',
};

const STRIPE_PAYMENT_STATUSES: Record<string, PaymentStatus> = {
	paid: 'paid',
	expired: 'canceled',
	succeeded: 'paid',
	failed: 'failed',
	canceled: 'canceled',
};

export const stripe = ({
	secret = process.env.STRIPE_API_KEY,
	webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
	baseUrl = STRIPE_BASE_URL,
	retry,
	timeout,
	fetch,
}: StripeProviderOptions = {}) =>
	defineProvider({
		id: 'stripe',
		capabilities: STRIPE_CAPABILITIES,
		payments: {
			async create(data, options?: ProviderRequestOptions) {
				const body = new URLSearchParams({
					mode: 'payment',
					'line_items[0][quantity]': '1',
					'line_items[0][price_data][currency]': data.currency.toLowerCase(),
					'line_items[0][price_data][unit_amount]': String(data.amount),
					'line_items[0][price_data][product_data][name]':
						data.description ?? 'Payment',
				});

				if (data.successUrl) body.set('success_url', data.successUrl);
				if (data.cancelUrl) body.set('cancel_url', data.cancelUrl);
				if (data.customer?.id)
					body.set('client_reference_id', data.customer.id);
				if (data.customer?.email)
					body.set('customer_email', data.customer.email);

				for (const [key, value] of Object.entries(data.metadata ?? {})) {
					if (value !== null) body.set(`metadata[${key}]`, String(value));
				}

				const session = await request<StripeCheckoutSession>(
					'/v1/checkout/sessions',
					{
						baseUrl: options?.baseUrl ?? baseUrl,
						timeout: options?.timeout ?? timeout,
						retry: options?.retry ?? retry,
						fetch: options?.fetch ?? fetch,
						method: 'POST',
						headers: {
							authorization: `Bearer ${secret}`,
							'content-type': 'application/x-www-form-urlencoded',
						},
						body,
					},
				);

				return toPayment(session);
			},
		},
		webhooks: {
			map(body): PaymeshEvent {
				const event = body as unknown as StripeEvent;
				const object = event.data?.object;

				return {
					id: event.id,
					type: STRIPE_EVENTS[event.type] ?? 'payment.created',
					provider: 'stripe',
					data: object ? toPayment(object) : body,
					raw: body,
				};
			},
			async verify({ request }) {
				if (!webhookSecret) return false;

				const signature = new URLSearchParams(
					request.headers.get('stripe-signature')?.replaceAll(',', '&'),
				);
				const timestamp = signature.get('t');
				const expected = signature.get('v1');
				if (!timestamp || !expected) return false;

				const payload = `${timestamp}.${await request.text()}`;
				const actual = createHmac('sha256', webhookSecret)
					.update(payload)
					.digest('hex');

				return (
					actual.length === expected.length &&
					timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
				);
			},
		},
	});

function toPayment(data: StripePaymentObject): Payment {
	const status: PaymentStatus =
		('payment_status' in data &&
			STRIPE_PAYMENT_STATUSES[data.payment_status ?? data.status ?? '']) ||
		('refunded' in data && data.refunded && 'refunded') ||
		STRIPE_PAYMENT_STATUSES[data.status ?? ''] ||
		'pending';

	return {
		id: data.id,
		provider: 'stripe',
		amount:
			'amount_total' in data
				? (data.amount_total ?? 0)
				: 'amount' in data
					? data.amount
					: 0,
		currency: data.currency ?? 'usd',
		status,
		checkoutUrl: 'url' in data ? (data.url ?? undefined) : undefined,
		customer:
			'customer_details' in data
				? {
						id: typeof data.customer === 'string' ? data.customer : undefined,
						name: data.customer_details?.name ?? undefined,
						email:
							data.customer_details?.email ?? data.customer_email ?? undefined,
						phone: data.customer_details?.phone ?? undefined,
					}
				: undefined,
		metadata: data.metadata ?? undefined,
		raw: data,
	};
}
