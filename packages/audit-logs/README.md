<br>

<h1 align="center">@paymesh/audit-logs</h1>

<p align="center">
  <strong>Structured audit trails for Paymesh events and billing actions.</strong>
</p>

<p align="center">
  Capture normalized webhook activity, persist compliance-friendly records, and give teams a clear trail of who did what across payment operations.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#why-use-it">Why use it</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/audit-logs
```

<h2 align="center">Usage</h2>

```ts
import { auditLog } from "@paymesh/audit-logs";
import { stripe } from "@paymesh/stripe";
import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";

const paymesh = createClient({
  provider: stripe(),
  database: postgres(process.env.DATABASE_URL!),
  plugins: [
    auditLog({
      events: ["checkout.*", "payment.*", "customer.*"],
      mode: "async",
      retention: "1y",
    }),
  ],
});

await paymesh.auditLog.create({
  action: "invoice.sent",
  resource: {
    type: "invoice",
    id: "inv_123",
  },
  message: "Invoice sent to customer",
});

const entries = await paymesh.auditLog.list({
  action: "invoice.sent",
  limit: 10,
});

console.log(entries.total);
```

<h2 align="center">What It Does</h2>

<p align="center">
  <code>@paymesh/audit-logs</code> can automatically persist normalized Paymesh webhook events, supports event pattern filters like <code>payment.*</code>, stores request metadata, and exposes a runtime client extension with <code>create</code>, <code>list</code>, and <code>prune</code> operations.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/audit-logs</code> turns billing events into durable operational records. It can automatically capture webhook-driven activity and also lets your application write custom entries for internal actions that matter to finance, support, and compliance workflows.
</p>

<p align="center">
  That gives your team a much clearer system of record around payment operations.
</p>
