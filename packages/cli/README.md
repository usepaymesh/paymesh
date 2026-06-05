<br>

<h1 align="center">@paymesh/cli</h1>

<p align="center">
  <strong>Operational tooling for Paymesh migrations, status, catalog sync, plugin introspection, and internal event triggering.</strong>
</p>

<p align="center">
  Ship your billing schema with the same confidence you ship application code, using a CLI that reads the exact client module your product runs in production.
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#client-discovery">Client discovery</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#why-use-it">Why use it</a>
</p>

<br>

<h2 align="center">Installation</h2>

```bash
npm install @paymesh/cli
```

<h2 align="center">Client Discovery</h2>

<p align="center">
  The CLI resolves your Paymesh client in three ways: an explicit <code>--client</code> flag, the <code>PAYMESH_PATH</code> environment variable, or <code>package.json.paymesh.path</code>. The client module must export the Paymesh client as the default export or as a named export called <code>paymesh</code>.
</p>

```json
{
  "paymesh": {
    "path": "./src/lib/paymesh.ts"
  }
}
```

```bash
paymesh status --client ./src/lib/paymesh.ts
PAYMESH_PATH=./src/lib/paymesh.ts paymesh generate
paymesh migrate
```

<h2 align="center">Commands</h2>

<p align="center">
  Every command works from the resolved client, so schema, provider, database, catalog, and plugins all come from the same runtime configuration your app actually uses.
</p>

```bash
paymesh generate --client ./src/lib/paymesh.ts
# generates SQL files for schema changes and updates paymesh/history.json

paymesh migrate --client ./src/lib/paymesh.ts
# applies pending local migrations and records them in the configured database

paymesh push --client ./src/lib/paymesh.ts
# syncs provider catalog data into the configured database and reports product/price totals

paymesh status --client ./src/lib/paymesh.ts
# prints provider, database, history, migrations, catalog, webhook, and schema status

paymesh plugins --client ./src/lib/paymesh.ts
# lists the plugins registered in the current client

paymesh trigger customer.created --client ./src/lib/paymesh.ts
# triggers a built-in normalized webhook event with fake data

paymesh trigger customer.created --client ./src/lib/paymesh.ts --data '{"email":"ada@example.com"}'
# merges JSON into the fake built-in event payload

paymesh trigger onCouponRedeemed --client ./src/lib/paymesh.ts --data '{"code":"WELCOME10"}'
# emits a registered plugin event; plugin events require --data
```

<h2 align="center">Why Use It</h2>

<p align="center">
  <code>@paymesh/cli</code> closes the loop between your payment client configuration and your operational workflow. It generates migrations, applies them, checks status, syncs catalog data, and introspects registered plugins from the same client entrypoint your app depends on.
</p>

<p align="center">
  That reduces configuration drift and makes billing infrastructure easier to run as a product surface, not a side script.
</p>
