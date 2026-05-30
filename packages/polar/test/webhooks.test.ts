import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { polar } from '../src';

describe('polar webhooks', () => {
	test('Polar verifies, parses, maps, and resolves hook names', async () => {
		const provider = polar({ webhookSecret: 'polar_secret_test' });
		const request = polarWebhookRequest(
			{
				type: 'order.paid',
				timestamp: '2026-05-30T12:00:00Z',
				data: {
					id: 'ord_paid',
					paid: true,
					total_amount: 1200,
					currency: 'usd',
					customer: {
						id: 'cus_123',
						email: 'ana@example.com',
						name: 'Ana',
						external_id: 'user_ext_123',
					},
				},
			},
			'polar_secret_test',
		);

		const valid = await provider.webhooks?.verify({
			request: request.clone(),
		});
		const payload = await provider.webhooks?.parse(request);
		const event = await provider.webhooks?.map(payload ?? {});

		expect(valid).toBe(true);
		expect(event).toMatchObject({
			id: 'ord_paid',
			type: 'payment.succeeded',
			provider: 'polar',
			data: {
				id: 'ord_paid',
				status: 'paid',
				customer: {
					id: 'cus_123',
					externalId: 'user_ext_123',
				},
				raw: null,
			},
			raw: null,
		});
		expect(event && provider.webhooks?.hook(event)).toBe('onPaymentSucceeded');
	});

	test('Polar maps customer webhook events', async () => {
		const provider = polar({ webhookSecret: 'polar_secret_test' });
		const event = await provider.webhooks?.map(
			{
				type: 'customer.updated',
				timestamp: '2026-05-30T12:00:00Z',
				data: {
					id: 'cus_raw',
					email: 'ana@example.com',
					name: 'Ana',
					external_id: 'user_ext_123',
				},
			},
			{ includeRaw: true },
		);

		expect(event).toMatchObject({
			id: 'cus_raw',
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
				type: 'customer.updated',
			},
		});
		expect(event && provider.webhooks?.hook<true>(event)).toBe(
			'onCustomerUpdated',
		);
	});

	test('Polar rejects invalid signatures', async () => {
		const provider = polar({ webhookSecret: 'polar_secret_test' });

		const valid = await provider.webhooks?.verify({
			request: polarWebhookRequest(
				{
					type: 'customer.created',
					timestamp: '2026-05-30T12:00:00Z',
					data: { id: 'cus_invalid', email: 'ana@example.com' },
				},
				'wrong_secret',
			),
		});

		expect(valid).toBe(false);
	});

	test('maps canceled subscriptions from update events', async () => {
		const provider = polar({ webhookSecret: 'polar_secret_test' });
		const event = await provider.webhooks?.map({
			type: 'subscription.updated',
			timestamp: '2026-05-30T12:00:00Z',
			data: {
				id: 'sub_123',
				amount: 1200,
				currency: 'usd',
				canceled_at: '2026-05-30T12:00:00Z',
			},
		});

		expect(event).toMatchObject({
			id: 'sub_123',
			type: 'subscription.canceled',
			data: {
				id: 'sub_123',
				raw: null,
			},
		});
		expect(event && provider.webhooks?.hook(event)).toBe(
			'onSubscriptionCanceled',
		);
	});
});

function polarWebhookRequest(payload: unknown, secret: string) {
	const body = JSON.stringify(payload);
	const webhookId = 'msg_123';
	const timestamp = '1700000000';
	const signature = createHmac('sha256', secret)
		.update(`${webhookId}.${timestamp}.${body}`)
		.digest('base64');

	return new Request('https://app.test/webhooks', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'webhook-id': webhookId,
			'webhook-signature': `v1,${signature}`,
			'webhook-timestamp': timestamp,
		},
		body,
	});
}
