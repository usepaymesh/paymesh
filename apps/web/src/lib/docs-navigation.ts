export type DocNavItem = {
	label: string;
	href?: string;
	description?: string;
	status?: 'stable' | 'planned';
	icon?: string;
};

export type DocNavGroup = {
	title: string;
	items: DocNavItem[];
};

export const docsNavigation: DocNavGroup[] = [
	{
		title: 'Get Started',
		items: [
			{
				label: 'Introduction',
				href: '/docs/introduction',
				description: 'What Paymesh is and why it exists.',
				icon: 'book-open',
			},
			{
				label: 'Installation',
				href: '/docs/installation',
				description: 'Install Paymesh and wire a first provider.',
				icon: 'download',
			},
			{
				label: 'Basic Usage',
				href: '/docs/basic-usage',
				description: 'Create payments, customers, PIX flows, and webhooks.',
				icon: 'sparkles',
			},
			{
				label: 'Comparison',
				href: '/docs/comparison',
				description: 'Compare Paymesh to direct provider integrations.',
				icon: 'scale',
			},
		],
	},
	{
		title: 'Concepts',
		items: [
			{ label: 'API', href: '/docs/concepts/api', icon: 'braces' },
			{
				label: 'Client',
				href: '/docs/concepts/client',
				icon: 'terminal-square',
			},
			{ label: 'Hooks', href: '/docs/concepts/hooks', icon: 'hook' },
			{
				label: 'TypeScript',
				href: '/docs/concepts/typescript',
				icon: 'typescript',
			},
			{ label: 'Customers', href: '/docs/concepts/customers', icon: 'users' },
			{ label: 'PIX', href: '/docs/concepts/pix', icon: 'qr-code' },
			{
				label: 'Payment Providers',
				href: '/docs/concepts/payment-providers',
				icon: 'credit-card',
			},
		],
	},
	{
		title: 'Guides',
		items: [
			{
				label: 'Create Your First Plugin',
				href: '/docs/guides/create-your-first-plugin',
				icon: 'blocks',
			},
			{
				label: 'Create a Database Adapter',
				href: '/docs/guides/create-a-database-adapter',
				icon: 'database',
			},
			{
				label: 'Create a Provider',
				href: '/docs/guides/create-a-provider',
				icon: 'credit-card',
			},
			{
				label: 'Optimize Performance',
				href: '/docs/guides/optimize-performance',
				icon: 'sparkles',
			},
			{
				label: 'Webhooks at Scale',
				href: '/docs/guides/webhooks-at-scale',
				icon: 'webhook',
			},
		],
	},
	{
		title: 'Providers',
		items: [
			{ label: 'Stripe', href: '/docs/providers/stripe', icon: 'stripe' },
			{ label: 'Polar', href: '/docs/providers/polar', icon: 'polar' },
			{
				label: 'AbacatePay',
				description: 'Planned provider',
				status: 'planned',
				icon: 'abacatepay',
			},
			{
				label: 'PayPal',
				description: 'Planned provider',
				status: 'planned',
				icon: 'paypal',
			},
			{
				label: 'Dodo',
				description: 'Planned provider',
				status: 'planned',
				icon: 'dodo',
			},
		],
	},
	{
		title: 'Adapters',
		items: [
			{ label: 'Next', href: '/docs/adapters/next', icon: 'next' },
			{ label: 'Express', href: '/docs/adapters/express', icon: 'express' },
			{ label: 'Fastify', href: '/docs/adapters/fastify', icon: 'fastify' },
			{ label: 'Hono', href: '/docs/adapters/hono', icon: 'hono' },
			{ label: 'Elysia', href: '/docs/adapters/elysia', icon: 'elysia' },
		],
	},
	{
		title: 'Plugins',
		items: [
			{ label: 'Overview', href: '/docs/plugins/overview', icon: 'blocks' },
			{ label: 'Dash', href: '/docs/plugins/dash', icon: 'layout-dashboard' },
			{
				label: 'Audit Logs',
				href: '/docs/plugins/audit-logs',
				icon: 'scroll-text',
			},
		],
	},
	{
		title: 'Database',
		items: [
			{
				label: 'Overview',
				href: '/docs/database/overview',
				icon: 'database',
			},
			{
				label: 'Postgres',
				href: '/docs/database/postgres',
				icon: 'postgresql',
			},
			{ label: 'Drizzle', href: '/docs/database/drizzle', icon: 'drizzle' },
			{ label: 'Prisma', href: '/docs/database/prisma', icon: 'prisma' },
		],
	},
	{
		title: 'Reference',
		items: [
			{
				label: 'Client Options',
				href: '/docs/reference/client-options',
				icon: 'sliders-horizontal',
			},
			{
				label: 'Database Schema',
				href: '/docs/reference/database-schema',
				icon: 'table-properties',
			},
			{
				label: 'Plugin API',
				href: '/docs/reference/plugin-api',
				icon: 'plug-zap',
			},
			{
				label: 'Errors',
				href: '/docs/reference/errors',
				icon: 'triangle-alert',
			},
			{ label: 'CLI', href: '/docs/reference/cli', icon: 'terminal' },
		],
	},
	{
		title: 'Using with AI',
		items: [
			{
				label: 'LLMs.txt',
				icon: 'sparkles',
				href: '/llms.txt',
			},
			{
				label: 'MCP',
				icon: 'braces',
				status: 'planned',
			},
			{
				label: 'Skills',
				icon: 'scroll-text',
				href: '/docs/ai-resources/skills',
			},
		],
	},
];

export const flattenedDocs = docsNavigation.flatMap((group) =>
	group.items
		.filter((item): item is DocNavItem & { href: string } => Boolean(item.href))
		.map((item) => ({
			...item,
			group: group.title,
		})),
);

export function getDocNeighbors(pathname: string) {
	const index = flattenedDocs.findIndex((item) => item.href === pathname);

	if (index === -1) {
		return {
			prev: null,
			next: null,
		};
	}

	return {
		prev: flattenedDocs[index - 1] ?? null,
		next: flattenedDocs[index + 1] ?? null,
	};
}
