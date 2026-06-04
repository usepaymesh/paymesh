<br>

<h1 align="center">@paymesh/hono</h1>

<p align="center">
  <strong>Edge-friendly Hono webhooks for Paymesh.</strong>
</p>

<p align="center">
  Run verified payment webhooks in Hono with the same normalized hooks and provider abstraction used across the rest of your Paymesh stack.
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
npm install paymesh @paymesh/hono hono
```

<h2 align="center">Usage</h2>

```ts
import { Hono } from "hono";
import { Webhooks } from "@paymesh/hono";
import { paymesh } from "./paymesh";

const app = new Hono();

app.post(
  "/webhooks/stripe",
  Webhooks({
    client: paymesh,
    async onEvent(event) {
      console.log(event.type);
    },
    async onCheckoutCompleted(event) {
      console.log(event.data.id);
    },
    async onCustomerUpdated(event) {
      console.log(event.data.id);
    },
  }),
);
```

<h2 align="center">Available Hooks</h2>

<p align="center">
  <code>@paymesh/hono</code> supports the same built-in hooks as Paymesh itself: <code>onEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/hono</code> is a clean fit for edge-oriented backends and lightweight APIs that still need serious billing workflows. It maps Hono’s request model directly into Paymesh so your event logic stays portable.
</p>

<p align="center">
  That gives you flexibility across Node and edge deployments without rewriting webhook internals.
</p>
