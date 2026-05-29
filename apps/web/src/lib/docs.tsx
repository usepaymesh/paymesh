import type { Route } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { DocCodeBlock } from '../components/docs/doc-code-block';

export interface DocSection {
	id: string;
	title: string;
	content: ReactNode;
}

export interface DocPage {
	group: string;
	slug: string[];
	title: string;
	description: string;
	status?: 'available' | 'coming-soon';
	sections: DocSection[];
}

export interface DocNavGroup {
	title: string;
	items: {
		label: string;
		slug: string[];
		status?: 'available' | 'coming-soon';
	}[];
}

function InlineCode({ children }: { children: ReactNode }) {
	return (
		<code className="rounded-sm border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[13px] text-white/90">
			{children}
		</code>
	);
}

function Paragraph({ children }: { children: ReactNode }) {
	return (
		<p className="text-[15px] leading-8 text-white/72 sm:text-[16px]">
			{children}
		</p>
	);
}

function BulletList({ children }: { children: ReactNode }) {
	return (
		<ul className="space-y-2 pl-5 text-[15px] leading-8 text-white/72 marker:text-white/25 sm:text-[16px]">
			{children}
		</ul>
	);
}

function OrderedList({ children }: { children: ReactNode }) {
	return (
		<ol className="space-y-2 pl-5 text-[15px] leading-8 text-white/72 marker:text-white/32 sm:text-[16px]">
			{children}
		</ol>
	);
}

function Callout({
	title,
	children,
	tone = 'default',
}: {
	title: string;
	children: ReactNode;
	tone?: 'default' | 'soon';
}) {
	return (
		<div
			className={`rounded-md border px-4 py-3 ${
				tone === 'soon'
					? 'border-amber-500/20 bg-amber-500/[0.06]'
					: 'border-white/[0.08] bg-white/[0.03]'
			}`}
		>
			<div className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45">
				{title}
			</div>
			<div className="text-[14px] leading-7 text-white/72">{children}</div>
		</div>
	);
}

function DocTable({
	headers,
	rows,
}: {
	headers: ReactNode[];
	rows: ReactNode[][];
}) {
	return (
		<div className="overflow-hidden rounded-md border border-white/[0.08]">
			<table className="w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-white/[0.08] bg-white/[0.03]">
						{headers.map((header) => (
							<th
								className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/50"
								key={`header-${getNodeKey(header, 'value')}`}
							>
								{header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const rowKey = getRowKey(row);

						return (
							<tr
								className={
									row !== rows.at(-1) ? 'border-b border-white/[0.06]' : ''
								}
								key={rowKey}
							>
								{row.map((cell) => (
									<td
										className="align-top px-4 py-3 text-[15px] leading-7 text-white/72"
										key={`${rowKey}-${getNodeKey(cell, 'value')}`}
									>
										{cell}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function StatusPill({
	children,
	tone = 'default',
}: {
	children: ReactNode;
	tone?: 'default' | 'soon' | 'success';
}) {
	const className =
		tone === 'soon'
			? 'border-amber-500/18 bg-amber-500/[0.06] text-amber-200/80'
			: tone === 'success'
				? 'border-emerald-500/18 bg-emerald-500/[0.06] text-emerald-200/80'
				: 'border-white/[0.08] bg-white/[0.04] text-white/72';

	return (
		<span
			className={`inline-flex rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${className}`}
		>
			{children}
		</span>
	);
}

function normalizeKeyPart(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function getNodeKey(node: ReactNode, fallback: string): string {
	if (
		typeof node === 'string' ||
		typeof node === 'number' ||
		typeof node === 'bigint'
	) {
		return normalizeKeyPart(String(node)) || fallback;
	}

	if (Array.isArray(node)) {
		const nested: string = node
			.map((child) => getNodeKey(child, 'node'))
			.filter(Boolean)
			.join('-');

		return nested || fallback;
	}

	if (isValidElement(node)) {
		if (node.key != null) {
			return normalizeKeyPart(String(node.key)) || fallback;
		}

		const element = node as ReactElement<{ children?: ReactNode }>;
		return getNodeKey(element.props.children, fallback);
	}

	return fallback;
}

function getRowKey(row: ReactNode[]): string {
	return (
		row
			.map((cell) => getNodeKey(cell, 'cell'))
			.filter(Boolean)
			.join('__') || 'row'
	);
}

const installSnippet = `bun add paymesh @paymesh/stripe @paymesh/next

# or
pnpm add paymesh @paymesh/stripe @paymesh/next

# or
npm install paymesh @paymesh/stripe @paymesh/next`;

const clientSnippet = `import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

export const client = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});`;

const clientOptionsSnippet = `import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

export const client = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  timeout: 10_000,
  retry: {
    max: 2,
    delay: ({ attempt }) => (attempt + 1) * 250,
  },
  hooks: {
    async onPaymentSucceeded(event) {
      console.log(event.id, event.data.amount);
    },
  },
});`;

const paymentSnippet = `const payment = await client.payments.create({
  amount: 1490,
  currency: "USD",
  description: "Starter plan",
  customer: {
    email: "alice@paymesh.dev",
    name: "Alice",
  },
  successUrl: "https://app.paymesh.dev/success",
  cancelUrl: "https://app.paymesh.dev/cancel",
});`;

const customerSnippet = `const customer = await client.customers.create({
  email: "alice@paymesh.dev",
  name: "Alice",
  metadata: {
    teamId: "team_123",
  },
});

const fetched = await client.customers.get(customer.id);

const updated = await client.customers.update(fetched.id, {
  name: "Alice Johnson",
});

await client.customers.delete(updated.id);`;

const paymentCreateShapeSnippet = `type PaymentCreateData = {
  amount: number;
  currency: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    document?: string;
    phone?: string;
  };
  description?: string;
  metadata?: Record<string, string | number | boolean | null>;
  successUrl?: string;
  cancelUrl?: string;
  returnUrl?: string;
};`;

const customerShapeSnippet = `type CustomerCreateData = {
  name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type CustomerUpdateData = CustomerCreateData;`;

const envTypingSnippet = `declare global {
  namespace NodeJS {
    interface ProcessEnv {
      STRIPE_API_KEY: string;
      STRIPE_WEBHOOK_SECRET?: string;
    }
  }
}

export {};`;

const rawSnippet = `const rawClient = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
  }),
  includeRaw: true,
});

const payment = await rawClient.payments.create({
  amount: 2000,
  currency: "USD",
});

payment.raw; // provider payload`;

const nextWebhookSnippet = `import { Webhooks } from "@paymesh/next";

export const POST = Webhooks({
  client,

  async onPaymentSucceeded(event) {
    console.log("payment.succeeded", event.id);
  },

  async onCustomerUpdated(event) {
    console.log("customer.updated", event.data.id);
  },
});`;

const expressWebhookSnippet = `import express from "express";
import { createClient } from "paymesh";
import { Webhooks } from "@paymesh/express";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

const app = express();

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  Webhooks({
    client,
    async onPaymentFailed(event) {
      console.log("payment.failed", event.id);
    },
  }),
);`;

const providerSnippet = `import { defineProvider } from "paymesh";

export const customProvider = defineProvider({
  id: "custom",
  capabilities: {
    checkout: true,
    customers: true,
    webhooks: true,
  },
  payments: {
    async create(data, options) {
      return {
        id: "pay_123",
        provider: "custom",
        amount: data.amount,
        currency: data.currency,
        status: "pending",
        raw: options?.includeRaw ? { upstream: true } : null,
      };
    },
  },
  customers: {
    async create() {
      throw new Error("implement me");
    },
    async get() {
      throw new Error("implement me");
    },
    async update() {
      throw new Error("implement me");
    },
    async delete() {
      throw new Error("implement me");
    },
  },
});`;

const stripeSetupSnippet = `import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

export const client = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});`;

const docsNavigation: DocNavGroup[] = [
	{
		title: 'Get Started',
		items: [
			{ label: 'Introduction', slug: ['introduction'] },
			{ label: 'Installation', slug: ['installation'] },
			{ label: 'Basic Usage', slug: ['basic-usage'] },
			{ label: 'Comparison', slug: ['comparison'] },
		],
	},
	{
		title: 'Concepts',
		items: [
			{ label: 'API', slug: ['concepts', 'api'] },
			{ label: 'Client', slug: ['concepts', 'client'] },
			{ label: 'TypeScript', slug: ['concepts', 'typescript'] },
			{ label: 'Hooks', slug: ['concepts', 'hooks'] },
			{ label: 'Customers', slug: ['concepts', 'customers'] },
			{ label: 'Payment Providers', slug: ['concepts', 'payment-providers'] },
		],
	},
	{
		title: 'Providers',
		items: [
			{ label: 'Stripe', slug: ['providers', 'stripe'] },
			{ label: 'Polar', slug: ['providers', 'polar'], status: 'coming-soon' },
			{
				label: 'AbacatePay',
				slug: ['providers', 'abacatepay'],
				status: 'coming-soon',
			},
			{ label: 'PayPal', slug: ['providers', 'paypal'], status: 'coming-soon' },
			{ label: 'Dodo', slug: ['providers', 'dodo'], status: 'coming-soon' },
		],
	},
	{
		title: 'Plugins',
		items: [{ label: 'Coming Soon', slug: ['plugins'], status: 'coming-soon' }],
	},
];

const hookRows: ReactNode[][] = [
	[
		<InlineCode key="hp1">onPaymentCreated</InlineCode>,
		'payment.created',
		'Normalized payment creation event.',
	],
	[
		<InlineCode key="hp2">onPaymentSucceeded</InlineCode>,
		'payment.succeeded',
		'Successful payment completion.',
	],
	[
		<InlineCode key="hp3">onPaymentFailed</InlineCode>,
		'payment.failed',
		'Failed payment attempt.',
	],
	[
		<InlineCode key="hp4">onPaymentCanceled</InlineCode>,
		'payment.canceled',
		'Canceled or expired payment flow.',
	],
	[
		<InlineCode key="hp5">onPaymentRefunded</InlineCode>,
		'payment.refunded',
		'Refund event mapped from provider payloads.',
	],
	[
		<InlineCode key="hc1">onCustomerCreated</InlineCode>,
		'customer.created',
		'Customer was created upstream.',
	],
	[
		<InlineCode key="hc2">onCustomerUpdated</InlineCode>,
		'customer.updated',
		'Customer attributes changed upstream.',
	],
	[
		<InlineCode key="hc3">onCustomerDeleted</InlineCode>,
		'customer.deleted',
		'Customer was deleted upstream.',
	],
	[
		<InlineCode key="hs1">onSubscriptionCreated</InlineCode>,
		'subscription.created',
		'Reserved normalized hook for subscription providers.',
	],
	[
		<InlineCode key="hs2">onSubscriptionUpdated</InlineCode>,
		'subscription.updated',
		'Reserved normalized hook for subscription providers.',
	],
	[
		<InlineCode key="hs3">onSubscriptionCanceled</InlineCode>,
		'subscription.canceled',
		'Reserved normalized hook for subscription providers.',
	],
	[
		<InlineCode key="hh1">onCheckoutCompleted</InlineCode>,
		'checkout.completed',
		'Completed checkout session event.',
	],
];

const errorRows: ReactNode[][] = [
	['provider_error', 'Provider responded with a non-successful HTTP status.'],
	[
		'unsupported_capability',
		'Client attempted a flow the current provider does not advertise.',
	],
	['invalid_webhook_signature', 'Webhook signature validation failed.'],
	[
		'webhook_parse_error',
		'Payload could not be parsed into a provider object.',
	],
	[
		'webhook_mapping_error',
		'Provider payload could not be normalized into a Paymesh event.',
	],
	[
		'hook_error',
		'A user-defined hook threw while handling a normalized event.',
	],
	['network_error', 'The underlying fetch failed before getting a response.'],
	['timeout', 'The request exceeded the configured timeout.'],
];

const capabilityRows: ReactNode[][] = [
	[
		<InlineCode key="cap-checkout">checkout</InlineCode>,
		'Create a payment or checkout flow.',
	],
	[
		<InlineCode key="cap-customers">customers</InlineCode>,
		'Create, fetch, update, and delete customers.',
	],
	[
		<InlineCode key="cap-webhooks">webhooks</InlineCode>,
		'Verify, parse, map, and dispatch webhook events.',
	],
	[
		<InlineCode key="cap-refunds">refunds</InlineCode>,
		'Advertise refund support at provider level.',
	],
	[
		<InlineCode key="cap-subs">subscriptions</InlineCode>,
		'Advertise subscription capability.',
	],
	[
		<InlineCode key="cap-portal">customerPortal</InlineCode>,
		'Advertise customer portal capability.',
	],
	[
		<InlineCode key="cap-coupons">coupons</InlineCode>,
		'Advertise coupon capability.',
	],
	[
		<InlineCode key="cap-pix">pix</InlineCode>,
		'Advertise PIX or equivalent local payment rail support.',
	],
];

const stripeCapabilityRows: ReactNode[][] = [
	[
		<InlineCode key="str-cap1">checkout</InlineCode>,
		<StatusPill key="s1" tone="success">
			Available
		</StatusPill>,
		'Creates Stripe Checkout Sessions via /v1/checkout/sessions.',
	],
	[
		<InlineCode key="str-cap2">customers</InlineCode>,
		<StatusPill key="s2" tone="success">
			Available
		</StatusPill>,
		'Create, get, update, and delete Stripe customers.',
	],
	[
		<InlineCode key="str-cap3">webhooks</InlineCode>,
		<StatusPill key="s3" tone="success">
			Available
		</StatusPill>,
		'Verifies stripe-signature, parses JSON, maps normalized events.',
	],
	[
		<InlineCode key="str-cap4">refunds</InlineCode>,
		<StatusPill key="s4" tone="success">
			Advertised
		</StatusPill>,
		'Refund events are mapped from Stripe webhook payloads.',
	],
	[
		<InlineCode key="str-cap5">subscriptions</InlineCode>,
		<StatusPill key="s5" tone="success">
			Advertised
		</StatusPill>,
		'Capability is declared for provider-level expansion.',
	],
	[
		<InlineCode key="str-cap6">customerPortal</InlineCode>,
		<StatusPill key="s6" tone="success">
			Advertised
		</StatusPill>,
		'Capability is declared even though the core client does not yet expose portal helpers.',
	],
	[
		<InlineCode key="str-cap7">coupons</InlineCode>,
		<StatusPill key="s7" tone="success">
			Advertised
		</StatusPill>,
		'Capability is declared for future surface expansion.',
	],
	[
		<InlineCode key="str-cap8">pix</InlineCode>,
		<StatusPill key="s8" tone="default">
			False
		</StatusPill>,
		'Stripe provider currently marks PIX as unsupported.',
	],
];

const stripeEventRows: ReactNode[][] = [
	['payment_intent.created', 'payment.created', 'onPaymentCreated'],
	['payment_intent.succeeded', 'payment.succeeded', 'onPaymentSucceeded'],
	['payment_intent.payment_failed', 'payment.failed', 'onPaymentFailed'],
	['payment_intent.canceled', 'payment.canceled', 'onPaymentCanceled'],
	['charge.refunded', 'payment.refunded', 'onPaymentRefunded'],
	['checkout.session.completed', 'checkout.completed', 'onCheckoutCompleted'],
	['checkout.session.expired', 'payment.canceled', 'onPaymentCanceled'],
	['customer.created', 'customer.created', 'onCustomerCreated'],
	['customer.updated', 'customer.updated', 'onCustomerUpdated'],
	['customer.deleted', 'customer.deleted', 'onCustomerDeleted'],
];

const docsPages: DocPage[] = [
	{
		group: 'Get Started',
		slug: ['introduction'],
		title: 'Introduction',
		description:
			'Paymesh is provider-agnostic payments infrastructure for TypeScript teams that need one client surface across multiple gateways without scattering vendor logic across the app.',
		sections: [
			{
				id: 'overview',
				title: 'Overview',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Paymesh gives you a normalized client for payments, customers, and
							webhooks so application code does not have to know whether the
							upstream provider is Stripe today or something else tomorrow.
						</Paragraph>
						<Paragraph>
							The core boundary is deliberate: your product code talks to{' '}
							<InlineCode>createClient()</InlineCode>,{' '}
							<InlineCode>client.payments</InlineCode>,{' '}
							<InlineCode>client.customers</InlineCode>, and framework webhook
							adapters. Provider-specific request construction, signature
							verification, and event mapping stay inside adapters.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'what-you-get',
				title: 'What You Get',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>
								A small TypeScript-first client surface instead of bespoke
								provider SDK usage everywhere.
							</li>
							<li>
								Framework-native webhook adapters for Next.js, Express, Fastify,
								Hono, and Elysia.
							</li>
							<li>
								Capability assertions so unsupported flows fail explicitly and
								early.
							</li>
							<li>
								Optional raw payload access for teams that still need
								provider-specific escape hatches.
							</li>
							<li>
								A path to multi-provider support without rewriting product-level
								flows.
							</li>
						</BulletList>
						<Callout title="Current scope">
							Today the repo ships the core client, Stripe provider, and webhook
							adapters. The docs below distinguish between what already exists
							and what is on the roadmap.
						</Callout>
					</div>
				),
			},
			{
				id: 'architecture',
				title: 'Architecture',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Layer', 'Role']}
							rows={[
								[
									'paymesh',
									'Core client, shared request handling, provider contract, and normalized types.',
								],
								[
									'@paymesh/stripe',
									'Provider implementation for payments, customers, and webhook mapping.',
								],
								[
									'@paymesh/next / express / hono / fastify / elysia',
									'Framework-specific webhook adapters that validate, parse, map, and dispatch hooks.',
								],
							]}
						/>
						<Paragraph>
							If you are deciding where code should live, the rule is simple:
							business logic belongs in your app, transport and vendor details
							belong in provider/adaptor packages.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Get Started',
		slug: ['installation'],
		title: 'Installation',
		description:
			'Install the core client, choose a provider, add the framework adapter you need, and wire the environment the provider expects.',
		sections: [
			{
				id: 'choose-packages',
				title: 'Choose Packages',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Paymesh is split into a core package plus provider and framework
							adapter packages. Most applications need exactly three pieces: the
							core client, one provider, and one webhook adapter.
						</Paragraph>
						<DocTable
							headers={['Package', 'Use When']}
							rows={[
								[
									<InlineCode key="pkg-core">paymesh</InlineCode>,
									'Always. This is the core client and provider contract.',
								],
								[
									<InlineCode key="pkg-stripe">@paymesh/stripe</InlineCode>,
									'You are using Stripe as the upstream payment provider.',
								],
								[
									<InlineCode key="pkg-next">@paymesh/next</InlineCode>,
									'Your webhook endpoint runs in a Next.js App Router route.',
								],
								[
									<InlineCode key="pkg-express">@paymesh/express</InlineCode>,
									'Your webhook endpoint runs in Express.',
								],
								[
									<InlineCode key="pkg-hono">@paymesh/hono</InlineCode>,
									'Your webhook endpoint runs in Hono.',
								],
								[
									<InlineCode key="pkg-fastify">@paymesh/fastify</InlineCode>,
									'Your webhook endpoint runs in Fastify.',
								],
								[
									<InlineCode key="pkg-elysia">@paymesh/elysia</InlineCode>,
									'Your webhook endpoint runs in Elysia.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'install',
				title: 'Install',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={installSnippet}
							filename="terminal"
							lang="bash"
						/>
						<Paragraph>
							The docs use Stripe because it is the first shipped provider in
							this repo. Future provider pages keep the same shape so the setup
							process remains familiar.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'environment',
				title: 'Environment Variables',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Variable', 'Required', 'Used By']}
							rows={[
								[
									<InlineCode key="env-key">STRIPE_API_KEY</InlineCode>,
									<StatusPill key="req-key" tone="success">
										Yes
									</StatusPill>,
									'Default secret used by stripe() for authenticated API calls.',
								],
								[
									<InlineCode key="env-webhook">
										STRIPE_WEBHOOK_SECRET
									</InlineCode>,
									<StatusPill key="req-wh" tone="success">
										For webhooks
									</StatusPill>,
									'Used by Stripe webhook verification to validate stripe-signature.',
								],
							]}
						/>
						<Callout title="Accuracy matters">
							The current Stripe provider reads{' '}
							<InlineCode>STRIPE_API_KEY</InlineCode> by default, not{' '}
							<InlineCode>STRIPE_SECRET_KEY</InlineCode>. The docs here follow
							the implementation in this repo.
						</Callout>
					</div>
				),
			},
			{
				id: 'first-wire',
				title: 'First Wiring Steps',
				content: (
					<div className="space-y-4">
						<OrderedList>
							<li>
								Create a shared client module that constructs{' '}
								<InlineCode>createClient()</InlineCode> once.
							</li>
							<li>
								Point it at a provider package, starting with Stripe if you are
								following the live docs.
							</li>
							<li>
								Use the client in payment and customer flows instead of calling
								provider SDKs directly.
							</li>
							<li>
								Add a framework webhook route using the adapter package that
								matches your server runtime.
							</li>
						</OrderedList>
					</div>
				),
			},
		],
	},
	{
		group: 'Get Started',
		slug: ['basic-usage'],
		title: 'Basic Usage',
		description:
			'Create one client, then build payment creation, customer operations, and webhook handling on top of that shared surface.',
		sections: [
			{
				id: 'create-client',
				title: 'Create the Client Once',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The client is the integration boundary. If you ever swap
							providers, the goal is to do it here instead of across the rest of
							the codebase.
						</Paragraph>
						<DocCodeBlock code={clientSnippet} filename="src/lib/paymesh.ts" />
					</div>
				),
			},
			{
				id: 'create-payment',
				title: 'Create a Payment',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The first live payment API exposed by the core client is{' '}
							<InlineCode>client.payments.create()</InlineCode>. The returned
							object is normalized so downstream code sees a stable shape.
						</Paragraph>
						<DocCodeBlock
							code={paymentSnippet}
							filename="src/server/payments.ts"
						/>
						<Callout title="What comes back">
							A payment includes normalized fields such as{' '}
							<InlineCode>id</InlineCode>, <InlineCode>provider</InlineCode>,{' '}
							<InlineCode>amount</InlineCode>, <InlineCode>currency</InlineCode>
							, <InlineCode>status</InlineCode>, optional{' '}
							<InlineCode>checkoutUrl</InlineCode>, optional{' '}
							<InlineCode>customer</InlineCode>, and optional metadata.
						</Callout>
					</div>
				),
			},
			{
				id: 'customers',
				title: 'Work with Customers',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Customers are part of the same client so identity and billing
							state stay inside one integration boundary.
						</Paragraph>
						<DocCodeBlock
							code={customerSnippet}
							filename="src/server/customers.ts"
						/>
					</div>
				),
			},
			{
				id: 'webhooks',
				title: 'Handle Webhooks in Next.js',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Next.js adapter handles signature verification, JSON parsing,
							event normalization, and hook dispatch. Your route only defines
							what to do with the normalized event.
						</Paragraph>
						<DocCodeBlock
							code={nextWebhookSnippet}
							filename="app/api/webhooks/stripe/route.ts"
						/>
					</div>
				),
			},
			{
				id: 'raw',
				title: 'Opt Into Raw Payloads',
				content: (
					<div className="space-y-4">
						<Paragraph>
							When you need provider-specific data during a migration or edge
							case, use <InlineCode>includeRaw</InlineCode> globally or per
							call.
						</Paragraph>
						<DocCodeBlock code={rawSnippet} filename="src/server/raw.ts" />
					</div>
				),
			},
		],
	},
	{
		group: 'Get Started',
		slug: ['comparison'],
		title: 'Comparison',
		description:
			'Paymesh sits between direct provider SDK usage and a full payments platform. It is an infrastructure layer, not a merchant-of-record product.',
		sections: [
			{
				id: 'approaches',
				title: 'Approaches Compared',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Approach', 'Good At', 'Tradeoff']}
							rows={[
								[
									'Direct provider SDKs',
									'Immediate access to every provider-specific feature.',
									'Application logic becomes tightly coupled to each provider.',
								],
								[
									'Thin internal wrappers',
									'Fast to bootstrap for one provider and one team.',
									'Usually drift into undocumented conventions and uneven abstractions.',
								],
								[
									'Paymesh',
									'Stable TypeScript surface, normalized events, framework adapters.',
									'You work through the abstractions that the client currently exposes.',
								],
								[
									'Merchant-of-record platforms',
									'Tax, billing ops, and compliance handled by the platform.',
									'Less control over the exact payment stack and product integration surface.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'fit',
				title: 'When Paymesh Fits',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>
								You expect to support more than one payment provider over the
								lifetime of the product.
							</li>
							<li>
								You want framework-native webhook handlers instead of rebuilding
								verification logic yourself.
							</li>
							<li>
								You care about keeping payment operations behind a single
								TypeScript client boundary.
							</li>
							<li>
								You want a lower-level infrastructure toolkit, not a hosted
								merchant-of-record opinion.
							</li>
						</BulletList>
					</div>
				),
			},
			{
				id: 'non-goals',
				title: 'What Paymesh Is Not',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>Not a pricing page builder.</li>
							<li>Not a merchant-of-record layer.</li>
							<li>
								Not a full subscription catalog or entitlements system today.
							</li>
							<li>
								Not a replacement for all provider-specific features if you
								still need direct escape hatches.
							</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'api'],
		title: 'API',
		description:
			'The public API is intentionally small: a client factory, a provider contract, normalized models, optional raw payload access, and framework adapters.',
		sections: [
			{
				id: 'surface',
				title: 'Client Surface',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The core package exports <InlineCode>createClient</InlineCode>,{' '}
							<InlineCode>defineProvider</InlineCode>,{' '}
							<InlineCode>request</InlineCode>, <InlineCode>withRaw</InlineCode>
							, and the core types and errors.
						</Paragraph>
						<DocTable
							headers={['API', 'Purpose']}
							rows={[
								[
									<InlineCode key="api-1">createClient()</InlineCode>,
									'Construct a normalized payments client for one provider instance.',
								],
								[
									<InlineCode key="api-2">defineProvider()</InlineCode>,
									'Create a provider implementation that satisfies the Paymesh contract.',
								],
								[
									<InlineCode key="api-3">withRaw()</InlineCode>,
									'Attach raw provider payloads when includeRaw is enabled.',
								],
								[
									<InlineCode key="api-4">request()</InlineCode>,
									'Shared HTTP request helper with timeout and retry behavior.',
								],
								[
									<InlineCode key="api-5">PaymeshError</InlineCode>,
									'Normalized error class emitted by the core and adapters.',
								],
							]}
						/>
						<DocCodeBlock
							code={`const client = createClient({ provider });

await client.payments.create({
  amount: 1490,
  currency: "USD",
});

await client.customers.get("cus_123");`}
							filename="src/server/api-surface.ts"
						/>
					</div>
				),
			},
			{
				id: 'normalized-models',
				title: 'Normalized Models',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Model', 'Key Fields']}
							rows={[
								[
									<InlineCode key="model-payment">Payment</InlineCode>,
									'id, provider, amount, currency, status, checkoutUrl, customer, metadata, raw',
								],
								[
									<InlineCode key="model-customer">Customer</InlineCode>,
									'id, provider, name, email, phone, metadata, raw',
								],
								[
									<InlineCode key="model-event">PaymeshEvent</InlineCode>,
									'id, type, provider, data, raw',
								],
							]}
						/>
						<DocCodeBlock
							code={paymentCreateShapeSnippet}
							filename="payment-create-data.ts"
						/>
						<Paragraph>
							Those shapes are what make provider swapping feasible. App-level
							code consumes normalized objects while provider packages handle
							the vendor payload translation.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'errors',
				title: 'Error Model',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The core wraps network and provider failures in{' '}
							<InlineCode>PaymeshError</InlineCode>. That gives application code
							a stable error surface instead of provider-specific exception
							shapes.
						</Paragraph>
						<DocTable headers={['Code', 'Meaning']} rows={errorRows} />
					</div>
				),
			},
			{
				id: 'capability-assertions',
				title: 'Capability Assertions',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The client checks provider capabilities before calling provider
							methods. For example, if a provider declares{' '}
							<InlineCode>checkout: false</InlineCode>,{' '}
							<InlineCode>client.payments.create()</InlineCode> throws an{' '}
							<InlineCode>unsupported_capability</InlineCode> error instead of
							failing later in the stack.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'client'],
		title: 'Client',
		description:
			'The client owns provider configuration, shared request defaults, optional hook registration, and raw payload behavior.',
		sections: [
			{
				id: 'constructing',
				title: 'Constructing the Client',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={clientOptionsSnippet}
							filename="src/lib/paymesh.ts"
						/>
						<Paragraph>
							The client does not own stateful billing data. It owns integration
							configuration and behavior defaults that should be reused across
							calls.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'client-options',
				title: 'ClientOptions',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="opt-provider">provider</InlineCode>,
									'Required provider instance created by a package like @paymesh/stripe.',
								],
								[
									<InlineCode key="opt-base">baseUrl</InlineCode>,
									'Override the provider base URL, useful in tests or mocks.',
								],
								[
									<InlineCode key="opt-timeout">timeout</InlineCode>,
									'Request timeout in milliseconds. Defaults to 10_000 inside request().',
								],
								[
									<InlineCode key="opt-retry">retry</InlineCode>,
									'Retry policy with max attempts and optional delay callback.',
								],
								[
									<InlineCode key="opt-fetch">fetch</InlineCode>,
									'Inject a custom fetch implementation.',
								],
								[
									<InlineCode key="opt-logger">logger</InlineCode>,
									'Typed logger option reserved for instrumentation-oriented integrations around the client.',
								],
								[
									<InlineCode key="opt-raw">includeRaw</InlineCode>,
									'Enable raw provider payloads on normalized return values.',
								],
								[
									<InlineCode key="opt-hooks">hooks</InlineCode>,
									'Register normalized event handlers at the client level.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'request-merging',
				title: 'Per-call Request Options',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Per-call request options are merged onto client defaults. This is
							how you override timeout, retry, or includeRaw for a specific call
							without constructing a second client.
						</Paragraph>
						<DocCodeBlock
							code={`const payment = await client.payments.create(
  {
    amount: 1490,
    currency: "USD",
  },
  {
    timeout: 5_000,
    includeRaw: true,
  },
);`}
							filename="src/server/request-options.ts"
						/>
					</div>
				),
			},
			{
				id: 'raw-behavior',
				title: 'Raw Payload Behavior',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Without raw mode, normalized objects expose{' '}
							<InlineCode>raw: null</InlineCode>. With raw mode enabled globally
							or per call, the same object includes the provider payload
							instead.
						</Paragraph>
						<DocCodeBlock code={rawSnippet} filename="src/server/raw.ts" />
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'typescript'],
		title: 'TypeScript',
		description:
			'Paymesh is built so the TypeScript surface stays stable while providers remain swappable underneath it.',
		sections: [
			{
				id: 'compiler-config',
				title: 'Compiler Configuration',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Use strict settings. Payment infrastructure is the wrong place to
							leave unchecked environment or data shape assumptions.
						</Paragraph>
						<DocCodeBlock
							code={`{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "Bundler",
    "types": ["node"],
    "target": "ES2022"
  }
}`}
							filename="tsconfig.json"
							lang="json"
						/>
					</div>
				),
			},
			{
				id: 'type-inference',
				title: 'Type Inference',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The client surface is generic over provider and raw-payload mode.
							That means calls infer whether <InlineCode>raw</InlineCode> is{' '}
							<InlineCode>null</InlineCode> or an unknown provider object.
						</Paragraph>
						<DocCodeBlock
							code={`const defaultClient = createClient({ provider });
const rawClient = createClient({ provider, includeRaw: true });

const payment = await defaultClient.payments.create({
  amount: 1200,
  currency: "USD",
});

payment.raw; // null

const rawPayment = await rawClient.payments.create({
  amount: 1200,
  currency: "USD",
});

rawPayment.raw; // provider payload`}
							filename="src/server/types.ts"
						/>
					</div>
				),
			},
			{
				id: 'env-typing',
				title: 'Environment Typing',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Prefer validating environment at the application edge. The docs
							use the non-null assertion in snippets for brevity, but production
							apps should fail with a clear configuration error before payment
							code executes.
						</Paragraph>
						<DocCodeBlock code={envTypingSnippet} filename="env.d.ts" />
					</div>
				),
			},
			{
				id: 'import-boundaries',
				title: 'Import Boundaries',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>Import provider packages only in integration modules.</li>
							<li>
								Keep the rest of the app importing your shared client module.
							</li>
							<li>
								Use normalized hook names in app code, not provider event names.
							</li>
							<li>
								Avoid leaking raw payload types into feature code unless you
								explicitly opt into them.
							</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'hooks'],
		title: 'Hooks',
		description:
			'Webhook handlers operate on normalized Paymesh events, not provider-native payload names, so application code stays stable across providers.',
		sections: [
			{
				id: 'available',
				title: 'Available Hooks',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Hook', 'Event Type', 'Meaning']}
							rows={hookRows}
						/>
					</div>
				),
			},
			{
				id: 'adapter-flow',
				title: 'What the Framework Adapter Does',
				content: (
					<div className="space-y-4">
						<OrderedList>
							<li>Assert that the provider actually supports webhooks.</li>
							<li>Clone the incoming request and verify its signature.</li>
							<li>Parse the request body into a provider payload.</li>
							<li>
								Map that payload into a normalized{' '}
								<InlineCode>PaymeshEvent</InlineCode>.
							</li>
							<li>
								Resolve the matching hook name from the normalized event type.
							</li>
							<li>
								Run route-level hook overrides first, then fall back to
								client-level hooks.
							</li>
						</OrderedList>
						<DocCodeBlock
							code={nextWebhookSnippet}
							filename="app/api/webhooks/stripe/route.ts"
						/>
					</div>
				),
			},
			{
				id: 'route-vs-client',
				title: 'Route Hooks vs Client Hooks',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Framework adapters accept hooks inline. Those hooks override any
							hooks registered on the client itself. This makes it possible to
							keep global behavior in the shared client while specializing per
							route when necessary.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'express-example',
				title: 'Express Example',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Express adapter exposes the same normalized hook contract, but
							through an Express middleware signature. Preserve the raw request
							body so signature verification can recreate the provider payload
							exactly.
						</Paragraph>
						<DocCodeBlock
							code={expressWebhookSnippet}
							filename="src/server/webhooks/stripe.ts"
						/>
					</div>
				),
			},
			{
				id: 'failure-modes',
				title: 'Failure Modes',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Failure', 'Response']}
							rows={[
								[
									'Signature verification fails',
									'401 invalid_webhook_signature',
								],
								['Payload parsing throws', '400 webhook_parse_error'],
								['Mapping throws', '400 webhook_mapping_error'],
								['User hook throws', '500 hook_error'],
							]}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'customers'],
		title: 'Customers',
		description:
			'Customers are normalized alongside payments so identity, billing metadata, and webhook events use one consistent object model.',
		sections: [
			{
				id: 'crud',
				title: 'CRUD Surface',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={customerSnippet}
							filename="src/server/customers.ts"
						/>
						<Paragraph>
							The client currently exposes create, get, update, and delete for
							customers. Those methods map to provider operations while keeping
							the response shape normalized.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'shape',
				title: 'Normalized Customer Shape',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Field', 'Meaning']}
							rows={[
								[
									<InlineCode key="cust-id">id</InlineCode>,
									'Provider customer identifier.',
								],
								[
									<InlineCode key="cust-provider">provider</InlineCode>,
									'Provider id such as stripe.',
								],
								[
									<InlineCode key="cust-name">name</InlineCode>,
									'Optional customer name.',
								],
								[
									<InlineCode key="cust-email">email</InlineCode>,
									'Optional email address.',
								],
								[
									<InlineCode key="cust-phone">phone</InlineCode>,
									'Optional phone number.',
								],
								[
									<InlineCode key="cust-meta">metadata</InlineCode>,
									'Optional normalized metadata bag.',
								],
								[
									<InlineCode key="cust-raw">raw</InlineCode>,
									'Provider payload when raw mode is enabled, otherwise null.',
								],
							]}
						/>
						<DocCodeBlock
							code={customerShapeSnippet}
							filename="customer-data.ts"
						/>
					</div>
				),
			},
			{
				id: 'delete',
				title: 'Delete Semantics',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Delete returns a normalized delete result instead of a full
							customer object. That shape is{' '}
							<InlineCode>{'{ id, provider, deleted, raw }'}</InlineCode>.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'raw',
				title: 'Raw Customer Payloads',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The same includeRaw rules apply here. If you need the full Stripe
							customer object during migration, opt in per call instead of
							leaking that requirement everywhere.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'payment-providers'],
		title: 'Payment Providers',
		description:
			'Providers are the adapter boundary between Paymesh’s normalized client surface and the vendor-specific API underneath it.',
		sections: [
			{
				id: 'provider-contract',
				title: 'Provider Contract',
				content: (
					<div className="space-y-4">
						<Paragraph>
							A provider implements payments, customers, optional webhooks, and
							a capabilities map. That contract is what lets application code
							stay stable while vendors vary underneath it.
						</Paragraph>
						<DocCodeBlock
							code={providerSnippet}
							filename="src/providers/custom.ts"
						/>
					</div>
				),
			},
			{
				id: 'capabilities',
				title: 'Capabilities',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Capability', 'Meaning']}
							rows={capabilityRows}
						/>
						<Callout title="Important nuance">
							The provider may advertise capabilities that the current core
							client surface does not yet expose as dedicated helpers. The
							capabilities map is still useful for roadmap and adapter behavior.
						</Callout>
					</div>
				),
			},
			{
				id: 'roadmap',
				title: 'Current Provider Status',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Provider', 'Status', 'Notes']}
							rows={[
								[
									'Stripe',
									<StatusPill key="ps1" tone="success">
										Available
									</StatusPill>,
									'Live provider package in this repo.',
								],
								[
									'Polar',
									<StatusPill key="ps2" tone="soon">
										Coming Soon
									</StatusPill>,
									'Planned merchant-of-record style integration.',
								],
								[
									'AbacatePay',
									<StatusPill key="ps3" tone="soon">
										Coming Soon
									</StatusPill>,
									'Planned Brazil-first local rails support.',
								],
								[
									'PayPal',
									<StatusPill key="ps4" tone="soon">
										Coming Soon
									</StatusPill>,
									'Planned wallet and global checkout support.',
								],
								[
									'Dodo',
									<StatusPill key="ps5" tone="soon">
										Coming Soon
									</StatusPill>,
									'Planned additional modern billing route.',
								],
							]}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Providers',
		slug: ['providers', 'stripe'],
		title: 'Stripe',
		description:
			'Stripe is the first shipped Paymesh provider and the reference implementation for payments, customers, and webhook normalization.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Stripe provider lives in{' '}
							<InlineCode>@paymesh/stripe</InlineCode> and reads{' '}
							<InlineCode>STRIPE_API_KEY</InlineCode> and optional{' '}
							<InlineCode>STRIPE_WEBHOOK_SECRET</InlineCode> by default.
						</Paragraph>
						<DocCodeBlock
							code={stripeSetupSnippet}
							filename="src/lib/paymesh.ts"
						/>
					</div>
				),
			},
			{
				id: 'options',
				title: 'Provider Options',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="st-opt1">secret</InlineCode>,
									'Overrides the default STRIPE_API_KEY secret.',
								],
								[
									<InlineCode key="st-opt2">webhookSecret</InlineCode>,
									'Overrides STRIPE_WEBHOOK_SECRET for signature verification.',
								],
								[
									<InlineCode key="st-opt3">baseUrl</InlineCode>,
									'Overrides Stripe base URL, useful in tests.',
								],
								[
									<InlineCode key="st-opt4">retry</InlineCode>,
									'Retry policy passed through to shared request().',
								],
								[
									<InlineCode key="st-opt5">timeout</InlineCode>,
									'Request timeout in milliseconds.',
								],
								[
									<InlineCode key="st-opt6">fetch</InlineCode>,
									'Custom fetch implementation for server/runtime customization.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'capabilities',
				title: 'Capabilities',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Capability', 'Status', 'Notes']}
							rows={stripeCapabilityRows}
						/>
					</div>
				),
			},
			{
				id: 'payments',
				title: 'Payment Flow',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Stripe payment creation currently maps to Checkout Session
							creation at <InlineCode>/v1/checkout/sessions</InlineCode>. The
							normalized response uses Stripe fields such as{' '}
							<InlineCode>amount_total</InlineCode>,{' '}
							<InlineCode>currency</InlineCode>, <InlineCode>url</InlineCode>,
							and customer details to build the returned Paymesh payment object.
						</Paragraph>
						<DocCodeBlock
							code={paymentSnippet}
							filename="src/server/payments.ts"
						/>
						<Callout title="Status mapping">
							Stripe payment states such as <InlineCode>succeeded</InlineCode>,{' '}
							<InlineCode>failed</InlineCode>, <InlineCode>canceled</InlineCode>
							, and Checkout Session states such as{' '}
							<InlineCode>paid</InlineCode> and <InlineCode>expired</InlineCode>{' '}
							are normalized into Paymesh payment statuses.
						</Callout>
					</div>
				),
			},
			{
				id: 'customers',
				title: 'Customer Operations',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Stripe provider supports create, get, update, and delete for
							customers through <InlineCode>/v1/customers</InlineCode> and
							related resource endpoints.
						</Paragraph>
						<DocCodeBlock
							code={customerSnippet}
							filename="src/server/customers.ts"
						/>
					</div>
				),
			},
			{
				id: 'webhooks',
				title: 'Webhook Mapping',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Stripe webhook verification reconstructs the signed payload as{' '}
							<InlineCode>{'timestamp.body'}</InlineCode>, computes an
							HMAC-SHA256 with <InlineCode>webhookSecret</InlineCode>, and
							compares it to the <InlineCode>v1</InlineCode> signature using
							timing-safe equality.
						</Paragraph>
						<DocCodeBlock
							code={nextWebhookSnippet}
							filename="app/api/webhooks/stripe/route.ts"
						/>
						<DocTable
							headers={['Stripe Event', 'Normalized Event', 'Hook']}
							rows={stripeEventRows}
						/>
					</div>
				),
			},
			{
				id: 'raw',
				title: 'Raw Mode with Stripe',
				content: (
					<div className="space-y-4">
						<Paragraph>
							When <InlineCode>includeRaw</InlineCode> is enabled, the Stripe
							provider attaches the original Checkout Session, PaymentIntent,
							Charge, or Customer payload to the normalized result.
						</Paragraph>
					</div>
				),
			},
		],
	},
	...[
		{
			slug: ['providers', 'polar'],
			title: 'Polar',
			packageName: '@paymesh/polar',
			notes:
				'Planned merchant-of-record oriented adapter with normalized payment and webhook flows.',
			targets: [
				'Provider package with normalized checkout and customer flows.',
				'Webhook adapter compatibility through the same core hook surface.',
				'Migration-friendly path for teams that want MoR without app-level rewrites.',
			],
			capabilities: [
				['checkout', 'planned'],
				['customers', 'planned'],
				['webhooks', 'planned'],
				['subscriptions', 'planned'],
			] as const,
		},
		{
			slug: ['providers', 'abacatepay'],
			title: 'AbacatePay',
			packageName: '@paymesh/abacatepay',
			notes:
				'Planned Brazil-first adapter for local payment rails and region-specific billing flows.',
			targets: [
				'Local payment methods expressed through the same normalized client.',
				'Customer and webhook support aligned with the existing provider contract.',
				'Future room for PIX-related capability modeling.',
			],
			capabilities: [
				['checkout', 'planned'],
				['customers', 'planned'],
				['webhooks', 'planned'],
				['pix', 'planned'],
			] as const,
		},
		{
			slug: ['providers', 'paypal'],
			title: 'PayPal',
			packageName: '@paymesh/paypal',
			notes:
				'Planned wallet and global checkout provider integration under the same Paymesh surface.',
			targets: [
				'Normalized checkout creation for PayPal-backed flows.',
				'Common webhook and customer handling where the provider model allows it.',
				'Avoiding app-level branching when PayPal is added alongside other providers.',
			],
			capabilities: [
				['checkout', 'planned'],
				['customers', 'planned'],
				['webhooks', 'planned'],
				['refunds', 'planned'],
			] as const,
		},
		{
			slug: ['providers', 'dodo'],
			title: 'Dodo',
			packageName: '@paymesh/dodo',
			notes:
				'Planned additional modern billing route for teams that want optionality beyond the first provider.',
			targets: [
				'Consistent payment and customer primitives through the same core client.',
				'Webhook normalization into Paymesh event hooks.',
				'Provider capability modeling that matches the rest of the ecosystem.',
			],
			capabilities: [
				['checkout', 'planned'],
				['customers', 'planned'],
				['webhooks', 'planned'],
				['subscriptions', 'planned'],
			] as const,
		},
	].map((provider) => ({
		group: 'Providers',
		slug: provider.slug,
		title: provider.title,
		status: 'coming-soon' as const,
		description: provider.notes,
		sections: [
			{
				id: 'coming-soon',
				title: 'Coming Soon',
				content: (
					<div className="space-y-4">
						<Callout title="Roadmap" tone="soon">
							{provider.notes}
						</Callout>
					</div>
				),
			},
			{
				id: 'planned-scope',
				title: 'Planned Scope',
				content: (
					<div className="space-y-4">
						<BulletList>
							{provider.targets.map((target) => (
								<li key={target}>{target}</li>
							))}
						</BulletList>
					</div>
				),
			},
			{
				id: 'package-shape',
				title: 'Planned Package Shape',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The intended package slot is{' '}
							<InlineCode>{provider.packageName}</InlineCode>. The goal is to
							keep the same integration ergonomics used by the Stripe adapter:
							one provider factory, one client surface, and the same normalized
							webhook hooks.
						</Paragraph>
						<DocTable
							headers={['Capability', 'Expected Status']}
							rows={provider.capabilities.map(([capability, status]) => [
								<InlineCode key={`${provider.title}-${capability}`}>
									{capability}
								</InlineCode>,
								<StatusPill
									key={`${provider.title}-${capability}-${status}`}
									tone="soon"
								>
									{status}
								</StatusPill>,
							])}
						/>
					</div>
				),
			},
			{
				id: 'status',
				title: 'Status',
				content: (
					<div className="space-y-4">
						<Paragraph>
							This page exists now so the navigation structure and route shape
							stay stable as provider support expands. The adapter itself is not
							implemented in the current repo build yet.
						</Paragraph>
						<Callout title="What is concrete vs planned" tone="soon">
							The route names, package names, and capability expectations here
							describe the intended Paymesh integration shape. They are
							deliberately marked as planning notes, not shipped adapter APIs.
						</Callout>
					</div>
				),
			},
		],
	})),
	{
		group: 'Plugins',
		slug: ['plugins'],
		title: 'Plugins',
		status: 'coming-soon',
		description:
			'The plugin layer is planned for higher-level integrations that should build on top of the core client instead of bloating it.',
		sections: [
			{
				id: 'coming-soon',
				title: 'Coming Soon',
				content: (
					<div className="space-y-4">
						<Callout title="Why a plugin layer" tone="soon">
							The core client should stay small and infrastructural. Plugins are
							the right place for optional framework glue, orchestration
							helpers, or workflow-specific integrations that should not become
							mandatory dependencies.
						</Callout>
					</div>
				),
			},
			{
				id: 'planned-categories',
				title: 'Planned Categories',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>Higher-level billing workflow helpers.</li>
							<li>
								Provider-specific optional extensions that do not belong in the
								core surface.
							</li>
							<li>
								Framework or platform integrations beyond the current webhook
								adapters.
							</li>
						</BulletList>
					</div>
				),
			},
		],
	},
];

export { docsNavigation, docsPages };

export function getDocHref(slug: string[]): Route {
	return `/docs/${slug.join('/')}` as Route;
}

export function getDocPage(slug?: string[]) {
	if (!slug?.length) return undefined;
	return docsPages.find((page) => page.slug.join('/') === slug.join('/'));
}

export function getFlattenedDocs() {
	return docsNavigation.flatMap((group) =>
		group.items.map((item) => ({
			...item,
			group: group.title,
		})),
	);
}

export function getPrevNextDoc(slug: string[]) {
	const flat = getFlattenedDocs();
	const currentIndex = flat.findIndex(
		(item) => item.slug.join('/') === slug.join('/'),
	);

	return {
		prev: currentIndex > 0 ? flat[currentIndex - 1] : null,
		next:
			currentIndex >= 0 && currentIndex < flat.length - 1
				? flat[currentIndex + 1]
				: null,
	};
}
