import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['./src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	clean: true,
	sourcemap: false,
	minify: true,
	unbundle: true,
	target: 'node20',
	outDir: 'dist',
});
