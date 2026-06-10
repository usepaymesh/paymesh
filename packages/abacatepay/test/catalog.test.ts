import { describe, expect, test } from 'bun:test';
import { abacatepay } from '../src';

describe('abacatepay catalog', () => {
	test('lists products and maps prices', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async (input) => {
				expect(String(input)).toBe('https://abacatepay.test/v2/products');

				return Response.json({
					data: [
						{
							id: 'prod_1',
							name: 'Pro Plan',
							description: 'Access to all features',
							active: true,
							price: 4900,
							currency: 'BRL',
						},
						{
							id: 'prod_2',
							name: 'Basic Plan',
							description: 'Essential features',
							active: true,
							price: 1900,
							currency: 'BRL',
						},
					],
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products).toHaveLength(2);
		expect(catalog?.products[0]).toMatchObject({
			id: 'prod_1',
			sandbox: false,
			name: 'Pro Plan',
			description: 'Access to all features',
			active: true,
			metadata: undefined,
			version: undefined,
		});
		expect(catalog?.products[0]?.raw).toEqual({
			id: 'prod_1',
			name: 'Pro Plan',
			description: 'Access to all features',
			active: true,
			price: 4900,
			currency: 'BRL',
		});
		expect(catalog?.products[1]).toMatchObject({
			id: 'prod_2',
			name: 'Basic Plan',
			description: 'Essential features',
			active: true,
		});

		expect(catalog?.prices).toHaveLength(2);
		expect(catalog?.prices[0]).toMatchObject({
			id: 'prod_1_price',
			sandbox: false,
			productId: 'prod_1',
			active: true,
			type: 'one_time',
			currency: 'BRL',
			amount: 4900,
			interval: undefined,
			intervalCount: undefined,
			metadata: undefined,
			version: undefined,
		});
		expect(catalog?.prices[0]?.raw).toEqual({
			id: 'prod_1',
			name: 'Pro Plan',
			description: 'Access to all features',
			active: true,
			price: 4900,
			currency: 'BRL',
		});
		expect(catalog?.prices[1]).toMatchObject({
			id: 'prod_2_price',
			productId: 'prod_2',
			amount: 1900,
		});
	});

	test('filters out products without numeric price', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_with_price',
							name: 'Paid Product',
							price: 2500,
							currency: 'BRL',
						},
						{
							id: 'prod_no_price',
							name: 'Free Product',
							price: null,
						},
						{
							id: 'prod_undefined_price',
							name: 'Undefined Price Product',
						},
						{
							id: 'prod_zero_price',
							name: 'Zero Price Product',
							price: 0,
							currency: 'BRL',
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products).toHaveLength(4);

		expect(catalog?.prices).toHaveLength(2);
		expect(catalog?.prices?.map((p) => p.productId)).toEqual([
			'prod_with_price',
			'prod_zero_price',
		]);
	});

	test('handles empty product list', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products).toHaveLength(0);
		expect(catalog?.prices).toHaveLength(0);
	});

	test('defaults active to true when not provided', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_no_active',
							name: 'No Active Field',
							price: 1000,
							currency: 'BRL',
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products[0]?.active).toBe(true);
		expect(catalog?.prices[0]?.active).toBe(true);
	});

	test('defaults currency to BRL when not provided', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_no_currency',
							name: 'No Currency',
							price: 1000,
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.prices[0]?.currency).toBe('BRL');
	});

	test('defaults description to undefined when null', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_null_desc',
							name: 'Null Desc',
							description: null,
							price: 1000,
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products[0]?.description).toBeUndefined();
	});

	test('defaults description to undefined when name is undefined', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_no_name',
							price: 1000,
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products[0]?.name).toBeUndefined();
	});

	test('maps inactive products', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_inactive',
							name: 'Inactive Product',
							active: false,
							price: 1000,
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products[0]?.active).toBe(false);
		expect(catalog?.prices[0]?.active).toBe(false);
	});

	test('reports sandbox from provider options', async () => {
		const provider = abacatepay({
			apiKey: 'abc_dev_test123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: [
						{
							id: 'prod_sandbox',
							name: 'Sandbox Product',
							price: 1000,
						},
					],
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products[0]?.sandbox).toBe(true);
		expect(catalog?.prices[0]?.sandbox).toBe(true);
	});

	test('uses default baseUrl when not provided', async () => {
		let capturedUrl: string | undefined;
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			fetch: (async (input) => {
				capturedUrl = String(input);
				return Response.json({
					data: [],
					success: true,
					error: null,
				});
			}) as typeof fetch,
		});

		await provider.catalog?.list();

		expect(capturedUrl).toBe('https://api.abacatepay.com/v2/products');
	});

	test('throws on failed API response', async () => {
		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: null,
					success: false,
					error: 'Unauthorized',
				})) as unknown as typeof fetch,
		});

		await expect(provider.catalog?.list()).rejects.toMatchObject({
			code: 'provider_error',
			message: 'Unauthorized',
			provider: 'abacatepay',
		});
	});

	test('maps many products correctly', async () => {
		const products = Array.from({ length: 50 }, (_, i) => ({
			id: `prod_${i}`,
			name: `Product ${i}`,
			description: `Description ${i}`,
			active: i % 2 === 0,
			price: (i + 1) * 100,
			currency: 'BRL',
		}));

		const provider = abacatepay({
			apiKey: 'abc_test_123',
			baseUrl: 'https://abacatepay.test',
			fetch: (async () =>
				Response.json({
					data: products,
					success: true,
					error: null,
				})) as unknown as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products).toHaveLength(50);
		expect(catalog?.prices).toHaveLength(50);

		for (let i = 0; i < 50; i++) {
			expect(catalog?.products[i]?.id).toBe(`prod_${i}`);
			expect(catalog?.products[i]?.name).toBe(`Product ${i}`);
			expect(catalog?.products[i]?.active).toBe(i % 2 === 0);
			expect(catalog?.prices[i]?.id).toBe(`prod_${i}_price`);
			expect(catalog?.prices[i]?.productId).toBe(`prod_${i}`);
			expect(catalog?.prices[i]?.amount).toBe((i + 1) * 100);
		}
	});
});
