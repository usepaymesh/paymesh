import { serializeForScript } from './shared';
import type { DashboardAssetConfig } from './types';

export const DASHBOARD_CSS = `
:root {
	--bg: #0b0d12;
	--panel: #121723;
	--panel-strong: #171e2d;
	--panel-soft: #0f1420;
	--line: rgba(255, 255, 255, 0.08);
	--text: #f6f8fc;
	--muted: #9ba7be;
	--accent: #74f0c2;
	--accent-2: #6b8cff;
	--danger: #ff7f8b;
	--warning: #ffc875;
	--shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
	font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
	color: var(--text);
	background:
		radial-gradient(circle at top left, rgba(107, 140, 255, 0.16), transparent 32%),
		radial-gradient(circle at top right, rgba(116, 240, 194, 0.1), transparent 24%),
		linear-gradient(180deg, #0b0d12 0%, #0e1118 100%);
}

* {
	box-sizing: border-box;
}

html, body {
	margin: 0;
	min-height: 100%;
}

body {
	color: var(--text);
}

a {
	color: inherit;
	text-decoration: none;
}

button, input, textarea {
	font: inherit;
}

button {
	cursor: pointer;
}

.dash-shell {
	display: grid;
	grid-template-columns: 280px minmax(0, 1fr);
	min-height: 100vh;
}

.dash-sidebar {
	padding: 32px 20px;
	border-right: 1px solid var(--line);
	background: rgba(8, 10, 16, 0.9);
	backdrop-filter: blur(14px);
}

.dash-brand {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 28px;
}

.dash-brand__label {
	display: inline-flex;
	align-items: center;
	width: fit-content;
	padding: 6px 10px;
	border-radius: 999px;
	background: rgba(116, 240, 194, 0.12);
	color: var(--accent);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.dash-brand h1 {
	margin: 0;
	font-size: 28px;
	letter-spacing: -0.04em;
}

.dash-brand p,
.dash-sidebar__meta p,
.dash-note,
.dash-empty,
.dash-muted {
	margin: 0;
	color: var(--muted);
}

.dash-nav {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.dash-nav a {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 14px;
	border: 1px solid transparent;
	border-radius: 16px;
	color: var(--muted);
	transition: 140ms ease;
}

.dash-nav a:hover,
.dash-nav a[data-active="true"] {
	border-color: rgba(116, 240, 194, 0.12);
	background: rgba(255, 255, 255, 0.04);
	color: var(--text);
}

.dash-main {
	padding: 28px;
}

.dash-topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	margin-bottom: 24px;
}

.dash-topbar h2 {
	margin: 0;
	font-size: 34px;
	letter-spacing: -0.05em;
}

.dash-pill,
.dash-badge {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	border-radius: 999px;
	border: 1px solid var(--line);
	background: rgba(255, 255, 255, 0.04);
	color: var(--muted);
}

.dash-panel,
.dash-stat,
.dash-card {
	border: 1px solid var(--line);
	border-radius: 24px;
	background: linear-gradient(180deg, rgba(18, 23, 35, 0.98), rgba(12, 16, 25, 0.94));
	box-shadow: var(--shadow);
}

.dash-panel,
.dash-card {
	padding: 20px;
}

.dash-grid {
	display: grid;
	gap: 16px;
}

.dash-grid--cards {
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.dash-stat {
	padding: 20px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.dash-stat__value {
	font-size: 28px;
	font-weight: 700;
	letter-spacing: -0.04em;
}

.dash-layout {
	display: grid;
	grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
	gap: 18px;
}

.dash-stack {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.dash-panel__header,
.dash-card__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 16px;
}

.dash-panel__header h3,
.dash-card__header h3 {
	margin: 0;
	font-size: 18px;
}

.dash-list,
.dash-data-list {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.dash-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 12px;
	padding: 14px 0;
	border-top: 1px solid var(--line);
}

.dash-row:first-child {
	border-top: 0;
	padding-top: 0;
}

.dash-row__title {
	font-weight: 600;
}

.dash-row__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	color: var(--muted);
	font-size: 13px;
}

.dash-table {
	width: 100%;
	border-collapse: collapse;
}

.dash-table th,
.dash-table td {
	padding: 14px 12px;
	border-top: 1px solid var(--line);
	text-align: left;
	vertical-align: top;
}

.dash-table th {
	border-top: 0;
	color: var(--muted);
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 0.08em;
}

.dash-table td a {
	color: var(--text);
	font-weight: 600;
}

.dash-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}

.dash-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 11px 14px;
	border-radius: 14px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(255, 255, 255, 0.04);
	color: var(--text);
}

.dash-button:hover {
	border-color: rgba(116, 240, 194, 0.3);
	background: rgba(116, 240, 194, 0.08);
}

.dash-button[data-kind="primary"] {
	background: linear-gradient(135deg, rgba(116, 240, 194, 0.18), rgba(107, 140, 255, 0.16));
	border-color: rgba(116, 240, 194, 0.28);
}

.dash-button[data-kind="danger"] {
	border-color: rgba(255, 127, 139, 0.25);
	color: #ffd3d8;
}

.dash-button[disabled] {
	cursor: not-allowed;
	opacity: 0.45;
}

.dash-form {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;
}

.dash-form label {
	display: flex;
	flex-direction: column;
	gap: 8px;
	color: var(--muted);
	font-size: 13px;
}

.dash-form input,
.dash-form textarea {
	width: 100%;
	padding: 12px 14px;
	border-radius: 14px;
	border: 1px solid var(--line);
	background: rgba(255, 255, 255, 0.03);
	color: var(--text);
}

.dash-form .dash-form__wide {
	grid-column: 1 / -1;
}

.dash-json {
	margin: 0;
	padding: 16px;
	border-radius: 18px;
	background: #0b0f18;
	border: 1px solid rgba(255, 255, 255, 0.06);
	overflow: auto;
	font-family: "IBM Plex Mono", monospace;
	font-size: 13px;
	line-height: 1.5;
}

.dash-toast {
	position: fixed;
	right: 24px;
	bottom: 24px;
	display: none;
	padding: 14px 16px;
	border-radius: 16px;
	border: 1px solid rgba(116, 240, 194, 0.18);
	background: rgba(10, 14, 20, 0.95);
	color: var(--text);
	box-shadow: var(--shadow);
}

.dash-toast[data-visible="true"] {
	display: block;
}

.dash-link {
	color: var(--accent);
}

.dash-status {
	display: inline-flex;
	align-items: center;
	padding: 6px 10px;
	border-radius: 999px;
	background: rgba(107, 140, 255, 0.12);
	color: #c9d6ff;
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.dash-status[data-tone="danger"] {
	background: rgba(255, 127, 139, 0.12);
	color: #ffd3d8;
}

.dash-status[data-tone="success"] {
	background: rgba(116, 240, 194, 0.12);
	color: var(--accent);
}

.dash-status[data-tone="warning"] {
	background: rgba(255, 200, 117, 0.12);
	color: var(--warning);
}

@media (max-width: 1080px) {
	.dash-shell {
		grid-template-columns: 1fr;
	}

	.dash-sidebar {
		border-right: 0;
		border-bottom: 1px solid var(--line);
	}

	.dash-layout {
		grid-template-columns: 1fr;
	}
}

@media (max-width: 720px) {
	.dash-main {
		padding: 18px;
	}

	.dash-form {
		grid-template-columns: 1fr;
	}

	.dash-topbar {
		flex-direction: column;
		align-items: flex-start;
	}
}
`;

export const DASHBOARD_JS = String.raw`
const config = window.__PAYMESH_DASH__;
const root = document.querySelector('[data-app-root]');
const toast = document.querySelector('[data-toast]');
const pagePath = window.location.pathname.startsWith(config.basePath)
	? window.location.pathname.slice(config.basePath.length) || '/'
	: '/';

render().catch((error) => {
	root.innerHTML = '<section class="dash-panel"><h3>Dashboard error</h3><p class="dash-note">' + escapeHtml(error.message || 'Unable to render dashboard') + '</p></section>';
});

document.addEventListener('submit', async (event) => {
	if (event.target?.matches('[data-form="customer-create"]')) {
		event.preventDefault();
		const form = new FormData(event.target);
		await mutate('/customers', {
			method: 'POST',
			body: JSON.stringify({
				email: optional(form.get('email')),
				externalId: optional(form.get('externalId')),
				name: optional(form.get('name')),
				phone: optional(form.get('phone'))
			})
		}, (payload) => {
			notify('Customer created');
			if (payload?.id) {
				window.location.href = config.basePath + '/customers/' + encodeURIComponent(payload.id);
				return;
			}
			window.location.reload();
		});
	}

	if (event.target?.matches('[data-form="payment-create"]')) {
		event.preventDefault();
		const form = new FormData(event.target);
		await mutate('/payments', {
			method: 'POST',
			body: JSON.stringify({
				amount: Number(form.get('amount')),
				cancelUrl: optional(form.get('cancelUrl')),
				currency: String(form.get('currency') || 'USD'),
				customer: {
					email: optional(form.get('customerEmail')),
					externalId: optional(form.get('customerExternalId')),
					id: optional(form.get('customerId')),
					name: optional(form.get('customerName'))
				},
				description: optional(form.get('description')),
				productIds: splitLines(form.get('productIds')),
				returnUrl: optional(form.get('returnUrl')),
				successUrl: optional(form.get('successUrl'))
			})
		}, (payload) => {
			notify('Payment created');
			if (payload?.id) {
				window.location.href = config.basePath + '/payments/' + encodeURIComponent(payload.id);
				return;
			}
			window.location.reload();
		});
	}

	if (event.target?.matches('[data-form="pix-create"]')) {
		event.preventDefault();
		const form = new FormData(event.target);
		const pix = {
			amountIncludesIof: optional(form.get('amountIncludesIof')),
			expiresAfterSeconds: numericOptional(form.get('expiresAfterSeconds')),
			expiresAt: optional(form.get('expiresAt'))
		};
		await mutate('/pix', {
			method: 'POST',
			body: JSON.stringify({
				amount: Number(form.get('amount')),
				currency: String(form.get('currency') || 'BRL'),
				customer: {
					email: optional(form.get('customerEmail')),
					externalId: optional(form.get('customerExternalId')),
					id: optional(form.get('customerId')),
					name: optional(form.get('customerName'))
				},
				description: optional(form.get('description')),
				pix: Object.values(pix).some((value) => value != null) ? pix : undefined
			})
		}, (payload) => {
			notify('PIX payment created');
			if (payload?.id) {
				window.location.href = config.basePath + '/pix/' + encodeURIComponent(payload.id);
				return;
			}
			window.location.reload();
		});
	}
});

document.addEventListener('click', async (event) => {
	const element = event.target?.closest('[data-action]');
	if (!element) return;

	const action = element.getAttribute('data-action');
	const id = element.getAttribute('data-id');
	if (!action || !id) return;

	if (action === 'copy-id') {
		await navigator.clipboard.writeText(id);
		notify('ID copied');
		return;
	}

	if (action === 'open-provider') {
		const href = element.getAttribute('data-href');
		if (href) {
			window.open(href, '_blank', 'noopener,noreferrer');
		}
		return;
	}

	if (action === 'delete-customer') {
		if (!window.confirm('Delete this customer?')) return;
		await mutate('/customers/' + encodeURIComponent(id), { method: 'DELETE' }, () => {
			notify('Customer deleted');
			window.location.href = config.basePath + '/customers';
		});
		return;
	}

	if (action === 'sync-customer') {
		await mutate('/customers/' + encodeURIComponent(id) + '/sync', { method: 'POST' }, () => {
			notify('Customer synced');
			window.location.reload();
		});
		return;
	}

	if (action === 'sync-payment') {
		await mutate('/payments/' + encodeURIComponent(id) + '/sync', { method: 'POST' }, () => {
			notify('Payment sync requested');
			window.location.reload();
		});
		return;
	}

	if (action === 'sync-pix') {
		await mutate('/pix/' + encodeURIComponent(id) + '/sync', { method: 'POST' }, () => {
			notify('PIX sync requested');
			window.location.reload();
		});
		return;
	}

	if (action === 'sync-subscription') {
		await mutate('/subscriptions/' + encodeURIComponent(id) + '/sync', { method: 'POST' }, () => {
			notify('Subscription sync requested');
			window.location.reload();
		});
		return;
	}

	if (action === 'retry-webhook') {
		await mutate('/webhooks/' + encodeURIComponent(id) + '/retry', { method: 'POST' }, () => {
			notify('Webhook retry is not available for this provider yet');
			window.location.reload();
		});
	}
});

async function render() {
	if (pagePath === '/' || pagePath === '') {
		const payload = await api('/overview');
		renderOverview(payload);
		return;
	}

	if (pagePath === '/customers') {
		const payload = await api('/customers');
		renderCustomers(payload);
		return;
	}

	if (pagePath.startsWith('/customers/')) {
		const payload = await api('/customers/' + encodeURIComponent(decodeURIComponent(pagePath.split('/')[2] || '')));
		renderDetail('Customer', payload, { kind: 'customer' });
		return;
	}

	if (pagePath === '/payments') {
		const payload = await api('/payments');
		renderPayments(payload);
		return;
	}

	if (pagePath.startsWith('/payments/')) {
		const payload = await api('/payments/' + encodeURIComponent(decodeURIComponent(pagePath.split('/')[2] || '')));
		renderDetail('Payment', payload, { kind: 'payment' });
		return;
	}

	if (pagePath === '/pix') {
		const payload = await api('/pix');
		renderPix(payload);
		return;
	}

	if (pagePath.startsWith('/pix/')) {
		const payload = await api('/pix/' + encodeURIComponent(decodeURIComponent(pagePath.split('/')[2] || '')));
		renderDetail('PIX', payload, { kind: 'pix' });
		return;
	}

	if (pagePath === '/subscriptions') {
		const payload = await api('/subscriptions');
		renderSubscriptions(payload);
		return;
	}

	if (pagePath.startsWith('/subscriptions/')) {
		const payload = await api('/subscriptions/' + encodeURIComponent(decodeURIComponent(pagePath.split('/')[2] || '')));
		renderDetail('Subscription', payload, { kind: 'subscription' });
		return;
	}

	if (pagePath === '/webhooks') {
		const payload = await api('/webhooks');
		renderWebhooks(payload);
		return;
	}

	if (pagePath.startsWith('/webhooks/')) {
		const payload = await api('/webhooks/' + encodeURIComponent(decodeURIComponent(pagePath.split('/')[2] || '')));
		renderDetail('Webhook', payload, { kind: 'webhook' });
		return;
	}

	if (pagePath === '/providers') {
		const payload = await api('/providers');
		renderProviders(payload);
		return;
	}

	if (pagePath === '/database') {
		const payload = await api('/database');
		renderDatabase(payload);
		return;
	}

	if (pagePath === '/plugins') {
		const payload = await api('/plugins');
		renderPlugins(payload);
		return;
	}

	root.innerHTML = '<section class="dash-panel"><h3>Not found</h3><p class="dash-note">This section is not registered.</p></section>';
}

function renderOverview(payload) {
	root.innerHTML = shell('Overview', 'Live operational state across the active provider and normalized billing tables.', [
		sectionCards(payload.counts),
		'<section class="dash-layout">' +
			'<div class="dash-stack">' +
				panel('Recent webhooks', listRows(payload.recentWebhooks.map((item) => ({
					href: config.basePath + '/webhooks/' + encodeURIComponent(item.id),
					meta: [item.eventType, item.status, item.createdAt].filter(Boolean).join(' · '),
					title: item.id
				})))) +
			'</div>' +
			'<div class="dash-stack">' +
				panel('Balance', balancePanel(payload.balance)) +
				panel('Provider', '<div class="dash-data-list">' +
					dataLine('Provider', payload.provider.id) +
					dataLine('Capabilities', Object.entries(payload.provider.capabilities).filter(([, enabled]) => enabled).map(([name]) => name).join(', ') || 'None') +
				'</div>') +
			'</div>' +
		'</section>'
	].join(''));
}

function renderCustomers(payload) {
	root.innerHTML = shell('Customers', 'Normalized customers persisted by Paymesh.', panel('Create customer', customerForm()) + panel('Customer list', table([
		['ID', 'Email', 'Name', 'Created'],
		...payload.map((item) => [
			link(config.basePath + '/customers/' + encodeURIComponent(item.id), item.id),
			item.email || 'Unknown',
			item.name || 'Unknown',
			item.createdAt || 'Unknown'
		])
	])));
}

function renderPayments(payload) {
	root.innerHTML = shell('Payments', 'Checkouts and invoice-backed payment records across the active provider.', panel('Create payment', paymentForm()) + panel('Payment list', table([
		['ID', 'Status', 'Amount', 'Source'],
		...payload.map((item) => [
			link(config.basePath + '/payments/' + encodeURIComponent(item.id), item.id),
			statusBadge(item.status),
			formatMoney(item.amount, item.currency),
			item.source
		])
	])));
}

function renderPix(payload) {
	root.innerHTML = shell('PIX', 'Native PIX payment records persisted by Paymesh.', panel('Create PIX payment', pixForm()) + panel('PIX list', table([
		['ID', 'Status', 'Amount', 'Expires'],
		...payload.map((item) => [
			link(config.basePath + '/pix/' + encodeURIComponent(item.id), item.id),
			statusBadge(item.status),
			formatMoney(item.amount, item.currency),
			item.expiresAt || 'Unknown'
		])
	])));
}

function renderSubscriptions(payload) {
	root.innerHTML = shell('Subscriptions', 'Normalized subscription lifecycle state written through webhooks.', panel('Subscription list', table([
		['ID', 'Status', 'Customer', 'Amount'],
		...payload.map((item) => [
			link(config.basePath + '/subscriptions/' + encodeURIComponent(item.id), item.id),
			statusBadge(item.status),
			item.customerId || 'Unknown',
			formatMoney(item.amount, item.currency)
		])
	])));
}

function renderWebhooks(payload) {
	root.innerHTML = shell('Webhooks', 'Delivery history for normalized provider events.', panel('Webhook deliveries', table([
		['ID', 'Event', 'Status', 'Attempts'],
		...payload.map((item) => [
			link(config.basePath + '/webhooks/' + encodeURIComponent(item.id), item.id),
			item.eventType,
			statusBadge(item.status),
			String(item.attempts)
		])
	])));
}

function renderProviders(payload) {
	root.innerHTML = shell('Providers', 'Capabilities, catalog coverage, and provider-facing shortcuts.', '<section class="dash-layout"><div class="dash-stack">' +
		panel('Capabilities', '<div class="dash-data-list">' + Object.entries(payload.capabilities).map(([name, enabled]) => dataLine(name, enabled ? 'Enabled' : 'Disabled')).join('') + '</div>') +
		panel('Catalog', '<div class="dash-data-list">' + dataLine('Products', String(payload.catalog.products)) + dataLine('Prices', String(payload.catalog.prices)) + '</div>') +
	'</div><div class="dash-stack">' + panel('Balance', balancePanel(payload.balance)) + '</div></section>');
}

function renderDatabase(payload) {
	root.innerHTML = shell('Database', 'Resolved table names, row counts, and plugin-owned tables.', '<section class="dash-layout"><div class="dash-stack">' +
		panel('Counts', '<div class="dash-data-list">' + Object.entries(payload.counts).map(([key, value]) => dataLine(key, String(value))).join('') + '</div>') +
		panel('Core tables', table([
			['Table', 'Resolved name'],
			...payload.schema.tables.map((item) => [item.key, item.name])
		])) +
	'</div><div class="dash-stack">' +
		panel('Custom tables', payload.customTables.length ? table([
			['Table', 'Plugin'],
			...payload.customTables.map((item) => [item.name, item.pluginId || 'Unknown'])
		]) : '<p class="dash-empty">No custom tables registered.</p>') +
		panel('Storage', '<div class="dash-data-list">' + dataLine('Prefix', payload.schema.prefix) + dataLine('Persist raw', payload.persistRaw ? 'Yes' : 'No') + '</div>') +
	'</div></section>');
}

function renderPlugins(payload) {
	root.innerHTML = shell('Plugins', 'Registered plugin metadata and route inventory.', panel('Plugin inventory', payload.length ? table([
		['Plugin', 'Status', 'Routes', 'Custom tables'],
		...payload.map((item) => [
			item.name || item.id,
			statusBadge(item.status),
			String(item.routes.length),
			String(item.customTables.length)
		])
	]) : '<p class="dash-empty">No plugins registered.</p>'));
}

function renderDetail(title, payload, options) {
	const actions = [];
	if (payload.actions?.openInProvider) {
		actions.push('<button class="dash-button" data-action="open-provider" data-id="' + escapeHtml(payload.resource.id) + '" data-href="' + escapeHtml(payload.actions.openInProvider) + '">Open in provider</button>');
	}
	if (payload.actions?.canSync) {
		actions.push('<button class="dash-button" data-action="sync-' + options.kind + '" data-id="' + escapeHtml(payload.resource.id) + '">Sync resource</button>');
	}
	if (options.kind === 'customer') {
		actions.push('<button class="dash-button" data-kind="danger" data-action="delete-customer" data-id="' + escapeHtml(payload.resource.id) + '">Delete customer</button>');
	}
	if (options.kind === 'webhook') {
		actions.push('<button class="dash-button" data-action="retry-webhook" data-id="' + escapeHtml(payload.resource.id) + '"' + (payload.actions?.canRetryWebhook ? '' : ' disabled') + '>Retry webhook</button>');
	}
	actions.push('<button class="dash-button" data-action="copy-id" data-id="' + escapeHtml(payload.resource.id) + '">Copy ID</button>');

	root.innerHTML = shell(title, 'Detailed normalized and provider-linked resource view.', '<section class="dash-stack">' +
		panel(title + ' actions', '<div class="dash-actions">' + actions.join('') + '</div>') +
		'<section class="dash-layout"><div class="dash-stack">' +
			panel('Summary', summaryPanel(payload.resource)) +
			panel('Normalized payload', '<pre class="dash-json">' + escapeHtml(JSON.stringify(payload.resource.normalized, null, 2)) + '</pre>') +
		'</div><div class="dash-stack">' +
			panel('Timeline', payload.timeline?.length ? listRows(payload.timeline.map((entry) => ({
				meta: [entry.outcome, entry.createdAt].filter(Boolean).join(' · '),
				title: entry.action
			}))) : '<p class="dash-empty">No timeline entries yet.</p>') +
			panel('Raw payload', '<pre class="dash-json">' + escapeHtml(JSON.stringify(payload.resource.raw, null, 2)) + '</pre>') +
		'</div></section>' +
	'</section>');
}

function shell(title, description, content) {
	return '<div class="dash-topbar"><div><h2>' + escapeHtml(title) + '</h2><p class="dash-note">' + escapeHtml(description) + '</p></div><div class="dash-pill">' + escapeHtml(config.actor.name || config.actor.email || config.actor.id) + '</div></div>' + content;
}

function panel(title, content) {
	return '<section class="dash-panel"><div class="dash-panel__header"><h3>' + escapeHtml(title) + '</h3></div>' + content + '</section>';
}

function sectionCards(counts) {
	return '<section class="dash-grid dash-grid--cards">' + Object.entries(counts).map(([key, value]) => (
		'<article class="dash-stat"><span class="dash-muted">' + escapeHtml(labelize(key)) + '</span><span class="dash-stat__value">' + escapeHtml(String(value ?? 0)) + '</span></article>'
	)).join('') + '</section>';
}

function balancePanel(balance) {
	if (!balance) {
		return '<p class="dash-empty">Balance is unavailable for this provider adapter.</p>';
	}

	const available = (balance.available || []).map((entry) => dataLine(entry.label || 'Available', formatMoney(entry.amount, entry.currency))).join('');
	const pending = (balance.pending || []).map((entry) => dataLine(entry.label || 'Pending', formatMoney(entry.amount, entry.currency))).join('');
	const reserved = (balance.reserved || []).map((entry) => dataLine(entry.label || 'Reserved', formatMoney(entry.amount, entry.currency))).join('');
	return '<div class="dash-data-list">' + available + pending + reserved + '</div>';
}

function customerForm() {
	return '<form class="dash-form" data-form="customer-create">' +
		field('Name', 'name') +
		field('Email', 'email', 'email') +
		field('External ID', 'externalId') +
		field('Phone', 'phone') +
		'<div class="dash-form__wide"><button class="dash-button" data-kind="primary" type="submit">Create customer</button></div>' +
	'</form>';
}

function paymentForm() {
	return '<form class="dash-form" data-form="payment-create">' +
		field('Amount', 'amount', 'number') +
		field('Currency', 'currency', 'text', 'USD') +
		field('Description', 'description') +
		field('Customer email', 'customerEmail', 'email') +
		field('Customer ID', 'customerId') +
		field('Customer external ID', 'customerExternalId') +
		field('Customer name', 'customerName') +
		field('Success URL', 'successUrl') +
		field('Cancel URL', 'cancelUrl') +
		field('Return URL', 'returnUrl') +
		textareaField('Product IDs (one per line)', 'productIds') +
		'<div class="dash-form__wide"><button class="dash-button" data-kind="primary" type="submit">Create payment</button></div>' +
	'</form>';
}

function pixForm() {
	return '<form class="dash-form" data-form="pix-create">' +
		field('Amount', 'amount', 'number') +
		field('Currency', 'currency', 'text', 'BRL') +
		field('Description', 'description') +
		field('Customer email', 'customerEmail', 'email') +
		field('Customer ID', 'customerId') +
		field('Customer external ID', 'customerExternalId') +
		field('Customer name', 'customerName') +
		selectField('Amount includes IOF', 'amountIncludesIof', [
			['', 'Stripe default'],
			['never', 'Never'],
			['always', 'Always']
		]) +
		field('Expires after seconds', 'expiresAfterSeconds', 'number') +
		field('Expires at (ISO-8601)', 'expiresAt') +
		'<div class="dash-form__wide"><button class="dash-button" data-kind="primary" type="submit">Create PIX payment</button></div>' +
	'</form>';
}

function field(label, name, type = 'text', value = '') {
	return '<label>' + escapeHtml(label) + '<input name="' + escapeHtml(name) + '" type="' + escapeHtml(type) + '" value="' + escapeHtml(value) + '" /></label>';
}

function selectField(label, name, options) {
	return '<label>' + escapeHtml(label) + '<select name="' + escapeHtml(name) + '">' + options.map(([value, text]) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(text) + '</option>').join('') + '</select></label>';
}

function textareaField(label, name) {
	return '<label class="dash-form__wide">' + escapeHtml(label) + '<textarea rows="5" name="' + escapeHtml(name) + '"></textarea></label>';
}

function table(rows) {
	const [header, ...body] = rows;
	return '<table class="dash-table"><thead><tr>' + header.map((cell) => '<th>' + cell + '</th>').join('') + '</tr></thead><tbody>' + body.map((row) => '<tr>' + row.map((cell) => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}

function link(href, text) {
	return '<a href="' + escapeHtml(href) + '">' + escapeHtml(text) + '</a>';
}

function summaryPanel(resource) {
	return '<div class="dash-data-list">' + Object.entries(resource)
		.filter(([key]) => !['normalized', 'raw'].includes(key))
		.map(([key, value]) => dataLine(labelize(key), formatValue(value)))
		.join('') + '</div>';
}

function listRows(items) {
	return '<div class="dash-list">' + items.map((item) => '<article class="dash-row"><div><div class="dash-row__title">' + (item.href ? '<a href="' + escapeHtml(item.href) + '">' + escapeHtml(item.title) + '</a>' : escapeHtml(item.title)) + '</div><div class="dash-row__meta">' + escapeHtml(item.meta || '') + '</div></div></article>').join('') + '</div>';
}

function dataLine(label, value) {
	return '<div class="dash-row"><div><div class="dash-row__title">' + escapeHtml(String(label)) + '</div></div><div>' + value + '</div></div>';
}

function statusBadge(status) {
	const tone = /paid|processed|ready|success|active/.test(String(status)) ? 'success' : /failed|error|canceled/.test(String(status)) ? 'danger' : /pending|processing/.test(String(status)) ? 'warning' : 'default';
	return '<span class="dash-status" data-tone="' + tone + '">' + escapeHtml(String(status || 'unknown')) + '</span>';
}

async function api(path, init = {}) {
	const response = await fetch(config.basePath + '/api' + path, {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init.headers || {})
		}
	});
	const payload = await response.json();
	if (!response.ok) {
		throw new Error(payload.message || 'Request failed');
	}
	return payload;
}

async function mutate(path, init, onSuccess) {
	try {
		const payload = await api(path, init);
		onSuccess(payload);
	} catch (error) {
		notify(error.message || 'Request failed', true);
	}
}

function notify(message, isError = false) {
	toast.textContent = message;
	toast.dataset.visible = 'true';
	toast.style.borderColor = isError ? 'rgba(255, 127, 139, 0.28)' : 'rgba(116, 240, 194, 0.18)';
	setTimeout(() => {
		toast.dataset.visible = 'false';
	}, 2800);
}

function labelize(value) {
	return String(value)
		.replaceAll(/([a-z])([A-Z])/g, '$1 $2')
		.replaceAll(/_/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value) {
	if (value == null) return '<span class="dash-muted">Unknown</span>';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (typeof value === 'object') return '<span class="dash-muted">Object</span>';
	return escapeHtml(String(value));
}

function formatMoney(amount, currency) {
	if (amount == null || !currency) {
		return '<span class="dash-muted">Unknown</span>';
	}
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: String(currency).toUpperCase(),
		maximumFractionDigits: 2
	}).format(Number(amount) / 100);
}

function optional(value) {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function numericOptional(value) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function splitLines(value) {
	if (typeof value !== 'string') return undefined;
	const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
	return lines.length > 0 ? lines : undefined;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
`;

export function renderDashboardDocument(config: DashboardAssetConfig) {
	const currentPath = config.currentPath;
	const navigation = [
		['/', 'Overview'],
		['/customers', 'Customers'],
		['/payments', 'Payments'],
		['/pix', 'PIX'],
		['/subscriptions', 'Subscriptions'],
		['/webhooks', 'Webhooks'],
		['/providers', 'Providers'],
		['/database', 'Database'],
		['/plugins', 'Plugins'],
	]
		.map(([suffix, label]) => {
			const href = `${config.basePath}${suffix === '/' ? '' : suffix}`;
			const isActive =
				currentPath === href ||
				(suffix !== '/' && currentPath.startsWith(`${href}/`));
			return `<a href="${href}" data-active="${String(isActive)}"><span>${label}</span></a>`;
		})
		.join('');

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Paymesh Dashboard</title>
		<link rel="stylesheet" href="${config.basePath}/assets/app.css" />
	</head>
	<body>
		<div class="dash-shell">
			<aside class="dash-sidebar">
				<div class="dash-brand">
					<span class="dash-brand__label">Paymesh dash</span>
					<h1>Billing control</h1>
					<p>Provider-aware admin tooling on top of normalized Paymesh data.</p>
				</div>
				<nav class="dash-nav">${navigation}</nav>
			</aside>
			<main class="dash-main">
				<div data-app-root></div>
			</main>
		</div>
		<div class="dash-toast" data-toast></div>
		<script>window.__PAYMESH_DASH__ = ${serializeForScript(config)};</script>
		<script src="${config.basePath}/assets/app.js" type="module"></script>
	</body>
</html>`;
}
