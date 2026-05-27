import { describe, expect, test } from 'bun:test';
import { PaymeshError } from '../src';
import { request } from '../src/shared/request';

describe('request', () => {
	test('combines baseUrl, path, query params, and json body', async () => {
		const response = await request<{ ok: true }>('/v1/example', {
			baseUrl: 'https://api.example.test',
			method: 'POST',
			query: {
				limit: 10,
				expand: ['customer', 'line_items'],
			},
			body: {
				name: 'paymesh',
			},
			fetch: (async (input, init) => {
				expect(String(input)).toBe(
					'https://api.example.test/v1/example?limit=10&expand=customer&expand=line_items',
				);
				expect(init?.method).toBe('POST');
				expect(init?.body).toBe('{"name":"paymesh"}');

				return Response.json({ ok: true });
			}) as typeof fetch,
		});

		expect(response.ok).toBe(true);
	});

	test('retries retryable responses', async () => {
		let attempts = 0;

		const response = await request<{ ok: true }>('/v1/retry', {
			baseUrl: 'https://api.example.test',
			retry: {
				max: 2,
			},
			fetch: (async () => {
				attempts += 1;

				if (attempts < 3) {
					return new Response('rate limited', { status: 429 });
				}

				return Response.json({ ok: true });
			}) as unknown as typeof fetch,
		});

		expect(attempts).toBe(3);
		expect(response.ok).toBe(true);
	});

	test('throws PaymeshError on http errors with the response body message', async () => {
		const promise = request('/v1/fail', {
			baseUrl: 'https://api.example.test',
			fetch: (async () =>
				Response.json(
					{
						error: {
							message: 'Invalid amount',
							code: 'amount_too_small',
						},
					},
					{
						status: 400,
						statusText: 'Bad Request',
					},
				)) as unknown as typeof fetch,
		});

		await expect(promise).rejects.toThrow(PaymeshError);
		await expect(promise).rejects.toMatchObject({
			type: 'request_error',
			message: 'Invalid amount',
			status: 400,
			statusText: 'Bad Request',
			url: 'https://api.example.test/v1/fail',
			body: {
				error: {
					message: 'Invalid amount',
					code: 'amount_too_small',
				},
			},
		});
	});
});
