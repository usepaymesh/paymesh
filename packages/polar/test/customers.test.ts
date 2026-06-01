import { describe, expect, test } from 'bun:test';
import { createClient, defineProvider, PaymeshError } from 'paymesh';
import { polar } from '../src';

function expectType<T>(_value: T) {}

describe('polar customers', () => {
	test('manages Polar customers through the client', async () => {
		const requests: Array<{
			input: string;
			method?: string;
			body?: Record<string, unknown>;
		}> = [];
		const provider = polar({
			accessToken: 'polar_oat_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://polar.customers.test',
			timeout: 1234,
			fetch: (async (input, init) => {
				requests.push({
					input: String(input),
					method: init?.method,
					body: init?.body ? JSON.parse(String(init.body)) : undefined,
				});

				if (
					String(input).endsWith('/v1/customers') &&
					init?.method === 'POST'
				) {
					return Response.json({
						id: 'cus_create',
						email: 'ana@example.com',
						name: 'Ana',
						external_id: 'user_ext_123',
						metadata: {
							plan: 'pro',
						},
					});
				}

				if (String(input).endsWith('/v1/customers/cus_create')) {
					if (init?.method === 'PATCH') {
						return Response.json({
							id: 'cus_create',
							email: 'ana@example.com',
							name: 'Ana Silva',
							external_id: 'user_ext_123',
							metadata: {
								plan: 'business',
							},
						});
					}

					if (init?.method === 'DELETE') {
						return new Response(null, { status: 204 });
					}

					return Response.json({
						id: 'cus_create',
						email: 'ana@example.com',
						name: 'Ana',
						external_id: 'user_ext_123',
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
			externalId: 'user_ext_123',
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
			input: 'https://polar.customers.test/v1/customers',
			method: 'POST',
		});
		expect(requests[0]?.body).toEqual({
			email: 'ana@example.com',
			name: 'Ana',
			external_id: 'user_ext_123',
			metadata: {
				plan: 'pro',
			},
		});
		expect(requests[1]).toMatchObject({
			input: 'https://polar.customers.test/v1/customers/cus_create',
			method: undefined,
		});
		expect(requests[2]).toMatchObject({
			input: 'https://polar.customers.test/v1/customers/cus_create',
			method: 'PATCH',
		});
		expect(requests[2]?.body).toEqual({
			email: undefined,
			name: 'Ana Silva',
			metadata: {
				plan: 'business',
			},
		});
		expect(requests[3]).toMatchObject({
			input: 'https://polar.customers.test/v1/customers/cus_create',
			method: 'DELETE',
		});
		expect(created).toMatchObject({
			id: 'cus_create',
			provider: 'polar',
			externalId: 'user_ext_123',
			name: 'Ana',
			email: 'ana@example.com',
			metadata: {
				plan: 'pro',
			},
		});
		expect(found.id).toBe('cus_create');
		expect(updated).toMatchObject({
			id: 'cus_create',
			externalId: 'user_ext_123',
			name: 'Ana Silva',
			metadata: {
				plan: 'business',
			},
		});
		expect(deleted).toEqual({
			id: 'cus_create',
			provider: 'polar',
			deleted: true,
			raw: null,
		});
	});

	test('requires email when creating Polar customers', async () => {
		const provider = polar({
			accessToken: 'polar_oat_123',
		});

		await expect(
			provider.customers.create({
				name: 'Ana',
			}),
		).rejects.toMatchObject({
			code: 'invalid_request',
			message: 'Provider "polar" requires "email" when creating customers',
		});
	});

	test('supports raw customer payloads globally and per call', async () => {
		const provider = polar({
			accessToken: 'polar_oat_123',
			baseUrl: 'https://polar.customers.test',
			fetch: (async () =>
				Response.json({
					id: 'cus_raw',
					email: 'ana@example.com',
					name: 'Ana',
					external_id: 'user_ext_123',
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
		});
		expect(globalRawCustomer.raw).toMatchObject({
			id: 'cus_raw',
		});
		expect(callNullCustomer.raw).toBeNull();
		expect(defaultCustomer.externalId).toBe('user_ext_123');
		expect(callRawCustomer.externalId).toBe('user_ext_123');
		expect(globalRawCustomer.externalId).toBe('user_ext_123');
		expect(callNullCustomer.externalId).toBe('user_ext_123');
	});

	test('checks customer capability before calling the provider', async () => {
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: true,
					customers: false,
				},
				payments: {
					create: async () => {
						throw new Error('should not be called');
					},
				},
				customers: {
					create: async () => {
						throw new Error('should not be called');
					},
					get: async () => {
						throw new Error('should not be called');
					},
					update: async () => {
						throw new Error('should not be called');
					},
					delete: async () => {
						throw new Error('should not be called');
					},
				},
			}),
		});

		await expect(client.customers.get('cus_test')).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "stub" does not support "customers" capability',
			provider: 'stub',
		});
		await expect(client.customers.get('cus_test')).rejects.toBeInstanceOf(
			PaymeshError,
		);
	});
});
