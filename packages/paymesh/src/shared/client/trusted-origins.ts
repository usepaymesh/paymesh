import { PaymeshError } from '../../errors';

export function normalizeTrustedOrigins(trustedOrigins?: string[]) {
	return trustedOrigins?.map((value) => {
		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new PaymeshError({
				code: 'invalid_request',
				message: `Invalid trusted origin "${value}". Expected an absolute origin.`,
			});
		}

		if (
			url.username ||
			url.password ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		) {
			throw new PaymeshError({
				code: 'invalid_request',
				message: `Invalid trusted origin "${value}". trustedOrigins entries must be origin-only URLs.`,
			});
		}

		return url.origin;
	});
}

export function assertTrustedRedirectUrls(
	data: {
		successUrl?: string;
		cancelUrl?: string;
		returnUrl?: string;
	},
	trustedOrigins?: string[],
) {
	for (const field of ['successUrl', 'cancelUrl', 'returnUrl'] as const) {
		const value = data[field];
		if (!value) continue;

		let url: URL;

		try {
			url = new URL(value);
		} catch {
			throw new PaymeshError({
				code: 'invalid_request',
				message: `Payment ${field} must be an absolute URL.`,
			});
		}

		assertTrustedOrigin(url.origin, trustedOrigins, field);
	}
}

export function resolveTrustedUrl(
	value: string | undefined,
	request: Request,
	trustedOrigins?: string[],
) {
	if (!value) return;

	try {
		const url = new URL(value);
		assertTrustedOrigin(url.origin, trustedOrigins, 'redirect URL');
		return url.toString();
	} catch (error) {
		if (error instanceof PaymeshError) throw error;
	}

	if (!trustedOrigins?.length) {
		throw new PaymeshError({
			code: 'invalid_request',
			message:
				'Relative redirect URLs require createClient({ trustedOrigins }).',
		});
	}

	assertTrustedOrigin(
		new URL(request.url).origin,
		trustedOrigins,
		'request origin',
	);

	return new URL(value, request.url).toString();
}

function assertTrustedOrigin(
	origin: string,
	trustedOrigins?: string[],
	label?: string,
) {
	if (!trustedOrigins?.length || trustedOrigins.includes(origin)) return;

	throw new PaymeshError({
		code: 'invalid_request',
		message: `Untrusted origin for ${label}: "${origin}".`,
	});
}
