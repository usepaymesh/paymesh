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

const installSnippet = `bun add paymesh @paymesh/stripe @paymesh/polar @paymesh/postgres @paymesh/elysia pg

# or
pnpm add paymesh @paymesh/stripe @paymesh/polar @paymesh/postgres @paymesh/elysia pg

# or
npm install paymesh @paymesh/stripe @paymesh/polar @paymesh/postgres @paymesh/elysia pg`;

const clientSnippet = `import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

export const client = createClient({
  provider: stripe({
    secret: "sk_test_123",
    webhookSecret: "whsec_123",
  }),
});`;

const clientOptionsSnippet = `import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

export const client = createClient({
  provider: stripe({
    secret: "sk_test_123",
    webhookSecret: "whsec_123",
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

const pixSnippet = `const pix = await client.pix.create({
  amount: 3500,
  currency: "BRL",
  description: "Invoice #42",
  customer: {
    email: "alice@paymesh.dev",
    externalId: "user_123",
  },
  pix: {
    expiresAfterSeconds: 900,
  },
});

console.log(pix.copyPasteCode, pix.instructionsUrl);`;

const customerSnippet = `const customer = await client.customers.upsert({
  email: "alice@paymesh.dev",
  externalId: "user_123",
  name: "Alice",
  metadata: {
    teamId: "team_123",
  },
});

const fetched = await client.customers.get(customer.id);

await client.customers.delete(fetched.id);`;

const paymentCreateShapeSnippet = `type PaymentCreateData = {
  amount: number;
  currency: string;
  productIds?: string[];
  customer?: {
    id?: string;
    externalId?: string;
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

const customerShapeSnippet = `type CustomerUpsertData = {
  id?: string;
  externalId?: string;
  name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type CustomerDeleteResult = {
  id: string;
  provider: string;
  deleted: boolean;
};`;

const envTypingSnippet = `declare global {
  namespace NodeJS {
    interface ProcessEnv {
      STRIPE_API_KEY: string;
      POLAR_ACCESS_TOKEN: string;
      STRIPE_WEBHOOK_SECRET?: string;
      POLAR_WEBHOOK_SECRET?: string;
    }
  }
}

export {};`;

const rawSnippet = `const rawClient = createClient({
  provider: stripe({
    secret: "sk_test_123",
  }),
  includeRaw: true,
});

const payment = await rawClient.payments.create({
  amount: 2000,
  currency: "USD",
});

payment.raw; // provider payload`;

const elysiaWebhookSnippet = `import { Elysia } from "elysia";
import { Webhooks } from "@paymesh/elysia";

export const app = new Elysia().post(
  "/webhooks/paymesh",
  Webhooks({
    client,

    async onPaymentSucceeded(event) {
      console.log("payment.succeeded", event.id);
    },

    async onCustomerUpdated(event) {
      console.log("customer.updated", event.data.id);
    },
  }),
);`;

const expressWebhookSnippet = `import express from "express";
import { createClient } from "paymesh";
import { Webhooks } from "@paymesh/express";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({
    secret: "sk_test_123",
    webhookSecret: "whsec_123",
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

const polarSetupSnippet = `import { createClient } from "paymesh";
import { polar } from "@paymesh/polar";

export const client = createClient({
  provider: polar({
    accessToken: "polar_access_123",
    webhookSecret: "whsec_polar_123",
  }),
});`;

const polarPaymentsSnippet = `const checkout = await client.payments.create({
  amount: 2900,
  currency: "USD",
  productIds: ["prod_abc123"],
  customer: {
    email: "ada@example.com",
    externalId: "user_123",
  },
  successUrl: "https://example.com/success",
  returnUrl: "https://example.com/billing",
});`;

const polarCustomersSnippet = `const customer = await client.customers.upsert({
  email: "ada@example.com",
  externalId: "user_123",
  name: "Ada Lovelace",
});

const fetched = await client.customers.get(customer.id);`;

const polarWebhookSnippet = `import { Elysia } from "elysia";
import { Webhooks } from "@paymesh/elysia";

export const app = new Elysia().post(
  "/webhooks/polar",
  Webhooks({
    client,

    async onCheckoutCompleted(event) {
      console.log("checkout.completed", event.id);
    },
  }),
);`;

const dodoSetupSnippet = `import { createClient } from "paymesh";
import { dodo } from "@paymesh/dodo";

export const client = createClient({
  provider: dodo({
    apiKey: process.env.DODO_PAYMENTS_API_KEY!,
    webhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    baseUrl: "https://test.dodopayments.com",
  }),
});`;

const dodoPaymentsSnippet = `const payment = await client.payments.create({
  amount: 4900,
  currency: "BRL",
  productIds: ["prod_abc123"],
  customer: {
    email: "billing@example.com",
    externalId: "order_42",
    name: "Billing Team",
  },
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
  metadata: {
    orderId: "order_42",
  },
});`;

const dodoWebhookSnippet = `import { Elysia } from "elysia";
import { Webhooks } from "@paymesh/elysia";

export const app = new Elysia().post(
  "/webhooks/dodo",
  Webhooks({
    client,

    async onPaymentSucceeded(event) {
      console.log("payment.succeeded", event.id);
    },
  }),
);`;

const postgresSnippet = `import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: postgres("postgresql://localhost:5432/paymesh", {
    persistRaw: true,
  }),
});`;

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
    async get() {
      throw new Error("implement me");
    },
    async upsert() {
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
    secret: "sk_test_123",
    webhookSecret: "whsec_123",
  }),
});`;

const nextAdapterSnippet = `import { Webhooks } from "@paymesh/next";
import { paymesh } from "@/lib/paymesh";

export const POST = Webhooks({
  client: paymesh,
  async onEvent(event) {
    console.log(event.type);
  },
});`;

const expressAdapterSnippet = `import express from "express";
import { Webhooks } from "@paymesh/express";
import { paymesh } from "@/lib/paymesh";

const app = express();

app.post(
  "/webhooks/paymesh",
  express.raw({ type: "application/json" }),
  Webhooks({ client: paymesh }),
);`;

const fastifyAdapterSnippet = `import Fastify from "fastify";
import { Webhooks } from "@paymesh/fastify";
import { paymesh } from "@/lib/paymesh";

const app = Fastify();

app.post(
  "/webhooks/paymesh",
  {
    config: {
      rawBody: true,
    },
  },
  Webhooks({ client: paymesh }),
);`;

const honoAdapterSnippet = `import { Hono } from "hono";
import { Webhooks } from "@paymesh/hono";
import { paymesh } from "@/lib/paymesh";

const app = new Hono();

app.post("/webhooks/paymesh", Webhooks({ client: paymesh }));`;

const elysiaAdapterSnippet = `import { Elysia } from "elysia";
import { Webhooks } from "@paymesh/elysia";
import { paymesh } from "@/lib/paymesh";

export const app = new Elysia().post(
  "/webhooks/paymesh",
  Webhooks({
    client: paymesh,
    async onPaymentSucceeded(event) {
      console.log(event.data.id);
    },
  }),
);`;

const dashPluginSnippet = `import { Dashboard, dash } from "@paymesh/dash";
import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: postgres("postgresql://localhost:5432/paymesh", {
    persistRaw: true,
  }),
  plugins: [
    dash({
      path: "/admin/paymesh",
      auth({ request }) {
        const actorId = request.headers.get("x-actor-id") ?? "usr_123";

        return {
          id: actorId,
          type: "user",
          email: "ops@paymesh.dev",
          name: "Ops",
        };
      },
    }),
  ],
});

const dashboard = Dashboard({ client });`;

const auditLogPluginSnippet = `import { auditLog } from "@paymesh/audit-logs";
import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: postgres("postgresql://localhost:5432/paymesh", {
    persistRaw: true,
  }),
  plugins: [
    auditLog({
      events: ["checkout.*", "payment.*", "customer.*"],
      exclude: ["payment.failed"],
      mode: "async",
      failureMode: "warn",
      retention: "1y",
      includeDiff: true,
      includeProviderMetadata: true,
      includeRequestInfo: true,
      batch: {
        enabled: true,
        size: 50,
        flushInterval: 1_000,
      },
      actor({ request }) {
        return {
          type: "user",
          id: request.headers.get("x-user-id") ?? "usr_123",
          email: "ops@paymesh.dev",
        };
      },
    }),
  ],
});

await client.auditLog.list({ action: "payment.succeeded", limit: 10 });`;

const pluginAuthoringSnippet = `import { definePlugin, event, lazy } from "paymesh";

export const examplePlugin = definePlugin({
  id: "example",
  name: "Example Plugin",
  events: {
    "example.entry.created": event<{ id: string }>({
      description: "Emitted when an example entry is created.",
    }),
  },
  setup() {
    return {
      metrics: lazy(() => ({ counter: 0 })),
    };
  },
  hooks: {
    onEvent(event) {
      console.log(event.type);
    },
  },
});`;

const databaseSchemaSnippet = `const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: postgres("postgresql://localhost:5432/paymesh", {
    persistRaw: true,
  }),
  schema: {
    prefix: "paymesh",
    tables: {
      customers: {
        name: "billing_customers",
      },
    },
    customTables: {
      billing_notes: {
        name: "billing_notes",
        primaryKey: { type: "text" },
        timestamps: { createdAt: true, updatedAt: true },
        fields: {
          note: { type: "string", required: true },
        },
      },
    },
  },
});`;

const drizzleAdapterSnippet = `import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as paymeshDrizzle } from "@paymesh/drizzle";
import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

const db = drizzle(pool);

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: paymeshDrizzle(db, { persistRaw: true }),
});`;

const prismaAdapterSnippet = `import { PrismaClient } from "@prisma/client";
import { prisma } from "@paymesh/prisma";
import { createClient } from "paymesh";
import { polar } from "@paymesh/polar";

const db = new PrismaClient();

const client = createClient({
  provider: polar({
    accessToken: "polar_access_123",
    webhookSecret: "whsec_polar_123",
  }),
  database: prisma(db, { persistRaw: true }),
});`;

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
	[
		<InlineCode key="hw1">onWebhookReceived</InlineCode>,
		'webhook.received',
		'Low-level inbound webhook hook.',
	],
	[
		<InlineCode key="hw2">onWebhookVerified</InlineCode>,
		'webhook.verified',
		'Signature verification succeeded.',
	],
	[
		<InlineCode key="hw3">onWebhookFailed</InlineCode>,
		'webhook.failed',
		'Signature or parse failure.',
	],
];

const guidePages: DocPage[] = [
	{
		group: 'Guides',
		slug: ['guides', 'provider-selection'],
		title: 'Choose a Provider',
		description:
			'Decide whether Stripe, Polar, or a future provider belongs in your stack based on product model, market, and operational needs.',
		sections: [
			{
				id: 'decision-factors',
				title: 'Decision Factors',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>
								Use Stripe when you want broad ecosystem coverage and the most
								general payment surface.
							</li>
							<li>
								Use Polar when your billing model is product-led and you want a
								merchant-of-record style integration.
							</li>
							<li>
								Keep Paymesh in the center so provider swaps do not leak through
								product code.
							</li>
							<li>
								Add a second provider later if regional or commercial needs
								change.
							</li>
						</BulletList>
					</div>
				),
			},
			{
				id: 'comparison',
				title: 'Provider Comparison',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Provider', 'Best For', 'Tradeoff']}
							rows={[
								[
									'Stripe',
									'General-purpose checkout and customer billing.',
									'You still own most of the billing and tax surface.',
								],
								[
									'Polar',
									'Product-led billing with merchant-of-record style flows.',
									'More opinionated around the Polar model.',
								],
								[
									'AbacatePay',
									'Brazil-first local rails and PIX-centric flows.',
									'Roadmap-only in the current repo build.',
								],
								[
									'PayPal',
									'Wallet-driven checkout and global reach.',
									'Roadmap-only in the current repo build.',
								],
								[
									'Dodo',
									'Catalog-driven hosted checkout with Dodo Payments.',
									'No native paymesh.pix flow; Pix only appears inside BRL hosted checkout.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'setup-path',
				title: 'Recommended Setup Path',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Start with a shared client module, pick one provider, then layer
							framework adapters and database persistence only where they solve
							a concrete need.
						</Paragraph>
						<DocCodeBlock
							code={stripeSetupSnippet}
							filename="src/lib/paymesh.ts"
						/>
						<Paragraph>
							If your product is merchant-of-record first, swap Stripe for Polar
							without changing the rest of the application surface.
						</Paragraph>
						<DocCodeBlock
							code={polarSetupSnippet}
							filename="src/lib/paymesh.ts"
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Guides',
		slug: ['guides', 'webhooks'],
		title: 'Build Webhooks',
		description:
			'Set up verified webhook routes with the right adapter for your runtime and keep route code focused on normalized events.',
		sections: [
			{
				id: 'adapter-choice',
				title: 'Pick the Right Adapter',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Runtime', 'Adapter', 'Gotcha']}
							rows={[
								[
									'Next.js App Router',
									'@paymesh/next',
									'Return a Route Handler function.',
								],
								[
									'Express',
									'@paymesh/express',
									'Preserve the raw request body.',
								],
								[
									'Fastify',
									'@paymesh/fastify',
									'Enable rawBody handling for the route.',
								],
								['Hono', '@paymesh/hono', 'Pass context.req.raw directly.'],
								[
									'Elysia',
									'@paymesh/elysia',
									'Use the raw request object from the route context.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'route-shape',
				title: 'Route Shape',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={nextAdapterSnippet}
							filename="app/api/webhooks/route.ts"
						/>
						<Paragraph>
							All adapters normalize into the same webhook hook contract, so
							your business logic does not change when you move between
							frameworks.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'failure-modes',
				title: 'Failure Modes',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Problem', 'Result']}
							rows={[
								['Bad signature', 'HTTP 401 and invalid_webhook_signature'],
								['Malformed payload', 'HTTP 400 and webhook_parse_error'],
								['Mapping error', 'HTTP 400 and webhook_mapping_error'],
								['User hook crash', 'HTTP 500 and hook_error'],
							]}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Guides',
		slug: ['guides', 'plugins'],
		title: 'Use Plugins',
		description:
			'Add dashboards, audit trails, and other cross-cutting behavior without bloating the core client or provider contract.',
		sections: [
			{
				id: 'what-plugins-are',
				title: 'What Plugins Are',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Plugins extend the client. They can add routes, hooks, database
							tables, or lazy runtime features while still keeping provider
							behavior separate from application code.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'create-plugin',
				title: 'Create a Plugin',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={pluginAuthoringSnippet}
							filename="src/plugins/example.ts"
						/>
					</div>
				),
			},
			{
				id: 'plugin-rules',
				title: 'Plugin Rules',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>Keep plugin state isolated to the plugin boundary.</li>
							<li>
								Use hooks for event-driven behavior and setup for runtime
								wiring.
							</li>
							<li>Prefer lazy runtime extensions for optional features.</li>
							<li>Use custom tables when the plugin needs persistence.</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Guides',
		slug: ['guides', 'database'],
		title: 'Set Up Database Persistence',
		description:
			'Choose the right database adapter, decide when to persist raw payloads, and model custom schema extensions without fighting the core client.',
		sections: [
			{
				id: 'adapter-matrix',
				title: 'Adapter Matrix',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Adapter', 'Use When', 'Persist Raw']}
							rows={[
								[
									'@paymesh/postgres',
									'You want direct PostgreSQL access.',
									'Yes',
								],
								[
									'@paymesh/drizzle',
									'You already own a Drizzle session.',
									'Yes',
								],
								['@paymesh/prisma', 'You already own a Prisma client.', 'Yes'],
							]}
						/>
					</div>
				),
			},
			{
				id: 'schema-extension',
				title: 'Schema Extension',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={databaseSchemaSnippet}
							filename="src/lib/paymesh.ts"
						/>
					</div>
				),
			},
			{
				id: 'rules',
				title: 'Persistence Rules',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>
								Use `persistRaw` only when you need provider payloads later.
							</li>
							<li>Prefer custom tables for plugin-owned data.</li>
							<li>
								Keep migrations alongside the rest of your application schema.
							</li>
							<li>Use a single database adapter per client instance.</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Guides',
		slug: ['guides', 'testing'],
		title: 'Test Billing Integrations',
		description:
			'Validate webhook routes, provider configuration, and database persistence with a testing approach that mirrors production behavior.',
		sections: [
			{
				id: 'what-to-test',
				title: 'What to Test',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>Webhook verification and normalized hook dispatch.</li>
							<li>Payment and customer flows for the active provider.</li>
							<li>Database persistence and raw payload behavior.</li>
							<li>Plugin side effects like dashboards and audit logs.</li>
						</BulletList>
					</div>
				),
			},
			{
				id: 'fixtures',
				title: 'Fixture Strategy',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={`const result = await client.webhooks.handle({
  request,
  hooks: {
    async onPaymentSucceeded(event) {
      expect(event.type).toBe("payment.succeeded");
    },
  },
});`}
							filename="test/webhooks.test.ts"
						/>
					</div>
				),
			},
			{
				id: 'local-development',
				title: 'Local Development',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Run webhook routes locally with a real raw request body and verify
							the same code path you will use in production. That catches body
							parsing and signature issues early.
						</Paragraph>
					</div>
				),
			},
		],
	},
];

const adapterPages: DocPage[] = [
	{
		group: 'Adapters',
		slug: ['adapters', 'next'],
		title: 'Next.js Adapter',
		description:
			'Mount Paymesh webhooks inside Next.js App Router routes with a route handler that returns normalized responses.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={nextAdapterSnippet}
							filename="app/api/webhooks/route.ts"
						/>
						<Paragraph>
							Use the adapter when your webhook endpoint lives in App Router and
							you want a small route file with no manual verification logic.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'contract',
				title: 'Contract',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="n1">client</InlineCode>,
									'Required Paymesh client.',
								],
								[
									<InlineCode key="n2">includeRaw</InlineCode>,
									'Propagate raw payloads to hooks.',
								],
								[
									<InlineCode key="n3">hooks</InlineCode>,
									'Normalized event handlers.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'notes',
				title: 'Notes',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Next adapters return a standard Route Handler. They fit best when
							you already use Next for the rest of the billing surface.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Adapters',
		slug: ['adapters', 'express'],
		title: 'Express Adapter',
		description:
			'Handle Paymesh webhooks inside Express middleware stacks while keeping raw request handling explicit.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={expressAdapterSnippet}
							filename="src/server/webhooks.ts"
						/>
					</div>
				),
			},
			{
				id: 'body',
				title: 'Raw Body',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Express must preserve the raw webhook body so signature
							verification can reconstruct the exact payload that came from the
							provider.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'hooks',
				title: 'Hooks',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Hook', 'Use For', 'Notes']}
							rows={hookRows.slice(0, 4)}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Adapters',
		slug: ['adapters', 'fastify'],
		title: 'Fastify Adapter',
		description:
			'Use Paymesh with Fastify while preserving raw payload handling and the framework’s request lifecycle.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={fastifyAdapterSnippet}
							filename="src/server/webhooks.ts"
						/>
					</div>
				),
			},
			{
				id: 'raw',
				title: 'Raw Payload Handling',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Enable raw body handling for webhook routes. Without it, signature
							verification cannot validate the incoming payload reliably.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'failure',
				title: 'Failure Cases',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Case', 'Result']}
							rows={[
								['Signature mismatch', '401 invalid_webhook_signature'],
								['Invalid payload', '400 webhook_parse_error'],
								['Hook exception', '500 hook_error'],
							]}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Adapters',
		slug: ['adapters', 'hono'],
		title: 'Hono Adapter',
		description:
			'Use Paymesh on Hono when you want a small edge-friendly webhook integration with no extra glue.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={honoAdapterSnippet}
							filename="src/server/webhooks.ts"
						/>
					</div>
				),
			},
			{
				id: 'request-flow',
				title: 'Request Flow',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Hono exposes the raw request on{' '}
							<InlineCode>context.req.raw</InlineCode>, which maps directly into
							Paymesh webhook handling.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'hooks',
				title: 'Hooks',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Hook', 'Meaning', 'Available']}
							rows={hookRows.slice(0, 5)}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Adapters',
		slug: ['adapters', 'elysia'],
		title: 'Elysia Adapter',
		description:
			'Elysia is the Bun-first adapter for Paymesh, with a simple route signature and normalized webhook handling.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={elysiaAdapterSnippet}
							filename="src/server/webhooks.ts"
						/>
					</div>
				),
			},
			{
				id: 'request',
				title: 'Request Object',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Elysia passes the raw <InlineCode>request</InlineCode> into
							Paymesh, so webhook verification and event mapping happen without
							extra body parsing steps.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'hooks',
				title: 'Hooks',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Hook', 'Typical Use', 'Status']}
							rows={hookRows.slice(0, 6)}
						/>
					</div>
				),
			},
		],
	},
];

const databasePages: DocPage[] = [
	{
		group: 'Database',
		slug: ['database', 'overview'],
		title: 'Database Overview',
		description:
			'Understand how Paymesh persists normalized billing state, custom tables, and plugin-owned data across supported database adapters.',
		sections: [
			{
				id: 'model',
				title: 'Storage Model',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The database layer persists normalized customers, checkouts,
							webhook deliveries, subscriptions, catalog data, and plugin-owned
							records. It is optional, but it is the right home for durable
							billing state.
						</Paragraph>
						<DocTable
							headers={['Built-in Table', 'Purpose']}
							rows={[
								['customers', 'Persist normalized customer records.'],
								['checkouts', 'Persist payment/checkouts.'],
								['pix', 'Persist PIX-specific payments.'],
								['webhookEvents', 'Persist webhook deliveries and ids.'],
								[
									'subscriptions',
									'Persist subscription state where supported.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'schema',
				title: 'Schema Customization',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={databaseSchemaSnippet}
							filename="src/lib/paymesh.ts"
						/>
						<Paragraph>
							Use custom tables when a plugin needs its own durable storage, and
							use table overrides when you need to align Paymesh with an
							existing database naming convention.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'transactions',
				title: 'Transactions',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Adapters expose transactions so you can keep provider sync and
							local persistence atomic when your use case needs it.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Database',
		slug: ['database', 'memory'],
		title: 'Memory Adapter',
		description:
			'Use ephemeral in-memory persistence for tests, CI, demos, and local examples.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The memory adapter is useful when you want the Paymesh database
							contract without durable SQL storage.
						</Paragraph>
						<DocCodeBlock
							code={`import { createClient } from "paymesh";
import { memory } from "@paymesh/memory";
import { stripe } from "@paymesh/stripe";

export const paymesh = createClient({
  provider: stripe(),
  database: memory({
    seed: {
      customers: [
        {
          id: "cus_seed",
          provider: "stripe",
          sandbox: true,
          email: "ada@example.com",
        },
      ],
    },
  }),
});`}
							filename="src/server/paymesh.ts"
						/>
					</div>
				),
			},
			{
				id: 'options',
				title: 'Options',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="mem1">persistRaw</InlineCode>,
									'Keep raw provider payloads in memory.',
								],
								[
									<InlineCode key="mem2">strict</InlineCode>,
									'Validate required fields, duplicate ids, and related entities.',
								],
								[
									<InlineCode key="mem3">seed</InlineCode>,
									'Preload built-in Paymesh tables at initialization.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'when',
				title: 'When to Use It',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>Tests and CI should not depend on a database container.</li>
							<li>You want a lightweight local demo or prototype.</li>
							<li>You need seeded ephemeral state for docs or examples.</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Database',
		slug: ['database', 'postgres'],
		title: 'Postgres Adapter',
		description:
			'Use PostgreSQL directly with Paymesh when you want the shortest path to durable billing state.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={postgresSnippet}
							filename="src/server/database.ts"
						/>
					</div>
				),
			},
			{
				id: 'options',
				title: 'Options',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="pg1">connection</InlineCode>,
									'Connection string or pg Pool.',
								],
								[
									<InlineCode key="pg2">persistRaw</InlineCode>,
									'Persist raw provider payloads.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'when',
				title: 'When to Use It',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>You want minimal adapter surface.</li>
							<li>You are already standardized on Postgres.</li>
							<li>You want a first-party adapter with predictable behavior.</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Database',
		slug: ['database', 'drizzle'],
		title: 'Drizzle Adapter',
		description:
			'Use an existing Drizzle session to back Paymesh without introducing a separate persistence stack.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={drizzleAdapterSnippet}
							filename="src/server/database.ts"
						/>
					</div>
				),
			},
			{
				id: 'options',
				title: 'Options',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="dr1">persistRaw</InlineCode>,
									'Keep raw provider payloads in the database.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'notes',
				title: 'Notes',
				content: (
					<div className="space-y-4">
						<Paragraph>
							This adapter is a fit when you already have Drizzle at the center
							of your data layer and want Paymesh to share that same database
							transaction model.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Database',
		slug: ['database', 'prisma'],
		title: 'Prisma Adapter',
		description:
			'Reuse an existing Prisma client for Paymesh persistence while keeping provider logic separate.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={prismaAdapterSnippet}
							filename="src/server/database.ts"
						/>
					</div>
				),
			},
			{
				id: 'options',
				title: 'Options',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="pr1">persistRaw</InlineCode>,
									'Persist raw provider payloads.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'notes',
				title: 'Notes',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Prisma adapter uses raw query and transaction APIs to
							integrate with Paymesh’s repository contract. It is best when
							Prisma is already the persistence boundary for the application.
						</Paragraph>
					</div>
				),
			},
		],
	},
];

const pluginPages: DocPage[] = [
	{
		group: 'Plugins',
		slug: ['plugins', 'dash'],
		title: 'Dash Plugin',
		description:
			'Add a Paymesh dashboard to your application and control access through a request-aware auth callback.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={dashPluginSnippet}
							filename="src/server/plugins.ts"
						/>
					</div>
				),
			},
			{
				id: 'auth',
				title: 'Auth Callback',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The <InlineCode>auth</InlineCode> callback receives
							<InlineCode>request</InlineCode> and{' '}
							<InlineCode>client</InlineCode>. The request gives you headers,
							cookies, and any app-specific identity context you need to decide
							whether the dashboard should render.
						</Paragraph>
						<DocTable
							headers={['Argument', 'Purpose']}
							rows={[
								[
									<InlineCode key="dash-req">request</InlineCode>,
									'Use request metadata for auth decisions.',
								],
								[
									<InlineCode key="dash-client">client</InlineCode>,
									'Access the Paymesh client and provider metadata.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'runtime',
				title: 'Runtime Behavior',
				content: (
					<div className="space-y-4">
						<BulletList>
							<li>
								Mount with <InlineCode>Dashboard(client)</InlineCode>.
							</li>
							<li>
								Use a custom path when the dashboard should not live at
								`/admin/paymesh`.
							</li>
							<li>Keep actor objects minimal and stable.</li>
						</BulletList>
					</div>
				),
			},
		],
	},
	{
		group: 'Plugins',
		slug: ['plugins', 'audit-logs'],
		title: 'Audit Logs Plugin',
		description:
			'Persist normalized Paymesh events as audit records with request-aware actors, filters, retention, and batching.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={auditLogPluginSnippet}
							filename="src/server/plugins.ts"
						/>
					</div>
				),
			},
			{
				id: 'options',
				title: 'Options',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Option', 'Meaning']}
							rows={[
								[
									<InlineCode key="a1">events</InlineCode>,
									'Include event patterns.',
								],
								[
									<InlineCode key="a2">exclude</InlineCode>,
									'Exclude event patterns.',
								],
								[
									<InlineCode key="a3">mode</InlineCode>,
									'sync or async persistence.',
								],
								[
									<InlineCode key="a4">failureMode</InlineCode>,
									'throw, warn, or ignore.',
								],
								[
									<InlineCode key="a5">retention</InlineCode>,
									'30d, 90d, 180d, 1y, or forever.',
								],
								[
									<InlineCode key="a6">includeRequestInfo</InlineCode>,
									'Capture request metadata.',
								],
								[
									<InlineCode key="a7">includeDiff</InlineCode>,
									'Capture diff information.',
								],
								[
									<InlineCode key="a8">batch</InlineCode>,
									'Batch entries before persistence.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'actor-resolver',
				title: 'Actor Resolver',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The actor resolver can use the request, the normalized event, or
							the input entry to decide who caused the logged action.
						</Paragraph>
						<DocTable
							headers={['Field', 'Use']}
							rows={[
								[
									<InlineCode key="actor-req">request</InlineCode>,
									'Identity and session context.',
								],
								[
									<InlineCode key="actor-event">event</InlineCode>,
									'Webhook data and normalized type.',
								],
								[
									<InlineCode key="actor-input">input</InlineCode>,
									'Manual audit entry payload.',
								],
								[
									<InlineCode key="actor-client">client</InlineCode>,
									'Provider and plugin context.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'manual-entries',
				title: 'Manual Entries',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Use manual entries for internal actions that are not coming from a
							webhook, like invoicing, support operations, or administrative
							side effects.
						</Paragraph>
						<DocCodeBlock
							code={`await client.auditLog.create({
  action: "invoice.sent",
  resource: {
    type: "invoice",
    id: "inv_123",
  },
  message: "Invoice sent to customer",
});`}
							filename="src/server/audit-log.ts"
						/>
					</div>
				),
			},
		],
	},
];

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
			{ label: 'PIX', slug: ['concepts', 'pix'] },
			{ label: 'Payment Providers', slug: ['concepts', 'payment-providers'] },
		],
	},
	{
		title: 'Guides',
		items: [
			{ label: 'Provider Selection', slug: ['guides', 'provider-selection'] },
			{ label: 'Webhooks', slug: ['guides', 'webhooks'] },
			{ label: 'Plugins', slug: ['guides', 'plugins'] },
			{ label: 'Database', slug: ['guides', 'database'] },
			{ label: 'Testing', slug: ['guides', 'testing'] },
		],
	},
	{
		title: 'Providers',
		items: [
			{ label: 'Stripe', slug: ['providers', 'stripe'] },
			{ label: 'Polar', slug: ['providers', 'polar'] },
			{
				label: 'AbacatePay',
				slug: ['providers', 'abacatepay'],
				status: 'coming-soon',
			},
			{ label: 'PayPal', slug: ['providers', 'paypal'], status: 'coming-soon' },
			{ label: 'Dodo', slug: ['providers', 'dodo'] },
		],
	},
	{
		title: 'Adapters',
		items: [
			{ label: 'Next', slug: ['adapters', 'next'] },
			{ label: 'Express', slug: ['adapters', 'express'] },
			{ label: 'Fastify', slug: ['adapters', 'fastify'] },
			{ label: 'Hono', slug: ['adapters', 'hono'] },
			{ label: 'Elysia', slug: ['adapters', 'elysia'] },
		],
	},
	{
		title: 'Plugins',
		items: [
			{ label: 'Overview', slug: ['plugins'] },
			{ label: 'Dash', slug: ['plugins', 'dash'] },
			{ label: 'Audit Logs', slug: ['plugins', 'audit-logs'] },
			{ label: 'Create a Plugin', slug: ['guides', 'plugin-authoring'] },
		],
	},
	{
		title: 'Database',
		items: [
			{ label: 'Overview', slug: ['database', 'overview'] },
			{ label: 'Postgres', slug: ['database', 'postgres'] },
			{ label: 'Drizzle', slug: ['database', 'drizzle'] },
			{ label: 'Prisma', slug: ['database', 'prisma'] },
		],
	},
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
		'Upsert, fetch, list, and delete customers.',
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
		'Upsert, get, and delete Stripe customers.',
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

const polarCapabilityRows: ReactNode[][] = [
	[
		<InlineCode key="polar-cap1">checkout</InlineCode>,
		<StatusPill key="polar-s1" tone="success">
			Available
		</StatusPill>,
		'Creates Polar checkouts through /v1/checkouts.',
	],
	[
		<InlineCode key="polar-cap2">customers</InlineCode>,
		<StatusPill key="polar-s2" tone="success">
			Available
		</StatusPill>,
		'Upserts, fetches, and deletes Polar customers.',
	],
	[
		<InlineCode key="polar-cap3">webhooks</InlineCode>,
		<StatusPill key="polar-s3" tone="success">
			Available
		</StatusPill>,
		'Verifies webhook-id and webhook-signature headers before dispatching normalized hooks.',
	],
	[
		<InlineCode key="polar-cap4">refunds</InlineCode>,
		<StatusPill key="polar-s4" tone="success">
			Advertised
		</StatusPill>,
		'Refund events are normalized from Polar webhook payloads.',
	],
	[
		<InlineCode key="polar-cap5">subscriptions</InlineCode>,
		<StatusPill key="polar-s5" tone="success">
			Advertised
		</StatusPill>,
		'Subscription webhook events are normalized into Paymesh hooks.',
	],
	[
		<InlineCode key="polar-cap6">customerPortal</InlineCode>,
		<StatusPill key="polar-s6" tone="success">
			Advertised
		</StatusPill>,
		'Polar exposes a dashboard resource link through the provider adapter.',
	],
	[
		<InlineCode key="polar-cap7">coupons</InlineCode>,
		<StatusPill key="polar-s7" tone="success">
			Advertised
		</StatusPill>,
		'Capability is declared for product-led billing workflows.',
	],
	[
		<InlineCode key="polar-cap8">pix</InlineCode>,
		<StatusPill key="polar-s8" tone="default">
			False
		</StatusPill>,
		'Polar does not expose PIX through this adapter.',
	],
];

const dodoCapabilityRows: ReactNode[][] = [
	[
		<InlineCode key="dodo-cap1">checkout</InlineCode>,
		<StatusPill key="dodo-s1" tone="success">
			Available
		</StatusPill>,
		'Creates Dodo hosted payments through catalog-driven product carts.',
	],
	[
		<InlineCode key="dodo-cap2">customers</InlineCode>,
		<StatusPill key="dodo-s2" tone="success">
			Available
		</StatusPill>,
		'Upserts and fetches Dodo customers.',
	],
	[
		<InlineCode key="dodo-cap3">webhooks</InlineCode>,
		<StatusPill key="dodo-s3" tone="success">
			Available
		</StatusPill>,
		'Verifies webhook-id, webhook-timestamp, and webhook-signature headers before dispatching normalized hooks.',
	],
	[
		<InlineCode key="dodo-cap4">subscriptions</InlineCode>,
		<StatusPill key="dodo-s4" tone="success">
			Advertised
		</StatusPill>,
		'Subscription webhook events and dashboard sync are implemented.',
	],
	[
		<InlineCode key="dodo-cap5">pix</InlineCode>,
		<StatusPill key="dodo-s5" tone="default">
			False
		</StatusPill>,
		'Dodo can offer hosted Pix inside BRL checkout links, but it does not expose native paymesh.pix flows.',
	],
	[
		<InlineCode key="dodo-cap6">refunds</InlineCode>,
		<StatusPill key="dodo-s6" tone="default">
			False
		</StatusPill>,
		'Refund webhooks are normalized, but the provider does not expose refund helpers as a public capability.',
	],
	[
		<InlineCode key="dodo-cap7">customerPortal</InlineCode>,
		<StatusPill key="dodo-s7" tone="default">
			False
		</StatusPill>,
		'No dedicated customer portal helper is exposed by the package.',
	],
	[
		<InlineCode key="dodo-cap8">coupons</InlineCode>,
		<StatusPill key="dodo-s8" tone="default">
			False
		</StatusPill>,
		'No coupon capability is exposed by the package.',
	],
];

const polarEventRows: ReactNode[][] = [
	['checkout.created', 'payment.created', 'onPaymentCreated'],
	['checkout.updated', 'checkout.completed', 'onCheckoutCompleted'],
	['order.created', 'payment.created', 'onPaymentCreated'],
	['order.paid', 'payment.succeeded', 'onPaymentSucceeded'],
	['order.refunded', 'payment.refunded', 'onPaymentRefunded'],
	['customer.created', 'customer.created', 'onCustomerCreated'],
	['customer.updated', 'customer.updated', 'onCustomerUpdated'],
	['customer.deleted', 'customer.deleted', 'onCustomerDeleted'],
	['subscription.created', 'subscription.created', 'onSubscriptionCreated'],
	['subscription.updated', 'subscription.updated', 'onSubscriptionUpdated'],
	['subscription.canceled', 'subscription.canceled', 'onSubscriptionCanceled'],
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
							upstream provider is Stripe, Polar, or something else tomorrow.
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
							Today the repo ships the core client, Stripe and Polar providers,
							webhook adapters, dashboard and audit-log plugins, and the
							Postgres database adapter. The docs below distinguish between what
							already exists and what is on the roadmap.
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
									'@paymesh/stripe / @paymesh/polar',
									'Provider implementations for payments, customers, catalogs, dashboards, and webhook mapping.',
								],
								[
									'@paymesh/next / express / hono / fastify / elysia',
									'Framework-specific webhook adapters that validate, parse, map, and dispatch hooks.',
								],
								[
									'@paymesh/dash / @paymesh/audit-logs / @paymesh/postgres',
									'Optional plugins and database adapters that extend the core client without changing the provider contract.',
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
							core client, one provider, and one webhook adapter. Add the
							Postgres adapter when you want normalized billing state persisted
							locally.
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
									<InlineCode key="pkg-polar">@paymesh/polar</InlineCode>,
									'You are using Polar as the upstream merchant-of-record provider.',
								],
								[
									<InlineCode key="pkg-dodo">@paymesh/dodo</InlineCode>,
									'You are using Dodo Payments for catalog-driven hosted checkout flows.',
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
								[
									<InlineCode key="pkg-dash">@paymesh/dash</InlineCode>,
									'You want the built-in dashboard plugin for local admin workflows.',
								],
								[
									<InlineCode key="pkg-audit">@paymesh/audit-logs</InlineCode>,
									'You want structured audit logging for Paymesh events and internal actions.',
								],
								[
									<InlineCode key="pkg-postgres">@paymesh/postgres</InlineCode>,
									'You want to store Paymesh billing state in PostgreSQL through an existing pool or connection string.',
								],
								[
									<InlineCode key="pkg-pg">pg</InlineCode>,
									'You are using the Postgres adapter and need the underlying PostgreSQL client.',
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
							The docs use Stripe as the reference provider and Polar as the
							merchant-of-record option that is already shipped in this repo. If
							you want a persisted local database layer, add the Postgres
							adapter alongside the provider package. Future provider pages keep
							the same shape so the setup process remains familiar.
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
								[
									<InlineCode key="env-polar-token">
										POLAR_ACCESS_TOKEN
									</InlineCode>,
									<StatusPill key="req-polar-token" tone="success">
										Yes
									</StatusPill>,
									'Default bearer token used by polar() for authenticated API calls.',
								],
								[
									<InlineCode key="env-polar-webhook">
										POLAR_WEBHOOK_SECRET
									</InlineCode>,
									<StatusPill key="req-polar-webhook" tone="success">
										For webhooks
									</StatusPill>,
									'Used by Polar webhook verification to validate webhook signatures.',
								],
							]}
						/>
						<Callout title="Accuracy matters">
							The current Stripe provider reads{' '}
							<InlineCode>STRIPE_API_KEY</InlineCode> by default, not{' '}
							<InlineCode>STRIPE_SECRET_KEY</InlineCode>. The docs here follow
							the implementation in this repo. Polar uses{' '}
							<InlineCode>POLAR_ACCESS_TOKEN</InlineCode> and optional{' '}
							<InlineCode>POLAR_WEBHOOK_SECRET</InlineCode>. Postgres uses a
							connection string or pool from{' '}
							<InlineCode>@paymesh/postgres</InlineCode>.
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
								Point it at a provider package, starting with Stripe or Polar if
								you are following the live docs.
							</li>
							<li>
								Use the client in payment and customer flows instead of calling
								provider SDKs directly.
							</li>
							<li>
								Add the Postgres adapter when you want normalized billing state
								persisted locally.
							</li>
							<li>
								Add a framework webhook route using the adapter package that
								matches your server runtime.
							</li>
							<li>
								Add optional plugins and a database adapter when you need the
								dashboard, audit trail, or persisted billing state.
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
				id: 'pix',
				title: 'Work with PIX',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Use <InlineCode>client.pix.create()</InlineCode> when you need a
							native PIX flow with QR code and copia e cola details. It sits
							next to payments instead of replacing them.
						</Paragraph>
						<DocCodeBlock code={pixSnippet} filename="src/server/pix.ts" />
					</div>
				),
			},
			{
				id: 'webhooks',
				title: 'Handle Webhooks in Elysia',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Elysia adapter handles signature verification, JSON parsing,
							event normalization, and hook dispatch. Your route only defines
							what to do with the normalized event.
						</Paragraph>
						<DocCodeBlock
							code={elysiaWebhookSnippet}
							filename="src/server/webhooks.ts"
						/>
					</div>
				),
			},
			{
				id: 'plugins',
				title: 'Use Plugins',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The plugin layer is the right place for dashboards, audit trails,
							and other optional integrations that should extend the client
							instead of bloating the core surface.
						</Paragraph>
						<DocCodeBlock
							code={dashPluginSnippet}
							filename="src/server/plugins/dash.ts"
						/>
						<DocCodeBlock
							code={auditLogPluginSnippet}
							filename="src/server/plugins/audit-logs.ts"
						/>
					</div>
				),
			},
			{
				id: 'postgres-database',
				title: 'Use Postgres as Database',
				content: (
					<div className="space-y-4">
						<Paragraph>
							If you already use PostgreSQL for the rest of the app, the Paymesh
							adapter can persist billing state in the same database layer with
							an existing pool or connection string.
						</Paragraph>
						<DocCodeBlock
							code={postgresSnippet}
							filename="src/server/database.ts"
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
							code={elysiaWebhookSnippet}
							filename="src/server/webhooks.ts"
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
				title: 'Upsert Surface',
				content: (
					<div className="space-y-4">
						<DocCodeBlock
							code={customerSnippet}
							filename="src/server/customers.ts"
						/>
						<Paragraph>
							The client currently exposes upsert, get, list, and delete for
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
							The same includeRaw rules apply here. If you need the full
							provider customer object during migration, opt in per call instead
							of leaking that requirement everywhere.
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
									<StatusPill key="ps2" tone="success">
										Available
									</StatusPill>,
									'Shipped merchant-of-record provider with checkout, customers, webhooks, and dashboard sync.',
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
									<StatusPill key="ps5" tone="success">
										Available
									</StatusPill>,
									'Shipped catalog-driven provider with hosted checkout, customers, webhooks, catalog sync, and subscription sync.',
								],
							]}
						/>
					</div>
				),
			},
		],
	},
	{
		group: 'Concepts',
		slug: ['concepts', 'pix'],
		title: 'PIX',
		description:
			'PIX is a first-class payment method in Paymesh, with its own normalized payment shape, provider support, and raw payload behavior.',
		sections: [
			{
				id: 'overview',
				title: 'Overview',
				content: (
					<div className="space-y-4">
						<Paragraph>
							PIX lives alongside cards and checkout sessions in the Paymesh
							client. It is a dedicated payment flow, not a provider-specific
							afterthought.
						</Paragraph>
						<DocCodeBlock code={pixSnippet} filename="src/server/pix.ts" />
					</div>
				),
			},
			{
				id: 'shape',
				title: 'Normalized Shape',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Field', 'Meaning']}
							rows={[
								[
									<InlineCode key="pix-id">id</InlineCode>,
									'Provider payment id.',
								],
								[
									<InlineCode key="pix-method">method</InlineCode>,
									'Always pix for PIX payments.',
								],
								[
									<InlineCode key="pix-copy">copyPasteCode</InlineCode>,
									'The copia e cola string.',
								],
								[
									<InlineCode key="pix-qr-png">qrCodeImageUrlPng</InlineCode>,
									'PNG QR code URL.',
								],
								[
									<InlineCode key="pix-qr-svg">qrCodeImageUrlSvg</InlineCode>,
									'SVG QR code URL.',
								],
								[
									<InlineCode key="pix-exp">expiresAt</InlineCode>,
									'Expiration timestamp when provided.',
								],
							]}
						/>
					</div>
				),
			},
			{
				id: 'provider-support',
				title: 'Provider Support',
				content: (
					<div className="space-y-4">
						<DocTable
							headers={['Provider', 'Support']}
							rows={[
								['Stripe', 'Available'],
								['Polar', 'Unavailable'],
								['AbacatePay', 'Planned'],
							]}
						/>
						<Callout title="Important">
							Providers decide whether PIX is available. The client keeps the
							same `client.pix` surface either way so your app code does not
							need to branch around provider-specific payment method names.
						</Callout>
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
							The Stripe provider supports upsert, get, and delete for customers
							through <InlineCode>/v1/customers</InlineCode> and related
							resource endpoints.
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
							code={elysiaWebhookSnippet}
							filename="src/server/webhooks.ts"
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
	{
		group: 'Providers',
		slug: ['providers', 'polar'],
		title: 'Polar',
		description:
			'Polar is a shipped Paymesh provider for product-led billing, customer operations, and normalized webhook handling.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Polar provider lives in{' '}
							<InlineCode>@paymesh/polar</InlineCode> and reads{' '}
							<InlineCode>POLAR_ACCESS_TOKEN</InlineCode> and optional{' '}
							<InlineCode>POLAR_WEBHOOK_SECRET</InlineCode> by default.
						</Paragraph>
						<DocCodeBlock
							code={polarSetupSnippet}
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
									<InlineCode key="po-opt1">accessToken</InlineCode>,
									'Overrides the default POLAR_ACCESS_TOKEN secret.',
								],
								[
									<InlineCode key="po-opt2">webhookSecret</InlineCode>,
									'Overrides POLAR_WEBHOOK_SECRET for signature verification.',
								],
								[
									<InlineCode key="po-opt3">baseUrl</InlineCode>,
									'Overrides Polar base URL, useful in tests.',
								],
								[
									<InlineCode key="po-opt4">retry</InlineCode>,
									'Retry policy passed through to shared request().',
								],
								[
									<InlineCode key="po-opt5">timeout</InlineCode>,
									'Request timeout in milliseconds.',
								],
								[
									<InlineCode key="po-opt6">fetch</InlineCode>,
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
							rows={polarCapabilityRows}
						/>
					</div>
				),
			},
			{
				id: 'payments',
				title: 'Checkout Flow',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Polar checkout creation requires at least one product id in{' '}
							<InlineCode>productIds</InlineCode>. The adapter maps Polar
							checkouts into normalized Paymesh payment objects with checkout
							urls, customer context, and metadata.
						</Paragraph>
						<DocCodeBlock
							code={polarPaymentsSnippet}
							filename="src/server/payments.ts"
						/>
					</div>
				),
			},
			{
				id: 'customers',
				title: 'Customer Operations',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Polar customer management uses the same normalized
							<InlineCode>upsert</InlineCode>, <InlineCode>get</InlineCode>, and{' '}
							<InlineCode>delete</InlineCode> contract that the rest of Paymesh
							expects.
						</Paragraph>
						<DocCodeBlock
							code={polarCustomersSnippet}
							filename="src/server/customers.ts"
						/>
					</div>
				),
			},
			{
				id: 'dashboard',
				title: 'Dashboard Sync',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Polar includes dashboard sync helpers so teams can link back to
							the Polar dashboard and keep payment or subscription state in sync
							with the local database.
						</Paragraph>
						<DocTable
							headers={['Helper', 'Purpose']}
							rows={[
								[
									'dashboard.getResourceUrl()',
									'Returns the Polar dashboard URL.',
								],
								[
									'dashboard.syncPayment()',
									'Synchronizes a payment into the local database.',
								],
								[
									'dashboard.syncSubscription()',
									'Synchronizes a subscription into the local database.',
								],
							]}
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
							Polar webhooks verify the webhook-id, webhook-timestamp, and
							webhook-signature headers before mapping checkout, order,
							customer, and subscription events into normalized Paymesh hooks.
						</Paragraph>
						<DocCodeBlock
							code={polarWebhookSnippet}
							filename="src/server/webhooks.ts"
						/>
						<DocTable
							headers={['Polar Event', 'Normalized Event', 'Hook']}
							rows={polarEventRows}
						/>
					</div>
				),
			},
			{
				id: 'raw',
				title: 'Raw Mode',
				content: (
					<div className="space-y-4">
						<Paragraph>
							When <InlineCode>includeRaw</InlineCode> is enabled, Polar
							attaches the original checkout, order, customer, or subscription
							payload to the normalized result.
						</Paragraph>
					</div>
				),
			},
		],
	},
	{
		group: 'Providers',
		slug: ['providers', 'dodo'],
		title: 'Dodo',
		description:
			'Dodo is a shipped Paymesh provider for catalog-driven hosted checkout, customer operations, catalog sync, and normalized webhook handling.',
		sections: [
			{
				id: 'setup',
				title: 'Setup',
				content: (
					<div className="space-y-4">
						<Paragraph>
							The Dodo provider lives in <InlineCode>@paymesh/dodo</InlineCode>{' '}
							and reads <InlineCode>DODO_PAYMENTS_API_KEY</InlineCode> and
							optional <InlineCode>DODO_PAYMENTS_WEBHOOK_KEY</InlineCode> by
							default.
						</Paragraph>
						<DocCodeBlock
							code={dodoSetupSnippet}
							filename="src/lib/paymesh.ts"
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
							rows={dodoCapabilityRows}
						/>
					</div>
				),
			},
			{
				id: 'payments',
				title: 'Hosted Checkout Flow',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Dodo payment creation is catalog-driven. You must provide at least
							one <InlineCode>productIds</InlineCode> entry, and{' '}
							<InlineCode>amount</InlineCode> is only accepted when exactly one
							product id is present.
						</Paragraph>
						<DocCodeBlock
							code={dodoPaymentsSnippet}
							filename="src/server/payments.ts"
						/>
						<Callout title="Pix nuance">
							For BRL hosted checkout links, the provider enables Dodo payment
							methods that can include Pix inside the hosted checkout page. This
							does not expose the dedicated <InlineCode>client.pix</InlineCode>{' '}
							surface.
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
							The Dodo provider supports normalized{' '}
							<InlineCode>upsert</InlineCode> and <InlineCode>get</InlineCode>{' '}
							for customers. Delete is intentionally unsupported because the
							package does not expose a provider-side customer delete endpoint.
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
							Dodo webhook verification reconstructs the standard signed message
							using <InlineCode>webhook-id</InlineCode>,{' '}
							<InlineCode>webhook-timestamp</InlineCode>, and the raw request
							body before comparing the expected HMAC-SHA256 signature with the
							<InlineCode>v1</InlineCode> signature.
						</Paragraph>
						<DocCodeBlock
							code={dodoWebhookSnippet}
							filename="src/server/webhooks.ts"
						/>
						<DocTable
							headers={['Dodo Event Family', 'Normalized Behavior']}
							rows={[
								[
									'payment.*',
									'Mapped into normalized payment events and hooks.',
								],
								['refund.*', 'Mapped into payment.refunded or payment.failed.'],
								[
									'subscription.*',
									'Mapped into normalized subscription hooks.',
								],
							]}
						/>
					</div>
				),
			},
		],
	},
	...[
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
		status: 'available',
		description:
			'The plugin layer extends the core client with dashboards, audit logs, and other optional integrations that belong outside the provider contract.',
		sections: [
			{
				id: 'overview',
				title: 'Overview',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Plugins let you add cross-cutting behavior without changing the
							core payment contract. That keeps the base client small while
							still supporting dashboards, audit trails, and persistence
							integrations.
						</Paragraph>
					</div>
				),
			},
			{
				id: 'dashboard-audit',
				title: 'Dash and Audit Log',
				content: (
					<div className="space-y-4">
						<Paragraph>
							Use <InlineCode>@paymesh/dash</InlineCode> for local dashboard
							workflows and <InlineCode>@paymesh/audit-logs</InlineCode> for
							structured audit trails that capture payments, customers, and
							internal actions. Each plugin has its own dedicated page below.
						</Paragraph>
						<DocCodeBlock
							code={dashPluginSnippet}
							filename="src/server/plugins/dash.ts"
						/>
						<DocCodeBlock
							code={auditLogPluginSnippet}
							filename="src/server/plugins/audit-logs.ts"
						/>
					</div>
				),
			},
		],
	},
	...guidePages,
	...adapterPages,
	...databasePages,
	...pluginPages,
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
