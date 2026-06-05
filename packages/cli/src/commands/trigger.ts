import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import {
	type PaymeshClient,
	PaymeshError,
	type PaymeshEventType,
	type PluginHookEvent,
} from 'paymesh';
import pc from 'picocolors';
import { createFakeData } from 'src/lib/faker';
import { parseJson, parseObjectJson } from 'src/lib/utils';
import { loadClient } from '../lib/client';

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
		.option('--data <json>', 'JSON payload data for the triggered event')
		.action(
			async (
				eventName: string,
				options: { client?: string; data?: string },
			) => {
				const client = await loadClient({
					cwd: process.cwd(),
					explicitPath: options.client,
				});

				try {
					if (eventName in BUILT_IN_HOOKS) {
						const data = options.data ? parseObjectJson(options.data) : {};
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

						const [called, specificCalled] = await Promise.all([
							callClientHook(client, 'onEvent', event),
							callClientHook(client, hook, event),
						]);

						console.log(
							`${pc.magenta('✦')} ${pc.bold(eventName)} ${pc.dim('hooks:')} ${[called, specificCalled].filter(Boolean).join(', ') || 'none'}`,
						);

						return;
					}

					const plugin = client.plugins
						.list()
						.find((entry) =>
							(entry.eventHooks as readonly string[]).includes(eventName),
						);

					if (plugin) {
						if (options.data == null) {
							throw new PaymeshError({
								code: 'client_error',
								message: `Plugin event "${eventName}" requires --data with a JSON payload`,
							});
						}

						const called = await callClientHook(client, eventName, {
							pluginId: plugin.id,
							type: eventName,
							data: parseJson(options.data),
							createdAt: new Date().toISOString(),
						} satisfies PluginHookEvent<string, unknown>);

						console.log(
							`${pc.magenta('✦')} ${pc.bold(eventName)} ${pc.dim(`plugin:${plugin.id}`)} ${pc.dim('hooks:')} ${called ?? 'none'}`,
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
