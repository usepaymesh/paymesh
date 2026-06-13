import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { InstallPackageTabs } from './install-package-tabs';

const packageDocsLinks: Record<string, string> = {
	paymesh: '/docs/introduction',
	'@paymesh/stripe': '/docs/providers/stripe',
	'@paymesh/polar': '/docs/providers/polar',
	'@paymesh/dodo': '/docs/providers/dodo',
	'@paymesh/next': '/docs/adapters/next',
	'@paymesh/express': '/docs/adapters/express',
	'@paymesh/fastify': '/docs/adapters/fastify',
	'@paymesh/hono': '/docs/adapters/hono',
	'@paymesh/elysia': '/docs/adapters/elysia',
	'@paymesh/memory': '/docs/database/memory',
	'@paymesh/postgres': '/docs/database/postgres',
	'@paymesh/drizzle': '/docs/database/drizzle',
	'@paymesh/prisma': '/docs/database/prisma',
	'@paymesh/dash': '/docs/plugins/dash',
	'@paymesh/audit-logs': '/docs/plugins/audit-logs',
};

function Callout({
	children,
	type = 'info',
	title,
}: {
	children: ReactNode;
	title?: ReactNode;
	type?: 'info' | 'warn' | 'error' | 'success' | 'warning';
}) {
	const resolvedType = type === 'warning' ? 'warn' : type;
	const tone = {
		info: 'border-s-blue-500/50',
		warn: 'border-s-orange-500/50',
		error: 'border-s-red-500/50',
		success: 'border-s-green-500/50',
	}[resolvedType];

	return (
		<div
			className={cn(
				'my-4 flex gap-2 rounded-none border border-s-2 border-dashed bg-fd-card p-3 text-sm text-fd-card-foreground shadow-md',
				tone,
			)}
		>
			{
				{
					info: <Info className="size-5 fill-blue-500 text-fd-card" />,
					warn: (
						<TriangleAlert className="size-5 fill-orange-500 text-fd-card" />
					),
					error: <CircleX className="size-5 fill-red-500 text-fd-card" />,
					success: (
						<CircleCheck className="size-5 fill-green-500 text-fd-card" />
					),
				}[resolvedType]
			}
			<div className="min-w-0 flex flex-1 flex-col gap-2">
				{title ? <p className="!my-0 font-medium">{title}</p> : null}
				<div className="prose-no-margin empty:hidden text-fd-muted-foreground">
					{children}
				</div>
			</div>
		</div>
	);
}

function InlineCode(props: ComponentProps<'code'>) {
	const text =
		typeof props.children === 'string'
			? props.children
			: Array.isArray(props.children) && props.children.length === 1
				? props.children[0]
				: null;

	if (!props.className && typeof text === 'string' && packageDocsLinks[text]) {
		return (
			<Link
				className="font-medium text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground/45"
				href={packageDocsLinks[text] as ComponentProps<typeof Link>['href']}
			>
				{text}
			</Link>
		);
	}

	return <code {...props} />;
}

async function InstallTabs({ packages }: { packages: string }) {
	return <InstallPackageTabs packages={packages} />;
}

export const docsMdxComponents = {
	...defaultMdxComponents,
	Steps,
	Step,
	Tabs,
	Tab,
	TypeTable,
	Callout,
	code: InlineCode,
	InstallTabs,
};
