<br>

<h1 align="center">@paymesh/next</h1>

<p align="center">
  <strong>Next.js App Router webhooks for Paymesh.</strong>
</p>

<p align="center">
  Handle verified payment webhooks with a route shape that feels native to Next.js while keeping the underlying billing logic provider-agnostic.
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
npm install paymesh @paymesh/next
```

<h2 align="center">Usage</h2>

<p align="center">
  The adapter accepts the same hook surface exposed by the Paymesh client, so route handlers can mix broad event capture with targeted lifecycle hooks.
</p>

```ts
// app/api/webhooks/stripe/route.ts
import { Webhooks } from "@paymesh/next";
import { paymesh } from "@/lib/paymesh";

export const POST = Webhooks({
  client: paymesh,
  async onEvent(event) {
    console.log("Received", event.type, event.id);
  },
  async onCheckoutCompleted(event) {
    console.log("Checkout completed", event.data.id);
  },
  async onPaymentSucceeded(event) {
    console.log("Payment succeeded", event.data.id);
  },
  async onCustomerUpdated(event) {
    console.log("Customer updated", event.data.id);
  },
});
```

<h2 align="center">Available Hooks</h2>

<p align="center">
  <code>@paymesh/next</code> supports the same built-in hooks as Paymesh itself: <code>onEvent</code>, <code>onUnhandledEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/next</code> removes the glue code between App Router route handlers and payment webhook processing. You write product hooks, Paymesh handles the verification and dispatch pipeline.
</p>

<p align="center">
  That keeps billing endpoints small, typed, and production-ready.
</p>
