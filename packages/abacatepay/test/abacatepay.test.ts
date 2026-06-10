import { describe, expect, test } from 'bun:test';
import { createClient } from 'paymesh';
import { abacatepay } from '../src';

function expectType<T>(_value: T) {}

describe('abacatepay provider', () => {
	test('creates a checkout session using productIds', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(String(input)).toBe(
					'https://abacatepay.test/v2/checkouts/create',
				);
				expect(init?.method).toBe('POST');
				expect(init?.headers).toEqual({
					authorization: 'Bearer abc_test_123',
					'content-type': 'application/json',
				});
				expect(body.items).toEqual([{ id: 'prod_123', quantity: 1 }]);
				expect(body.methods).toEqual(['PIX', 'CARD']);
				expect(body.customerId).toBe('cus_123');
				expect(body.externalId).toBe('user_ext_123');
				expect(body.completionUrl).toBe('https://app.test/success');
				expect(body.returnUrl).toBe('https://app.test/cancel');
				expect(body.metadata).toEqual({
					externalId: 'user_ext_123',
					orderId: 'order_123',
				});

				return Response.json({
					data: {
						id: 'chk_test_123',
						url: 'https://checkout.abacatepay.test/session',
						amount: 4900,
						status: 'PENDING',
						customerId: 'cus_123',
						externalId: 'user_ext_123',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			amount: 4900,
			currency: 'BRL',
			productIds: ['prod_123'],
			successUrl: 'https://app.test/success',
			returnUrl: 'https://app.test/cancel',
			customer: {
				id: 'cus_123',
				email: 'ana@example.com',
			},
			metadata: {
				externalId: 'user_ext_123',
				orderId: 'order_123',
			},
		});

		expect(payment).toMatchObject({
			id: 'chk_test_123',
			provider: 'abacatepay',
			amount: 4900,
			currency: 'BRL',
			status: 'pending',
			checkoutUrl: 'https://checkout.abacatepay.test/session',
			customer: {
				id: 'cus_123',
			},
			metadata: {
				externalId: 'user_ext_123',
			},
		});
		expect(payment.raw).toBeNull();
	});

	test('creates a checkout session with multiple product IDs', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (_input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(body.items).toEqual([
					{ id: 'prod_1', quantity: 1 },
					{ id: 'prod_2', quantity: 1 },
					{ id: 'prod_3', quantity: 1 },
				]);

				return Response.json({
					data: {
						id: 'chk_multi',
						url: 'https://checkout.abacatepay.test/multi',
						amount: 9900,
						status: 'PENDING',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			productIds: ['prod_1', 'prod_2', 'prod_3'],
		});

		expect(payment.id).toBe('chk_multi');
		expect(payment.amount).toBe(9900);
	});

	test('throws when productIds is empty', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		await expect(
			provider.payments.create({
				amount: 1000,
				currency: 'USD',
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message:
				'AbacatePay requires at least one product ID. Pass productIds when creating a payment.',
			provider: 'abacatepay',
		});
	});

	test('throws when productIds is undefined', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		await expect(provider.payments.create({})).rejects.toMatchObject({
			code: 'invalid_request',
			provider: 'abacatepay',
		});
	});

	test('throws when productIds is an empty array', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		await expect(
			provider.payments.create({
				productIds: [],
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			provider: 'abacatepay',
		});
	});

	test('creates a PIX transparent charge', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(String(input)).toBe(
					'https://abacatepay.test/v2/transparents/create',
				);
				expect(init?.method).toBe('POST');
				expect(body).toEqual({
					method: 'PIX',
					data: {
						amount: 5000,
						description: 'PIX payment',
						expiresIn: 3600,
						customerId: 'cus_pix_123',
						externalId: 'pix_ext_123',
						metadata: {
							externalId: 'pix_ext_123',
							orderId: 'order_pix',
						},
					},
				});

				return Response.json({
					data: {
						id: 'charge_pix_123',
						amount: 5000,
						status: 'PENDING',
						brCode: '00020126580014br.gov.bcb.pix0136...',
						brCodeBase64: 'iVBORw0KGgoAAAANSUhEUg==',
						expiresAt: '2026-06-11T12:00:00Z',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.create({
			amount: 5000,
			currency: 'BRL',
			description: 'PIX payment',
			customer: {
				id: 'cus_pix_123',
			},
			metadata: {
				externalId: 'pix_ext_123',
				orderId: 'order_pix',
			},
			pix: {
				expiresAfterSeconds: 3600,
			},
		});

		expect(pix).toMatchObject({
			id: 'charge_pix_123',
			provider: 'abacatepay',
			sandbox: false,
			amount: 5000,
			currency: 'BRL',
			status: 'pending',
			method: 'pix',
			copyPasteCode: '00020126580014br.gov.bcb.pix0136...',
			qrCodeImageUrlPng: 'iVBORw0KGgoAAAANSUhEUg==',
		});
		expect(pix?.expiresAt).toBe('2026-06-11T12:00:00Z');
		expect(pix?.raw).toBeNull();
	});

	test('creates a PIX charge with minimal data', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (_input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(body).toEqual({
					method: 'PIX',
					data: {
						amount: 1000,
					},
				});

				return Response.json({
					data: {
						id: 'charge_min',
						amount: 1000,
						status: 'PENDING',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.create({
			amount: 1000,
			currency: 'BRL',
		});

		expect(pix?.id).toBe('charge_min');
		expect(pix?.copyPasteCode).toBeUndefined();
		expect(pix?.qrCodeImageUrlPng).toBeUndefined();
		expect(pix?.expiresAt).toBeUndefined();
	});

	test('fetches a PIX charge by id', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input, init) => {
				expect(String(input)).toBe(
					'https://abacatepay.test/v2/transparents/get?id=charge_get_123',
				);
				expect(init?.method).toBeUndefined();

				return Response.json({
					data: {
						id: 'charge_get_123',
						amount: 7500,
						status: 'PAID',
						brCode: '000201PAID',
						brCodeBase64: 'iVBORw0KGgo=',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.get('charge_get_123');

		expect(pix).toMatchObject({
			id: 'charge_get_123',
			provider: 'abacatepay',
			amount: 7500,
			status: 'paid',
			method: 'pix',
			copyPasteCode: '000201PAID',
			qrCodeImageUrlPng: 'iVBORw0KGgo=',
		});
	});

	test('encodes special characters in PIX get id', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input) => {
				expect(String(input)).toBe(
					'https://abacatepay.test/v2/transparents/get?id=charge%2Fwith%2Fslashes',
				);

				return Response.json({
					data: {
						id: 'charge/with/slashes',
						amount: 1000,
						status: 'PENDING',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.get('charge/with/slashes');

		expect(pix?.id).toBe('charge/with/slashes');
	});

	test('throws on failed AbacatePay response', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: null,
					success: false,
					error: 'Invalid API key',
				})) as unknown as typeof fetch,
		});

		await expect(
			provider.payments.create({
				productIds: ['prod_1'],
			}),
		).rejects.toMatchObject({
			code: 'provider_error',
			message: 'Invalid API key',
			provider: 'abacatepay',
		});
	});

	test('uses client request options when creating payments', async () => {
		let attempts = 0;
		let timeoutSignal: AbortSignal | undefined;
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://abacatepay.client.test',
			timeout: 1234,
			retry: {
				max: 1,
			},
			fetch: (async (input, init) => {
				attempts += 1;
				timeoutSignal = init?.signal as AbortSignal;

				expect(String(input)).toBe(
					'https://abacatepay.client.test/v2/checkouts/create',
				);

				if (attempts === 1) {
					return new Response('busy', { status: 500 });
				}

				return Response.json({
					data: {
						id: 'chk_retry',
						url: 'https://checkout.abacatepay.test/retry',
						amount: 1000,
						status: 'PAID',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const payment = await client.payments.create({
			productIds: ['prod_retry'],
		});

		expect(attempts).toBe(2);
		expect(timeoutSignal).toBeInstanceOf(AbortSignal);
		expect(payment.status).toBe('paid');
		expect(payment.raw).toBeNull();
	});

	test('supports raw payment payloads globally and per call', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.raw.test',
			fetch: (async () =>
				Response.json({
					data: {
						id: 'chk_raw',
						url: 'https://checkout.abacatepay.test/raw',
						amount: 1200,
						status: 'PENDING',
						customerId: 'cus_raw',
						externalId: 'user_raw',
					},
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPayment = await defaultClient.payments.create({
			productIds: ['prod_raw'],
		});
		const callRawPayment = await defaultClient.payments.create(
			{
				productIds: ['prod_raw'],
			},
			{ includeRaw: true },
		);
		const globalRawPayment = await rawClient.payments.create({
			productIds: ['prod_raw'],
		});
		const callNullPayment = await rawClient.payments.create(
			{
				productIds: ['prod_raw'],
			},
			{ includeRaw: false },
		);

		expectType<null>(defaultPayment.raw);
		expectType<unknown>(callRawPayment.raw);
		expectType<unknown>(globalRawPayment.raw);
		expectType<null>(callNullPayment.raw);

		expect(defaultPayment.raw).toBeNull();
		expect(callRawPayment.raw).toMatchObject({
			id: 'chk_raw',
		});
		expect(globalRawPayment.raw).toMatchObject({
			id: 'chk_raw',
		});
		expect(callNullPayment.raw).toBeNull();
		expect(defaultPayment.customer?.id).toBe('cus_raw');
		expect(defaultPayment.metadata?.externalId).toBe('user_raw');
	});

	test('supports raw PIX payloads globally and per call', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.raw.test',
			fetch: (async () =>
				Response.json({
					data: {
						id: 'charge_raw',
						amount: 3000,
						status: 'PENDING',
						brCode: 'PIX_RAW',
						brCodeBase64: 'raw_base64',
					},
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPix = await defaultClient.pix?.create({
			amount: 3000,
			currency: 'BRL',
		});
		const callRawPix = await defaultClient.pix?.create(
			{
				amount: 3000,
				currency: 'BRL',
			},
			{ includeRaw: true },
		);
		const globalRawPix = await rawClient.pix?.create({
			amount: 3000,
			currency: 'BRL',
		});
		const callNullPix = await rawClient.pix?.create(
			{
				amount: 3000,
				currency: 'BRL',
			},
			{ includeRaw: false },
		);

		expectType<null>(defaultPix?.raw);
		expectType<unknown>(callRawPix?.raw);
		expectType<unknown>(globalRawPix?.raw);
		expectType<null>(callNullPix?.raw);

		expect(defaultPix?.raw).toBeNull();
		expect(callRawPix?.raw).toMatchObject({
			id: 'charge_raw',
		});
		expect(globalRawPix?.raw).toMatchObject({
			id: 'charge_raw',
		});
		expect(callNullPix?.raw).toBeNull();
	});

	test('auto-detects sandbox from API key prefix', () => {
		const sandboxProvider = abacatepay({
			apiKey: 'abc_dev_test123',
		});
		const prodProvider = abacatepay({
			apiKey: 'abc_live_test123',
		});
		const explicitSandbox = abacatepay({
			apiKey: 'abc_live_test123',
			sandbox: true,
		});

		expect(sandboxProvider.isSandbox()).toBe(true);
		expect(prodProvider.isSandbox()).toBe(false);
		expect(explicitSandbox.isSandbox()).toBe(true);
	});

	test('defaults sandbox to false when no API key', () => {
		const provider = abacatepay({ apiKey: 'abc_production_key' });

		expect(provider.isSandbox()).toBe(false);
	});

	test('reports correct capabilities', () => {
		const provider = abacatepay({ apiKey: 'abc_test' });

		expect(provider.capabilities).toEqual({
			checkout: true,
			pix: true,
			webhooks: true,
			customers: true,
			coupons: false,
			subscriptions: false,
			refunds: false,
			customerPortal: false,
		});
	});

	test('reports provider id as abacatepay', () => {
		const provider = abacatepay({ apiKey: 'abc_test' });

		expect(provider.id).toBe('abacatepay');
	});

	test('omits optional fields from payment when not provided', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: {
						id: 'chk_minimal',
						url: 'https://checkout.abacatepay.test/minimal',
						amount: 1000,
						status: 'PENDING',
					},
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const payment = await provider.payments.create({
			productIds: ['prod_1'],
		});

		expect(payment.customer).toBeUndefined();
		expect(payment.metadata).toBeUndefined();
	});

	test('maps all payment statuses correctly', async () => {
		const statuses = [
			{ abacate: 'PENDING', expected: 'pending' },
			{ abacate: 'PAID', expected: 'paid' },
			{ abacate: 'REFUNDED', expected: 'refunded' },
			{ abacate: 'CANCELLED', expected: 'canceled' },
			{ abacate: 'EXPIRED', expected: 'failed' },
			{ abacate: 'UNKNOWN_STATUS', expected: 'pending' },
		];

		for (const { abacate, expected } of statuses) {
			const provider = abacatepay({
				apiKey: 'abc_test_123',
				baseUrl: 'https://abacatepay.test',
				fetch: (async () =>
					Response.json({
						data: {
							id: `chk_${abacate}`,
							url: 'https://checkout.abacatepay.test',
							amount: 1000,
							status: abacate,
						},
						success: true,
						error: null,
					})) as unknown as typeof fetch,
			});

			const payment = await provider.payments.create({
				productIds: ['prod_1'],
			});

			expect(payment.status).toBe(expected);
		}
	});

	test('maps all PIX statuses correctly', async () => {
		const statuses = [
			{ abacate: 'PENDING', expected: 'pending' },
			{ abacate: 'PAID', expected: 'paid' },
			{ abacate: 'REFUNDED', expected: 'refunded' },
			{ abacate: 'CANCELLED', expected: 'canceled' },
			{ abacate: 'EXPIRED', expected: 'failed' },
		];

		for (const { abacate, expected } of statuses) {
			const provider = abacatepay({
				apiKey: 'abc_test_123',
				baseUrl: 'https://abacatepay.test',
				fetch: (async () =>
					Response.json({
						data: {
							id: `charge_${abacate}`,
							amount: 1000,
							status: abacate,
						},
						success: true,
						error: null,
					})) as unknown as typeof fetch,
			});

			const pix = await provider.pix?.create({
				amount: 1000,
				currency: 'BRL',
			});

			expect(pix?.status).toBe(expected);
		}
	});

	test('uses default baseUrl when not provided', async () => {
		let capturedUrl: string | undefined;
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			fetch: (async (input) => {
				capturedUrl = String(input);
				return Response.json({
					data: {
						id: 'chk_default_url',
						url: 'https://checkout.abacatepay.test',
						amount: 1000,
						status: 'PENDING',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		await provider.payments.create({
			productIds: ['prod_1'],
		});

		expect(capturedUrl).toBe('https://api.abacatepay.com/v2/checkouts/create');
	});

	test('PIX request omits optional fields when not provided', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (_input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(body).toEqual({
					method: 'PIX',
					data: {
						amount: 2000,
					},
				});

				return Response.json({
					data: {
						id: 'charge_no_opts',
						amount: 2000,
						status: 'PENDING',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const pix = await provider.pix?.create({
			amount: 2000,
			currency: 'BRL',
		});

		expect(pix?.id).toBe('charge_no_opts');
	});
});
