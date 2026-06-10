import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS: Record<string, string> = {
	next: 'next',
	hono: 'hono',
	express: 'express',
	fastify: 'fastify',
	elysia: 'elysia',
};

export function detectFramework(
	deps: Record<string, string> = {},
): string | null {
	for (const [pattern, id] of Object.entries(PATTERNS)) {
		if (
			Object.keys(deps).some(
				(k) => k === pattern || k.startsWith(`@${pattern}/`),
			)
		)
			return id;
	}

	return null;
}

export function getWebhookPath(framework: string, cwd: string): string {
	const hasSrc = existsSync(join(cwd, 'src'));
	const src = hasSrc ? 'src/' : '';

	const map: Record<string, string> = {
		next: `${src}app/api/paymesh/webhook/route.ts`,
		hono: `${src}index.ts`,
		express: `${src}index.ts`,
		fastify: `${src}index.ts`,
		elysia: `${src}index.ts`,
	};

	return map[framework] || `${src}paymesh-webhook.ts`;
}

export function generateWebhookCode(
	framework: string,
	importPath: string,
): string {
	const templates: Record<string, string> = {
		next: `import { paymesh } from '${importPath}';

export async function POST(request: Request) {
  const result = await paymesh.webhooks.handle(request);
  return new Response(
    JSON.stringify({ received: true, event: result?.type }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}`,
		hono: `import { Hono } from 'hono';
import { paymesh } from '${importPath}';

const app = new Hono();

app.post('/api/paymesh/webhook', async (c) => {
  const result = await paymesh.webhooks.handle(c.req.raw);
  return c.json({ received: true, event: result?.type });
});

export default app;`,
		express: `import express from 'express';
import { paymesh } from '${importPath}';

const app = express();

app.post('/api/paymesh/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const result = await paymesh.webhooks.handle(req);
  res.json({ received: true, event: result?.type });
});

export default app;`,
		fastify: `import Fastify from 'fastify';
import { paymesh } from '${importPath}';

const app = Fastify();

app.post('/api/paymesh/webhook', async (request, reply) => {
  const result = await paymesh.webhooks.handle(request);
  return { received: true, event: result?.type };
});

export default app;`,
		elysia: `import { Elysia } from 'elysia';
import { paymesh } from '${importPath}';

const app = new Elysia();

app.post('/api/paymesh/webhook', async ({ request }) => {
  const result = await paymesh.webhooks.handle(request);
  return { received: true, event: result?.type };
});

export default app;`,
	};

	return (
		templates[framework] ||
		`import { paymesh } from '${importPath}';

export async function handleWebhook(request: Request) {
  const result = await paymesh.webhooks.handle(request);
  return { received: true, event: result?.type };
}`
	);
}
