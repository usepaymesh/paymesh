import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import {
	type PaymeshClient,
	PaymeshError,
	type PaymeshEventType,
	type PluginHookEvent,
} from 'paymesh';
import { createFakeData } from 'src/lib/faker';
import { parseJson, parseObjectJson } from 'src/lib/utils';
import { readStdin } from 'src/shared/stdin';
import { loadClient } from '../lib/client';
import {
	formatBadge,
	formatPath,
	formatState,
	formatValue,
	logInfo,
	logSuccess,
} from '../lib/output';

const BUILT_IN_HOOKS = {
	'payment.created': 'onPaymentCreated',
	'payment.succeeded': 'onPaymentSucceeded',
	'payment.failed': 'onPaymentFailed',
	'payment.canceled': 'onPaymentCanceled',
	'payment.refunded': 'onPaymentRefunded',
	'customer.created': 'onCustomerCreated',
	'customer.updated': 'onCustomerUpdated',
	'customer.deleted': 'onCustomerDeleted',
	'subscription.created': 'onSubscriptionCreated',
	'subscription.updated': 'onSubscriptionUpdated',
	'subscription.canceled': 'onSubscriptionCanceled',
	'checkout.completed': 'onCheckoutCompleted',
} satisfies Record<PaymeshEventType, `on${string}`>;

export function registerTriggerCommand(program: Command) {
	program
		.command('trigger')
		.description(
			'Trigger a built-in webhook event or a registered plugin event',
		)
		.argument('<event>', 'Built-in event type or plugin event hook')
		.option(
			'--client <path>',
			'Path to the module exporting the Paymesh client',
		)
		.option('--listen <url>', 'Send the built-in event to a paymesh listen URL')
		.option('--data <json>', 'JSON payload data for the triggered event')
		.action(
			async (
				eventName: string,
				options: { client?: string; data?: string; listen?: string },
			) => {
				const client = await loadClient({
					cwd: process.cwd(),
					explicitPath: options.client,
				});

				const fromStdin = options.data == null;
				const rawData = options.data ?? (await readStdin());

				try {
					const source = fromStdin ? 'stdin' : 'data';

					if (eventName in BUILT_IN_HOOKS) {
						const data = rawData ? parseObjectJson(rawData, source) : {};
						const hook = BUILT_IN_HOOKS[eventName as PaymeshEventType];

						const event = {
							id: `evt_trigger_${randomUUID()}`,
							type: eventName,
							provider: client.provider.id,
							data: {
								...createFakeData(
									client.provider.id,
									eventName as PaymeshEventType,
								),
								...data,
							},
							context: {
								deliveryId: `evt_trigger_${randomUUID()}`,
								dispatchedAt: new Date().toISOString(),
								hook,
							},
						};

						if (options.listen) {
							const response = await sendEventToListener(
								options.listen,
								event,
								hook,
							);

							logSuccess(
								`${formatBadge('✦')} ${formatValue(eventName)} ${formatPath(`listener ${options.listen}`)} ${formatState(`status ${response.status}`)}`,
							);
							return;
						}

						const [called, specificCalled] = await Promise.all([
							callClientHook(client, 'onEvent', event),
							callClientHook(client, hook, event),
						]);

						const triggeredHooks = [called, specificCalled].filter(Boolean);
						if (triggeredHooks.length > 0) {
							logSuccess(
								`${formatBadge('✦')} ${formatValue(eventName)} ${formatPath(`hooks ${triggeredHooks.join(', ')}`)}`,
							);
						} else {
							logInfo(`${formatValue(eventName)} did not trigger any hooks`);
						}

						return;
					}

					const plugin = client.plugins
						.list()
						.find((entry) =>
							(entry.eventHooks as readonly string[]).includes(eventName),
						);

					if (plugin) {
						if (options.listen) {
							throw new PaymeshError({
								code: 'client_error',
								message:
									'Plugin events cannot be sent to paymesh listen. Use built-in webhook events only.',
							});
						}

						if (rawData == null)
							throw new PaymeshError({
								code: 'client_error',
								message: `Plugin event "${eventName}" requires --data or stdin with a JSON payload`,
							});

						const called = await callClientHook(client, eventName, {
							pluginId: plugin.id,
							type: eventName,
							data: parseJson(rawData, source),
							createdAt: new Date().toISOString(),
						} satisfies PluginHookEvent<string, unknown>);

						logSuccess(
							`${formatBadge('✦')} ${formatValue(eventName)} ${formatPath(`plugin ${plugin.id}`)} ${called ? formatState(`hook ${called}`) : formatState('no hook called', 'warn')}`,
						);
						return;
					}

					throw new PaymeshError({
						code: 'client_error',
						message: [
							`Unknown event "${eventName}".`,
							`Built-in events: ${Object.keys(BUILT_IN_HOOKS).join(', ')}`,
							`Plugin events: ${
								client.plugins
									.list()
									.flatMap((entry) => entry.eventHooks)
									.join(', ') || 'none'
							}`,
						].join(' '),
					});
				} finally {
					await client.database?.close?.();
				}
			},
		);
}

async function callClientHook(
	client: Pick<PaymeshClient<boolean>, 'hooks'>,
	name: string,
	event: unknown,
) {
	const hook = (
		client.hooks as
			| Record<
					string,
					((event: unknown) => unknown | Promise<unknown>) | undefined
			  >
			| undefined
	)?.[name];

	if (typeof hook !== 'function') return null;

	await hook(event);

	return name;
}

async function sendEventToListener(url: string, event: unknown, hook: string) {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-paymesh-source': 'trigger',
		},
		body: JSON.stringify({
			event,
			hook,
		}),
	});

	if (!response.ok) {
		const body = await response.text();

		throw new PaymeshError({
			code: 'client_error',
			message: `Failed to deliver triggered event to ${url}: HTTP ${response.status}${body ? ` ${body}` : ''}`,
		});
	}

	return response;
}
