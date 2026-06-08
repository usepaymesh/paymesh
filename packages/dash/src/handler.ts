import type {
	AnyPaymeshPlugin,
	DatabaseSchemaOptions,
	PaymeshClient,
} from 'paymesh';
import { getDashboardConfig, isDashboardPath } from './shared';

export function Dashboard<
	Plugins extends readonly AnyPaymeshPlugin[] = readonly [],
	Schema extends DatabaseSchemaOptions = DatabaseSchemaOptions,
>({ client }: { client: PaymeshClient<boolean, Schema, Plugins> }) {
	const config = getDashboardConfig(client);

	return async (request: Request) => {
		const pathname = new URL(request.url).pathname;
		if (!isDashboardPath(pathname, config.path)) {
			return Response.json({ error: 'route_not_found' }, { status: 404 });
		}

		return client.routes.handle(request);
	};
}
