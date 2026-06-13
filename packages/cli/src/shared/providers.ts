export const PROVIDERS = {
	stripe: {
		label: 'Stripe',
		package: '@paymesh/stripe',
		apiKeyEnv: 'STRIPE_API_KEY',
		webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',
		paramName: 'secret',
	},
	polar: {
		label: 'Polar',
		package: '@paymesh/polar',
		apiKeyEnv: 'POLAR_API_KEY',
		webhookSecretEnv: 'POLAR_WEBHOOK_SECRET',
		paramName: 'accessToken',
	},
	dodo: {
		label: 'Dodo Payments',
		package: '@paymesh/dodo',
		apiKeyEnv: 'DODO_PAYMENTS_API_KEY',
		webhookSecretEnv: 'DODO_PAYMENTS_WEBHOOK_KEY',
		paramName: 'apiKey',
	},
	custom: {
		label: 'Custom — I will configure later',
		package: null,
		apiKeyEnv: null,
		webhookSecretEnv: null,
		paramName: null,
	},
} as const;

export type ProviderId = keyof typeof PROVIDERS;

export async function detectProviderFromDeps(
	deps: Record<string, string> = {},
): Promise<ProviderId | null> {
	for (const [id, cfg] of Object.entries(PROVIDERS)) {
		if (cfg.package && deps[cfg.package]) return id as ProviderId;
	}
	return null;
}
