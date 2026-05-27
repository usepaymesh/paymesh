import { describe, expect, test } from 'bun:test';
import { createClient } from '../src';
import { stripe } from '../src/providers/stripe';

describe('stripe provider', () => {
	test('creates a checkout session using Stripe form params', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.test',
			fetch: (async (input, init) => {
				const body = init?.body as URLSearchParams;

				expect(String(input)).toBe('https://stripe.test/v1/checkout/sessions');
				expect(init?.method).toBe('POST');
				expect(init?.headers).toEqual({
					authorization: 'Bearer sk_test_123',
					'content-type': 'application/x-www-form-urlencoded',
				});
				expect(body.get('mode')).toBe('payment');
				expect(body.get('line_items[0][price_data][unit_amount]')).toBe('4900');
				expect(body.get('line_items[0][price_data][currency]')).toBe('brl');
				expect(body.get('line_items[0][price_data][product_data][name]')).toBe(
					'Pro plan',
				);
				expect(body.get('customer_email')).toBe('ana@example.com');
				expect(body.get('metadata[orderId]')).toBe('order_123');

				return Response.json({
					id: 'cs_test_123',
					object: 'checkout.session',
					amount_total: 4900,
					currency: 'brl',
					customer: 'cus_123',
					customer_details: {
						email: 'ana@example.com',
						name: 'Ana',
					},
					metadata: {
						orderId: 'order_123',
					},
					payment_status: 'unpaid',
					status: 'open',
					url: 'https://checkout.stripe.test/session',
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			amount: 4900,
			currency: 'BRL',
			description: 'Pro plan',
			successUrl: 'https://app.test/success',
			cancelUrl: 'https://app.test/cancel',
			customer: {
				email: 'ana@example.com',
			},
			metadata: {
				orderId: 'order_123',
			},
		});

		expect(payment).toMatchObject({
			id: 'cs_test_123',
			provider: 'stripe',
			amount: 4900,
			currency: 'brl',
			status: 'pending',
			checkoutUrl: 'https://checkout.stripe.test/session',
			customer: {
				id: 'cus_123',
				name: 'Ana',
				email: 'ana@example.com',
			},
		});
	});

	test('uses client request options when creating payments', async () => {
		let attempts = 0;
		let timeoutSignal: AbortSignal | undefined;
		const provider = stripe({
			secret: 'sk_test_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://stripe.client.test',
			timeout: 1234,
			retry: {
				max: 1,
			},
			fetch: (async (input, init) => {
				attempts += 1;
				timeoutSignal = init?.signal as AbortSignal;

				expect(String(input)).toBe(
					'https://stripe.client.test/v1/checkout/sessions',
				);

				if (attempts === 1) {
					return new Response('busy', { status: 500 });
				}

				return Response.json({
					id: 'cs_test_retry',
					object: 'checkout.session',
					amount_total: 1000,
					currency: 'usd',
					payment_status: 'paid',
					status: 'complete',
				});
			}) as typeof fetch,
		});

		const payment = await client.payments.create({
			amount: 1000,
			currency: 'USD',
		});

		expect(attempts).toBe(2);
		expect(timeoutSignal).toBeInstanceOf(AbortSignal);
		expect(payment.status).toBe('paid');
	});
});
