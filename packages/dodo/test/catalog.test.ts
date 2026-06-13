import { describe, expect, test } from 'bun:test';
import { dodo } from '../src';

describe('dodo catalog', () => {
	test('lists products and maps one-time and recurring prices', async () => {
		const provider = dodo({
			apiKey: 'dodo_test_123',
			baseUrl: 'https://test.dodopayments.com',
			fetch: (async (input) => {
				expect(String(input)).toBe(
					'https://test.dodopayments.com/products?page_size=100',
				);

				return Response.json({
					items: [
						{
							product_id: 'prod_one',
							name: 'One Time',
							description: 'One-time product',
							is_recurring: false,
							currency: 'USD',
							price: 4900,
							price_detail: {
								type: 'one_time_price',
								currency: 'USD',
								price: 4900,
							},
							metadata: {
								version: 'v1',
							},
						},
						{
							product_id: 'prod_recurring',
							name: 'Recurring',
							description: 'Recurring product',
							is_recurring: true,
							currency: 'EUR',
							price: 2900,
							price_detail: {
								type: 'recurring_price',
								currency: 'EUR',
								price: 2900,
								payment_frequency_count: 1,
								payment_frequency_interval: 'Month',
								subscription_period_count: 1,
								subscription_period_interval: 'Month',
							},
							metadata: {},
						},
					],
				});
			}) as typeof fetch,
		});

		const catalog = await provider.catalog?.list();

		expect(catalog?.products).toHaveLength(2);
		expect(catalog?.products[0]).toMatchObject({
			id: 'prod_one',
			sandbox: true,
			name: 'One Time',
			description: 'One-time product',
			active: true,
			version: 'v1',
		});
		expect(catalog?.prices).toHaveLength(2);
		expect(catalog?.prices[0]).toMatchObject({
			id: 'prod_one_price',
			type: 'one_time',
			currency: 'usd',
			amount: 4900,
		});
		expect(catalog?.prices[1]).toMatchObject({
			id: 'prod_recurring_price',
			type: 'recurring',
			currency: 'eur',
			amount: 2900,
			interval: 'month',
			intervalCount: 1,
		});
	});
});
