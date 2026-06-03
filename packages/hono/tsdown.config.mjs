import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['./src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: false,
	minify: true,
	target: 'node20',
	outDir: 'dist',
	external: ['paymesh', 'hono'],
});
