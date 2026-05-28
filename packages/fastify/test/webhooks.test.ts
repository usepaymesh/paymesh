import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createClient } from '../../paymesh/src';
import { stripe } from '../../paymesh/src/providers/stripe';
import { Webhooks } from '../src';

describe('@paymesh/fastify Webhooks', () => {
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
		const reply = createReply();

		await handler(
			createRequest(
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
			),
			reply as unknown as FastifyReply,
		);

		expect(reply.statusCode).toBe(200);
		expect(reply.body).toEqual({ received: true });
		expect(calls).toEqual(['local']);
	});
});

function createRequest(payload: unknown, secret: string) {
	const body = JSON.stringify(payload);
	const timestamp = '1700000000';
	const signature = createHmac('sha256', secret)
		.update(`${timestamp}.${body}`)
		.digest('hex');
	const raw = Readable.from([body]) as Readable & FastifyRequest['raw'];

	raw.headers = {
		'content-type': 'application/json',
		host: 'app.test',
		'stripe-signature': `t=${timestamp},v1=${signature}`,
	};
	raw.method = 'POST';
	raw.socket = {} as FastifyRequest['raw']['socket'];
	raw.url = '/webhooks';

	return {
		body: undefined,
		headers: raw.headers,
		method: 'POST',
		protocol: 'https',
		raw,
		url: '/webhooks',
	} as FastifyRequest;
}

function createReply() {
	return {
		body: undefined as unknown,
		statusCode: 200,
		code(statusCode: number) {
			this.statusCode = statusCode;
			return this;
		},
		send(body: unknown) {
			this.body = body;
			return this;
		},
	};
}
