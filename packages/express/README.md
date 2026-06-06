<br>

<h1 align="center">@paymesh/express</h1>

<p align="center">
  <strong>Express webhook handling for Paymesh.</strong>
</p>

<p align="center">
  Bring Paymesh webhook verification and normalized event dispatch into mature Express backends without rewriting your request pipeline.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#available-hooks">Available hooks</a> ·
  <a href="#why-use-it">Why use it</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/express express
```

<h2 align="center">Usage</h2>

<p align="center">
  Use a raw body parser for webhook routes so provider signature verification can operate on the original request payload.
</p>

```ts
import express from "express";
import { Webhooks } from "@paymesh/express";
import { paymesh } from "./paymesh";

const app = express();

app.post(
  "/webhooks/stripe",
  express.raw({ type: "*/*" }),
  Webhooks({
    client: paymesh,
    async onEvent(event) {
      console.log("Received", event.type);
    },
    async onPaymentSucceeded(event) {
      console.log("Paid", event.data.id);
    },
    async onCustomerUpdated(event) {
      console.log("Customer updated", event.data.id);
    },
  }),
);
```

<h2 align="center">Available Hooks</h2>

<p align="center">
  <code>@paymesh/express</code> supports the same built-in hooks as Paymesh itself: <code>onEvent</code>, <code>onUnhandledEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/express</code> adapts Express requests into the standard Paymesh webhook flow, including raw-body handling for signature verification. Your business logic stays inside event hooks instead of being spread across middleware and controller layers.
</p>

<p align="center">
  That is especially valuable in larger Node services that need operational predictability.
</p>
