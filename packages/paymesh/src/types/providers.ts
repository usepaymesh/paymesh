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
	/** Payment amount in the smallest currency unit. Required by providers that compute the amount server-side (e.g. Stripe). */
	amount?: number;
	/** ISO currency code. Required by providers that compute the currency server-side. */
	currency?: string;
	/** Provider-specific product ids attached to the payment. Required by providers that price via catalog (e.g. AbacatePay). */
	productIds?: string[];
	/** Coupon or promotion code to pre-apply on the checkout. */
	couponCode?: string;
	/** Whether the hosted checkout should allow customers to enter coupon codes manually. */
	allowCouponCodes?: boolean;

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
	sandbox: boolean;

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
	sandbox: boolean;
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
	sandbox: boolean;
	deleted: boolean;
}

/** Customer deletion payload that optionally carries the raw provider response. */
export type CustomerDeleteResult<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomerDeleteResult,
	IncludeRaw
>;

/** Common coupon status values normalized across providers. */
export type CouponStatus =
	| 'active'
	| 'inactive'
	| 'scheduled'
	| 'expired'
	| 'deleted';

/** Normalized coupon discount type. */
export type CouponDiscountType = 'percentage' | 'fixed';

/** Percentage-based discount definition. */
export interface CouponPercentageDiscount {
	type: 'percentage';
	value: number;
}

/** Fixed-amount discount definition. */
export interface CouponFixedDiscount {
	type: 'fixed';
	value: number;
	currency?: string;
	amounts?: Record<string, number>;
}

/** Normalized discount definition accepted and returned by the coupons API. */
export type CouponDiscount = CouponPercentageDiscount | CouponFixedDiscount;

/** Duration modes supported by provider-side coupons. */
export interface CouponDuration {
	type: 'once' | 'forever' | 'repeating';
	durationInMonths?: number;
}

/** Product or price restrictions applied to a coupon. */
export interface CouponAppliesTo {
	products?: string[];
	prices?: string[];
}

/** Redemption counters exposed by providers. */
export interface CouponRedemptions {
	count: number;
	max: number | null;
}

/** Normalized coupon payload returned by providers. */
export interface BaseCoupon {
	id: string;
	provider: string;
	sandbox: boolean;
	code: string;
	name?: string;
	status: CouponStatus;
	active?: boolean;
	discount: CouponDiscount;
	duration?: CouponDuration;
	startsAt?: string;
	expiresAt?: string;
	customerId?: string;
	firstTimeOnly?: boolean;
	minimumAmount?: number;
	minimumAmountCurrency?: string;
	appliesTo?: CouponAppliesTo;
	redemptions: CouponRedemptions;
	metadata?: Record<string, unknown>;
}

/** Coupon payload that optionally carries the raw provider response. */
export type Coupon<IncludeRaw extends boolean = false> = WithRaw<
	BaseCoupon,
	IncludeRaw
>;

/** Input used to create a coupon or promotion code. */
export interface CouponCreateData {
	code: string;
	name?: string;
	discount: CouponDiscount;
	duration?: CouponDuration;
	startsAt?: Date | string;
	expiresAt?: Date | string;
	maxRedemptions?: number | null;
	customerId?: string;
	firstTimeOnly?: boolean;
	minimumAmount?: number;
	minimumAmountCurrency?: string;
	appliesTo?: CouponAppliesTo;
	metadata?: Record<string, string | number | boolean | null>;
}

/** Input used to update a coupon or promotion code. */
export interface CouponUpdateData {
	code?: string;
	name?: string;
	active?: boolean;
	discount?: CouponDiscount;
	duration?: CouponDuration;
	startsAt?: Date | string | null;
	expiresAt?: Date | string | null;
	maxRedemptions?: number | null;
	customerId?: string | null;
	firstTimeOnly?: boolean;
	minimumAmount?: number | null;
	minimumAmountCurrency?: string | null;
	appliesTo?: CouponAppliesTo;
	metadata?: Record<string, string | number | boolean | null>;
}

/** Cursor-based filters supported when listing coupons. */
export interface CouponListOptions {
	limit?: number;
	after?: string;
	before?: string;
	code?: string;
	active?: boolean;
	status?: CouponStatus;
}

/** Paginated coupon list response. */
export interface CouponListResult<
	IncludeRaw extends boolean = false,
	TCoupon = Coupon<IncludeRaw>,
> {
	data: TCoupon[];
	total: number;
	previous: string | null;
	next: string | null;
}

/** Returned after deleting a coupon or promotion code. */
export interface BaseCouponDeleteResult {
	id: string;
	provider: string;
	sandbox: boolean;
	deleted: boolean;
	code?: string;
}

/** Coupon delete payload that optionally carries the raw provider response. */
export type CouponDeleteResult<IncludeRaw extends boolean = false> = WithRaw<
	BaseCouponDeleteResult,
	IncludeRaw
>;

/** Reasons returned when coupon validation fails. */
export type CouponInvalidReason =
	| 'not_found'
	| 'inactive'
	| 'expired'
	| 'not_started'
	| 'max_redemptions_reached'
	| 'customer_not_eligible'
	| 'product_not_eligible'
	| 'currency_not_supported'
	| 'minimum_amount_not_reached'
	| 'provider_error';

/** Price preview returned when checking a coupon against a cart. */
export interface CouponCheckPreview {
	subtotal: number;
	discountTotal: number;
	total: number;
	currency: string;
}

/** Input accepted by `coupons.check()`. */
export interface CouponCheckData {
	code: string;
	customerId?: string;
	productIds?: string[];
	priceIds?: string[];
	amount?: number;
	currency?: string;
}

/** Successful coupon validation result. */
export interface CouponCheckValidResult<
	IncludeRaw extends boolean = false,
	TCoupon = Coupon<IncludeRaw>,
> {
	valid: true;
	coupon: TCoupon;
	preview?: CouponCheckPreview;
}

/** Failed coupon validation result. */
export interface CouponCheckInvalidResult<
	IncludeRaw extends boolean = false,
	TCoupon = Coupon<IncludeRaw>,
> {
	valid: false;
	reason: CouponInvalidReason;
	message?: string;
	coupon?: TCoupon;
	preview?: CouponCheckPreview;
}

/** Coupon validation result union. */
export type CouponCheckResult<
	IncludeRaw extends boolean = false,
	TCoupon = Coupon<IncludeRaw>,
> =
	| CouponCheckValidResult<IncludeRaw, TCoupon>
	| CouponCheckInvalidResult<IncludeRaw, TCoupon>;

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
	/** Overrides the sandbox mode for this request. Defaults to the provider sandbox mode. */
	sandbox?: boolean;
}

/** Snapshot of a provider catalog product. */
export interface ProviderCatalogProduct {
	id: string;
	sandbox: boolean;
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
	sandbox: boolean;
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

/** Coupon management contract. */
export interface ProviderCoupons {
	/** Loads a coupon by id. */
	get<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Coupon<IncludeRaw>>;
	/** Creates a coupon or promotion code. */
	create<IncludeRaw extends boolean = false>(
		data: CouponCreateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Coupon<IncludeRaw>>;
	/** Lists coupons exposed by the provider. */
	list<IncludeRaw extends boolean = false>(
		listOptions?: CouponListOptions,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<CouponListResult<IncludeRaw>>;
	/** Updates a coupon or promotion code. */
	update<IncludeRaw extends boolean = false>(
		id: string,
		data: CouponUpdateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Coupon<IncludeRaw>>;
	/** Deletes a coupon or promotion code. */
	delete<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<CouponDeleteResult<IncludeRaw>>;
	/** Validates a coupon against the current cart or amount context. */
	check<IncludeRaw extends boolean = false>(
		data: CouponCheckData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<CouponCheckResult<IncludeRaw>>;
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
	/** Whether the event came from a sandbox environment. */
	sandbox: boolean;

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
	/** Returns whether the provider is currently configured for sandbox mode. */
	isSandbox(): boolean;

	/** Payment creation contract. */
	payments: ProviderPayments;
	/** Optional PIX contract. */
	pix?: ProviderPix;

	/** Customer management contract. */
	customers: ProviderCustomers;
	/** Optional coupon management contract. */
	coupons?: ProviderCoupons;

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
