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
	| 'client_error';

export interface PaymeshErrorProps {
	code: PaymeshErrorCode;
	message: string;
	provider?: string;
	status?: number;
	statusText?: string;
	url?: string;
	body?: unknown;
	cause?: unknown;
}

export class PaymeshError extends Error {
	readonly code: PaymeshErrorCode;
	readonly provider?: string;
	readonly status?: number;
	readonly statusText?: string;
	readonly url?: string;
	readonly body?: unknown;

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
