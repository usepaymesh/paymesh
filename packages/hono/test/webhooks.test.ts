import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { stripe } from '@paymesh/stripe';
import type { Context } from 'hono';
import { createClient } from 'paymesh';
import { Webhooks } from '../src';

describe('@paymesh/hono Webhooks', () => {
	test('returns a Hono-compatible handler for successful webhooks', async () => {
		const calls: string[] = [];
		const client = createClient({
			provider: stripe({ webhookSecret: 'whsec_test' }),
			hooks: {
				onPaymentSucceeded(event) {
					calls.push(event.id);
				},
			},
		});
		const handler = Webhooks({ client });

		const response = (await handler({
			req: {
				raw: signedStripeRequest({
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
			},
			json(body: unknown, status: number) {
				return { body, status };
			},
		} as unknown as Context)) as unknown as {
			body: unknown;
			status: number;
		};

		expect(response).toEqual({
			status: 200,
			body: { received: true },
		});
		expect(calls).toEqual(['evt_success']);
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
