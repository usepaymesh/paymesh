import type {
	PluginMiddleware,
	PluginRouteContext,
	PluginRouteDefinition,
} from 'paymesh';
import { type PaymeshClient, PaymeshError } from 'paymesh';
import {
	createCustomer,
	createPayment,
	createPix,
	deleteCustomer,
	getCustomerData,
	getDatabaseData,
	getOverviewData,
	getPaymentData,
	getPixData,
	getPluginsData,
	getProviderData,
	getSubscriptionData,
	getWebhookData,
	listCustomersData,
	listPaymentsData,
	listPixData,
	listSubscriptionsData,
	listWebhooksData,
	retryWebhook,
	syncCustomer,
	syncPayment,
	syncPix,
	syncSubscription,
	writeAuditEntry,
} from './data';
import {
	assertDashActor,
	ensureDatabase,
	errorPayload,
	isApiPath,
	json,
	parseJson,
	toContentType,
} from './shared';
import type { DashActor, DashboardRequestContext, DashOptions } from './types';
import { DASHBOARD_CSS, DASHBOARD_JS, renderDashboardDocument } from './ui';

export function createDashboardMiddleware(
	options: Required<Pick<DashOptions, 'auth'>> & { path: string },
): PluginMiddleware {
	return async (context, next) => {
		try {
			const actor = assertDashActor(
				await options.auth({
					request: context.request,
					client: context.client as PaymeshClient<boolean>,
				}),
			);
			context.locals['dash.actor'] = actor;

			return await next();
		} catch (error) {
			const pathname = new URL(context.request.url).pathname;
			const payload = errorPayload(error);
			if (isApiPath(pathname, options.path)) {
				return json(
					{
						error: payload.error,
						message: payload.message,
					},
					{ status: payload.status === 500 ? 403 : payload.status },
				);
			}

			return new Response(
				`<!doctype html><html lang="en"><body style="font-family: sans-serif; background: #090b10; color: #f7f9fc; padding: 32px;"><h1>Dashboard access denied</h1><p>${escapeHtml(payload.message)}</p></body></html>`,
				{
					status: payload.status === 500 ? 403 : payload.status,
					headers: {
						'content-type': 'text/html; charset=utf-8',
					},
				},
			);
		}
	};
}

export function createDashboardRoutes(path: string): PluginRouteDefinition[] {
	const viewRoutes = [
		path,
		`${path}/customers`,
		`${path}/customers/:id`,
		`${path}/payments`,
		`${path}/payments/:id`,
		`${path}/pix`,
		`${path}/pix/:id`,
		`${path}/subscriptions`,
		`${path}/subscriptions/:id`,
		`${path}/webhooks`,
		`${path}/webhooks/:id`,
		`${path}/providers`,
		`${path}/database`,
		`${path}/plugins`,
	].map((routePath) => ({
		method: 'GET' as const,
		path: routePath,
		handler(context: PluginRouteContext) {
			const actor = getActor(context);
			return new Response(
				renderDashboardDocument({
					actor,
					basePath: path,
					currentPath: new URL(context.request.url).pathname,
					providerId: context.client.provider.id,
				}),
				{
					headers: {
						'content-type': 'text/html; charset=utf-8',
					},
				},
			);
		},
	}));

	const assetRoutes: PluginRouteDefinition[] = [
		{
			method: 'GET',
			path: `${path}/assets/app.css`,
			handler() {
				return new Response(DASHBOARD_CSS, {
					headers: {
						'content-type': toContentType('app.css'),
					},
				});
			},
		},
		{
			method: 'GET',
			path: `${path}/assets/app.js`,
			handler() {
				return new Response(DASHBOARD_JS, {
					headers: {
						'content-type': toContentType('app.js'),
					},
				});
			},
		},
	];

	const apiRoutes: PluginRouteDefinition[] = [
		{
			method: 'GET',
			path: `${path}/api/overview`,
			async handler(context) {
				return json(await getOverviewData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/customers`,
			async handler(context) {
				return json(await listCustomersData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/customers/:id`,
			async handler(context) {
				const customerId = requireParam(context, 'id');
				const customer = await getCustomerData(
					getDashboardContext(context),
					customerId,
				);
				if (!customer) {
					return notFound('customer');
				}

				return json(customer);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/customers`,
			async handler(context) {
				const body = await parseJson<{
					email?: string;
					externalId?: string;
					name?: string;
					phone?: string;
				}>(context.request);

				return mutate(
					context,
					{
						action: 'customer.create',
						resourceType: 'customer',
					},
					async (dashboardContext) => {
						const customer = await createCustomer(dashboardContext, body);
						return {
							email: customer.email ?? null,
							id: customer.id,
							name: customer.name ?? null,
						};
					},
				);
			},
		},
		{
			method: 'DELETE',
			path: `${path}/api/customers/:id`,
			async handler(context) {
				const customerId = requireParam(context, 'id');
				return mutate(
					context,
					{
						action: 'customer.delete',
						resourceId: customerId,
						resourceType: 'customer',
					},
					async (dashboardContext) => {
						const result = await deleteCustomer(dashboardContext, customerId);
						return {
							deleted: result.deleted,
							id: result.id,
						};
					},
				);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/customers/:id/sync`,
			async handler(context) {
				const customerId = requireParam(context, 'id');
				return mutate(
					context,
					{
						action: 'customer.sync',
						resourceId: customerId,
						resourceType: 'customer',
					},
					async (dashboardContext) => {
						const customer = await syncCustomer(dashboardContext, customerId);
						return {
							id: customer.id,
						};
					},
				);
			},
		},
		{
			method: 'GET',
			path: `${path}/api/payments`,
			async handler(context) {
				return json(await listPaymentsData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/payments/:id`,
			async handler(context) {
				const paymentId = requireParam(context, 'id');
				const payment = await getPaymentData(
					getDashboardContext(context),
					paymentId,
				);
				if (!payment) {
					return notFound('payment');
				}

				return json(payment);
			},
		},
		{
			method: 'GET',
			path: `${path}/api/pix`,
			async handler(context) {
				return json(await listPixData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/pix/:id`,
			async handler(context) {
				const pixId = requireParam(context, 'id');
				const pix = await getPixData(getDashboardContext(context), pixId);
				if (!pix) {
					return notFound('pix');
				}

				return json(pix);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/payments`,
			async handler(context) {
				const body = await parseJson<{
					amount: number;
					cancelUrl?: string;
					currency: string;
					customer?: {
						email?: string;
						externalId?: string;
						id?: string;
						name?: string;
						phone?: string;
					};
					description?: string;
					productIds?: string[];
					returnUrl?: string;
					successUrl?: string;
				}>(context.request);

				return mutate(
					context,
					{
						action: 'payment.create',
						resourceType: 'payment',
					},
					async (dashboardContext) => {
						const payment = await createPayment(dashboardContext, body);
						return {
							checkoutUrl: payment.checkoutUrl ?? null,
							id: payment.id,
							status: payment.status,
						};
					},
				);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/pix`,
			async handler(context) {
				const body = await parseJson<{
					amount: number;
					currency: string;
					customer?: {
						email?: string;
						externalId?: string;
						id?: string;
						name?: string;
						phone?: string;
					};
					description?: string;
					metadata?: Record<string, string | number | boolean | null>;
					pix?: {
						amountIncludesIof?: 'always' | 'never';
						expiresAfterSeconds?: number;
						expiresAt?: string;
					};
				}>(context.request);

				return mutate(
					context,
					{
						action: 'pix.create',
						resourceType: 'pix',
					},
					async (dashboardContext) => {
						const pix = await createPix(dashboardContext, body);
						return {
							id: pix.id,
							status: pix.status,
						};
					},
				);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/payments/:id/sync`,
			async handler(context) {
				const paymentId = requireParam(context, 'id');
				return mutate(
					context,
					{
						action: 'payment.sync',
						resourceId: paymentId,
						resourceType: 'payment',
					},
					async (dashboardContext) => {
						const payment = await syncPayment(dashboardContext, paymentId);
						return {
							id: payment?.id ?? paymentId,
						};
					},
				);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/pix/:id/sync`,
			async handler(context) {
				const pixId = requireParam(context, 'id');
				return mutate(
					context,
					{
						action: 'pix.sync',
						resourceId: pixId,
						resourceType: 'pix',
					},
					async (dashboardContext) => {
						const pix = await syncPix(dashboardContext, pixId);
						return {
							id: pix?.id ?? pixId,
						};
					},
				);
			},
		},
		{
			method: 'GET',
			path: `${path}/api/subscriptions`,
			async handler(context) {
				return json(await listSubscriptionsData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/subscriptions/:id`,
			async handler(context) {
				const subscriptionId = requireParam(context, 'id');
				const subscription = await getSubscriptionData(
					getDashboardContext(context),
					subscriptionId,
				);
				if (!subscription) {
					return notFound('subscription');
				}

				return json(subscription);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/subscriptions/:id/sync`,
			async handler(context) {
				const subscriptionId = requireParam(context, 'id');
				return mutate(
					context,
					{
						action: 'subscription.sync',
						resourceId: subscriptionId,
						resourceType: 'subscription',
					},
					async (dashboardContext) => {
						const subscription = await syncSubscription(
							dashboardContext,
							subscriptionId,
						);
						return {
							id:
								typeof subscription?.id === 'string'
									? subscription.id
									: subscriptionId,
						};
					},
				);
			},
		},
		{
			method: 'GET',
			path: `${path}/api/webhooks`,
			async handler(context) {
				return json(await listWebhooksData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/webhooks/:id`,
			async handler(context) {
				const webhookId = requireParam(context, 'id');
				const webhook = await getWebhookData(
					getDashboardContext(context),
					webhookId,
				);
				if (!webhook) {
					return notFound('webhook');
				}

				return json(webhook);
			},
		},
		{
			method: 'POST',
			path: `${path}/api/webhooks/:id/retry`,
			async handler(context) {
				const webhookId = requireParam(context, 'id');
				return mutate(
					context,
					{
						action: 'webhook.retry',
						resourceId: webhookId,
						resourceType: 'webhook',
					},
					async (dashboardContext) => {
						await retryWebhook(dashboardContext, webhookId);
						return {
							id: webhookId,
						};
					},
				);
			},
		},
		{
			method: 'GET',
			path: `${path}/api/providers`,
			async handler(context) {
				return json(await getProviderData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/database`,
			async handler(context) {
				return json(await getDatabaseData(getDashboardContext(context)));
			},
		},
		{
			method: 'GET',
			path: `${path}/api/plugins`,
			handler(context) {
				return json(getPluginsData(getDashboardContext(context)));
			},
		},
	];

	return [...viewRoutes, ...assetRoutes, ...apiRoutes];
}

async function mutate(
	context: PluginRouteContext,
	audit: {
		action: string;
		resourceId?: string;
		resourceType: 'customer' | 'payment' | 'pix' | 'subscription' | 'webhook';
	},
	action: (context: DashboardRequestContext) => Promise<unknown>,
) {
	const dashboardContext = getDashboardContext(context);

	try {
		const result = await action(dashboardContext);
		await writeAuditEntry(dashboardContext, dashboardContext.actor, {
			action: audit.action,
			metadata: isRecord(result) ? result : null,
			outcome: 'success',
			resourceId:
				audit.resourceId ??
				(typeof result === 'object' &&
				result !== null &&
				'id' in result &&
				typeof result.id === 'string'
					? result.id
					: null),
			resourceType: audit.resourceType,
		});

		return json(result);
	} catch (error) {
		await writeAuditEntry(dashboardContext, dashboardContext.actor, {
			action: audit.action,
			error: error instanceof Error ? error.message : 'Request failed',
			outcome: 'error',
			resourceId: audit.resourceId ?? null,
			resourceType: audit.resourceType,
		});

		throw error;
	}
}

function getDashboardContext(
	context: PluginRouteContext,
): DashboardRequestContext {
	return {
		actor: getActor(context),
		client: context.client as PaymeshClient<boolean>,
		database: ensureDatabase(context.client as PaymeshClient<boolean>),
		request: context.request,
		resolveTrustedUrl: context.resolveTrustedUrl,
		schema: context.schema,
	};
}

function getActor(context: PluginRouteContext): DashActor {
	const actor = context.locals['dash.actor'];
	if (
		typeof actor === 'object' &&
		actor !== null &&
		'id' in actor &&
		typeof actor.id === 'string'
	) {
		return actor as DashActor;
	}

	throw new PaymeshError({
		code: 'plugin_error',
		message: 'Dashboard actor is missing from the request context.',
		status: 500,
	});
}

function notFound(resource: string) {
	return json(
		{
			error: 'provider_not_found',
			message: `${resource} was not found`,
		},
		{ status: 404 },
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function requireParam(context: PluginRouteContext, key: string) {
	const value = context.params[key];
	if (!value) {
		throw new PaymeshError({
			code: 'invalid_request',
			message: `Missing route parameter "${key}".`,
			status: 400,
		});
	}

	return value;
}
