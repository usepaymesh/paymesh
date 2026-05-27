import { describe, expect, test } from 'bun:test';
import { createClient } from '../src';
import { stripe } from '../src/providers/stripe';

function expectType<T>(_value: T) {}

describe('customers', () => {
	test('manages Stripe customers through the client', async () => {
		const requests: Array<{
			input: string;
			method?: string;
			body?: URLSearchParams;
		}> = [];
		const provider = stripe({
			secret: 'sk_test_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://stripe.customers.test',
			timeout: 1234,
			fetch: (async (input, init) => {
				requests.push({
					input: String(input),
					method: init?.method,
					body: init?.body as URLSearchParams | undefined,
				});

				if (
					String(input).endsWith('/v1/customers') &&
					init?.method === 'POST'
				) {
					return Response.json({
						id: 'cus_create',
						object: 'customer',
						name: 'Ana',
						email: 'ana@example.com',
						phone: '+5511999999999',
						metadata: {
							plan: 'pro',
						},
					});
				}

				if (String(input).endsWith('/v1/customers/cus_create')) {
					if (init?.method === 'POST') {
						return Response.json({
							id: 'cus_create',
							object: 'customer',
							name: 'Ana Silva',
							email: 'ana@example.com',
							phone: '+5511999999999',
							metadata: {
								plan: 'business',
							},
						});
					}

					if (init?.method === 'DELETE') {
						return Response.json({
							id: 'cus_create',
							object: 'customer',
							deleted: true,
						});
					}

					return Response.json({
						id: 'cus_create',
						object: 'customer',
						name: 'Ana',
						email: 'ana@example.com',
						phone: '+5511999999999',
						metadata: {
							plan: 'pro',
						},
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});

		const created = await client.customers.create({
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+5511999999999',
			metadata: {
				plan: 'pro',
			},
		});
		const found = await client.customers.get('cus_create');
		const updated = await client.customers.update('cus_create', {
			name: 'Ana Silva',
			metadata: {
				plan: 'business',
			},
		});
		const deleted = await client.customers.delete('cus_create');

		expect(requests[0]).toMatchObject({
			input: 'https://stripe.customers.test/v1/customers',
			method: 'POST',
		});
		expect(requests[0]?.body?.get('name')).toBe('Ana');
		expect(requests[0]?.body?.get('email')).toBe('ana@example.com');
		expect(requests[0]?.body?.get('phone')).toBe('+5511999999999');
		expect(requests[0]?.body?.get('metadata[plan]')).toBe('pro');
		expect(requests[1]).toMatchObject({
			input: 'https://stripe.customers.test/v1/customers/cus_create',
			method: undefined,
		});
		expect(requests[2]).toMatchObject({
			input: 'https://stripe.customers.test/v1/customers/cus_create',
			method: 'POST',
		});
		expect(requests[2]?.body?.get('name')).toBe('Ana Silva');
		expect(requests[2]?.body?.get('metadata[plan]')).toBe('business');
		expect(requests[3]).toMatchObject({
			input: 'https://stripe.customers.test/v1/customers/cus_create',
			method: 'DELETE',
		});
		expect(created).toMatchObject({
			id: 'cus_create',
			provider: 'stripe',
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+5511999999999',
			metadata: {
				plan: 'pro',
			},
		});
		expect(found.id).toBe('cus_create');
		expect(updated).toMatchObject({
			id: 'cus_create',
			name: 'Ana Silva',
			metadata: {
				plan: 'business',
			},
		});
		expect(deleted).toEqual({
			id: 'cus_create',
			provider: 'stripe',
			deleted: true,
			raw: null,
		});
	});

	test('supports raw customer payloads globally and per call', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.customers.test',
			fetch: (async () =>
				Response.json({
					id: 'cus_raw',
					object: 'customer',
					name: 'Ana',
					email: 'ana@example.com',
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultCustomer = await defaultClient.customers.get('cus_raw');
		const callRawCustomer = await defaultClient.customers.get('cus_raw', {
			includeRaw: true,
		});
		const globalRawCustomer = await rawClient.customers.get('cus_raw');
		const callNullCustomer = await rawClient.customers.get('cus_raw', {
			includeRaw: false,
		});

		expectType<null>(defaultCustomer.raw);
		expectType<unknown>(callRawCustomer.raw);
		expectType<unknown>(globalRawCustomer.raw);
		expectType<null>(callNullCustomer.raw);

		expect(defaultCustomer.raw).toBeNull();
		expect(callRawCustomer.raw).toMatchObject({
			id: 'cus_raw',
			object: 'customer',
		});
		expect(globalRawCustomer.raw).toMatchObject({
			id: 'cus_raw',
			object: 'customer',
		});
		expect(callNullCustomer.raw).toBeNull();
	});

	test('uses Stripe customer id when creating checkout sessions', async () => {
		const provider = stripe({
			secret: 'sk_test_123',
			baseUrl: 'https://stripe.test',
			fetch: (async (_input, init) => {
				const body = init?.body as URLSearchParams;

				expect(body.get('customer')).toBe('cus_123');
				expect(body.get('client_reference_id')).toBeNull();
				expect(body.get('customer_email')).toBeNull();

				return Response.json({
					id: 'cs_test_customer',
					object: 'checkout.session',
					amount_total: 1000,
					currency: 'usd',
					customer: 'cus_123',
					payment_status: 'paid',
					status: 'complete',
				});
			}) as typeof fetch,
		});

		const payment = await provider.payments.create({
			amount: 1000,
			currency: 'USD',
			customer: {
				id: 'cus_123',
				email: 'ana@example.com',
			},
		});

		expect(payment.customer).toBeUndefined();
	});
});
