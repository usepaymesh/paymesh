<br>

<h1 align="center">@paymesh/dodo</h1>

<p align="center">
  <strong>Dodo Payments for Paymesh, designed for catalog-driven global checkout flows.</strong>
</p>

<p align="center">
  Launch Dodo hosted payments, manage customers, normalize webhooks, and keep the rest of your application on the standard Paymesh client contract.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#what-you-get">What You Get</a> ·
  <a href="#important-notes">Important Notes</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/dodo
```

<h2 align="center">Usage</h2>

```ts
import { createClient } from "paymesh";
import { dodo } from "@paymesh/dodo";

const paymesh = createClient({
  provider: dodo({
    apiKey: process.env.DODO_PAYMENTS_API_KEY!,
    webhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
    baseUrl: "https://test.dodopayments.com",
  }),
});

const payment = await paymesh.payments.create({
  productIds: ["prod_abc123"],
  currency: "BRL",
  customer: {
    email: "ada@example.com",
    name: "Ada Lovelace",
  },
  metadata: {
    orderId: "order_123",
  },
  successUrl: "https://example.com/billing",
  cancelUrl: "https://example.com/cancel",
});

console.log(payment.id, payment.checkoutUrl);
```

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/dodo</code> implements catalog-driven hosted payments, customer reads and upserts, catalog sync, dashboard sync helpers, webhook verification, and normalized Dodo event handling.
</p>

<h2 align="center">Important Notes</h2>

<p align="center">
  Dodo can expose Pix as a hosted payment method for BRL checkouts, and this provider enables that automatically for BRL payment links. The current Paymesh <code>pix</code> contract is intentionally not exposed here because Dodo does not document a native backend Pix creation flow that matches Paymesh's QR-code-first shape.
</p>
