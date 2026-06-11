<br>

<h1 align="center">@paymesh/memory</h1>

<p align="center">
  <strong>Ephemeral in-memory persistence for Paymesh.</strong>
</p>

<p align="center">
  Use Paymesh with a first-party database adapter in tests, CI, demos, and local development without provisioning Postgres or an ORM runtime.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#what-you-get">What you get</a> ·
  <a href="#when-to-use-it">When to use it</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/memory
```

<h2 align="center">Usage</h2>

```ts
import { createClient } from "paymesh";
import { memory } from "@paymesh/memory";
import { stripe } from "@paymesh/stripe";

export const paymesh = createClient({
  provider: stripe(),
  database: memory({
    seed: {
      customers: [
        {
          id: "cus_seed",
          provider: "stripe",
          sandbox: true,
          email: "ada@example.com",
        },
      ],
    },
  }),
});

const customer = await paymesh.customers.get("cus_seed");

console.log(customer.email);
```

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/memory</code> implements the full Paymesh repository contract in memory, including transactions, webhook idempotency, catalog persistence, seeded startup data, and strict validation by default.
</p>

<h2 align="center">When to Use It</h2>

<p align="center">
  Use <code>@paymesh/memory</code> for tests, CI, prototypes, docs examples, and local workflows where durable SQL storage would only add friction.
</p>

<p align="center">
  Do not treat it as a production database. It is process-local and ephemeral by design.
</p>
