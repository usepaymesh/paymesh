import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ['paymesh', '@paymesh/stripe'],
	typedRoutes: true,
};

const withMDX = createMDX();

export default withMDX(nextConfig);
