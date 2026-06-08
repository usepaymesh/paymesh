<br>

<h1 align="center">@paymesh/polar</h1>

<p align="center">
  <strong>Polar for Paymesh, designed for product-led billing flows.</strong>
</p>

<p align="center">
  Launch Polar checkouts and customer operations through the same Paymesh primitives you use across the rest of your billing stack.
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
npm install paymesh @paymesh/polar
```

<h2 align="center">Usage</h2>

```ts
import { createClient } from "paymesh";
import { polar } from "@paymesh/polar";

const paymesh = createClient({
  provider: polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  }),
});

const checkout = await paymesh.payments.create({
  amount: 2900,
  currency: "USD",
  productIds: ["prod_abc123"],
  customer: {
    email: "ada@example.com",
    externalId: "user_123",
  },
  successUrl: "https://example.com/success",
  returnUrl: "https://example.com/billing",
});

const customer = await paymesh.customers.upsert({
  email: "ada@example.com",
  externalId: "user_123",
  name: "Ada Lovelace",
});

console.log(checkout.id, checkout.checkoutUrl, customer.id);
```

<p align="center">
  <code>@paymesh/polar</code> currently does not expose the <code>pix</code> capability. Use <code>paymesh.payments</code> for Polar checkout flows; <code>paymesh.pix</code> is currently Stripe-only inside Paymesh.
</p>

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/polar</code> implements normalized checkout creation, customer operations, provider catalog sync, and webhook processing while preserving Polar’s product-driven billing model.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/polar</code> gives you a clean Polar integration without forcing Polar-specific request shapes through the rest of your application. Product, checkout, customer, and webhook flows stay aligned with the broader Paymesh model.
</p>

<p align="center">
  It is a good fit for teams that want fast go-to-market billing with room to evolve later.
</p>
