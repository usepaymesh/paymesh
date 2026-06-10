import { describe, expect, test } from 'bun:test';
import { createClient, defineProvider, PaymeshError } from 'paymesh';
import { abacatepay } from '../src';

function expectType<T>(_value: T) {}

describe('abacatepay customers', () => {
	test('manages customers through the client', async () => {
		const requests: Array<{
			input: string;
			method?: string;
			body?: Record<string, unknown>;
		}> = [];
		const provider = abacatepay({
			apiKey: 'abc_test_123',
		});
		const client = createClient({
			provider,
			baseUrl: 'https://abacatepay.customers.test',
			timeout: 1234,
			fetch: (async (input, init) => {
				requests.push({
					input: String(input),
					method: init?.method,
					body: init?.body ? JSON.parse(String(init.body)) : undefined,
				});

				if (
					String(input).includes('/v2/customers/create') &&
					init?.method === 'POST'
				) {
					return Response.json({
						data: {
							id: 'cus_create',
							email: 'ana@example.com',
							name: 'Ana',
							cellphone: '+5511999999999',
							metadata: {
								plan: 'pro',
							},
						},
						success: true,
						error: null,
					});
				}

				if (String(input).includes('/v2/customers/get?id=cus_create')) {
					return Response.json({
						data: {
							id: 'cus_create',
							email: 'ana@example.com',
							name: 'Ana',
							cellphone: '+5511999999999',
							metadata: {
								plan: 'pro',
							},
						},
						success: true,
						error: null,
					});
				}

				if (
					String(input).includes('/v2/customers/delete?id=cus_create') &&
					init?.method === 'POST'
				) {
					return Response.json({
						data: null,
						success: true,
						error: null,
					});
				}

				return new Response('not found', { status: 404 });
			}) as typeof fetch,
		});

		const created = await client.customers.upsert({
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+5511999999999',
			metadata: {
				plan: 'pro',
			},
		});
		const found = await client.customers.get('cus_create');
		const deleted = await client.customers.delete('cus_create');

		expect(requests[0]).toMatchObject({
			input: 'https://abacatepay.customers.test/v2/customers/create',
			method: 'POST',
		});
		expect(requests[0]?.body).toEqual({
			email: 'ana@example.com',
			name: 'Ana',
			cellphone: '+5511999999999',
			metadata: {
				plan: 'pro',
			},
		});
		expect(requests[1]).toMatchObject({
			input: 'https://abacatepay.customers.test/v2/customers/get?id=cus_create',
			method: undefined,
		});
		expect(requests[2]).toMatchObject({
			input:
				'https://abacatepay.customers.test/v2/customers/delete?id=cus_create',
			method: 'POST',
		});
		expect(created).toMatchObject({
			id: 'cus_create',
			provider: 'abacatepay',
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+5511999999999',
			metadata: {
				plan: 'pro',
			},
		});
		expect(found.id).toBe('cus_create');
		expect(found.email).toBe('ana@example.com');
		expect(found.name).toBe('Ana');
		expect(deleted).toEqual({
			id: 'cus_create',
			provider: 'abacatepay',
			sandbox: false,
			deleted: true,
			raw: null,
		});
	});

	test('upserts customer with minimal data', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (_input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(body).toEqual({
					email: 'minimal@example.com',
				});

				return Response.json({
					data: {
						id: 'cus_minimal',
						email: 'minimal@example.com',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const customer = await provider.customers?.upsert({
			email: 'minimal@example.com',
		});

		expect(customer).toMatchObject({
			id: 'cus_minimal',
			provider: 'abacatepay',
			email: 'minimal@example.com',
		});
	});

	test('upserts customer with all fields', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (_input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(body).toEqual({
					email: 'full@example.com',
					name: 'Full Name',
					cellphone: '+5511888888888',
					metadata: {
						plan: 'enterprise',
						team: 'backend',
					},
				});

				return Response.json({
					data: {
						id: 'cus_full',
						email: 'full@example.com',
						name: 'Full Name',
						cellphone: '+5511888888888',
						metadata: {
							plan: 'enterprise',
							team: 'backend',
						},
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const customer = await provider.customers?.upsert({
			email: 'full@example.com',
			name: 'Full Name',
			phone: '+5511888888888',
			metadata: {
				plan: 'enterprise',
				team: 'backend',
			},
		});

		expect(customer).toMatchObject({
			id: 'cus_full',
			provider: 'abacatepay',
			name: 'Full Name',
			email: 'full@example.com',
			phone: '+5511888888888',
			metadata: {
				plan: 'enterprise',
				team: 'backend',
			},
		});
	});

	test('gets customer by id', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input) => {
				expect(String(input)).toBe(
					'https://abacatepay.test/v2/customers/get?id=cus_get_123',
				);

				return Response.json({
					data: {
						id: 'cus_get_123',
						email: 'get@example.com',
						name: 'Get User',
						cellphone: '+5511777777777',
						metadata: {
							role: 'admin',
						},
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const customer = await provider.customers?.get('cus_get_123');

		expect(customer).toMatchObject({
			id: 'cus_get_123',
			provider: 'abacatepay',
			email: 'get@example.com',
			name: 'Get User',
			phone: '+5511777777777',
			metadata: {
				role: 'admin',
			},
		});
		expect(customer?.raw).toBeNull();
	});

	test('encodes special characters in customer id', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input) => {
				expect(String(input)).toBe(
					'https://abacatepay.test/v2/customers/get?id=cus%2Fwith%2Fslashes',
				);

				return Response.json({
					data: {
						id: 'cus/with/slashes',
						email: 'slash@example.com',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const customer = await provider.customers?.get('cus/with/slashes');

		expect(customer?.id).toBe('cus/with/slashes');
	});

	test('deletes customer and always returns success', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input, init) => {
				expect(String(input)).toBe(
					'https://abacatepay.test/v2/customers/delete?id=cus_del_123',
				);
				expect(init?.method).toBe('POST');

				return Response.json({
					data: null,
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const deleted = await provider.customers?.delete('cus_del_123');

		expect(deleted).toEqual({
			id: 'cus_del_123',
			provider: 'abacatepay',
			sandbox: false,
			deleted: true,
			raw: null,
		});
	});

	test('delete returns sandbox true when provider is sandbox', async () => {
		const provider = abacatepay({
			apiKey: 'abc_dev_test123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: null,
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const deleted = await provider.customers?.delete('cus_sandbox_del');

		expect(deleted).toMatchObject({
			id: 'cus_sandbox_del',
			sandbox: true,
			deleted: true,
		});
	});

	test('supports raw customer payloads globally and per call', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.customers.test',
			fetch: (async () =>
				Response.json({
					data: {
						id: 'cus_raw',
						email: 'ana@example.com',
						name: 'Ana',
						cellphone: '+5511999999999',
					},
					success: true,
					error: null,
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
	});

	test('supports raw payloads on upsert', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.customers.test',
			fetch: (async () =>
				Response.json({
					data: {
						id: 'cus_upsert_raw',
						email: 'upsert@example.com',
						name: 'Upsert',
					},
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultCustomer = await defaultClient.customers.upsert({
			email: 'upsert@example.com',
			name: 'Upsert',
		});
		const rawCustomer = await rawClient.customers.upsert({
			email: 'upsert@example.com',
			name: 'Upsert',
		});

		expect(defaultCustomer.raw).toBeNull();
		expect(rawCustomer.raw).toMatchObject({
			id: 'cus_upsert_raw',
		});
	});

	test('supports raw payloads on delete', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.customers.test',
			fetch: (async () =>
				Response.json({
					data: null,
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultDeleted = await defaultClient.customers.delete('cus_del_raw');
		const rawDeleted = await rawClient.customers.delete('cus_del_raw');

		expect(defaultDeleted.raw).toBeNull();
		expect(rawDeleted.raw).toBeNull();
	});

	test('checks customer capability before calling the provider', async () => {
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				isSandbox: () => false,
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
					get: async () => {
						throw new Error('should not be called');
					},
					upsert: async () => {
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

	test('upsert omits optional fields when not provided', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (_input, init) => {
				const body = JSON.parse(String(init?.body));

				expect(body).toEqual({});

				return Response.json({
					data: {
						id: 'cus_empty',
					},
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const customer = await provider.customers?.upsert({});

		expect(customer?.id).toBe('cus_empty');
	});

	test('returns undefined for null fields from API', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: {
						id: 'cus_nulls',
						email: null,
						name: null,
						cellphone: null,
						metadata: null,
					},
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const customer = await provider.customers?.get('cus_nulls');

		expect(customer?.id).toBe('cus_nulls');
		expect(customer?.email).toBeUndefined();
		expect(customer?.name).toBeUndefined();
		expect(customer?.phone).toBeUndefined();
		expect(customer?.metadata).toBeUndefined();
	});
});
