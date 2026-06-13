import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymeshError } from 'paymesh';
import type {
	DodoIntentStatus,
	DodoMetadata,
	DodoPayment,
	DodoRefund,
	DodoSubscription,
} from '../types';
import { DODO_PAYMENT_STATUSES } from './constants';

export function getDodoExternalId(metadata?: DodoMetadata | null) {
	return typeof metadata?.externalId === 'string' &&
		metadata.externalId.length > 0
		? metadata.externalId
		: undefined;
}

export function serializeMetadata(
	metadata?: Record<string, string | number | boolean | null>,
) {
	const entries = Object.entries(metadata ?? {}).filter(
		([, value]) => value !== null,
	);
	if (entries.length === 0) return undefined;

	return Object.fromEntries(
		entries.map(([key, value]) => [key, String(value)]),
	) as Record<string, string>;
}

export function buildDodoCustomerRequest(input?: {
	customer?: {
		email?: string;
		id?: string;
		name?: string;
		phone?: string;
	};
	provider?: string;
}) {
	const customer = input?.customer;

	if (!customer?.id && !customer?.email) {
		throw new PaymeshError({
			code: 'invalid_request',
			message:
				'Provider "dodo" requires either "customer.id" or "customer.email" when creating payments.',
			provider: input?.provider ?? 'dodo',
		});
	}

	if (customer.id) {
		return { customer_id: customer.id };
	}

	return {
		email: customer.email!,
		name: customer.name ?? customer.email!,
		phone_number: customer.phone,
	};
}

export function isDodoPixPayment(
	payment:
		| DodoPayment
		| Pick<DodoRefund, 'currency' | 'payment_id'>
		| {
				currency?: string | null;
				payment_method?: string | null;
				payment_method_type?: string | null;
		  },
) {
	return (
		'payment_method_type' in payment &&
		(payment.payment_method_type === 'pix' ||
			payment.payment_method === 'real_time_payment')
	);
}

export function mapDodoIntentStatus(status?: DodoIntentStatus | null) {
	return !status ? 'pending' : (DODO_PAYMENT_STATUSES[status] ?? 'pending');
}

export function parseDodoWebhookSecret(secret: string) {
	const value = secret.startsWith('whsec_')
		? secret.slice('whsec_'.length)
		: secret;
	return Buffer.from(value, 'base64');
}

export function signDodoWebhook(options: {
	payload: string;
	secret: string;
	timestamp: string;
	webhookId: string;
}) {
	const body = `${options.webhookId}.${options.timestamp}.${options.payload}`;
	const expected = createHmac('sha256', parseDodoWebhookSecret(options.secret))
		.update(body)
		.digest('base64');

	return `v1,${expected}`;
}

export function verifyDodoWebhookSignature(options: {
	headers: Headers;
	payload: string;
	secret?: string;
}) {
	if (!options.secret) return false;

	const webhookId = options.headers.get('webhook-id');
	const timestamp = options.headers.get('webhook-timestamp');
	const signatureHeader = options.headers.get('webhook-signature');

	if (!webhookId || !timestamp || !signatureHeader) return false;

	const timestampValue = Number.parseInt(timestamp, 10);
	if (!Number.isFinite(timestampValue)) return false;

	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestampValue) > 5 * 60) return false;

	const expected = signDodoWebhook({
		payload: options.payload,
		secret: options.secret,
		timestamp,
		webhookId,
	});

	const expectedSignature = expected.split(',')[1];
	if (!expectedSignature) return false;

	for (const part of signatureHeader.split(/\s+/)) {
		const [version, signature] = part.split(',');
		if (version !== 'v1' || !signature) continue;
		if (
			signature.length === expectedSignature.length &&
			timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
		) {
			return true;
		}
	}

	return false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function resolveDodoSubscriptionEventType(
	subscription: DodoSubscription,
) {
	if (
		subscription.status === 'cancelled' ||
		subscription.status === 'expired'
	) {
		return 'subscription.canceled' as const;
	}

	return 'subscription.updated' as const;
}

export function ensureDodoProductIds(productIds?: string[]) {
	if (!productIds || productIds.length === 0) {
		throw new PaymeshError({
			code: 'invalid_request',
			message:
				'Provider "dodo" requires at least one product id in "productIds"',
			provider: 'dodo',
		});
	}
}

export function buildDodoProductCart(input: {
	amount?: number;
	productIds: string[];
	provider?: string;
}) {
	ensureDodoProductIds(input.productIds);

	if (typeof input.amount === 'number' && input.productIds.length > 1)
		throw new PaymeshError({
			code: 'invalid_request',
			message:
				'Provider "dodo" only accepts "amount" when exactly one product id is provided.',
			provider: input.provider ?? 'dodo',
		});

	return input.productIds.map((productId) => ({
		product_id: productId,
		quantity: 1,
		amount: typeof input.amount === 'number' ? input.amount : undefined,
	}));
}

export function resolveDodoCustomerFromInput(input?: {
	email?: string;
	externalId?: string;
	id?: string;
	name?: string;
	phone?: string;
}) {
	if (!input) return undefined;

	if (
		!input.id &&
		!input.email &&
		!input.externalId &&
		!input.name &&
		!input.phone
	) {
		return undefined;
	}

	return {
		id: input.id,
		externalId: input.externalId,
		name: input.name,
		email: input.email,
		phone: input.phone,
	};
}

export function mapDodoRefundStatusToPaymentStatus(status?: string | null) {
	if (status === 'succeeded') return 'refunded' as const;
	if (status === 'failed') return 'failed' as const;
	if (status === 'review') return 'processing' as const;
	return 'pending' as const;
}
