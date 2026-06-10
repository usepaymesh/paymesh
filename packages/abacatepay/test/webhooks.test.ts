import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { abacatepay } from '../src';
import { ABACATEPAY_PUBLIC_HMAC_KEY } from '../src/shared/constants';

describe('abacatepay webhooks', () => {
	test('verifies valid webhook signature and secret', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			webhookSecret: 'my_webhook_secret',
		});
		const request = abacacateWebhookRequest(
			{
				id: 'evt_verify',
				event: 'checkout.completed',
				data: {
					checkout: {
						id: 'chk_123',
						amount: 1000,
						status: 'PAID',
						url: 'https://checkout.test',
					},
				},
			},
			'my_webhook_secret',
		);

		const valid = await provider.webhooks?.verify({
			request: request.clone(),
		});

		expect(valid).toBe(true);
	});

	test('rejects when webhookSecret is not configured', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const request = abacacateWebhookRequest(
			{
				id: 'evt_no_secret',
				event: 'checkout.completed',
				data: {},
			},
			'',
		);

		const valid = await provider.webhooks?.verify({
			request,
		});

		expect(valid).toBe(false);
	});

	test('rejects when x-webhook-signature header is missing', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			webhookSecret: 'my_webhook_secret',
		});

		const request = new Request(
			'https://app.test/webhooks?webhookSecret=my_webhook_secret',
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_no_sig',
					event: 'checkout.completed',
					data: {},
				}),
			},
		);

		const valid = await provider.webhooks?.verify({
			request,
		});

		expect(valid).toBe(false);
	});

	test('rejects when webhookSecret query param does not match', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			webhookSecret: 'correct_secret',
		});
		const request = abacacateWebhookRequest(
			{
				id: 'evt_wrong_secret',
				event: 'checkout.completed',
				data: {},
			},
			'correct_secret',
		);

		const wrongSecretUrl = new URL(request.url);
		wrongSecretUrl.searchParams.set('webhookSecret', 'wrong_secret');
		const wrongRequest = new Request(wrongSecretUrl.toString(), {
			method: 'POST',
			headers: request.headers,
			body: await request.text(),
		});

		const valid = await provider.webhooks?.verify({
			request: wrongRequest,
		});

		expect(valid).toBe(false);
	});

	test('rejects when signature does not match body', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			webhookSecret: 'my_webhook_secret',
		});

		const body = JSON.stringify({
			id: 'evt_tampered',
			event: 'checkout.completed',
			data: {},
		});
		const signature = createHmac('sha256', ABACATEPAY_PUBLIC_HMAC_KEY)
			.update(Buffer.from('tampered body', 'utf8'))
			.digest('base64');

		const request = new Request(
			'https://app.test/webhooks?webhookSecret=my_webhook_secret',
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-webhook-signature': signature,
				},
				body,
			},
		);

		const valid = await provider.webhooks?.verify({
			request,
		});

		expect(valid).toBe(false);
	});

	test('handles checkout.completed webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_checkout_completed',
					event: 'checkout.completed',
					devMode: false,
					data: {
						checkout: {
							id: 'chk_completed',
							amount: 5000,
							status: 'PAID',
							url: 'https://checkout.test/paid',
							customerId: 'cus_123',
							externalId: 'user_ext',
						},
					},
				}),
			}),
		});
		const event = handled?.event;

		expect(event).toMatchObject({
			id: 'evt_checkout_completed',
			type: 'payment.succeeded',
			provider: 'abacatepay',
			sandbox: false,
			data: {
				id: 'chk_completed',
				amount: 5000,
				currency: 'BRL',
				status: 'paid',
				checkoutUrl: 'https://checkout.test/paid',
				customer: {
					id: 'cus_123',
				},
				metadata: {
					externalId: 'user_ext',
				},
				raw: null,
			},
			raw: null,
		});
		expect(handled?.hook).toBe('onPaymentSucceeded');
		expect(handled?.deliveryId).toBe('evt_checkout_completed');
	});

	test('handles transparent.completed webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_transparent_completed',
					event: 'transparent.completed',
					devMode: false,
					data: {
						transparent: {
							id: 'charge_completed',
							amount: 3000,
							status: 'PAID',
							brCode: 'PIX_COMPLETED',
							brCodeBase64: 'completed_base64',
						},
					},
				}),
			}),
		});
		const event = handled?.event;

		expect(event).toMatchObject({
			id: 'evt_transparent_completed',
			type: 'payment.succeeded',
			provider: 'abacatepay',
			sandbox: false,
			data: {
				id: 'charge_completed',
				amount: 3000,
				currency: 'BRL',
				status: 'paid',
				method: 'pix',
				copyPasteCode: 'PIX_COMPLETED',
				qrCodeImageUrlPng: 'completed_base64',
				raw: null,
			},
			raw: null,
		});
		expect(handled?.hook).toBe('onPaymentSucceeded');
	});

	test('handles checkout.refunded webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_refunded',
					event: 'checkout.refunded',
					devMode: false,
					data: {
						checkout: {
							id: 'chk_refunded',
							amount: 2000,
							status: 'REFUNDED',
							url: 'https://checkout.test/refunded',
						},
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'payment.refunded',
			data: {
				status: 'refunded',
			},
		});
		expect(handled?.hook).toBe('onPaymentRefunded');
	});

	test('handles checkout.disputed webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_disputed',
					event: 'checkout.disputed',
					devMode: false,
					data: {
						checkout: {
							id: 'chk_disputed',
							amount: 4000,
							status: 'CANCELLED',
							url: 'https://checkout.test/disputed',
						},
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'payment.failed',
			data: {
				status: 'canceled',
			},
		});
		expect(handled?.hook).toBe('onPaymentFailed');
	});

	test('handles checkout.lost webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_lost',
					event: 'checkout.lost',
					devMode: false,
					data: {
						checkout: {
							id: 'chk_lost',
							amount: 1500,
							status: 'EXPIRED',
							url: 'https://checkout.test/lost',
						},
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'payment.failed',
			data: {
				status: 'failed',
			},
		});
		expect(handled?.hook).toBe('onPaymentFailed');
	});

	test('handles transparent.refunded webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_transparent_refunded',
					event: 'transparent.refunded',
					devMode: false,
					data: {
						transparent: {
							id: 'charge_refunded',
							amount: 2500,
							status: 'REFUNDED',
						},
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'payment.refunded',
			data: {
				status: 'refunded',
			},
		});
		expect(handled?.hook).toBe('onPaymentRefunded');
	});

	test('handles transparent.disputed webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_transparent_disputed',
					event: 'transparent.disputed',
					devMode: false,
					data: {
						transparent: {
							id: 'charge_disputed',
							amount: 3500,
							status: 'CANCELLED',
						},
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'payment.failed',
			data: {
				status: 'canceled',
			},
		});
		expect(handled?.hook).toBe('onPaymentFailed');
	});

	test('handles transparent.lost webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_transparent_lost',
					event: 'transparent.lost',
					devMode: false,
					data: {
						transparent: {
							id: 'charge_lost',
							amount: 4500,
							status: 'EXPIRED',
						},
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'payment.failed',
			data: {
				status: 'failed',
			},
		});
		expect(handled?.hook).toBe('onPaymentFailed');
	});

	test('handles customer.created webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_customer_created',
					event: 'customer.created',
					devMode: false,
					data: {
						customer: {
							id: 'cus_new',
							email: 'new@example.com',
							name: 'New Customer',
							cellphone: '+5511000000000',
						},
					},
				}),
			}),
			includeRaw: true,
		});

		expect(handled?.event).toMatchObject({
			id: 'evt_customer_created',
			type: 'customer.created',
			provider: 'abacatepay',
			sandbox: false,
			data: {
				id: 'cus_new',
				email: 'new@example.com',
				name: 'New Customer',
				phone: '+5511000000000',
				raw: {
					id: 'cus_new',
				},
			},
			raw: {
				id: 'evt_customer_created',
			},
		});
		expect(handled?.hook).toBe('onCustomerCreated');
	});

	test('handles customer.updated webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_customer_updated',
					event: 'customer.updated',
					devMode: false,
					data: {
						customer: {
							id: 'cus_updated',
							email: 'updated@example.com',
							name: 'Updated Customer',
						},
					},
				}),
			}),
			includeRaw: true,
		});

		expect(handled?.event).toMatchObject({
			id: 'evt_customer_updated',
			type: 'customer.updated',
			provider: 'abacatepay',
			data: {
				id: 'cus_updated',
				email: 'updated@example.com',
				name: 'Updated Customer',
				raw: {
					id: 'cus_updated',
				},
			},
			raw: {
				id: 'evt_customer_updated',
			},
		});
		expect(handled?.hook).toBe('onCustomerUpdated');
	});

	test('handles subscription.completed webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_sub_completed',
					event: 'subscription.completed',
					devMode: false,
					data: {
						id: 'sub_123',
						amount: 1000,
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			id: 'evt_sub_completed',
			type: 'subscription.created',
			provider: 'abacatepay',
		});
		expect(handled?.hook).toBe('onSubscriptionCreated');
	});

	test('handles subscription.cancelled webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_sub_cancelled',
					event: 'subscription.cancelled',
					devMode: false,
					data: {
						id: 'sub_cancelled',
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'subscription.canceled',
		});
		expect(handled?.hook).toBe('onSubscriptionCanceled');
	});

	test('handles subscription.renewed webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_sub_renewed',
					event: 'subscription.renewed',
					devMode: false,
					data: {
						id: 'sub_renewed',
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'subscription.updated',
		});
		expect(handled?.hook).toBe('onSubscriptionUpdated');
	});

	test('handles subscription.trial_started webhook event', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_sub_trial',
					event: 'subscription.trial_started',
					devMode: false,
					data: {
						id: 'sub_trial',
					},
				}),
			}),
		});

		expect(handled?.event).toMatchObject({
			type: 'subscription.created',
		});
		expect(handled?.hook).toBe('onSubscriptionCreated');
	});

	test('uses devMode for sandbox detection when boolean', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		const sandboxEvent = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_sandbox',
					event: 'checkout.completed',
					devMode: true,
					data: {
						checkout: {
							id: 'chk_sandbox',
							amount: 1000,
							status: 'PAID',
							url: 'https://checkout.test',
						},
					},
				}),
			}),
		});

		expect(sandboxEvent?.event?.sandbox).toBe(true);

		const prodEvent = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_prod',
					event: 'checkout.completed',
					devMode: false,
					data: {
						checkout: {
							id: 'chk_prod',
							amount: 1000,
							status: 'PAID',
							url: 'https://checkout.test',
						},
					},
				}),
			}),
		});

		expect(prodEvent?.event?.sandbox).toBe(false);
	});

	test('falls back to provider sandbox when devMode is not boolean', async () => {
		const provider = abacatepay({
			apiKey: 'abc_dev_test123',
		});

		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_no_dev',
					event: 'checkout.completed',
					data: {
						checkout: {
							id: 'chk_no_dev',
							amount: 1000,
							status: 'PAID',
							url: 'https://checkout.test',
						},
					},
				}),
			}),
		});

		expect(handled?.event?.sandbox).toBe(true);
	});

	test('falls back to payment.created for unknown event types', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_unknown',
					event: 'some.unknown.event',
					devMode: false,
					data: {},
				}),
			}),
		});

		expect(handled?.event?.type).toBe('payment.created');
		expect(handled?.hook).toBe('onPaymentCreated');
	});

	test('throws on non-object payload', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		await expect(
			provider.webhooks?.handle({
				request: new Request('https://app.test/webhooks', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
					},
					body: JSON.stringify('not an object'),
				}),
			}),
		).rejects.toThrow('AbacatePay webhook payload must be a JSON object.');
	});

	test('throws on array payload', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		await expect(
			provider.webhooks?.handle({
				request: new Request('https://app.test/webhooks', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
					},
					body: JSON.stringify([1, 2, 3]),
				}),
			}),
		).rejects.toThrow('AbacatePay webhook payload must be a JSON object.');
	});

	test('throws on null payload', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});

		await expect(
			provider.webhooks?.handle({
				request: new Request('https://app.test/webhooks', {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
					},
					body: JSON.stringify(null),
				}),
			}),
		).rejects.toThrow('AbacatePay webhook payload must be a JSON object.');
	});

	test('supports raw webhook payloads per handle call', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const payload = {
			id: 'evt_raw',
			event: 'checkout.completed',
			devMode: false,
			data: {
				checkout: {
					id: 'chk_raw',
					amount: 1200,
					status: 'PAID',
					url: 'https://checkout.test/raw',
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
			id: 'chk_raw',
			raw: null,
		});
		expect(rawEvent?.data).toMatchObject({
			id: 'chk_raw',
			raw: {
				id: 'chk_raw',
			},
		});
	});

	test('maps checkout event with customerId and externalId', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_mapped',
					event: 'checkout.completed',
					devMode: false,
					data: {
						checkout: {
							id: 'chk_mapped',
							amount: 8800,
							status: 'PAID',
							url: 'https://checkout.test/mapped',
							customerId: 'cus_mapped',
							externalId: 'ext_mapped',
						},
					},
				}),
			}),
		});

		expect(handled?.event?.data).toMatchObject({
			id: 'chk_mapped',
			customer: {
				id: 'cus_mapped',
			},
			metadata: {
				externalId: 'ext_mapped',
			},
		});
	});

	test('maps transparent event without optional fields', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_minimal_transparent',
					event: 'transparent.completed',
					devMode: false,
					data: {
						transparent: {
							id: 'charge_minimal',
							amount: 1000,
							status: 'PAID',
						},
					},
				}),
			}),
		});

		expect(handled?.event?.data).toMatchObject({
			id: 'charge_minimal',
			copyPasteCode: undefined,
			qrCodeImageUrlPng: undefined,
			expiresAt: undefined,
		});
	});

	test('handles checkout event when checkout data is missing', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_no_checkout',
					event: 'checkout.completed',
					devMode: false,
					data: {},
				}),
			}),
		});

		expect(handled?.event?.type).toBe('payment.succeeded');
		expect(handled?.event?.data).toEqual({});
	});

	test('handles customer event when customer data is missing', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_no_customer',
					event: 'customer.created',
					devMode: false,
					data: {},
				}),
			}),
		});

		expect(handled?.event?.type).toBe('customer.created');
		expect(handled?.event?.data).toEqual({});
	});
});

function expectType<T>(_value: T) {}

function abacacateWebhookRequest(payload: unknown, secret: string) {
	const body = JSON.stringify(payload);
	const signature = createHmac('sha256', ABACATEPAY_PUBLIC_HMAC_KEY)
		.update(Buffer.from(body, 'utf8'))
		.digest('base64');

	return new Request(
		`https://app.test/webhooks?webhookSecret=${encodeURIComponent(secret)}`,
		{
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-webhook-signature': signature,
			},
			body,
		},
	);
}
