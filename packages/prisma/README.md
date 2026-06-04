<br>

<h1 align="center">@paymesh/prisma</h1>

<p align="center">
  <strong>Prisma adapter for Paymesh-backed billing workflows.</strong>
</p>

<p align="center">
  Reuse your Prisma client, keep billing state inside your existing data layer, and let Paymesh handle the provider-facing complexity.
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
npm install paymesh @paymesh/prisma @prisma/client
```

<h2 align="center">Usage</h2>

```ts
import { prisma as paymeshPrisma } from "@paymesh/prisma";
import { PrismaClient } from "@prisma/client";
import { stripe } from "@paymesh/stripe";
import { createClient } from "paymesh";

const db = new PrismaClient();

const paymesh = createClient({
  provider: stripe(),
  database: paymeshPrisma(db, {
    persistRaw: true,
  }),
});

await paymesh.customers.upsert({
  email: "ada@example.com",
  externalId: "user_123",
});
```

<h2 align="center">What You Get</h2>

<p align="center">
  <code>@paymesh/prisma</code> adapts Prisma raw query execution and transactions into the Paymesh database interface, so your billing state can live inside the same operational layer as the rest of your app.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/prisma</code> keeps your billing workflow inside the Prisma runtime your team already uses for the rest of the product. You get Paymesh normalization and Prisma continuity without rebuilding adapters or duplicating database concerns.
</p>

<p align="center">
  That lowers adoption friction and keeps payment infrastructure easy to reason about.
</p>
