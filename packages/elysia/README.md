<br>

<h1 align="center">@paymesh/elysia</h1>

<p align="center">
  <strong>Elysia webhook handling for Paymesh on Bun-first stacks.</strong>
</p>

<p align="center">
  Connect Paymesh to Elysia with a small adapter layer and keep webhook verification, event routing, and provider differences out of your route code.
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
npm install paymesh @paymesh/elysia elysia
```

<h2 align="center">Usage</h2>

```ts
import { Elysia } from "elysia";
import { Webhooks } from "@paymesh/elysia";
import { paymesh } from "./paymesh";

const app = new Elysia();

app.post(
  "/webhooks/stripe",
  Webhooks({
    client: paymesh,
    async onEvent(event) {
      console.log(event.type);
    },
    async onPaymentSucceeded(event) {
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
  <code>@paymesh/elysia</code> supports the same built-in hooks as Paymesh itself: <code>onEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/elysia</code> brings the Paymesh webhook contract to Bun-native applications without adding framework-specific branching to your billing code. Your integration stays direct and typed, even as the rest of the stack changes.
</p>

<p align="center">
  That keeps fast-moving Elysia apps simple where it matters.
</p>
