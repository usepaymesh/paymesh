<br>

<h1 align="center">@paymesh/mcp</h1>

<p align="center">
  <strong>Turn your Paymesh client into an MCP server, with the same runtime config your app already uses.</strong>
</p>

<p align="center">
  Expose customers, payments, PIX, and plugin introspection to AI tools through a small MCP server that reads your real Paymesh client instead of a parallel config file.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#available-tools">Available tools</a> ·
  <a href="#why-use-it">Why use it</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install paymesh @paymesh/mcp
```

<h2 align="center">Usage</h2>

```ts
import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

export const billing = createClient({
  provider: stripe({
    secret: process.env.STRIPE_API_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  mcp: {
    readonly: true,
    maxListLimit: 50,
    tools: {
      customers: true,
      payments: true,
      pix: true,
      plugins: true,
    },
  },
});
```

```bash
npx @paymesh/mcp \
  --client ./src/lib/paymesh.ts \
  --export billing \
  --readonly \
  --max-list-limit 50
```

```bash
codex mcp add paymesh -- npx -y @paymesh/mcp \
  --client ./src/lib/paymesh.ts \
  --export billing \
  --readonly \
  --max-list-limit 50
```

<p align="center">
  The final MCP config is resolved from Paymesh defaults, then <code>client.$mcp</code>, then CLI flags. That keeps the MCP server aligned with the same client module your application imports.
</p>

<h2 align="center">Available Tools</h2>

<p align="center">
  <code>@paymesh/mcp</code> exposes <code>customers_list</code>, <code>customers_get</code>, <code>customers_upsert</code>, <code>customers_delete</code>, <code>payments_create</code>, <code>pix_create</code>, <code>pix_get</code>, and <code>plugins_list</code>.
</p>

<p align="center">
  Readonly mode automatically hides mutating tools, and live-mode providers stay blocked unless you explicitly enable <code>allowLiveMode</code>.
</p>

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/mcp</code> lets AI tooling talk to your billing layer through the exact Paymesh client your product already trusts. No duplicated provider credentials, no second schema, and no separate MCP-specific business logic.
</p>

<p align="center">
  That keeps the MCP surface small, predictable, and aligned with your real application runtime.
</p>
