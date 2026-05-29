import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { stripe } from '@paymesh/stripe';
import type { Context } from 'elysia';
import { createClient } from 'paymesh';
import { Webhooks } from '../src';

describe('@paymesh/elysia Webhooks', () => {
	test('returns an Elysia-compatible handler for successful webhooks', async () => {
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

		const response = await callHandler(handler, {
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
		});

		expect(response).toEqual({
			statusCode: 200,
			body: { received: true },
		});
		expect(calls).toEqual(['evt_success']);
	});

	test('local hooks override client hooks', async () => {
		const calls: string[] = [];
		const client = createClient({
			provider: stripe({ webhookSecret: 'whsec_test' }),
			hooks: {
				onPaymentFailed() {
					calls.push('client');
				},
			},
		});
		const handler = Webhooks({
			client,
			onPaymentFailed() {
				calls.push('local');
			},
		});

		const response = await callHandler(handler, {
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
		});

		expect(response.statusCode).toBe(200);
		expect(calls).toEqual(['local']);
	});

	test('returns 401 for invalid signatures', async () => {
		const client = createClient({
			provider: stripe({ webhookSecret: 'whsec_test' }),
		});
		const handler = Webhooks({ client });

		const response = await callHandler(
			handler,
			{ id: 'evt_invalid', type: 'customer.created' },
			'wrong_secret',
		);

		expect(response).toEqual({
			statusCode: 401,
			body: { error: 'invalid_webhook_signature' },
		});
	});
});

async function callHandler(
	handler: ReturnType<typeof Webhooks>,
	payload: unknown,
	secret = 'whsec_test',
) {
	return callHandlerWithBody(handler, JSON.stringify(payload), secret);
}

async function callHandlerWithBody(
	handler: ReturnType<typeof Webhooks>,
	body: string,
	secret: string,
) {
	const request = signedStripeRequest(body, secret);
	let statusCode = 200;
	let responseBody: unknown;

	await handler({
		request,
		status(code: number, body: unknown) {
			statusCode = code;
			responseBody = body;
			return { statusCode: code, body };
		},
	} as unknown as Context);

	return { statusCode, body: responseBody };
}

function signedStripeRequest(body: string, secret: string) {
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
