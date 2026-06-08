import { describe, expect, test } from 'bun:test';
import { createClient } from 'paymesh';
import { stripe } from '../src';

function expectType<T>(_value: T) {}

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
				expect(body.get('client_reference_id')).toBe('user_123');
				expect(body.get('metadata[orderId]')).toBe('order_123');

				return Response.json({
					id: 'cs_test_123',
					object: 'checkout.session',
					amount_total: 4900,
					client_reference_id: 'user_123',
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
				externalId: 'user_123',
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
				externalId: 'user_123',
				name: 'Ana',
				email: 'ana@example.com',
			},
		});
		expect(payment.raw).toBeNull();
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
		expect(payment.raw).toBeNull();
	});

	test('supports raw payment payloads globally and per call', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.payments.test',
			fetch: (async () =>
				Response.json({
					id: 'cs_test_raw',
					object: 'checkout.session',
					amount_total: 1200,
					currency: 'usd',
					payment_status: 'paid',
					status: 'complete',
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPayment = await defaultClient.payments.create({
			amount: 1200,
			currency: 'USD',
		});
		const callRawPayment = await defaultClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
			},
			{ includeRaw: true },
		);
		const globalRawPayment = await rawClient.payments.create({
			amount: 1200,
			currency: 'USD',
		});
		const callNullPayment = await rawClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
			},
			{ includeRaw: false },
		);

		expectType<null>(defaultPayment.raw);
		expectType<unknown>(callRawPayment.raw);
		expectType<unknown>(globalRawPayment.raw);
		expectType<null>(callNullPayment.raw);

		expect(defaultPayment.raw).toBeNull();
		expect(callRawPayment.raw).toMatchObject({
			id: 'cs_test_raw',
			object: 'checkout.session',
		});
		expect(globalRawPayment.raw).toMatchObject({
			id: 'cs_test_raw',
			object: 'checkout.session',
		});
		expect(callNullPayment.raw).toBeNull();
	});

	test('creates a PIX payment intent using Stripe form params', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.pix.test',
			fetch: (async (input, init) => {
				const body = init?.body as URLSearchParams;

				expect(String(input)).toBe(
					'https://stripe.pix.test/v1/payment_intents',
				);
				expect(init?.method).toBe('POST');
				expect(body.get('amount')).toBe('4900');
				expect(body.get('confirm')).toBe('true');
				expect(body.get('currency')).toBe('brl');
				expect(body.get('description')).toBe('PIX order');
				expect(body.get('customer')).toBe('cus_123');
				expect(body.get('receipt_email')).toBe('ana@example.com');
				expect(body.get('payment_method_data[type]')).toBe('pix');
				expect(body.get('payment_method_types[0]')).toBe('pix');
				expect(body.get('payment_method_data[billing_details][email]')).toBe(
					'ana@example.com',
				);
				expect(body.get('payment_method_data[billing_details][name]')).toBe(
					'Ana',
				);
				expect(body.get('payment_method_data[billing_details][phone]')).toBe(
					'+5511999999999',
				);
				expect(body.get('metadata[externalId]')).toBe('user_123');
				expect(body.get('metadata[orderId]')).toBe('ord_123');
				expect(
					body.get('payment_method_options[pix][amount_includes_iof]'),
				).toBe('never');
				expect(
					body.get('payment_method_options[pix][expires_after_seconds]'),
				).toBe('900');

				return Response.json({
					id: 'pi_pix_123',
					object: 'payment_intent',
					amount: 4900,
					currency: 'brl',
					customer: 'cus_123',
					metadata: {
						externalId: 'user_123',
						orderId: 'ord_123',
					},
					next_action: {
						type: 'pix_display_qr_code',
						pix_display_qr_code: {
							data: '000201010212',
							expires_at: 1760000000,
							hosted_instructions_url: 'https://stripe.test/pix/pi_pix_123',
							image_url_png: 'https://stripe.test/pix/pi_pix_123.png',
							image_url_svg: 'https://stripe.test/pix/pi_pix_123.svg',
						},
					},
					payment_method_options: {
						pix: {
							amount_includes_iof: 'never',
							expires_after_seconds: 900,
						},
					},
					payment_method_types: ['pix'],
					receipt_email: 'ana@example.com',
					status: 'requires_action',
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.create({
			amount: 4900,
			currency: 'BRL',
			description: 'PIX order',
			customer: {
				id: 'cus_123',
				email: 'ana@example.com',
				externalId: 'user_123',
				name: 'Ana',
				phone: '+5511999999999',
			},
			metadata: {
				orderId: 'ord_123',
			},
			pix: {
				amountIncludesIof: 'never',
				expiresAfterSeconds: 900,
			},
		});

		expect(pix).toMatchObject({
			id: 'pi_pix_123',
			provider: 'stripe',
			amount: 4900,
			currency: 'brl',
			status: 'pending',
			method: 'pix',
			copyPasteCode: '000201010212',
			instructionsUrl: 'https://stripe.test/pix/pi_pix_123',
			qrCodeImageUrlPng: 'https://stripe.test/pix/pi_pix_123.png',
			qrCodeImageUrlSvg: 'https://stripe.test/pix/pi_pix_123.svg',
			customer: {
				id: 'cus_123',
				email: 'ana@example.com',
				externalId: 'user_123',
			},
		});
		expect(pix?.expiresAt).toBe('2025-10-09T08:53:20.000Z');
		expect(pix?.raw).toBeNull();
	});

	test('fetches PIX payment intents and normalizes paid status', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.pix.test',
			fetch: (async (input, init) => {
				expect(String(input)).toBe(
					'https://stripe.pix.test/v1/payment_intents/pi_pix_paid',
				);
				expect(init?.method).toBeUndefined();

				return Response.json({
					id: 'pi_pix_paid',
					object: 'payment_intent',
					amount: 4900,
					currency: 'brl',
					metadata: {
						orderId: 'ord_paid',
					},
					payment_method_options: {
						pix: {
							expires_at: 1760000100,
						},
					},
					payment_method_types: ['pix'],
					status: 'succeeded',
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.get('pi_pix_paid');

		expect(pix).toMatchObject({
			id: 'pi_pix_paid',
			provider: 'stripe',
			amount: 4900,
			currency: 'brl',
			status: 'paid',
			method: 'pix',
			metadata: {
				orderId: 'ord_paid',
			},
		});
		expect(pix?.expiresAt).toBe('2025-10-09T08:55:00.000Z');
	});

	test('uses externalId as client reference when customer id is absent', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.test',
			fetch: (async (_input, init) => {
				const body = init?.body as URLSearchParams;

				expect(body.get('customer')).toBeNull();
				expect(body.get('client_reference_id')).toBe('user_ext_123');
				expect(body.get('customer_email')).toBe('ana@example.com');

				return Response.json({
					id: 'cs_test_external_id',
					object: 'checkout.session',
					amount_total: 1000,
					client_reference_id: 'user_ext_123',
					currency: 'usd',
					customer_email: 'ana@example.com',
					customer_details: {
						email: 'ana@example.com',
					},
					payment_status: 'paid',
					status: 'complete',
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			amount: 1000,
			currency: 'USD',
			customer: {
				email: 'ana@example.com',
				externalId: 'user_ext_123',
			},
		});

		expect(payment.customer).toMatchObject({
			externalId: 'user_ext_123',
			email: 'ana@example.com',
		});
	});

	test('supports raw webhook payloads per handle call', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
		});
		const payload = {
			id: 'evt_raw',
			type: 'payment_intent.succeeded',
			data: {
				object: {
					id: 'pi_raw',
					object: 'payment_intent',
					amount: 1200,
					currency: 'usd',
					status: 'succeeded',
				},
			},
		};

		const defaultEvent = (
			await provider.webhooks?.handle({
				request: new Request('https://app.test/webhooks', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
					},
					body: JSON.stringify(payload),
				}),
			})
		)?.event;
		const rawEvent = (
			await provider.webhooks?.handle({
				request: new Request('https://app.test/webhooks', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
					},
					body: JSON.stringify(payload),
				}),
				includeRaw: true,
			})
		)?.event;

		expectType<null>(defaultEvent?.raw ?? null);
		expectType<unknown>(rawEvent?.raw);

		expect(defaultEvent?.raw).toBeNull();
		expect(rawEvent?.raw).toEqual(payload);
		expect(defaultEvent?.data).toMatchObject({
			id: 'pi_raw',
			raw: null,
		});
		expect(rawEvent?.data).toMatchObject({
			id: 'pi_raw',
			raw: {
				id: 'pi_raw',
			},
		});
	});

	test('maps externalId from checkout session webhooks', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
		});
		const payload = {
			id: 'evt_checkout_completed',
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_completed',
					object: 'checkout.session',
					amount_total: 2200,
					client_reference_id: 'user_ext_123',
					currency: 'usd',
					customer_details: {
						email: 'ana@example.com',
					},
					payment_status: 'paid',
					status: 'complete',
				},
			},
		};

		const event = (
			await provider.webhooks?.handle({
				request: new Request('https://app.test/webhooks', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
					},
					body: JSON.stringify(payload),
				}),
			})
		)?.event;

		expect(event).toMatchObject({
			type: 'checkout.completed',
			data: {
				customer: {
					externalId: 'user_ext_123',
					email: 'ana@example.com',
				},
			},
		});
	});
});
