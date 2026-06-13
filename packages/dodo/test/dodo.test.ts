import { describe, expect, test } from 'bun:test';
import { createClient } from 'paymesh';
import { dodo } from '../src';

function expectType<T>(_value: T) {}

describe('dodo provider', () => {
	test('creates a hosted payment link using Dodo product carts', async () => {
		const provider = dodo({
			apiKey: 'dodo_test_123',
			baseUrl: 'https://test.dodopayments.com',
			fetch: (async (input, init) => {
				expect(String(input)).toBe('https://test.dodopayments.com/payments');
				expect(init?.method).toBe('POST');
				expect(init?.headers).toEqual({
					authorization: 'Bearer dodo_test_123',
					'content-type': 'application/json',
				});

				const body = JSON.parse(String(init?.body));
				expect(body).toEqual({
					billing: {
						country: 'BR',
					},
					customer: {
						email: 'ana@example.com',
						name: 'Ana',
						phone_number: '+5511999999999',
					},
					product_cart: [{ product_id: 'prod_123', quantity: 1, amount: 4900 }],
					allowed_payment_method_types: ['pix', 'credit', 'debit'],
					billing_currency: 'BRL',
					metadata: {
						externalId: 'user_123',
						orderId: 'order_123',
					},
					payment_link: true,
					return_url: 'https://app.test/success',
					show_saved_payment_methods: false,
				});

				return Response.json({
					payment_id: 'pay_123',
					total_amount: 4900,
					currency: 'BRL',
					payment_link: 'https://pay.dodo.test/pay_123',
					metadata: {
						externalId: 'user_123',
						orderId: 'order_123',
					},
					customer: {
						customer_id: 'cus_123',
						email: 'ana@example.com',
						name: 'Ana',
						phone_number: '+5511999999999',
						metadata: {
							externalId: 'user_123',
						},
					},
					status: 'processing',
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			amount: 4900,
			currency: 'BRL',
			productIds: ['prod_123'],
			customer: {
				email: 'ana@example.com',
				name: 'Ana',
				phone: '+5511999999999',
				externalId: 'user_123',
			},
			successUrl: 'https://app.test/success',
			metadata: {
				externalId: 'user_123',
				orderId: 'order_123',
			},
		});

		expect(payment).toMatchObject({
			id: 'pay_123',
			provider: 'dodo',
			sandbox: true,
			amount: 4900,
			currency: 'brl',
			status: 'processing',
			checkoutUrl: 'https://pay.dodo.test/pay_123',
			customer: {
				id: 'cus_123',
				email: 'ana@example.com',
				name: 'Ana',
				externalId: 'user_123',
			},
			metadata: {
				externalId: 'user_123',
				orderId: 'order_123',
			},
		});
		expect(payment.raw).toBeNull();
	});

	test('uses client request options and supports raw payload toggles', async () => {
		let attempts = 0;
		let timeoutSignal: AbortSignal | undefined;
		const provider = dodo({
			apiKey: 'dodo_test_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://dodo.client.test',
			timeout: 1234,
			retry: {
				max: 1,
			},
			fetch: (async (input, init) => {
				attempts += 1;
				timeoutSignal = init?.signal as AbortSignal;

				expect(String(input)).toBe('https://dodo.client.test/payments');

				if (attempts === 1) {
					return new Response('busy', { status: 500 });
				}

				return Response.json({
					payment_id: 'pay_retry',
					total_amount: 1200,
					currency: 'USD',
					customer: {
						customer_id: 'cus_retry',
						email: 'retry@example.com',
						name: 'Retry',
					},
					metadata: {},
					payment_link: 'https://pay.dodo.test/retry',
					status: 'succeeded',
				});
			}) as typeof fetch,
		});
		const rawClient = createClient({ provider, includeRaw: true });

		const payment = await client.payments.create({
			productIds: ['prod_123'],
			customer: {
				email: 'retry@example.com',
			},
		});
		const rawPayment = await rawClient.payments.create(
			{
				productIds: ['prod_123'],
				customer: {
					email: 'raw@example.com',
				},
			},
			{
				includeRaw: true,
				baseUrl: 'https://dodo.raw.test',
				fetch: (async () =>
					Response.json({
						payment_id: 'pay_raw',
						total_amount: 900,
						currency: 'USD',
						customer: {
							customer_id: 'cus_raw',
							email: 'raw@example.com',
							name: 'Raw',
						},
						metadata: {},
						payment_link: 'https://pay.dodo.test/raw',
						status: 'processing',
					})) as unknown as typeof fetch,
			},
		);

		expect(attempts).toBe(2);
		expect(timeoutSignal).toBeInstanceOf(AbortSignal);
		expect(payment.status).toBe('paid');
		expect(payment.raw).toBeNull();
		expectType<unknown>(rawPayment.raw);
		expect(rawPayment.raw).toMatchObject({
			payment_id: 'pay_raw',
		});
	});

	test('requires productIds and customer identity', async () => {
		const provider = dodo({
			apiKey: 'dodo_test_123',
		});

		expect(
			provider.payments.create({
				customer: {
					email: 'ana@example.com',
				},
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message:
				'Provider "dodo" requires at least one product id in "productIds"',
		});

		expect(
			provider.payments.create({
				productIds: ['prod_1', 'prod_2'],
				amount: 1000,
				customer: {
					email: 'ana@example.com',
				},
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message:
				'Provider "dodo" only accepts "amount" when exactly one product id is provided.',
		});

		expect(
			provider.payments.create({
				productIds: ['prod_123'],
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message:
				'Provider "dodo" requires either "customer.id" or "customer.email" when creating payments.',
		});
	});

	test('infers sandbox from the configured base URL', () => {
		expect(dodo({ baseUrl: 'https://test.dodopayments.com' }).isSandbox()).toBe(
			true,
		);
		expect(dodo({ baseUrl: 'https://live.dodopayments.com' }).isSandbox()).toBe(
			false,
		);
	});

	test('advertises the supported Dodo capability surface', () => {
		expect(dodo().capabilities).toEqual({
			checkout: true,
			pix: false,
			coupons: false,
			refunds: false,
			subscriptions: true,
			webhooks: true,
			customerPortal: false,
			customers: true,
		});
	});
});
