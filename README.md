<br>

<h1 align="center">Paymesh</h1>

<p align="center">
  <strong>Provider-agnostic payments infrastructure for TypeScript teams.</strong>
</p>

<p align="center">
  Create payments, manage customers, normalize webhooks, and keep provider-specific details behind one typed API.
</p>

<p align="center">
  <a href="#what-is-paymesh">About</a> ·
  <a href="#getting-started">Getting started</a>
</p>

<br>

<h2 align="center">What is Paymesh</h2>

<p align="center">
  Paymesh is a provider-agnostic payments toolkit for TypeScript applications. It gives your app a small, typed abstraction over payment providers so you can create checkout sessions, manage customers, verify webhooks, and react to normalized payment events without spreading provider SDK details across your codebase.
</p>

<p align="center">
  The core package exposes the client and provider contracts. Provider packages implement those contracts, and framework adapters make webhook handling feel native in your HTTP framework.
</p>

```ts
import { drizzle as paymeshDrizzle } from "@paymesh/drizzle";
import { stripe } from "@paymesh/stripe";
import { createClient } from "paymesh";
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.DATABASE_URL!);

export const paymesh = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  database: paymeshDrizzle(db, {
    persistRaw: true,
  }),
  schema: {
    prefix: "paymesh_",
    tables: {
      customers: {
        name: "paymesh_customers",
      },
    },
  },
});

const payment = await paymesh.payments.create({
  amount: 1999,
  currency: "USD",
  description: "Pro plan",
  customer: {
    email: "ada@example.com",
  },
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});

console.log(payment.checkoutUrl);
```

<h2 align="center">Getting Started</h2>

<p align="center">
  Install the core package, a provider, and a database adapter.
</p>

```bash
npm install paymesh @paymesh/stripe @paymesh/postgres
# or, if you already use Drizzle
npm install paymesh @paymesh/stripe @paymesh/drizzle drizzle-orm
# or, if you already use Prisma
npm install paymesh @paymesh/stripe @paymesh/prisma @prisma/client
```

<p align="center">
  Available providers currently include <a href="./packages/stripe/README.md">@paymesh/stripe</a>, <a href="./packages/polar/README.md">@paymesh/polar</a>, <a href="./packages/abacatepay/README.md">@paymesh/abacatepay</a>, and <a href="./packages/dodo/README.md">@paymesh/dodo</a>.
</p>

<p align="center">
  Available database adapters currently include <a href="./packages/postgres/README.md">@paymesh/postgres</a>, <a href="./packages/drizzle/README.md">@paymesh/drizzle</a>, and <a href="./packages/prisma/README.md">@paymesh/prisma</a>.
</p>

<h2 align="center">Database and CLI</h2>

<p align="center">
  Paymesh can persist normalized relational data for customers, checkouts, invoices, subscriptions, webhook events, products, and prices. When a database is configured, <code>paymesh.customers.get(id)</code> reads from the local database instead of calling the provider API.
</p>

<p align="center">
  Native PIX flows live under <code>paymesh.pix</code>. Use <code>paymesh.payments</code> for generic checkout sessions and <code>paymesh.pix</code> when you need QR code, copia-e-cola, and expiration data as first-class fields.
</p>

<p align="center">
  <code>@paymesh/dodo</code> supports hosted BRL checkout links that can present Pix inside the Dodo checkout page, but it intentionally does not expose <code>paymesh.pix</code> because Dodo does not currently document a native QR-code-first backend PIX flow.
</p>

<p align="center">
  Database packages: <a href="./packages/postgres/README.md">@paymesh/postgres</a>, <a href="./packages/drizzle/README.md">@paymesh/drizzle</a>, and <a href="./packages/prisma/README.md">@paymesh/prisma</a>. Operational tooling: <a href="./packages/cli/README.md">@paymesh/cli</a>.
</p>

You can pass a database adapter instance directly:

```ts
const paymesh = createClient({
  provider: stripe(),
  database: postgres(process.env.DATABASE_URL!),
});
```

Or adapt an existing Drizzle database instance:

```ts
import { drizzle as drizzleAdapter } from "@paymesh/drizzle";
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.DATABASE_URL!);

const paymesh = createClient({
  provider: stripe(),
  database: drizzleAdapter(db),
});
```

Or adapt an existing Prisma client:

```ts
import { prisma } from "@paymesh/prisma";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const paymesh = createClient({
  provider: stripe(),
  database: prisma(db),
});
```

<p align="center">
  The <a href="./packages/cli/README.md">@paymesh/cli</a> package reads the same client module used by your app. Point it at the module with <code>--client</code>, <code>PAYMESH_PATH</code>, or <code>package.json.paymesh.path</code>.
</p>

```bash
paymesh generate --client ./src/lib/paymesh.ts
paymesh migrate --client ./src/lib/paymesh.ts
paymesh push --client ./src/lib/paymesh.ts
paymesh status --client ./src/lib/paymesh.ts
```

<p align="center">
  <code>paymesh generate</code> writes both <code>paymesh/history.json</code> and <code>paymesh/migrations/*.sql</code>. The history file is the schema manifest used by <code>migrate</code> and <code>status</code>.
</p>

<p align="center">
  Customer writes go through a single upsert entrypoint.
</p>

```ts
await paymesh.customers.upsert({
  email: "ada@example.com",
  externalId: "user_123",
});

await paymesh.customers.upsert({
  id: "cus_123",
  name: "Ada Lovelace",
});
```

<h2 align="center">Webhooks</h2>

<p align="center">
  Paymesh maps provider-specific webhook payloads into normalized events and dispatches them to typed hooks.
</p>

<p align="center">
  Webhook adapters are available for <a href="./packages/next/README.md">@paymesh/next</a>, <a href="./packages/express/README.md">@paymesh/express</a>, <a href="./packages/fastify/README.md">@paymesh/fastify</a>, <a href="./packages/hono/README.md">@paymesh/hono</a>, and <a href="./packages/elysia/README.md">@paymesh/elysia</a>.
</p>

For Next.js App Router:

```ts
// app/api/webhooks/stripe/route.ts
import { Webhooks } from "@paymesh/next";
import { paymesh } from "@/lib/paymesh";

export const POST = Webhooks({
  client: paymesh,
  async onEvent(event) {
    console.log("Webhook event", event.type, event.id);
  },
  async onCheckoutCompleted(event) {
    console.log("Checkout completed", event.data.id);
  },
  async onPaymentSucceeded(event) {
    console.log("Payment succeeded", event.data.id);
  },
});
```

<p align="center">
  Framework adapters expose the same hook API while returning responses in the shape expected by each framework, including <code>onEvent</code>, <code>onUnhandledEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<p align="center">
  Dispatch prefers the specific normalized hook first, falls back to <code>onEvent</code> when no specific handler exists, and uses <code>onUnhandledEvent</code> only when neither is defined.
</p>

<h2 align="center">Why Paymesh</h2>

<p align="center">
  Payment code usually starts small and then spreads provider-specific request shapes, webhook signatures, event names, and customer objects through the application. That makes it harder to test, harder to switch providers, and harder to support multiple runtimes.
</p>

<p align="center">
  Paymesh keeps those boundaries explicit.
</p>

- one typed client for payment operations;
- normalized payment, customer, and webhook event shapes;
- provider packages that isolate external API details;
- framework adapters that handle webhook verification and dispatch;
- optional raw provider responses when you need to inspect or store the original payload.

<h2 align="center">Contribution</h2>

<p align="center">
  You can help by opening issues, proposing provider integrations, improving framework adapters, and contributing fixes to the source code.
</p>
