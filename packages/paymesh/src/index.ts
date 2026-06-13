import { createClientManagers } from './client/managers';
import { defineDatabaseAdapter } from './database/adapter';
import { resolveDatabaseSchema } from './database/schema';
import { PaymeshError } from './errors';
import { definePlugin, event, lazy } from './plugins';
import { defineProvider } from './providers';
import { isPaymeshClient, PAYMESH_CLIENT_SYMBOL } from './shared/client/marker';
import { normalizeTrustedOrigins } from './shared/client/trusted-origins';
import { resolveClientSchemaOptions } from './shared/database/schema';
import { withRaw } from './shared/raw';
import { request } from './shared/request';
import type {
	ClientOptions,
	PaymeshClient,
	PluginClientExtensions,
} from './types/client';
import type { DatabaseSchemaOptions } from './types/database';
import type { AnyPaymeshPlugin } from './types/plugins';
import type { Provider } from './types/providers';

export type * from './errors';
export type { RetryOptions } from './shared/request';
export type * from './types/client';
export type * from './types/database';
export type * from './types/plugins';
export type * from './types/providers';
export {
	defineDatabaseAdapter,
	definePlugin,
	defineProvider,
	event,
	isPaymeshClient,
	lazy,
	PAYMESH_CLIENT_SYMBOL,
	PaymeshError,
	request,
	resolveDatabaseSchema,
	withRaw,
};

/**
 * Creates a Paymesh client from a provider, optional database adapter, and plugin list.
 *
 * @example
 * ```ts
 * const client = createClient({
 *   provider: stripe({ secret: process.env.STRIPE_API_KEY }),
 *   database: postgres(process.env.DATABASE_URL),
 *   includeRaw: false,
 * });
 * ```
 */
export function createClient<
	const Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
	P extends Provider<string> = Provider<string>,
	IncludeRaw extends boolean = false,
	const Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
>({
	provider,
	...options
}: ClientOptions<P, IncludeRaw, Schema, Plugins>): PaymeshClient<
	IncludeRaw,
	Schema,
	Plugins
> &
	PluginClientExtensions<Plugins> {
	if (
		typeof options.sandbox === 'boolean' &&
		options.sandbox !== provider.isSandbox()
	)
		throw new PaymeshError({
			code: 'invalid_request',
			message: `Client sandbox option (${String(options.sandbox)}) does not match provider "${provider.id}" sandbox mode (${String(provider.isSandbox())}).`,
			provider: provider.id,
		});

	const plugins = options.plugins ?? ([] as unknown as Plugins);
	const schema = resolveDatabaseSchema(
		resolveClientSchemaOptions(options.schema, plugins),
	);

	return createClientManagers({
		provider,
		options: {
			...options,
			plugins,
			trustedOrigins: normalizeTrustedOrigins(options.trustedOrigins),
		},
		schema,
	});
}
