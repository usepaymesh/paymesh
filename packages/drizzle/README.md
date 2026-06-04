<br>

<h1 align="center">@paymesh/drizzle</h1>

<p align="center">
  <strong>Drizzle adapter for teams that already own the database layer.</strong>
</p>

<p align="center">
  Plug an existing Drizzle connection into Paymesh and keep one source of truth for billing data, migrations, and application queries.
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
npm install paymesh @paymesh/drizzle drizzle-orm
```

<h2 align="center">Usage</h2>

```ts
import { drizzle as paymeshDrizzle } from "@paymesh/drizzle";
import { stripe } from "@paymesh/stripe";
import { createClient } from "paymesh";
import { drizzle } from "drizzle-orm/node-postgres";

const db = drizzle(process.env.DATABASE_URL!);

const paymesh = createClient({
  provider: stripe(),
  database: paymeshDrizzle(db, {
    persistRaw: true,
  }),
});

const customers = await paymesh.customers.list({
  limit: 20,
});

console.log(customers.data.length);
```

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/drizzle</code> adapts an existing Drizzle database instance into the Paymesh database contract, including query execution, transactions, and repository persistence.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/drizzle</code> lets you keep Paymesh inside the database architecture you already trust. Instead of introducing a parallel persistence layer, it adapts your Drizzle session into the Paymesh repository model.
</p>

<p align="center">
  The result is a tighter stack, fewer moving pieces, and a more maintainable billing backend.
</p>
