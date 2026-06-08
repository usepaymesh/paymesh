import { describe, expect, test } from 'bun:test';

describe('package entrypoints', () => {
	test('loads the core entrypoint', async () => {
		const mod = await import('../src/index');

		expect(typeof mod).toBe('object');
		expect(typeof mod.createClient).toBe('function');
		expect(typeof mod.definePlugin).toBe('function');
		expect(typeof mod.defineProvider).toBe('function');
		expect(typeof mod.event).toBe('function');
		expect(typeof mod.lazy).toBe('function');
		expect(typeof mod.request).toBe('function');
		expect(typeof mod.withRaw).toBe('function');
	});
});
