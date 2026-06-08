import type { RetryOptions } from '../shared/request';
import type { PaymeshDatabaseDriver, ResolvedDatabaseSchema } from './database';

/** Stable provider identifier. */
export type ProviderId = string;

/** Capabilities a provider can advertise to Paymesh. */
export type ProviderCapability =
	| 'pix'
	| 'coupons'
	| 'checkout'
	| 'subscriptions'
	| 'webhooks'
	| 'refunds'
	| 'customerPortal'
	| 'customers';

/** Capability map for a provider. */
export type ProviderCapabilities = Partial<Record<ProviderCapability, boolean>>;

/** Normalized payment lifecycle statuses used across providers. */
export type PaymentStatus =
	| 'pending'
	| 'processing'
	| 'paid'
	| 'failed'
	| 'canceled'
	| 'refunded';

/** Raw payload wrapper used by `withRaw`. */
export interface RawObject {
	raw: unknown;
}

/** Conditionally attaches a raw payload to a normalized object. */
export type WithRaw<
	TObject,
	IncludeRaw extends boolean,
> = IncludeRaw extends true ? TObject & RawObject : TObject & { raw: null };

/** Customer payload accepted by provider payment and customer methods. */
export interface PaymentCustomer {
	/** Existing provider-side customer id. */
	id?: string;
	/** External identifier stored in provider metadata. */
	externalId?: string;
	/** Customer display name. */
	name?: string;
	/** Customer email address. */
	email?: string;
	/** Customer document or tax identifier. */
	document?: string;
	/** Customer phone number. */
	phone?: string;
}

/** Input used to create a payment checkout or invoice. */
export interface PaymentCreateData {
	/** Payment amount in the smallest currency unit. */
	amount: number;
	/** ISO currency code. */
	currency: string;
	/** Provider-specific product ids attached to the payment. */
	productIds?: string[];

	/** Optional customer context for the payment. */
	customer?: PaymentCustomer;

	/** Human-readable payment description. */
	description?: string;
	/** Arbitrary metadata forwarded to the provider. */
	metadata?: Record<string, string | number | boolean | null>;

	/** Redirect destination after successful payment. */
	successUrl?: string;
	/** Redirect destination after a canceled payment. */
	cancelUrl?: string;
	/** Generic redirect destination when the provider supports it. */
	returnUrl?: string;
}

/** PIX-specific options supported by some providers. */
export interface PixOptions {
	amountIncludesIof?: 'always' | 'never';
	expiresAfterSeconds?: number;
	expiresAt?: Date | string;
}

/** Input used to create a PIX payment. */
export interface PixCreateData {
	/** Payment amount in the smallest currency unit. */
	amount: number;
	/** ISO currency code. */
	currency: string;

	/** Optional customer context for the PIX payment. */
	customer?: PaymentCustomer;

	/** Human-readable payment description. */
	description?: string;
	/** Arbitrary metadata forwarded to the provider. */
	metadata?: Record<string, string | number | boolean | null>;
	/** PIX-specific behavior overrides. */
	pix?: PixOptions;
}

interface BasePaymentRecord {
	id: string;
	provider: string;

	amount: number;
	currency: string;

	status: PaymentStatus;

	checkoutUrl?: string;
	customer?: PaymentCustomer;

	metadata?: Record<string, unknown>;
}

/** Normalized payment payload returned by providers. */
export interface BasePayment extends BasePaymentRecord {
	method?: undefined;
}

/** Payment payload that optionally carries the raw provider response. */
export type Payment<IncludeRaw extends boolean = false> = WithRaw<
	BasePayment,
	IncludeRaw
>;

/** Normalized PIX payment payload. */
export interface BasePix extends BasePaymentRecord {
	method: 'pix';
	copyPasteCode?: string;
	qrCodeImageUrlPng?: string;
	qrCodeImageUrlSvg?: string;
	instructionsUrl?: string;
	expiresAt?: string;
}

/** PIX payload that optionally carries the raw provider response. */
export type Pix<IncludeRaw extends boolean = false> = WithRaw<
	BasePix,
	IncludeRaw
>;

/** Union of normalized payment shapes without raw payload decoration. */
export type BaseAnyPayment = BasePayment | BasePix;

/** Normalized payment union that includes the raw payload toggle. */
export type AnyPayment<IncludeRaw extends boolean = false> =
	| Payment<IncludeRaw>
	| Pix<IncludeRaw>;

/** Normalized customer payload returned by providers. */
export interface BaseCustomer {
	id: string;
	provider: string;
	externalId?: string;

	name?: string;
	email?: string;
	phone?: string;

	metadata?: Record<string, unknown>;
}

/** Customer payload that optionally carries the raw provider response. */
export type Customer<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomer,
	IncludeRaw
>;

/** Input used to create or update a customer. */
export interface CustomerUpsertData {
	/** Existing provider-side customer id. */
	id?: string;
	/** External identifier stored in provider metadata. */
	externalId?: string;
	/** Customer display name. */
	name?: string;
	/** Customer email address. */
	email?: string;
	/** Customer phone number. */
	phone?: string;
	/** Arbitrary metadata forwarded to the provider. */
	metadata?: Record<string, string | number | boolean | null>;
}

/** Normalized result for customer deletion. */
export interface BaseCustomerDeleteResult {
	id: string;
	provider: string;
	deleted: boolean;
}

/** Customer deletion payload that optionally carries the raw provider response. */
export type CustomerDeleteResult<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomerDeleteResult,
	IncludeRaw
>;

/** Request-level overrides passed to provider methods. */
export interface ProviderRequestOptions<IncludeRaw extends boolean = false> {
	/** Overrides the provider base URL. */
	baseUrl?: string;
	/** Overrides the request timeout in milliseconds. */
	timeout?: number;
	/** Retry configuration for the request. */
	retry?: RetryOptions;
	/** Fetch implementation to use. */
	fetch?: typeof fetch;
	/** Include the raw provider response on the returned object. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/** Snapshot of a provider catalog product. */
export interface ProviderCatalogProduct {
	id: string;
	name?: string;
	description?: string;
	active?: boolean;
	metadata?: Record<string, unknown>;
	version?: string;
	raw?: unknown;
}

/** Snapshot of a provider catalog price. */
export interface ProviderCatalogPrice {
	id: string;
	productId?: string;
	active?: boolean;
	type?: string;
	currency?: string;
	amount?: number;
	interval?: string;
	intervalCount?: number;
	metadata?: Record<string, unknown>;
	version?: string;
	raw?: unknown;
}

/** Full provider catalog snapshot. */
export interface ProviderCatalogSnapshot {
	products: ProviderCatalogProduct[];
	prices: ProviderCatalogPrice[];
}

/** Provider catalog access contract. */
export interface ProviderCatalog {
	/** Fetches the current catalog snapshot from the provider. */
	list(): Promise<ProviderCatalogSnapshot>;
}

/** Normalized balance amount. */
export interface ProviderBalanceAmount {
	amount: number;
	currency: string;
	label?: string;
	source?: string;
}

/** Normalized provider balance snapshot. */
export interface ProviderBalanceSnapshot {
	available: ProviderBalanceAmount[];
	pending?: ProviderBalanceAmount[];
	reserved?: ProviderBalanceAmount[];
}

/** Resource identifier used by provider dashboards. */
export interface ProviderDashboardResourceLinkInput {
	/** Resource type. */
	type: 'customer' | 'payment' | 'pix' | 'subscription' | 'webhook';
	/** Resource id. */
	id: string;
}

/** Input passed to provider dashboard sync helpers. */
export interface ProviderDashboardSyncInput {
	/** Connected database driver. */
	database: PaymeshDatabaseDriver;
	/** Resource id to sync. */
	id: string;
	/** Resolved database schema. */
	schema: ResolvedDatabaseSchema;
}

/** Dashboard adapter contract exposed by a provider. */
export interface ProviderDashboardAdapter {
	/** Fetches the provider balance, when the provider exposes one. */
	getBalance?(): Promise<ProviderBalanceSnapshot | null>;
	/** Returns a dashboard URL for the given resource, when supported. */
	getResourceUrl?(
		input: ProviderDashboardResourceLinkInput,
	): Promise<string | null> | string | null;
	/** Synchronizes a customer from the provider into Paymesh storage. */
	syncCustomer?(
		input: ProviderDashboardSyncInput,
	): Promise<Customer<true> | null>;
	/** Synchronizes a payment from the provider into Paymesh storage. */
	syncPayment?(
		input: ProviderDashboardSyncInput,
	): Promise<AnyPayment<true> | null>;
	/** Synchronizes a PIX payment from the provider into Paymesh storage. */
	syncPix?(input: ProviderDashboardSyncInput): Promise<Pix<true> | null>;
	/** Synchronizes a subscription or equivalent resource. */
	syncSubscription?(
		input: ProviderDashboardSyncInput,
	): Promise<Record<string, unknown> | null>;
}

/** Payment creation contract. */
export interface ProviderPayments {
	/** Creates a new checkout or invoice payment. */
	create<IncludeRaw extends boolean = false>(
		data: PaymentCreateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Payment<IncludeRaw>>;
}

/** PIX payment contract. */
export interface ProviderPix {
	/** Creates a new PIX payment. */
	create<IncludeRaw extends boolean = false>(
		data: PixCreateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Pix<IncludeRaw>>;
	/** Loads a PIX payment by id. */
	get<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Pix<IncludeRaw>>;
}

/** Customer management contract. */
export interface ProviderCustomers {
	/** Loads a customer by id. */
	get<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	/** Creates or updates a customer. */
	upsert<IncludeRaw extends boolean = false>(
		data: CustomerUpsertData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	/** Deletes a customer. */
	delete<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<CustomerDeleteResult<IncludeRaw>>;
}

/** Context passed to webhook verification. */
export interface ProviderVerifyWebhookContext {
	request: Request;
}

/** Canonical Paymesh event types emitted by providers. */
export type PaymeshEventType =
	| 'payment.created'
	| 'payment.succeeded'
	| 'payment.failed'
	| 'payment.canceled'
	| 'payment.refunded'
	| 'customer.created'
	| 'customer.updated'
	| 'customer.deleted'
	| 'subscription.created'
	| 'subscription.updated'
	| 'subscription.canceled'
	| 'checkout.completed';

/** Normalized webhook event payload. */
export interface BasePaymeshEvent<Data = unknown> {
	/** Event id emitted by the provider. */
	id: string;

	/** Normalized Paymesh event type. */
	type: PaymeshEventType;
	/** Provider identifier. */
	provider: string;

	/** Event payload. */
	data: Data;
}

/** Webhook event payload that optionally carries the raw provider response. */
export type PaymeshEvent<
	Data = unknown,
	IncludeRaw extends boolean = false,
> = WithRaw<BasePaymeshEvent<Data>, IncludeRaw>;

/** Provider webhook handle options. */
export interface ProviderWebhookHandleOptions<
	IncludeRaw extends boolean = false,
> {
	/** Incoming webhook request. */
	request: Request;
	/** Include raw provider payloads in the normalized event. Defaults to `false`. */
	includeRaw?: IncludeRaw;
}

/** Normalized webhook handler result. */
export interface ProviderWebhookHandleResult<
	IncludeRaw extends boolean = false,
> {
	/** Normalized event to dispatch. */
	event: PaymeshEvent<unknown, IncludeRaw>;
	/** Delivery id used for idempotency. */
	deliveryId?: string;
	/** Hook name to dispatch, if the provider wants a specific handler. */
	hook?: string;
}

/** Webhook handler contract implemented by providers. */
export interface ProviderWebhooks {
	/**
	 * Verify if the incoming webhook request is valid.
	 */
	verify(context: ProviderVerifyWebhookContext): boolean | Promise<boolean>;

	/**
	 * Handle the provider-specific webhook request
	 * and return a normalized Paymesh event plus metadata.
	 */
	handle<IncludeRaw extends boolean = false>(
		options: ProviderWebhookHandleOptions<IncludeRaw>,
	):
		| ProviderWebhookHandleResult<IncludeRaw>
		| Promise<ProviderWebhookHandleResult<IncludeRaw>>;
}

/** Full provider definition accepted by `defineProvider`. */
export interface ProviderDefinition<Name extends string = string> {
	/** Provider identifier. */
	id: Name;

	/** Payment creation contract. */
	payments: ProviderPayments;
	/** Optional PIX contract. */
	pix?: ProviderPix;

	/** Customer management contract. */
	customers: ProviderCustomers;

	/** Optional webhook contract. */
	webhooks?: ProviderWebhooks;

	/** Optional catalog contract. */
	catalog?: ProviderCatalog;

	/** Optional dashboard integration helpers. */
	dashboard?: ProviderDashboardAdapter;

	/** Capability map advertised by the provider. */
	capabilities: ProviderCapabilities;
}

/** Public provider instance returned by `defineProvider`. */
export interface Provider<Name extends string = string>
	extends ProviderDefinition<Name> {
	/** Runtime type marker. */
	readonly type: 'provider';
}
