import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { stripe } from '../src';

describe('provider webhooks', () => {
	test('Stripe verifies, handles, and resolves hook names', async () => {
		const provider = stripe({ webhookSecret: 'whsec_test' });
		const request = stripeWebhookRequest(
			{
				id: 'evt_failed',
				livemode: false,
				type: 'payment_intent.payment_failed',
				data: {
					object: {
						id: 'pi_failed',
						object: 'payment_intent',
						amount: 1200,
						currency: 'usd',
						status: 'failed',
					},
				},
			},
			'whsec_test',
		);

		const valid = await provider.webhooks?.verify({
			request: request.clone(),
		});
		const handled = await provider.webhooks?.handle({ request });
		const event = handled?.event;

		expect(valid).toBe(true);
		expect(event).toMatchObject({
			id: 'evt_failed',
			type: 'payment.failed',
			provider: 'stripe',
			sandbox: true,
			data: {
				id: 'pi_failed',
				sandbox: true,
				status: 'failed',
				raw: null,
			},
			raw: null,
		});
		expect(handled?.hook).toBe('onPaymentFailed');
	});

	test('Stripe maps customer webhook events', async () => {
		const provider = stripe({ webhookSecret: 'whsec_test' });
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_customer_updated',
					type: 'customer.updated',
					data: {
						object: {
							id: 'cus_raw',
							object: 'customer',
							name: 'Ana',
							email: 'ana@example.com',
							metadata: {
								externalId: 'user_ext_123',
							},
						},
					},
				}),
			}),
			includeRaw: true,
		});
		const event = handled?.event;

		expect(event).toMatchObject({
			id: 'evt_customer_updated',
			type: 'customer.updated',
			data: {
				id: 'cus_raw',
				externalId: 'user_ext_123',
				name: 'Ana',
				email: 'ana@example.com',
				raw: {
					id: 'cus_raw',
				},
			},
			raw: {
				id: 'evt_customer_updated',
			},
		});
		expect(handled?.hook).toBe('onCustomerUpdated');
	});

	test('Stripe maps PIX payment intent webhook events', async () => {
		const provider = stripe({ webhookSecret: 'whsec_test' });
		const handled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					id: 'evt_pix_created',
					type: 'payment_intent.created',
					data: {
						object: {
							id: 'pi_pix_webhook',
							object: 'payment_intent',
							amount: 2300,
							currency: 'brl',
							metadata: {
								externalId: 'user_456',
							},
							next_action: {
								type: 'pix_display_qr_code',
								pix_display_qr_code: {
									data: '000201PIXWEBHOOK',
									image_url_png: 'https://stripe.test/webhook.png',
								},
							},
							payment_method_types: ['pix'],
							receipt_email: 'pix@example.com',
							status: 'requires_action',
						},
					},
				}),
			}),
			includeRaw: true,
		});
		const event = handled?.event;

		expect(event).toMatchObject({
			id: 'evt_pix_created',
			type: 'payment.created',
			data: {
				id: 'pi_pix_webhook',
				amount: 2300,
				currency: 'brl',
				status: 'pending',
				method: 'pix',
				copyPasteCode: '000201PIXWEBHOOK',
				qrCodeImageUrlPng: 'https://stripe.test/webhook.png',
				customer: {
					email: 'pix@example.com',
					externalId: 'user_456',
				},
				raw: {
					id: 'pi_pix_webhook',
				},
			},
			raw: {
				id: 'evt_pix_created',
			},
		});
		expect(handled?.hook).toBe('onPaymentCreated');
	});

	test('Stripe rejects invalid signatures', async () => {
		const provider = stripe({ webhookSecret: 'whsec_test' });

		const valid = await provider.webhooks?.verify({
			request: stripeWebhookRequest(
				{ id: 'evt_invalid', type: 'customer.created' },
				'wrong_secret',
			),
		});

		expect(valid).toBe(false);
	});
});

function stripeWebhookRequest(payload: unknown, secret: string) {
	const body = JSON.stringify(payload);
	const timestamp = '1700000000';
	const signature = createHmac('sha256', secret)
		.update(`${timestamp}.${body}`)
		.digest('hex');

	return new Request('https://app.test/webhooks', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'stripe-signature': `t=${timestamp},v1=${signature}`,
		},
		body,
	});
}
