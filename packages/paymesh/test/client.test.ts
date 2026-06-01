import { describe, expect, test } from 'bun:test';
import {
	createClient,
	defineProvider,
	type Payment,
	PaymeshError,
	type ProviderRequestOptions,
	withRaw,
} from '../src';

function expectType<T>(_value: T) {}

describe('client', () => {
	test('merges default request options into provider calls', async () => {
		const calls: Array<ProviderRequestOptions<boolean> | undefined> = [];
		const retry = { max: 1 };
		const fetcher = (async () =>
			Response.json({
				ok: true,
			})) as unknown as typeof fetch;
		const provider = createStubProvider({
			onPaymentCreate(_data, options) {
				calls.push(options);

				return Promise.resolve(
					withRaw(
						{
							id: 'pay_123',
							provider: 'stub',
							amount: 1000,
							currency: 'usd',
							status: 'paid' as const,
						},
						{
							id: 'raw_pay_123',
						},
						options?.includeRaw,
					),
				);
			},
		});
		const client = createClient({
			provider,
			baseUrl: 'https://api.stub.test',
			timeout: 1234,
			retry,
			fetch: fetcher,
		});

		await client.payments.create({
			amount: 1000,
			currency: 'USD',
			productIds: ['prod_123'],
		});

		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({
			baseUrl: 'https://api.stub.test',
			timeout: 1234,
			retry,
			fetch: fetcher,
			includeRaw: false,
		});
	});

	test('supports raw payloads globally and per call', async () => {
		const provider = createStubProvider();
		const defaultClient = createClient({ provider });
		const rawClient = createClient({ provider, includeRaw: true });

		const defaultPayment = await defaultClient.payments.create({
			amount: 1200,
			currency: 'USD',
			productIds: ['prod_123'],
		});
		const callRawPayment = await defaultClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
				productIds: ['prod_123'],
			},
			{ includeRaw: true },
		);
		const globalRawPayment = await rawClient.payments.create({
			amount: 1200,
			currency: 'USD',
			productIds: ['prod_123'],
		});
		const callNullPayment = await rawClient.payments.create(
			{
				amount: 1200,
				currency: 'USD',
				productIds: ['prod_123'],
			},
			{ includeRaw: false },
		);
		const defaultCustomer = await defaultClient.customers.get('cus_123');
		const callRawCustomer = await defaultClient.customers.get('cus_123', {
			includeRaw: true,
		});

		expectType<null>(defaultPayment.raw);
		expectType<unknown>(callRawPayment.raw);
		expectType<unknown>(globalRawPayment.raw);
		expectType<null>(callNullPayment.raw);
		expectType<null>(defaultCustomer.raw);
		expectType<unknown>(callRawCustomer.raw);

		expect(defaultPayment.raw).toBeNull();
		expect(callRawPayment.raw).toMatchObject({ id: 'raw_pay_123' });
		expect(globalRawPayment.raw).toMatchObject({ id: 'raw_pay_123' });
		expect(callNullPayment.raw).toBeNull();
		expect(defaultCustomer.raw).toBeNull();
		expect(callRawCustomer.raw).toMatchObject({ id: 'raw_cus_123' });
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

	test('checks checkout capability before calling the provider', async () => {
		const client = createClient({
			provider: defineProvider({
				id: 'stub',
				capabilities: {
					checkout: false,
					customers: true,
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

		await expect(
			client.payments.create({
				amount: 1000,
				currency: 'USD',
			}),
		).rejects.toMatchObject({
			code: 'unsupported_capability',
			message: 'Provider "stub" does not support "checkout" capability',
			provider: 'stub',
		});
		await expect(
			client.payments.create({
				amount: 1000,
				currency: 'USD',
			}),
		).rejects.toBeInstanceOf(PaymeshError);
	});
});

function createStubProvider({
	onPaymentCreate,
}: {
	onPaymentCreate?: <IncludeRaw extends boolean = false>(
		data: { amount: number; currency: string },
		options?: ProviderRequestOptions<IncludeRaw>,
	) => Promise<Payment<IncludeRaw>>;
} = {}) {
	return defineProvider({
		id: 'stub',
		capabilities: {
			checkout: true,
			customers: true,
		},
		payments: {
			create: onPaymentCreate
				? onPaymentCreate
				: async (_data, options) =>
						withRaw(
							{
								id: 'pay_123',
								provider: 'stub',
								amount: 1200,
								currency: 'usd',
								status: 'paid' as const,
							},
							{
								id: 'raw_pay_123',
							},
							options?.includeRaw,
						),
		},
		customers: {
			get: async (_id, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
					},
					{
						id: 'raw_cus_123',
					},
					options?.includeRaw,
				),
			upsert: async (_data, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
					},
					{
						id: 'raw_cus_123',
					},
					options?.includeRaw,
				),
			delete: async (_id, options) =>
				withRaw(
					{
						id: 'cus_123',
						provider: 'stub',
						deleted: true,
					},
					{
						id: 'raw_cus_123',
					},
					options?.includeRaw,
				),
		},
	});
}
