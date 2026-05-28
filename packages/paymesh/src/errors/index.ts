export type PaymeshErrorType = 'request_error' | 'unsupported_capacity';

export interface PaymeshErrorProps {
	type: PaymeshErrorType;
	message: string;
	status?: number;
	statusText?: string;
	url?: string;
	body?: unknown;
	cause?: unknown;
}

export class PaymeshError extends Error {
	readonly type: PaymeshErrorType;
	readonly status?: number;
	readonly statusText?: string;
	readonly url?: string;
	readonly body?: unknown;

	constructor(props: PaymeshErrorProps) {
		super(props.message, { cause: props.cause });

		this.name = 'PaymeshError';
		this.type = props.type;
		this.status = props.status;
		this.statusText = props.statusText;
		this.url = props.url;
		this.body = props.body;
	}

	get props(): PaymeshErrorProps {
		return {
			type: this.type,
			message: this.message,
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
