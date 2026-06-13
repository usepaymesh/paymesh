import Image from 'next/image';
import { codeToTokens } from 'shiki';
import paymeshIcon from '../../assets/icon.png';
import { CodeTabs } from '../components/landing/code-tabs';
import { LineFieldBackground } from '../components/landing/line-field-bg';

type ProviderIconId =
	| 'stripe'
	| 'paypal'
	| 'polar'
	| 'abacatepay'
	| 'dodo'
	| 'mercadopago'
	| 'paddle'
	| 'lemonsqueezy'
	| 'custom';

interface ProviderCard {
	id: string;
	name: string;
	status: string;
	headline: string;
	description: string;
	icon: ProviderIconId;
	tags: string[];
}

const topLinks = [
	{ label: 'README', href: '#readme', active: true },
	{ label: 'DOCS', href: '/docs/introduction', active: false },
	{
		label: 'SPONSOR',
		href: 'https://github.com/sponsors/almeidazs',
		active: false,
		external: true,
	},
];

function GitHubSponsorHeart({ className }: { className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="none"
			height="16"
			viewBox="0 0 16 16"
			width="16"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M8 14.25C3.75 11.33 1.5 8.97 1.5 6.08C1.5 3.91 3.16 2.25 5.18 2.25C6.42 2.25 7.42 2.81 8 3.76C8.58 2.81 9.58 2.25 10.82 2.25C12.84 2.25 14.5 3.91 14.5 6.08C14.5 8.97 12.25 11.33 8 14.25Z"
				stroke="#DB61A2"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

function SponsorButton({ compact = false }: { compact?: boolean }) {
	return (
		<span
			className={cn(
				'inline-flex items-center justify-center gap-2 whitespace-nowrap bg-[var(--landing-panel-bg)] text-[color:var(--landing-text)] transition-colors',
				compact
					? 'min-h-8 px-2 text-[11px] sm:min-h-9 sm:px-3 sm:text-sm'
					: 'min-h-10 border border-dashed border-[color:var(--landing-border-strong)] px-5 py-2 text-sm font-medium hover:bg-[color:var(--landing-panel-bg-hover)]',
			)}
		>
			<GitHubSponsorHeart />
			<span>Sponsor</span>
		</span>
	);
}

const trustedLogos = [
	'Stripe',
	'PayPal',
	'Next.js',
	'Bun',
	'Express',
	'Fastify',
	'Hono',
	'Elysia',
];

const providerCards: ProviderCard[] = [
	{
		id: '01',
		name: 'Stripe',
		status: 'supported',
		headline: 'Stripe is live.',
		description:
			'Checkout sessions, customers, refunds, subscriptions, and webhook normalization.',
		icon: 'stripe',
		tags: ['checkout', 'customers', 'webhooks'],
	},
	{
		id: '02',
		name: 'PayPal',
		status: 'coming soon',
		headline: 'PayPal next.',
		description:
			'Wallet and global checkout flows through the same typed Paymesh client.',
		icon: 'paypal',
		tags: ['wallet', 'capture', 'global'],
	},
	{
		id: '03',
		name: 'Polar',
		status: 'supported',
		headline: 'Polar is live.',
		description:
			'Merchant-of-record billing through the same normalized Paymesh client.',
		icon: 'polar',
		tags: ['MoR', 'customers', 'webhooks'],
	},
	{
		id: '04',
		name: 'AbacatePay',
		status: 'supported',
		headline: 'AbacatePay is live.',
		description:
			'PIX transparent charges, checkout sessions, customers, and webhooks through the same Paymesh client.',
		icon: 'abacatepay',
		tags: ['pix', 'BRL', 'webhooks'],
	},
	{
		id: '05',
		name: 'Dodo Payments',
		status: 'supported',
		headline: 'Dodo is live.',
		description:
			'Catalog-driven hosted payments, customers, subscriptions, and webhook normalization through the same Paymesh client.',
		icon: 'dodo',
		tags: ['catalog', 'hosted', 'webhooks'],
	},
	{
		id: '06',
		name: 'Mercado Pago',
		status: 'planned',
		headline: 'LATAM expansion.',
		description:
			'Additional regional coverage for merchants that need more than one local provider.',
		icon: 'mercadopago',
		tags: ['LATAM', 'wallet', 'cards'],
	},
	{
		id: '07',
		name: 'Paddle',
		status: 'planned',
		headline: 'Paddle later.',
		description:
			'One more merchant-of-record route without changing the rest of your codebase.',
		icon: 'paddle',
		tags: ['MoR', 'SaaS', 'billing'],
	},
	{
		id: '08',
		name: 'Lemon Squeezy',
		status: 'planned',
		headline: 'Digital goods too.',
		description:
			'Licenses, subscriptions, and digital product flows under the same interface.',
		icon: 'lemonsqueezy',
		tags: ['licenses', 'subscriptions', 'digital'],
	},
	{
		id: '09',
		name: 'Custom Adapter',
		status: 'available',
		headline: 'Bring your own.',
		description:
			'Map any gateway or internal processor into the Paymesh provider contract.',
		icon: 'custom',
		tags: ['adapters', 'hooks', 'typed'],
	},
];

const codeSnippets = {
	payments: `import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
});

const payment = await client.payments.create({
  amount: 1490,
  currency: "USD",
  customer: { email: "alice@paymesh.dev" },
});`,
	customers: `import { createClient } from "paymesh";
import { polar } from "@paymesh/polar";

const client = createClient({
  provider: polar({
    accessToken: "polar_access_123",
    webhookSecret: "whsec_polar_123",
  }),
});

const customer = await client.customers.upsert({
  email: "alice@paymesh.dev",
  externalId: "user_123",
  name: "Alice",
});

const fetched = await client.customers.get(customer.id);

await client.customers.delete(fetched.id);`,
	webhooks: `import { Elysia } from "elysia";
import { createClient } from "paymesh";
import { Webhooks } from "@paymesh/elysia";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({
    secret: "sk_test_123",
    webhookSecret: "whsec_123",
  }),
});

export const app = new Elysia().post(
  "/webhooks/paymesh",
  Webhooks({
    client,

    async onPaymentSucceeded(event) {
      console.log("payment.succeeded", event.id);
    },
  }),
);`,
	pix: `const pix = await client.pix.create({
  amount: 3500,
  currency: "BRL",
  description: "Invoice #42",
  customer: {
    email: "ada@example.com",
    externalId: "user_123",
  },
  pix: {
    expiresAfterSeconds: 900,
  },
});

console.log(pix.copyPasteCode, pix.instructionsUrl);`,
	plugins: `import { Dashboard, dash } from "@paymesh/dash";
import { auditLog } from "@paymesh/audit-logs";
import { postgres } from "@paymesh/postgres";
import { createClient } from "paymesh";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: postgres("postgresql://localhost:5432/paymesh", {
    persistRaw: true,
  }),
  plugins: [
    dash({
      auth({ request }) {
        const actorId = request.headers.get("x-actor-id") ?? "usr_123";

        return {
          id: actorId,
          email: "ops@paymesh.dev",
          name: "Ops",
        };
      },
    }),
    auditLog({
      events: ["checkout.*", "payment.*", "customer.*"],
    }),
  ],
  hooks: {
    async onEvent(event) {
      console.log("audit event:", event.type);
    },
  },
});

const dashboard = Dashboard({ client });`,
	postgres: `import { createClient } from "paymesh";
import { postgres } from "@paymesh/postgres";
import { stripe } from "@paymesh/stripe";

const client = createClient({
  provider: stripe({ secret: "sk_test_123" }),
  database: postgres("postgresql://localhost:5432/paymesh", {
    persistRaw: true,
  }),
});`,
};

function cn(...classNames: Array<string | false | null | undefined>) {
	return classNames.filter(Boolean).join(' ');
}

const aiPrompt =
	'Explain what Paymesh (paymesh-six.vercel.app) is and why I should use it. Describe how it acts as a provider-agnostic payment infrastructure that simplifies multi-provider integrations, subscriptions, and webhook normalization directly inside my app. Focus on how it helps me ship payments faster, avoid vendor lock-in, keep data in my own database, and stay provider-agnostic. Keep it short, sharp, and persuasive for indie hackers and SaaS founders.';

const aiProviders = [
	{
		id: 'claude',
		label: 'Claude',
		href: `https://claude.ai/new?q=${encodeURIComponent(aiPrompt)}`,
		bg: '#CC9B7A',
		icon: '/ai/claude.svg',
	},
	{
		id: 'chatgpt',
		label: 'ChatGPT',
		href: `https://chat.com?q=${encodeURIComponent(aiPrompt)}`,
		bg: '#10A37F',
		icon: '/ai/chatgpt.svg',
	},
	{
		id: 'gemini',
		label: 'Gemini',
		href: `https://gemini.google.com/app?q=${encodeURIComponent(aiPrompt)}`,
		bg: '#4285F4',
		icon: '/ai/gemini.svg',
	},
	{
		id: 'copilot',
		label: 'Copilot',
		href: `https://copilot.microsoft.com/?q=${encodeURIComponent(aiPrompt)}`,
		bg: '#000000',
		icon: '/ai/copilot.svg',
	},
	{
		id: 'perplexity',
		label: 'Perplexity',
		href: `https://perplexity.ai?q=${encodeURIComponent(aiPrompt)}`,
		bg: '#1FB8CD',
		icon: '/ai/perplexity.svg',
	},
	{
		id: 'grok',
		label: 'Grok',
		href: `https://x.com/i/grok?text=${encodeURIComponent(aiPrompt)}`,
		bg: '#000000',
		icon: '/ai/grok.svg',
	},
];

function ArrowUpRightIcon() {
	return (
		<svg
			aria-hidden="true"
			className="text-[color:var(--landing-text-muted)]"
			fill="none"
			height="16"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
			width="16"
		>
			<line x1="7" x2="17" y1="17" y2="7" />
			<polyline points="7 7 17 7 17 17" />
		</svg>
	);
}

function OpenAIIcon() {
	return (
		<svg
			aria-hidden="true"
			fill="currentColor"
			height="20"
			viewBox="0 0 24 24"
			width="20"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M22.282 9.821a6 6 0 0 0-.516-4.91a6.05 6.05 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a6 6 0 0 0-3.998 2.9a6.05 6.05 0 0 0 .743 7.097a5.98 5.98 0 0 0 .51 4.911a6.05 6.05 0 0 0 6.515 2.9A6 6 0 0 0 13.26 24a6.06 6.06 0 0 0 5.772-4.206a6 6 0 0 0 3.997-2.9a6.06 6.06 0 0 0-.747-7.073M13.26 22.43a4.48 4.48 0 0 1-2.876-1.04l.141-.081l4.779-2.758a.8.8 0 0 0 .392-.681v-6.737l2.02 1.168a.07.07 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494M3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085l4.783 2.759a.77.77 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646M2.34 7.896a4.5 4.5 0 0 1 2.366-1.973V11.6a.77.77 0 0 0 .388.677l5.815 3.354l-2.02 1.168a.08.08 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.08.08 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667m2.01-3.023l-.141-.085l-4.774-2.782a.78.78 0 0 0-.785 0L9.409 9.23V6.897a.07.07 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.8.8 0 0 0-.393.681zm1.097-2.365l2.602-1.5l2.607 1.5v2.999l-2.597 1.5l-2.607-1.5Z" />
		</svg>
	);
}

function FastifyIcon() {
	return (
		<Image
			alt=""
			className="h-[14px] w-[14px] object-contain dark:invert"
			height={14}
			src="/providers/fastify.svg"
			unoptimized
			width={14}
		/>
	);
}

function PaymeshBrand() {
	return (
		<div className="flex items-center gap-2.5">
			<span className="inline-flex h-[17px] w-[17px] items-center justify-center overflow-hidden rounded-[2px]">
				<Image
					alt="Paymesh"
					className="h-full w-full object-contain dark:invert"
					priority
					src={paymeshIcon}
				/>
			</span>
			<span className="text-[15px] font-medium tracking-tight text-[color:var(--landing-text)]">
				PAYMESH.
			</span>
		</div>
	);
}

function ProviderBadgeIcon({ icon }: { icon: ProviderIconId }) {
	if (icon === 'polar') {
		return (
			<svg
				aria-hidden="true"
				className="text-[color:var(--landing-text)]"
				fill="none"
				height="11"
				viewBox="0 0 24 24"
				width="11"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M6 3.5h6.8c3.43 0 5.7 2.06 5.7 5.15c0 3.2-2.4 5.35-5.95 5.35H9.2V20.5H6zM9.2 11.35h3.06c1.92 0 3.04-.9 3.04-2.56c0-1.64-1.12-2.54-3.04-2.54H9.2z"
					fill="currentColor"
				/>
			</svg>
		);
	}

	if (icon === 'dodo') {
		return (
			<svg
				aria-hidden="true"
				fill="none"
				height="11"
				viewBox="0 0 24 24"
				width="11"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M7 4h5.4c3.9 0 6.6 2.52 6.6 6.97S16.3 18 12.4 18H7zm3.1 2.7v8.6h1.9c2.2 0 3.8-1.36 3.8-4.3c0-2.93-1.6-4.3-3.8-4.3z"
					fill="#F6D34F"
				/>
			</svg>
		);
	}

	if (icon === 'abacatepay') {
		return (
			<svg
				aria-hidden="true"
				fill="none"
				height="11"
				viewBox="0 0 24 24"
				width="11"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M12.86 4.2c3.56 0 6.14 2.76 6.14 6.52c0 4.3-3.04 8.08-7 8.08s-7-3.78-7-8.08c0-3.76 2.58-6.52 6.14-6.52c.17-.95.8-1.95 1.86-2.7c.67-.46 1.33-.68 2-.74c-.24.95-.83 1.73-1.56 2.32c-.22.18-.4.41-.58.62"
					fill="#86D24B"
				/>
				<circle cx="12" cy="12.2" fill="#4F3423" r="1.95" />
			</svg>
		);
	}

	if (icon === 'custom') {
		return (
			<svg
				aria-hidden="true"
				className="text-[color:var(--landing-text)]"
				fill="none"
				height="11"
				viewBox="0 0 24 24"
				width="11"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M8 4v5m8-5v5m-8 0h8m-9 0H5v4a4 4 0 0 0 4 4h1v3h4v-3h1a4 4 0 0 0 4-4V9h-2"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
				/>
			</svg>
		);
	}

	return (
		<Image
			alt=""
			className="h-[11px] w-[11px] object-contain"
			height={11}
			src={`/providers/${icon}.svg`}
			unoptimized
			width={11}
		/>
	);
}

function TrustedLogo({ label }: { label: string }) {
	if (label === 'OpenAI') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<OpenAIIcon />
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					OpenAI
				</span>
			</div>
		);
	}

	if (label === 'Next.js') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<svg
					aria-hidden="true"
					fill="currentColor"
					height="15"
					viewBox="0 0 24 24"
					width="15"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10m4-14h-1.35v4H16zM9.346 9.71l6.059 7.828l1.054-.809L9.683 8H8v7.997h1.346z" />
				</svg>
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					Next.js
				</span>
			</div>
		);
	}

	if (label === 'Bun') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<Image
					alt=""
					className="h-[14px] w-[14px] object-contain dark:hidden"
					height={14}
					src="/providers/bun.svg"
					unoptimized
					width={14}
				/>
				<Image
					alt=""
					className="hidden h-[14px] w-[14px] object-contain dark:block"
					height={14}
					src="/providers/bun-dark.svg"
					unoptimized
					width={14}
				/>
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					Bun
				</span>
			</div>
		);
	}

	if (label === 'Fastify') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<FastifyIcon />
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					Fastify
				</span>
			</div>
		);
	}

	if (label === 'Hono') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<Image
					alt=""
					className="h-[14px] w-[14px] object-contain dark:hidden"
					height={14}
					src="/providers/hono.svg"
					unoptimized
					width={14}
				/>
				<Image
					alt=""
					className="hidden h-[14px] w-[14px] object-contain dark:block"
					height={14}
					src="/providers/hono-dark.svg"
					unoptimized
					width={14}
				/>
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					Hono
				</span>
			</div>
		);
	}

	if (label === 'Elysia') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<Image
					alt=""
					className="h-[14px] w-[14px] object-contain dark:hidden"
					height={14}
					src="/providers/elysia.svg"
					unoptimized
					width={14}
				/>
				<Image
					alt=""
					className="hidden h-[14px] w-[14px] object-contain dark:block"
					height={14}
					src="/providers/elysia-dark.svg"
					unoptimized
					width={14}
				/>
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					Elysia
				</span>
			</div>
		);
	}

	if (label === 'Express') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<Image
					alt=""
					className="h-[14px] w-[14px] object-contain dark:hidden"
					height={14}
					src="/providers/express.svg"
					unoptimized
					width={14}
				/>
				<Image
					alt=""
					className="hidden h-[14px] w-[14px] object-contain dark:block"
					height={14}
					src="/providers/express-dark.svg"
					unoptimized
					width={14}
				/>
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					Express
				</span>
			</div>
		);
	}

	if (label === 'Stripe' || label === 'PayPal') {
		return (
			<div className="flex items-center gap-2 px-5 text-[color:var(--landing-text-muted)]">
				<Image
					alt=""
					className="h-[14px] w-[14px] object-contain"
					height={14}
					src={`/providers/${label.toLowerCase()}.svg`}
					unoptimized
					width={14}
				/>
				<span className="whitespace-nowrap text-xs font-medium tracking-wide">
					{label}
				</span>
			</div>
		);
	}

	return (
		<div className="px-5 text-xs font-medium tracking-wide text-[color:var(--landing-text-faint)]">
			{label}
		</div>
	);
}

export default async function Home() {
	const tabLabels: Record<string, string> = {
		payments: 'Payments',
		customers: 'Customers',
		webhooks: 'Webhooks',
		pix: 'PIX',
		plugins: 'Plugins',
		postgres: 'Postgres',
	};

	const highlightedTabs = await Promise.all(
		Object.entries(codeSnippets).map(async ([id, source]) => {
			const [lightHighlighted, darkHighlighted] = await Promise.all([
				codeToTokens(source, {
					lang: 'ts',
					theme: 'min-light',
				}),
				codeToTokens(source, {
					lang: 'ts',
					theme: 'min-dark',
				}),
			]);

			return {
				id,
				label: tabLabels[id] ?? 'Database',
				source,
				lightLines: lightHighlighted.tokens.map((line, index) => ({
					key: `line-light-${index}-${
						line.map((token) => `${token.offset}:${token.content}`).join('|') ||
						'empty'
					}`,
					tokens: line,
				})),
				darkLines: darkHighlighted.tokens.map((line, index) => ({
					key: `line-${index}-${
						line.map((token) => `${token.offset}:${token.content}`).join('|') ||
						'empty'
					}`,
					tokens: line,
				})),
			};
		}),
	);

	return (
		<main className="relative min-h-dvh bg-[var(--landing-bg)] pt-[45px] text-[color:var(--landing-text)] lg:pt-0">
			<div className="relative">
				<div className="flex flex-col lg:flex-row">
					<div className="relative z-10 w-full border-b border-[color:var(--landing-border)] bg-[var(--landing-panel-bg)] px-5 sm:px-6 lg:sticky lg:top-0 lg:h-dvh lg:w-[40%] lg:overflow-clip lg:border-r lg:border-b-0 lg:px-7">
						<LineFieldBackground />

						<div className="absolute left-5 top-4 z-[4] lg:left-7">
							<PaymeshBrand />
						</div>

						<div className="relative z-[2] flex h-full w-full flex-col justify-center py-16">
							<div>
								<a
									className="group/badge pointer-events-auto relative inline-flex items-center gap-1.5 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-card-bg)] px-2.5 py-1 transition-colors hover:bg-[color:var(--landing-card-bg)]"
									href="#providers"
								>
									<svg
										aria-hidden="true"
										className="text-[color:var(--landing-text)]"
										height="14"
										viewBox="0 0 24 24"
										width="14"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M13 4V2c4.66.5 8.33 4.19 8.85 8.85c.6 5.49-3.35 10.43-8.85 11.03v-2c3.64-.45 6.5-3.32 6.96-6.96A7.994 7.994 0 0 0 13 4m-7.33.2A9.8 9.8 0 0 1 11 2v2.06c-1.43.2-2.78.78-3.9 1.68zM2.05 11a9.8 9.8 0 0 1 2.21-5.33L5.69 7.1A8 8 0 0 0 4.05 11zm2.22 7.33A10.04 10.04 0 0 1 2.06 13h2c.18 1.42.75 2.77 1.63 3.9zm1.4 1.41l1.39-1.37h.04c1.13.88 2.48 1.45 3.9 1.63v2c-1.96-.21-3.82-1-5.33-2.26M12 17l1.56-3.42L17 12l-3.44-1.56L12 7l-1.57 3.44L7 12l3.43 1.58z"
											fill="currentColor"
										/>
									</svg>
									<span className="text-xs font-light text-[color:var(--landing-text)] sm:text-sm">
										Introducing{' '}
										<span className="font-normal">| Payment Mesh</span>
									</span>
									<svg
										aria-hidden="true"
										className="text-[color:var(--landing-text-muted)] transition-transform group-hover/badge:translate-x-0.5"
										fill="none"
										height="13"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
										viewBox="0 0 24 24"
										width="13"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path d="M5 12h14m-6-6l6 6l-6 6" />
									</svg>
								</a>

								<h1 className="max-w-[34rem] pt-4 text-2xl leading-tight tracking-tight text-[color:var(--landing-text)] md:text-3xl xl:text-4xl">
									Provider-agnostic payments infrastructure for TypeScript
									teams.
								</h1>

								<div className="pointer-events-auto flex flex-wrap items-center gap-2 pt-5 sm:gap-3">
									<a
										className="relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 bg-[var(--landing-accent-bg)] px-5 py-2 text-sm font-medium text-[var(--landing-accent-text)] shadow-[inset_0_0_0_1px_var(--landing-border-strong)] transition-colors hover:bg-[var(--landing-accent-bg-hover)]"
										href="/docs/introduction"
									>
										Get Started
									</a>
									<a
										className="relative z-10"
										href="https://github.com/sponsors/almeidazs"
										rel="noreferrer"
										target="_blank"
									>
										<SponsorButton />
									</a>
								</div>
							</div>
						</div>
					</div>

					<div className="relative z-0 w-full overflow-x-hidden lg:w-[60%]">
						<nav className="sticky top-0 z-20 grid grid-cols-3 border-b border-[color:var(--landing-border)] bg-[var(--landing-panel-bg)]">
							{topLinks.map((link) => (
								<a
									className={cn(
										'flex min-h-14 items-center justify-center border-l border-[color:var(--landing-border)] px-2 text-[11px] tracking-[0.09em] text-[color:var(--landing-text-muted)] transition-colors hover:text-[color:var(--landing-text-soft)] sm:min-h-16 sm:px-3 sm:text-[12px]',
										link.active &&
											'text-[color:var(--landing-text)] shadow-[inset_0_-1px_0_var(--landing-border-strong)]',
									)}
									href={link.href}
									key={link.label}
									rel={link.external ? 'noreferrer' : undefined}
									target={link.external ? '_blank' : undefined}
								>
									{link.label === 'SPONSOR' ? (
										<SponsorButton compact />
									) : (
										link.label
									)}
								</a>
							))}
						</nav>

						<div className="flex items-start justify-center lg:items-center">
							<div className="flex w-full flex-col">
								<div className="no-scrollbar flex-1 overflow-x-hidden">
									<div className="p-5 lg:px-8 lg:pt-10">
										<article className="no-scrollbar pb-0">
											<h1
												className="mb-4 flex items-center gap-3 text-sm text-[color:var(--landing-text)] sm:mb-5 sm:text-[15px]"
												id="readme"
												style={{ fontFamily: 'var(--font-mono)' }}
											>
												README
												<span className="h-px flex-1 bg-[color:var(--landing-border-strong)]" />
											</h1>

											<p className="mb-6 text-sm leading-relaxed text-[color:var(--landing-text-soft)] sm:mb-8 sm:text-[15px]">
												Payments that live{' '}
												<span className="font-medium text-[color:var(--landing-text)]">
													inside your app
												</span>
												. Composable, provider-based, and built to scale -
												powering from indie launches to the biggest{' '}
												<span className="font-medium text-[color:var(--landing-text)]">
													multi-provider billing stacks
												</span>{' '}
												on the internet.
											</p>

											<CodeTabs
												tabs={highlightedTabs.map(
													({ id, label, lightLines, darkLines, source }) => ({
														id,
														label,
														lightLines,
														darkLines,
														source,
													}),
												)}
											/>

											<div className="my-4 flex items-center gap-3">
												<div className="flex-1 border-t border-[color:var(--landing-border)]" />
												<span
													className="shrink-0 text-[11px] uppercase tracking-wider text-[color:var(--landing-text-muted)] sm:text-xs"
													style={{ fontFamily: 'var(--font-mono)' }}
												>
													Frameworks / Providers
												</span>
											</div>

											<div className="space-y-3">
												<div className="relative overflow-hidden">
													<div
														className="pointer-events-none absolute inset-0 z-10"
														style={{
															maskImage:
																'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
															WebkitMaskImage:
																'linear-gradient(to right, transparent, black 15%, black 85%, transparent)',
														}}
													>
														<div className="flex w-fit animate-logo-marquee">
															{[0, 1].map((setIndex) => (
																<div className="flex shrink-0" key={setIndex}>
																	{trustedLogos.map((logo) => (
																		<TrustedLogo
																			key={`${setIndex}-${logo}`}
																			label={logo}
																		/>
																	))}
																</div>
															))}
														</div>
													</div>
													<div aria-hidden="true" className="flex invisible">
														<TrustedLogo label="Stripe" />
													</div>
												</div>
											</div>

											<div className="my-4 flex items-center gap-4">
												<span className="shrink-0 text-lg font-medium tracking-tight text-[color:var(--landing-text)]">
													Providers
												</span>
												<div className="flex-1 border-t border-[color:var(--landing-border-strong)]" />
											</div>

											<div
												className="relative mb-2 grid grid-cols-1 overflow-hidden border border-[color:var(--landing-border)] sm:grid-cols-2 md:grid-cols-3"
												id="providers"
											>
												{providerCards.map((provider, index) => (
													<a
														className="contents"
														href="#code"
														key={provider.id}
													>
														<article
															className={cn(
																'group relative min-h-[168px] border-[color:var(--landing-border)] p-4 transition-all duration-200 hover:z-10 hover:bg-[var(--landing-card-bg)] hover:shadow-[inset_0_1px_0_0_var(--landing-border)] lg:p-5',
																index < 8 && 'border-b',
																index >= 6 && 'md:border-b-0',
																index % 2 === 0 && index < 8 && 'sm:border-r',
																index % 3 === 2 && 'md:border-r-0',
																index % 2 !== 0 &&
																	index % 3 !== 2 &&
																	'md:border-r',
															)}
														>
															<span className="absolute right-3 top-3 -translate-y-0.5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 lg:right-4 lg:top-4">
																<ArrowUpRightIcon />
															</span>

															<div className="mb-1">
																<div
																	className="tracking-wider text-[color:var(--landing-text-faint)] transition-colors duration-200 group-hover:text-[color:var(--landing-text-muted)]"
																	style={{
																		fontFamily: 'var(--font-mono)',
																		fontSize: '11px',
																	}}
																>
																	{provider.id}
																</div>
																<div className="text-[13px] font-medium text-[color:var(--landing-text)]">
																	{provider.headline}
																</div>
															</div>

															<div className="text-[13px] leading-relaxed text-[color:var(--landing-text-muted)] transition-colors duration-200 group-hover:text-[color:var(--landing-text-soft)]">
																{provider.description}
															</div>

															<div className="mt-3 flex items-center gap-2.5">
																<div className="relative flex items-center gap-2">
																	<div className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-[color:var(--landing-border)]" />
																	<div className="relative flex h-6 w-6 shrink-0 items-center justify-center border border-[color:var(--landing-border)] bg-[var(--landing-panel-bg)] opacity-70 transition-opacity duration-300 group-hover:opacity-100">
																		<ProviderBadgeIcon icon={provider.icon} />
																	</div>
																</div>

																<div className="relative flex flex-1 items-center gap-1 overflow-hidden">
																	{provider.tags.map((tag, tagIndex) => (
																		<span
																			className={cn(
																				'shrink-0 border px-1.5 py-0.5 font-mono text-[8px] whitespace-nowrap',
																				tagIndex < 2
																					? 'border-[color:var(--landing-border)] bg-[var(--landing-card-bg)] text-[color:var(--landing-text-muted)]'
																					: 'border-[color:var(--landing-border)] text-[color:var(--landing-text-faint)]',
																			)}
																			key={tag}
																		>
																			{tag}
																		</span>
																	))}
																	<div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-[image:var(--landing-edge-fade)]" />
																</div>

																<span className="shrink-0 border border-dashed border-[color:var(--landing-border-strong)] px-1.5 py-0.5 font-mono text-[8px] text-[color:var(--landing-text-faint)]">
																	{provider.status}
																</span>
															</div>
														</article>
													</a>
												))}

												<span className="absolute left-1/3 top-1/3 z-10 hidden -translate-x-1/2 -translate-y-1/2 select-none font-mono text-[10px] text-[color:var(--landing-text-faint)] md:block">
													+
												</span>
												<span className="absolute left-2/3 top-1/3 z-10 hidden -translate-x-1/2 -translate-y-1/2 select-none font-mono text-[10px] text-[color:var(--landing-text-faint)] md:block">
													+
												</span>
												<span className="absolute left-1/3 top-2/3 z-10 hidden -translate-x-1/2 -translate-y-1/2 select-none font-mono text-[10px] text-[color:var(--landing-text-faint)] md:block">
													+
												</span>
												<span className="absolute left-2/3 top-2/3 z-10 hidden -translate-x-1/2 -translate-y-1/2 select-none font-mono text-[10px] text-[color:var(--landing-text-faint)] md:block">
													+
												</span>
											</div>

											<div className="my-4 flex items-center gap-4">
												<span className="shrink-0 text-lg font-medium tracking-tight text-[color:var(--landing-text)]">
													Ask AI about Paymesh
												</span>
												<div className="flex-1 border-t border-[color:var(--landing-border-strong)]" />
											</div>

											<div className="mb-6 flex flex-wrap items-center gap-2">
												{aiProviders.map((provider) => (
													<a
														className="group relative inline-flex h-8 w-8 items-center justify-center rounded-sm transition-all hover:scale-110 hover:shadow-md"
														href={provider.href}
														key={provider.id}
														rel="noreferrer"
														style={{ backgroundColor: provider.bg }}
														target="_blank"
														title={`Ask ${provider.label} about Paymesh`}
													>
														<Image
															alt={provider.label}
															className="h-4 w-4 object-contain"
															height={16}
															src={provider.icon}
															unoptimized
															width={16}
														/>
													</a>
												))}
											</div>
										</article>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
