import { describe, expect, test } from 'bun:test';

describe('package entrypoints', () => {
	test('loads the core entrypoint', async () => {
		const mod = await import('../src/index');

		expect(typeof mod).toBe('object');
	});

	test('loads the stripe entrypoint', async () => {
		const mod = await import('../src/providers/stripe');

		expect(typeof mod).toBe('object');
	});
});
