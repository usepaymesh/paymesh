import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createClient } from '../../paymesh/src';
import { stripe } from '../../paymesh/src/providers/stripe';
import { Webhooks } from '../src';

describe('@paymesh/next Webhooks', () => {
	test('returns 500 when a hook throws', async () => {
		const handler = Webhooks({
			client: createClient({
				provider: stripe({ webhookSecret: 'whsec_test' }),
			}),
			onPaymentSucceeded() {
				throw new Error('boom');
			},
		});

		const response = await handler(
			signedStripeRequest({
				id: 'evt_success',
				type: 'payment_intent.succeeded',
				data: {
					object: {
						id: 'pi_success',
						object: 'payment_intent',
						amount: 1200,
						currency: 'usd',
						status: 'succeeded',
					},
				},
			}),
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'hook_error' });
	});
});

function signedStripeRequest(payload: unknown, secret = 'whsec_test') {
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
