<br>

<h1 align="center">@paymesh/postgres</h1>

<p align="center">
  <strong>Native Postgres persistence for Paymesh.</strong>
</p>

<p align="center">
  Store normalized customers, checkouts, webhook deliveries, and catalog data directly in PostgreSQL with a first-party adapter built for Paymesh.
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
npm install paymesh @paymesh/postgres pg
```

<h2 align="center">Usage</h2>

```ts
import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";
import { stripe } from "@paymesh/stripe";

const paymesh = createClient({
  provider: stripe(),
  database: postgres(process.env.DATABASE_URL!, {
    persistRaw: true,
  }),
});

const customer = await paymesh.customers.upsert({
  email: "ada@example.com",
  externalId: "user_123",
});

const stored = await paymesh.customers.get(customer.id);

console.log(stored.email);
```

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/postgres</code> wraps a connection string or <code>pg</code> pool, exposes transactions, and persists the normalized Paymesh schema directly into PostgreSQL.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/postgres</code> is the shortest path from provider events to queryable business data. It keeps a normalized local record of your billing state so your app can read from Postgres instead of reaching back into provider APIs for every request.
</p>

<p align="center">
  That means faster pages, simpler reporting, and fewer provider-specific joins in application code.
</p>
