import type {
	BaseAnyPayment,
	BaseCustomer,
	BasePaymeshEvent,
	BasePix,
	ProviderCatalogPrice,
	ProviderCatalogProduct,
} from 'paymesh';

/** Optional timestamp fields that can be provided when seeding records. */
export interface MemorySeedTimestamps {
	/** ISO-8601 creation timestamp. */
	createdAt?: string;
	/** ISO-8601 last update timestamp. */
	updatedAt?: string;
}

/** Customer record used for seeding the in-memory database. */
export type MemorySeedCustomer = BaseCustomer &
	MemorySeedTimestamps & {
		/** Marks the customer as soft-deleted at seed time. */
		deleted?: boolean;
		/** Optional raw provider payload to persist when `persistRaw` is enabled. */
		raw?: unknown;
	};

/** Payment record (checkout or invoice) used for seeding the in-memory database. */
export type MemorySeedPayment = BaseAnyPayment &
	MemorySeedTimestamps & {
		/** Optional raw provider payload to persist when `persistRaw` is enabled. */
		raw?: unknown;
	};

/** Pix payment record used for seeding the in-memory database. */
export type MemorySeedPix = BasePix &
	MemorySeedTimestamps & {
		/** Optional raw provider payload to persist when `persistRaw` is enabled. */
		raw?: unknown;
	};

/** Subscription event record used for seeding the in-memory database. */
export type MemorySeedSubscription = BasePaymeshEvent<unknown> &
	MemorySeedTimestamps & {
		/** Optional raw provider payload to persist when `persistRaw` is enabled. */
		raw?: unknown;
	};

/**
 * Webhook delivery event record used for seeding the in-memory database.
 *
 * Tracks delivery attempts, processing status, and error history for
 * idempotent webhook handling.
 */
export interface MemorySeedWebhookEvent
	extends BasePaymeshEvent<unknown>,
		MemorySeedTimestamps {
	/** Unique delivery identifier used as the idempotency key. */
	deliveryId: string;
	/** Current processing status of the webhook event. */
	status?: 'processing' | 'processed' | 'failed';
	/** Number of delivery attempts made so far. */
	attempts?: number;
	/** Error message from the last failed processing attempt. */
	lastError?: string | null;
	/** ISO-8601 timestamp of when the event was successfully processed. */
	processedAt?: string | null;
	/** Optional raw provider payload to persist when `persistRaw` is enabled. */
	raw?: unknown;
}

/** Catalog product record used for seeding the in-memory database. */
export type MemorySeedProduct = ProviderCatalogProduct &
	MemorySeedTimestamps & {
		/** Provider identifier that owns this product. */
		provider: string;
	};

/** Catalog price record used for seeding the in-memory database. */
export type MemorySeedPrice = ProviderCatalogPrice &
	MemorySeedTimestamps & {
		/** Provider identifier that owns this price. */
		provider: string;
	};

/**
 * Seed data configuration for populating the in-memory database at creation time.
 *
 * All arrays are optional. Records are inserted with validation according to
 * the current `strict` mode setting.
 */
export interface MemoryDatabaseSeed {
	/** Customer records to seed. */
	customers?: MemorySeedCustomer[];
	/** Pix payment records to seed. */
	pix?: MemorySeedPix[];
	/** Checkout payment records to seed. */
	checkouts?: MemorySeedPayment[];
	/** Invoice payment records to seed. */
	invoices?: MemorySeedPayment[];
	/** Subscription event records to seed. */
	subscriptions?: MemorySeedSubscription[];
	/** Webhook delivery event records to seed. */
	webhookEvents?: MemorySeedWebhookEvent[];
	/** Catalog product records to seed. */
	products?: MemorySeedProduct[];
	/** Catalog price records to seed. */
	prices?: MemorySeedPrice[];
	/** Migration names to mark as already applied. */
	migrations?: string[];
}

/**
 * Configuration options for the {@link memory} database adapter.
 */
export interface MemoryDatabaseOptions {
	/** When `true`, persists raw provider payloads alongside normalized records. Defaults to `false`. */
	persistRaw?: boolean;
	/** Seed data to populate the in-memory database at creation time. */
	seed?: MemoryDatabaseSeed;
	/** When `true`, enforces strict validation including referential integrity and uniqueness checks. Defaults to `true`. */
	strict?: boolean;
}
