<br>

<h1 align="center">Paymesh</h1>

<p align="center">
  <strong>Provider-agnostic payments infrastructure for modern TypeScript teams.</strong>
</p>

<p align="center">
  Ship checkout flows, customer sync, and normalized webhooks without locking your product to one provider or scattering billing logic across the codebase.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#built-in-hooks">Built-in hooks</a> ·
  <a href="#why-paymesh">Why Paymesh</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/stripe @paymesh/postgres
```

<h2 align="center">Quickstart</h2>

<p align="center">
  Create one typed client, choose a provider, optionally attach a database, and keep the rest of your product code working against normalized payment primitives.
</p>

```ts
import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";
import { stripe } from "@paymesh/stripe";

export const paymesh = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  database: postgres(process.env.DATABASE_URL!, {
    persistRaw: true,
  }),
});

const payment = await paymesh.payments.create({
  amount: 1999,
  currency: "USD",
  description: "Pro plan",
  customer: {
    email: "ada@example.com",
    externalId: "user_123",
  },
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});

await paymesh.customers.upsert({
  email: "ada@example.com",
  externalId: "user_123",
  name: "Ada Lovelace",
});

const customer = await paymesh.customers.get("cus_123");

console.log(payment.checkoutUrl, customer.email);
```

<h2 align="center">Built-in Hooks</h2>

<p align="center">
  Paymesh exposes one unified webhook hook model across providers and framework adapters. Built-in hooks include <code>onEvent</code>, <code>onUnhandledEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<p align="center">
  Dispatch prefers the specific normalized hook first, falls back to <code>onEvent</code> when no specific handler exists, and uses <code>onUnhandledEvent</code> only when neither is defined.
</p>

<h2 align="center">Why Paymesh</h2>

<p align="center">
  Paymesh gives product teams one typed surface for checkout creation, customer lifecycle operations, and webhook orchestration. Provider-specific SDK quirks stay inside provider packages, while your application code stays small, predictable, and easy to migrate.
</p>

<p align="center">
  It is built for teams that want to move fast now without paying a rewrite tax later.
</p>
