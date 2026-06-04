import type { RetryOptions } from '../shared/request';
import type { PaymeshDatabaseDriver, ResolvedDatabaseSchema } from './database';

export type ProviderId = string;

export type ProviderCapability =
	| 'pix'
	| 'coupons'
	| 'checkout'
	| 'subscriptions'
	| 'webhooks'
	| 'refunds'
	| 'customerPortal'
	| 'customers';

export type ProviderCapabilities = Partial<Record<ProviderCapability, boolean>>;

export type PaymentStatus =
	| 'pending'
	| 'processing'
	| 'paid'
	| 'failed'
	| 'canceled'
	| 'refunded';

export interface RawObject {
	raw: unknown;
}

export type WithRaw<
	TObject,
	IncludeRaw extends boolean,
> = IncludeRaw extends true ? TObject & RawObject : TObject & { raw: null };

export interface PaymentCustomer {
	id?: string;
	externalId?: string;
	name?: string;
	email?: string;
	document?: string;
	phone?: string;
}

export interface PaymentCreateData {
	amount: number;
	currency: string;
	productIds?: string[];

	customer?: PaymentCustomer;

	description?: string;
	metadata?: Record<string, string | number | boolean | null>;

	successUrl?: string;
	cancelUrl?: string;
	returnUrl?: string;
}

export interface BasePayment {
	id: string;
	provider: string;

	amount: number;
	currency: string;

	status: PaymentStatus;

	checkoutUrl?: string;
	customer?: PaymentCustomer;

	metadata?: Record<string, unknown>;
}

export type Payment<IncludeRaw extends boolean = false> = WithRaw<
	BasePayment,
	IncludeRaw
>;

export interface BaseCustomer {
	id: string;
	provider: string;
	externalId?: string;

	name?: string;
	email?: string;
	phone?: string;

	metadata?: Record<string, unknown>;
}

export type Customer<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomer,
	IncludeRaw
>;

export interface CustomerUpsertData {
	id?: string;
	externalId?: string;
	name?: string;
	email?: string;
	phone?: string;
	metadata?: Record<string, string | number | boolean | null>;
}

export interface BaseCustomerDeleteResult {
	id: string;
	provider: string;
	deleted: boolean;
}

export type CustomerDeleteResult<IncludeRaw extends boolean = false> = WithRaw<
	BaseCustomerDeleteResult,
	IncludeRaw
>;

export interface ProviderRequestOptions<IncludeRaw extends boolean = false> {
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	includeRaw?: IncludeRaw;
}

export interface ProviderCatalogProduct {
	id: string;
	name?: string;
	description?: string;
	active?: boolean;
	metadata?: Record<string, unknown>;
	version?: string;
	raw?: unknown;
}

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

export interface ProviderCatalogSnapshot {
	products: ProviderCatalogProduct[];
	prices: ProviderCatalogPrice[];
}

export interface ProviderCatalog {
	list(): Promise<ProviderCatalogSnapshot>;
}

export interface ProviderBalanceAmount {
	amount: number;
	currency: string;
	label?: string;
	source?: string;
}

export interface ProviderBalanceSnapshot {
	available: ProviderBalanceAmount[];
	pending?: ProviderBalanceAmount[];
	reserved?: ProviderBalanceAmount[];
}

export interface ProviderDashboardResourceLinkInput {
	type: 'customer' | 'payment' | 'subscription' | 'webhook';
	id: string;
}

export interface ProviderDashboardSyncInput {
	database: PaymeshDatabaseDriver;
	id: string;
	schema: ResolvedDatabaseSchema;
}

export interface ProviderDashboardAdapter {
	getBalance?(): Promise<ProviderBalanceSnapshot | null>;
	getResourceUrl?(
		input: ProviderDashboardResourceLinkInput,
	): Promise<string | null> | string | null;
	syncCustomer?(
		input: ProviderDashboardSyncInput,
	): Promise<Customer<true> | null>;
	syncPayment?(
		input: ProviderDashboardSyncInput,
	): Promise<Payment<true> | null>;
	syncSubscription?(
		input: ProviderDashboardSyncInput,
	): Promise<Record<string, unknown> | null>;
}

export interface ProviderPayments {
	create<IncludeRaw extends boolean = false>(
		data: PaymentCreateData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Payment<IncludeRaw>>;
}

export interface ProviderCustomers {
	get<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	upsert<IncludeRaw extends boolean = false>(
		data: CustomerUpsertData,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<Customer<IncludeRaw>>;
	delete<IncludeRaw extends boolean = false>(
		id: string,
		options?: ProviderRequestOptions<IncludeRaw>,
	): Promise<CustomerDeleteResult<IncludeRaw>>;
}

export interface ProviderVerifyWebhookContext {
	request: Request;
}

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

export interface BasePaymeshEvent<Data = unknown> {
	id: string;

	type: PaymeshEventType;
	provider: string;

	data: Data;
}

export type PaymeshEvent<
	Data = unknown,
	IncludeRaw extends boolean = false,
> = WithRaw<BasePaymeshEvent<Data>, IncludeRaw>;

export interface ProviderWebhookHandleOptions<
	IncludeRaw extends boolean = false,
> {
	request: Request;
	includeRaw?: IncludeRaw;
}

export interface ProviderWebhookHandleResult<
	IncludeRaw extends boolean = false,
> {
	event: PaymeshEvent<unknown, IncludeRaw>;
	deliveryId?: string;
	hook?: string;
}

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

export interface ProviderDefinition<Name extends string = string> {
	id: Name;

	payments: ProviderPayments;

	customers: ProviderCustomers;

	webhooks?: ProviderWebhooks;

	catalog?: ProviderCatalog;

	dashboard?: ProviderDashboardAdapter;

	capabilities: ProviderCapabilities;
}

export interface Provider<Name extends string = string>
	extends ProviderDefinition<Name> {
	readonly type: 'provider';
}
