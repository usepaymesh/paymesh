import type { RetryOptions } from '../shared/request';
import type { Provider } from './providers';

export interface ClientOptions<
	P extends Provider<string>,
	IncludeRaw extends boolean = false,
> {
	provider: P;
	baseUrl?: string;
	timeout?: number;
	retry?: RetryOptions;
	fetch?: typeof fetch;
	logger?: PaymeshLogger | boolean;
	includeRaw?: IncludeRaw;
}

export interface PaymeshLogger {
	debug(message: string, context?: Record<string, unknown>): void;
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
}
