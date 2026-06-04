<br>

<h1 align="center">@paymesh/fastify</h1>

<p align="center">
  <strong>Fastify-native webhook handling for Paymesh.</strong>
</p>

<p align="center">
  Keep Fastify performance characteristics and developer ergonomics while delegating payment webhook verification and event normalization to Paymesh.
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
npm install paymesh @paymesh/fastify fastify
```

<h2 align="center">Usage</h2>

<p align="center">
  Fastify integrations should preserve the raw request body for webhook routes so signature verification can run against the exact incoming payload.
</p>

```ts
import Fastify from "fastify";
import { Webhooks } from "@paymesh/fastify";
import { paymesh } from "./paymesh";

const app = Fastify();

app.post(
  "/webhooks/stripe",
  {
    config: {
      rawBody: true,
    },
  },
  Webhooks({
    client: paymesh,
    async onEvent(event) {
      console.log(event.type);
    },
    async onCheckoutCompleted(event) {
      console.log(event.data.id);
    },
    async onPaymentSucceeded(event) {
      console.log(event.data.id);
    },
  }),
);
```

<h2 align="center">Available Hooks</h2>

<p align="center">
  <code>@paymesh/fastify</code> supports the same built-in hooks as Paymesh itself: <code>onEvent</code>, <code>onPaymentCreated</code>, <code>onPaymentSucceeded</code>, <code>onPaymentFailed</code>, <code>onPaymentCanceled</code>, <code>onPaymentRefunded</code>, <code>onCustomerCreated</code>, <code>onCustomerUpdated</code>, <code>onCustomerDeleted</code>, <code>onSubscriptionCreated</code>, <code>onSubscriptionUpdated</code>, <code>onSubscriptionCanceled</code>, and <code>onCheckoutCompleted</code>.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/fastify</code> gives Fastify services a thin, typed integration layer over the Paymesh webhook engine. It preserves the runtime you already want while removing repetitive provider-specific verification code.
</p>

<p align="center">
  That keeps your billing endpoints fast and your implementation compact.
</p>
