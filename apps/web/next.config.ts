import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ['paymesh', '@paymesh/stripe'],
	typedRoutes: true,
};

export default nextConfig;
