import type { ProviderCapabilities } from 'paymesh';

export const POLAR_BASE_URL = 'https://api.polar.sh';

export const POLAR_CAPABILITIES = {
	checkout: true,
	coupons: true,
	pix: false,
	refunds: true,
	subscriptions: true,
	webhooks: true,
	customerPortal: true,
	customers: true,
} satisfies ProviderCapabilities;
