import { describe, expect, test } from 'bun:test';
import { createClient } from 'paymesh';
import { polar } from '../src';

function expectType<T>(_value: T) {}

describe('polar provider', () => {
	test('creates a checkout session using Polar JSON payloads', async () => {
		const provider = polar({
			accessToken: 'polar_oat_123',
			baseUrl: 'https://polar.test',
			fetch: (async (input, init) => {
				expect(String(input)).toBe('https://polar.test/v1/checkouts');
				expect(init?.method).toBe('POST');
				expect(init?.headers).toEqual({
					authorization: 'Bearer polar_oat_123',
					'content-type': 'application/json',
				});
				expect(JSON.parse(String(init?.body))).toEqual({
					products: ['prod_123'],
					amount: 4900,
					currency: 'brl',
					customer_id: undefined,
					external_customer_id: 'user_123',
					customer_name: 'Ana',
					customer_email: 'ana@example.com',
					metadata: {
						orderId: 'order_123',
					},
					success_url: 'https://app.test/success',
					return_url: 'https://app.test/cancel',
				});

				return Response.json({
					id: 'chk_test_123',
					status: 'open',
					url: 'https://checkout.polar.test/session',
					total_amount: 4900,
					currency: 'brl',
					customer_id: 'cus_123',
					external_customer_id: 'user_123',
					customer_name: 'Ana',
					customer_email: 'ana@example.com',
					metadata: {
						orderId: 'order_123',
					},
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			amount: 4900,
			currency: 'BRL',
			productIds: ['prod_123'],
			successUrl: 'https://app.test/success',
			cancelUrl: 'https://app.test/cancel',
			customer: {
				name: 'Ana',
				email: 'ana@example.com',
				externalId: 'user_123',
			},
			metadata: {
				orderId: 'order_123',
			},
		});

		expect(payment).toMatchObject({
			id: 'chk_test_123',
			provider: 'polar',
			amount: 4900,
			currency: 'brl',
			status: 'pending',
			checkoutUrl: 'https://checkout.polar.test/session',
			customer: {
				id: 'cus_123',
				externalId: 'user_123',
				name: 'Ana',
				email: 'ana@example.com',
			},
		});
		expect(payment.raw).toBeNull();
	});

	test('requires productIds to create a checkout session', async () => {
		const provider = polar({
			accessToken: 'polar_oat_123',
		});

		await expect(
			provider.payments.create({
				amount: 1000,
				currency: 'USD',
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message:
				'Provider "polar" requires at least one product id in "productIds"',
		});
	});

	test('uses client request options when creating payments', async () => {
		let attempts = 0;
		let timeoutSignal: AbortSignal | undefined;
		const provider = polar({
			accessToken: 'polar_oat_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://polar.client.test',
			timeout: 1234,
			retry: {
				max: 1,
			},
			fetch: (async (input, init) => {
				attempts += 1;
				timeoutSignal = init?.signal as AbortSignal;

				expect(String(input)).toBe('https://polar.client.test/v1/checkouts');

				if (attempts === 1) {
					return new Response('busy', { status: 500 });
				}

				return Response.json({
					id: 'chk_test_retry',
					status: 'succeeded',
					total_amount: 1000,
					currency: 'usd',
				});
			}) as typeof fetch,
		});

		const payment = await client.payments.create({
			amount: 1000,
			currency: 'USD',
			productIds: ['prod_123'],
		});

		expect(attempts).toBe(2);
		expect(timeoutSignal).toBeInstanceOf(AbortSignal);
		expect(payment.status).toBe('paid');
		expect(payment.raw).toBeNull();
	});

	test('supports raw payment payloads globally and per call', async () => {
		const provider = polar({
			accessToken: 'polar_oat_123',
			baseUrl: 'https://polar.payments.test',
			fetch: (async () =>
				Response.json({
					id: 'chk_test_raw',
					status: 'succeeded',
					total_amount: 1200,
					currency: 'usd',
					external_customer_id: 'user_123',
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPayment = await defaultClient.payments.create({
			amount: 1200,
			currency: 'USD',
			productIds: ['prod_123'],
		});
		const callRawPayment = await defaultClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
				productIds: ['prod_123'],
			},
			{ includeRaw: true },
		);
		const globalRawPayment = await rawClient.payments.create({
			amount: 1200,
			currency: 'USD',
			productIds: ['prod_123'],
		});
		const callNullPayment = await rawClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
				productIds: ['prod_123'],
			},
			{ includeRaw: false },
		);

		expectType<null>(defaultPayment.raw);
		expectType<unknown>(callRawPayment.raw);
		expectType<unknown>(globalRawPayment.raw);
		expectType<null>(callNullPayment.raw);

		expect(defaultPayment.raw).toBeNull();
		expect(callRawPayment.raw).toMatchObject({
			id: 'chk_test_raw',
		});
		expect(globalRawPayment.raw).toMatchObject({
			id: 'chk_test_raw',
		});
		expect(callNullPayment.raw).toBeNull();
		expect(globalRawPayment.customer?.externalId).toBe('user_123');
	});

	test('supports raw webhook payloads per map call', () => {
		const provider = polar({
			accessToken: 'polar_oat_123',
		});
		const payload = {
			type: 'order.paid',
			timestamp: '2026-05-30T12:00:00Z',
			data: {
				id: 'ord_raw',
				paid: true,
				total_amount: 1200,
				currency: 'usd',
			},
		};

		const defaultEvent = provider.webhooks?.map(payload);
		const rawEvent = provider.webhooks?.map(payload, { includeRaw: true });

		if (defaultEvent instanceof Promise || rawEvent instanceof Promise) {
			throw new Error('Polar webhook mapping should be synchronous');
		}

		expectType<null>(defaultEvent?.raw ?? null);
		expectType<unknown>(rawEvent?.raw);

		expect(defaultEvent?.raw).toBeNull();
		expect(rawEvent?.raw).toBe(payload);
		expect(defaultEvent?.data).toMatchObject({
			id: 'ord_raw',
			raw: null,
		});
		expect(rawEvent?.data).toMatchObject({
			id: 'ord_raw',
			raw: {
				id: 'ord_raw',
			},
		});
	});
});
