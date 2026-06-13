import { describe, expect, test } from 'bun:test';
import { createClient } from 'paymesh';
import { dodo } from '../src';

function expectType<T>(_value: T) {}

describe('dodo customers', () => {
	test('manages Dodo customers through the client', async () => {
		const requests: Array<{
			input: string;
			method?: string;
			body?: Record<string, unknown>;
		}> = [];
		const provider = dodo({
			apiKey: 'dodo_test_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://dodo.customers.test',
			timeout: 1234,
			fetch: (async (input, init) => {
				requests.push({
					input: String(input),
					method: init?.method,
					body: init?.body ? JSON.parse(String(init.body)) : undefined,
				});

				if (String(input).endsWith('/customers') && init?.method === 'POST') {
					return Response.json({
						customer_id: 'cus_create',
						email: 'ana@example.com',
						name: 'Ana',
						phone_number: '+5511999999999',
						metadata: {
							externalId: 'user_ext_123',
							plan: 'pro',
						},
					});
				}

				if (String(input).endsWith('/customers/cus_create')) {
					if (init?.method === 'PATCH') {
						return Response.json({
							customer_id: 'cus_create',
							email: 'ana@example.com',
							name: 'Ana Silva',
							phone_number: '+5511999999999',
							metadata: {
								externalId: 'user_ext_123',
								plan: 'business',
							},
						});
					}

					return Response.json({
						customer_id: 'cus_create',
						email: 'ana@example.com',
						name: 'Ana',
						phone_number: '+5511999999999',
						metadata: {
							externalId: 'user_ext_123',
							plan: 'pro',
						},
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});

		const created = await client.customers.upsert({
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+5511999999999',
			externalId: 'user_ext_123',
			metadata: {
				plan: 'pro',
			},
		});
		const found = await client.customers.get('cus_create');
		const updated = await client.customers.upsert({
			id: 'cus_create',
			name: 'Ana Silva',
			metadata: {
				plan: 'business',
			},
		});

		expect(requests[0]).toMatchObject({
			input: 'https://dodo.customers.test/customers',
			method: 'POST',
		});
		expect(requests[0]?.body).toEqual({
			email: 'ana@example.com',
			name: 'Ana',
			phone_number: '+5511999999999',
			metadata: {
				plan: 'pro',
				externalId: 'user_ext_123',
			},
		});
		expect(requests[1]).toMatchObject({
			input: 'https://dodo.customers.test/customers/cus_create',
			method: undefined,
		});
		expect(requests[2]).toMatchObject({
			input: 'https://dodo.customers.test/customers/cus_create',
			method: 'PATCH',
		});
		expect(requests[2]?.body).toEqual({
			email: undefined,
			name: 'Ana Silva',
			phone_number: undefined,
			metadata: {
				plan: 'business',
			},
		});
		expect(created).toMatchObject({
			id: 'cus_create',
			provider: 'dodo',
			externalId: 'user_ext_123',
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+5511999999999',
			metadata: {
				externalId: 'user_ext_123',
				plan: 'pro',
			},
		});
		expect(found.id).toBe('cus_create');
		expect(updated.name).toBe('Ana Silva');
	});

	test('supports raw customer payloads and explicit delete failures', async () => {
		const provider = dodo({
			apiKey: 'dodo_test_123',
			baseUrl: 'https://dodo.customers.test',
			fetch: (async () =>
				Response.json({
					customer_id: 'cus_raw',
					email: 'ana@example.com',
					name: 'Ana',
					metadata: {
						externalId: 'user_ext_123',
					},
				})) as unknown as typeof fetch,
		});
		const rawClient = createClient({ provider, includeRaw: true });

		const customer = await rawClient.customers.get('cus_raw');

		expectType<unknown>(customer.raw);
		expect(customer.raw).toMatchObject({
			customer_id: 'cus_raw',
		});
		expect(customer.externalId).toBe('user_ext_123');

		await expect(rawClient.customers.delete('cus_raw')).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "dodo" does not support deleting customers.',
			provider: 'dodo',
		});
	});

	test('requires email when creating customers', async () => {
		const provider = dodo({
			apiKey: 'dodo_test_123',
		});

		await expect(
			provider.customers.upsert({
				name: 'Ana',
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message: 'Provider "dodo" requires "email" when creating customers',
		});
	});
});
