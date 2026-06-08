<br>

<h1 align="center">@paymesh/stripe</h1>

<p align="center">
  <strong>Stripe for Paymesh, with a normalized API on top.</strong>
</p>

<p align="center">
  Keep Stripe’s reach and ecosystem, but expose it to your app through the same Paymesh client and event model you can use everywhere else.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#what-you-get">What you get</a> ·
  <a href="#why-use-it">Why use it</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/stripe
```

<h2 align="center">Usage</h2>

```ts
import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

const paymesh = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
});

const checkout = await paymesh.payments.create({
  amount: 4900,
  currency: "USD",
  description: "Growth plan",
  customer: {
    email: "team@example.com",
    externalId: "org_42",
  },
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});

const customer = await paymesh.customers.upsert({
  email: "team@example.com",
  externalId: "org_42",
  name: "Acme Inc.",
});

console.log(checkout.id, checkout.checkoutUrl, customer.id);
```

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/stripe</code> implements checkout creation, native PIX creation and lookup, customers, provider catalog sync, webhook verification, and normalized Stripe event handling through the standard Paymesh contracts.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/stripe</code> turns Stripe into a clean provider implementation instead of an application-wide dependency. You keep Stripe checkout, customers, refunds, subscriptions, and webhook verification, while your product code talks to one stable contract.
</p>

<p align="center">
  That makes Stripe easier to adopt today and easier to swap or complement tomorrow.
</p>
