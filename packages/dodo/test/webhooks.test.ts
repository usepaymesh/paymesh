import { describe, expect, test } from 'bun:test';
import { dodo } from '../src';
import { signDodoWebhook } from '../src/shared/utils';

describe('dodo webhooks', () => {
	test('verifies valid webhook signatures and handles payment events', async () => {
		const provider = dodo({
			webhookSecret: 'whsec_c2VjcmV0X2Rlc2lnbg==',
			baseUrl: 'https://test.dodopayments.com',
		});
		const request = dodoWebhookRequest(
			{
				business_id: 'biz_123',
				type: 'payment.succeeded',
				timestamp: new Date().toISOString(),
				data: {
					payment_id: 'pay_123',
					total_amount: 1200,
					currency: 'USD',
					customer: {
						customer_id: 'cus_123',
						email: 'ana@example.com',
						name: 'Ana',
						metadata: {
							externalId: 'user_123',
						},
					},
					metadata: {},
					payment_link: 'https://pay.dodo.test/pay_123',
					status: 'succeeded',
				},
			},
			'whsec_c2VjcmV0X2Rlc2lnbg==',
		);

		const valid = await provider.webhooks?.verify({
			request: request.clone(),
		});
		const handled = await provider.webhooks?.handle({
			request,
			includeRaw: true,
		});

		expect(valid).toBe(true);
		expect(handled?.deliveryId).toBe('msg_123');
		expect(handled?.hook).toBe('onPaymentSucceeded');
		expect(handled?.event).toMatchObject({
			id: 'pay_123',
			type: 'payment.succeeded',
			provider: 'dodo',
			sandbox: true,
			data: {
				id: 'pay_123',
				status: 'paid',
				customer: {
					id: 'cus_123',
					externalId: 'user_123',
				},
				raw: {
					payment_id: 'pay_123',
				},
			},
			raw: {
				type: 'payment.succeeded',
			},
		});
	});

	test('maps Pix-shaped payment and subscription cancellation webhooks', async () => {
		const provider = dodo({
			webhookSecret: 'whsec_c2VjcmV0X2Rlc2lnbg==',
			baseUrl: 'https://test.dodopayments.com',
		});
		const pixHandled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'webhook-id': 'msg_pix',
				},
				body: JSON.stringify({
					business_id: 'biz_123',
					type: 'payment.processing',
					timestamp: new Date().toISOString(),
					data: {
						payment_id: 'pay_pix_123',
						total_amount: 3100,
						currency: 'BRL',
						customer: {
							customer_id: 'cus_123',
							email: 'ana@example.com',
							name: 'Ana',
						},
						metadata: {},
						payment_link: 'https://pay.dodo.test/pay_pix_123',
						payment_method_type: 'pix',
						status: 'processing',
					},
				}),
			}),
		});
		const subscriptionHandled = await provider.webhooks?.handle({
			request: new Request('https://app.test/webhooks', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'webhook-id': 'msg_sub',
				},
				body: JSON.stringify({
					business_id: 'biz_123',
					type: 'subscription.cancelled',
					timestamp: new Date().toISOString(),
					data: {
						subscription_id: 'sub_123',
						product_id: 'prod_123',
						recurring_pre_tax_amount: 3900,
						currency: 'USD',
						status: 'cancelled',
						cancel_at_next_billing_date: true,
						customer: {
							customer_id: 'cus_123',
							email: 'ana@example.com',
							name: 'Ana',
						},
						metadata: {},
					},
				}),
			}),
		});

		expect(pixHandled?.event).toMatchObject({
			type: 'payment.created',
			data: {
				id: 'pay_pix_123',
				method: 'pix',
				status: 'processing',
			},
		});
		expect(pixHandled?.hook).toBe('onPaymentCreated');
		expect(subscriptionHandled?.event).toMatchObject({
			id: 'sub_123',
			type: 'subscription.canceled',
			data: {
				id: 'sub_123',
				status: 'cancelled',
			},
		});
		expect(subscriptionHandled?.hook).toBe('onSubscriptionCanceled');
	});

	test('rejects invalid webhook signatures', async () => {
		const provider = dodo({
			webhookSecret: 'whsec_c2VjcmV0X2Rlc2lnbg==',
		});
		const valid = await provider.webhooks?.verify({
			request: dodoWebhookRequest(
				{
					business_id: 'biz_123',
					type: 'payment.failed',
					timestamp: new Date().toISOString(),
					data: {
						payment_id: 'pay_123',
						total_amount: 1200,
						currency: 'USD',
						customer: {
							customer_id: 'cus_123',
							email: 'ana@example.com',
							name: 'Ana',
						},
						metadata: {},
						status: 'failed',
					},
				},
				'whsec_d3Jvbmdfa2V5',
			),
		});

		expect(valid).toBe(false);
	});
});

function dodoWebhookRequest(payload: unknown, secret: string) {
	const body = JSON.stringify(payload);
	const webhookId = 'msg_123';
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = signDodoWebhook({
		payload: body,
		secret,
		timestamp,
		webhookId,
	});

	return new Request('https://app.test/webhooks', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'webhook-id': webhookId,
			'webhook-signature': signature,
			'webhook-timestamp': timestamp,
		},
		body,
	});
}
