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

---

## What is Paymesh?

Paymesh is a provider-agnostic payments toolkit for TypeScript applications. It gives your app a small, typed abstraction over payment providers so you can create checkout sessions, manage customers, verify webhooks, and react to normalized payment events without spreading provider SDK details across your codebase.

The core package exposes the client and provider contracts. Provider packages implement those contracts, and framework adapters make webhook handling feel native in your HTTP framework.

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

## Getting Started

Install the core package, a provider, and a database adapter:

```bash
bun add paymesh @paymesh/stripe @paymesh/postgres
# or, if you already use Drizzle
bun add paymesh @paymesh/stripe @paymesh/drizzle drizzle-orm
```

You can also use your preferred package manager:

```bash
npm install paymesh @paymesh/stripe @paymesh/postgres
npm install paymesh @paymesh/stripe @paymesh/drizzle drizzle-orm
pnpm add paymesh @paymesh/stripe @paymesh/postgres
pnpm add paymesh @paymesh/stripe @paymesh/drizzle drizzle-orm
yarn add paymesh @paymesh/stripe @paymesh/postgres
yarn add paymesh @paymesh/stripe @paymesh/drizzle drizzle-orm
```

Available providers currently include `@paymesh/stripe` and `@paymesh/polar`.
Available database adapters currently include `@paymesh/postgres` and `@paymesh/drizzle`.

## Database and CLI

Paymesh can persist normalized relational data for customers, checkouts, invoices, subscriptions, webhook events, products, and prices.

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

The CLI reads the same client module used by your app. Point it at the module with `--client`, `PAYMESH_PATH`, or `package.json.paymesh.path`.

```bash
paymesh generate --client ./src/lib/paymesh.ts
paymesh migrate --client ./src/lib/paymesh.ts
paymesh push --client ./src/lib/paymesh.ts
paymesh status --client ./src/lib/paymesh.ts
```

## Webhooks

Paymesh maps provider-specific webhook payloads into normalized events and dispatches them to typed hooks.

For Next.js App Router:

```ts
// app/api/webhooks/stripe/route.ts
import { Webhooks } from "@paymesh/next";
import { paymesh } from "@/lib/paymesh";

export const POST = Webhooks({
  client: paymesh,
  async onCheckoutCompleted(event) {
    console.log("Checkout completed", event.data.id);
  },
  async onPaymentSucceeded(event) {
    console.log("Payment succeeded", event.data.id);
  },
});
```

Framework adapters expose the same hook API while returning responses in the shape expected by each framework.

## Why Paymesh

Payment code usually starts small and then spreads provider-specific request shapes, webhook signatures, event names, and customer objects through the application. That makes it harder to test, harder to switch providers, and harder to support multiple runtimes.

Paymesh keeps those boundaries explicit:

- one typed client for payment operations;
- normalized payment, customer, and webhook event shapes;
- provider packages that isolate external API details;
- framework adapters that handle webhook verification and dispatch;
- optional raw provider responses when you need to inspect or store the original payload.

## Contribution

Paymesh is a free and open source project licensed under the [Apache 2.0 License](./LICENSE). You are free to use it, modify it, and build on top of it.

You can help by opening issues, proposing provider integrations, improving framework adapters, and contributing fixes to the source code.
