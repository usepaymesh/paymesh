import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { createClient } from '../../paymesh/src';
import { stripe } from '../../paymesh/src/providers/stripe';
import { Webhooks } from '../src';

describe('@paymesh/express Webhooks', () => {
	test('returns 401 for invalid signatures', async () => {
		const client = createClient({
			provider: stripe({ webhookSecret: 'whsec_test' }),
		});
		const handler = Webhooks({ client });
		const response = createResponse();

		await handler(
			createRequest(
				JSON.stringify({ id: 'evt_invalid', type: 'customer.created' }),
				'wrong_secret',
			),
			response as unknown as Response,
		);

		expect(response.statusCode).toBe(401);
		expect(response.body).toEqual({ error: 'invalid_webhook_signature' });
	});
});

function createRequest(body: string, secret: string) {
	const timestamp = '1700000000';
	const signature = createHmac('sha256', secret)
		.update(`${timestamp}.${body}`)
		.digest('hex');
	const stream = Readable.from([body]) as ExpressRequestWithBody;

	stream.body = undefined;
	stream.headers = {
		'content-type': 'application/json',
		host: 'app.test',
		'stripe-signature': `t=${timestamp},v1=${signature}`,
	};
	stream.method = 'POST';
	stream.originalUrl = '/webhooks';
	stream.protocol = 'https';
	stream.socket = {} as Request['socket'];
	stream.url = '/webhooks';

	return stream as Request;
}

function createResponse() {
	return {
		body: undefined as unknown,
		statusCode: 200,
		json(body: unknown) {
			this.body = body;
			return this;
		},
		status(code: number) {
			this.statusCode = code;
			return this;
		},
	};
}

interface ExpressRequestWithBody extends Readable {
	body?: unknown;
	headers?: Request['headers'];
	method?: string;
	originalUrl?: string;
	protocol?: string;
	socket?: Request['socket'];
	url?: string;
}
