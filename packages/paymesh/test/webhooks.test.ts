import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { stripe } from '../src/providers/stripe';

describe('provider webhooks', () => {
	test('Stripe verifies, parses, maps, and resolves hook names', async () => {
		const provider = stripe({ webhookSecret: 'whsec_test' });
		const request = stripeWebhookRequest(
			{
				id: 'evt_failed',
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
		const payload = await provider.webhooks?.parse(request);
		const event = await provider.webhooks?.map(payload ?? {});

		expect(valid).toBe(true);
		expect(event).toMatchObject({
			id: 'evt_failed',
			type: 'payment.failed',
			provider: 'stripe',
			data: {
				id: 'pi_failed',
				status: 'failed',
				raw: null,
			},
			raw: null,
		});
		expect(event && provider.webhooks?.hook(event)).toBe('onPaymentFailed');
	});

	test('Stripe maps customer webhook events', async () => {
		const provider = stripe({ webhookSecret: 'whsec_test' });
		const event = await provider.webhooks?.map(
			{
				id: 'evt_customer_updated',
				type: 'customer.updated',
				data: {
					object: {
						id: 'cus_raw',
						object: 'customer',
						name: 'Ana',
						email: 'ana@example.com',
					},
				},
			},
			{ includeRaw: true },
		);

		expect(event).toMatchObject({
			id: 'evt_customer_updated',
			type: 'customer.updated',
			data: {
				id: 'cus_raw',
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
		expect(event && provider.webhooks?.hook<true>(event)).toBe(
			'onCustomerUpdated',
		);
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
