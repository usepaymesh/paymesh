/**
 * Canonical error codes emitted by Paymesh and its adapters.
 */
export type PaymeshErrorCode =
	| 'provider_error'
	| 'plugin_error'
	| 'plugin_configuration_error'
	| 'provider_not_found'
	| 'unsupported_capability'
	| 'invalid_webhook_signature'
	| 'webhook_parse_error'
	| 'webhook_mapping_error'
	| 'hook_error'
	| 'invalid_request'
	| 'database_error'
	| 'network_error'
	| 'timeout'
	| 'client_error'
	| 'cli_error';

/**
 * Structured input used to build a `PaymeshError`.
 */
export interface PaymeshErrorProps {
	/** Stable machine-readable error code. */
	code: PaymeshErrorCode;
	/** Human-readable message for logs and consumers. */
	message: string;
	/** Provider identifier associated with the failure, when available. */
	provider?: string;
	/** HTTP status code returned by the upstream provider, when available. */
	status?: number;
	/** HTTP status text returned by the upstream provider, when available. */
	statusText?: string;
	/** Upstream URL involved in the failure, when available. */
	url?: string;
	/** Parsed response body or low-level payload associated with the error. */
	body?: unknown;
	/** Original thrown value. */
	cause?: unknown;
}

/**
 * Error type used across the public Paymesh API.
 */
export class PaymeshError extends Error {
	/** Stable machine-readable error code. */
	readonly code: PaymeshErrorCode;
	/** Provider identifier associated with the failure, when available. */
	readonly provider?: string;
	/** HTTP status code returned by the upstream provider, when available. */
	readonly status?: number;
	/** HTTP status text returned by the upstream provider, when available. */
	readonly statusText?: string;
	/** Upstream URL involved in the failure, when available. */
	readonly url?: string;
	/** Parsed response body or low-level payload associated with the error. */
	readonly body?: unknown;

	/**
	 * Creates a new Paymesh error from structured metadata.
	 */
	constructor(props: PaymeshErrorProps) {
		super(props.message, { cause: props.cause });

		this.name = 'PaymeshError';
		this.code = props.code;
		this.provider = props.provider;
		this.status = props.status;
		this.statusText = props.statusText;
		this.url = props.url;
		this.body = props.body;
	}

	/**
	 * Returns the current error state as a serializable object.
	 */
	get props(): PaymeshErrorProps {
		return {
			code: this.code,
			message: this.message,
			provider: this.provider,
			status: this.status,
			statusText: this.statusText,
			url: this.url,
			body: this.body,
			cause: this.cause,
		};
	}

	/**
	 * Wraps an unknown error in `PaymeshError` unless it already is one.
	 */
	static wrap(
		error: unknown,
		props: Omit<PaymeshErrorProps, 'message' | 'cause'> & {
			message?: string;
		},
	) {
		if (error instanceof PaymeshError) return error;

		return new PaymeshError({
			...props,
			cause: error,
			message:
				props.message ??
				(error instanceof Error ? error.message : 'Request failed'),
		});
	}
}
