import {
	Blocks,
	BookOpen,
	Braces,
	Cable,
	CreditCard,
	Database,
	Download,
	FlaskConical,
	GitCompare,
	LayoutDashboard,
	PlugZap,
	QrCode,
	Scale,
	ScrollText,
	SlidersHorizontal,
	Sparkles,
	TableProperties,
	Terminal,
	TerminalSquare,
	TriangleAlert,
	Users,
	Webhook,
} from 'lucide-react';
import Image from 'next/image';
import {
	siDrizzle,
	siExpress,
	siFastify,
	siNextdotjs,
	siPostgresql,
	siPrisma,
	siStripe,
	siTypescript,
} from 'simple-icons';

type DocNavIconName =
	| 'abacatepay'
	| 'blocks'
	| 'book-open'
	| 'braces'
	| 'credit-card'
	| 'database'
	| 'download'
	| 'dodo'
	| 'drizzle'
	| 'elysia'
	| 'express'
	| 'fastify'
	| 'flask'
	| 'git-compare'
	| 'hono'
	| 'hook'
	| 'layout-dashboard'
	| 'next'
	| 'paypal'
	| 'polar'
	| 'postgresql'
	| 'prisma'
	| 'plug-zap'
	| 'qr-code'
	| 'scale'
	| 'scroll-text'
	| 'sliders-horizontal'
	| 'sparkles'
	| 'stripe'
	| 'table-properties'
	| 'terminal'
	| 'terminal-square'
	| 'triangle-alert'
	| 'typescript'
	| 'users'
	| 'webhook';

function SimpleIcon({
	path,
	title,
	hex,
	className = 'size-4',
}: {
	path: string;
	title: string;
	hex: string;
	className?: string;
}) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill={`#${hex}`}
			role="img"
			viewBox="0 0 24 24"
		>
			<title>{title}</title>
			<path d={path} />
		</svg>
	);
}

function ImageIcon({
	src,
	alt,
	className = 'size-4 rounded-[3px]',
	invert = false,
}: {
	src: string;
	alt: string;
	className?: string;
	invert?: boolean;
}) {
	return (
		<Image
			alt={alt}
			className={
				invert
					? `${className} object-contain invert`
					: `${className} object-contain`
			}
			height={16}
			src={src}
			unoptimized
			width={16}
		/>
	);
}

export function DocNavIcon({
	icon,
	className = 'size-4',
}: {
	icon?: string;
	className?: string;
}) {
	switch (icon as DocNavIconName | undefined) {
		case 'abacatepay':
			return (
				<ImageIcon
					alt="AbacatePay"
					className={`${className} rounded-[4px]`}
					src="/providers/abacatepay.svg"
				/>
			);
		case 'book-open':
			return <BookOpen className={className} />;
		case 'download':
			return <Download className={className} />;
		case 'sparkles':
			return <Sparkles className={className} />;
		case 'scale':
			return <Scale className={className} />;
		case 'braces':
			return <Braces className={className} />;
		case 'terminal-square':
			return <TerminalSquare className={className} />;
		case 'hook':
			return <Cable className={className} />;
		case 'users':
			return <Users className={className} />;
		case 'qr-code':
			return <QrCode className={className} />;
		case 'credit-card':
			return <CreditCard className={className} />;
		case 'typescript':
			return (
				<SimpleIcon
					className={className}
					hex={siTypescript.hex}
					path={siTypescript.path}
					title={siTypescript.title}
				/>
			);
		case 'git-compare':
			return <GitCompare className={className} />;
		case 'webhook':
			return <Webhook className={className} />;
		case 'blocks':
			return <Blocks className={className} />;
		case 'database':
			return <Database className={className} />;
		case 'flask':
			return <FlaskConical className={className} />;
		case 'stripe':
			return (
				<SimpleIcon
					className={className}
					hex={siStripe.hex}
					path={siStripe.path}
					title={siStripe.title}
				/>
			);
		case 'polar':
			return (
				<span className="inline-flex items-center justify-center rounded-full bg-[#111827] p-[2px] ring-1 ring-black/10 dark:ring-white/10">
					<ImageIcon
						alt="Polar"
						className={className}
						src="/providers/polar.ico"
					/>
				</span>
			);
		case 'paypal':
			return (
				<ImageIcon
					alt="PayPal"
					className={className}
					src="/providers/paypal.svg"
				/>
			);
		case 'dodo':
			return (
				<ImageIcon
					alt="Dodo Payments"
					className={`${className} rounded-[4px]`}
					src="/providers/dodo.svg"
				/>
			);
		case 'next':
			return (
				<SimpleIcon
					className={className}
					hex={siNextdotjs.hex}
					path={siNextdotjs.path}
					title={siNextdotjs.title}
				/>
			);
		case 'express':
			return (
				<SimpleIcon
					className={className}
					hex={siExpress.hex}
					path={siExpress.path}
					title={siExpress.title}
				/>
			);
		case 'fastify':
			return (
				<SimpleIcon
					className={className}
					hex={siFastify.hex}
					path={siFastify.path}
					title={siFastify.title}
				/>
			);
		case 'hono':
			return (
				<ImageIcon alt="Hono" className={className} src="/providers/hono.ico" />
			);
		case 'elysia':
			return (
				<ImageIcon
					alt="Elysia"
					className={className}
					src="/providers/elysia.png"
				/>
			);
		case 'layout-dashboard':
			return <LayoutDashboard className={className} />;
		case 'scroll-text':
			return <ScrollText className={className} />;
		case 'postgresql':
			return (
				<SimpleIcon
					className={className}
					hex={siPostgresql.hex}
					path={siPostgresql.path}
					title={siPostgresql.title}
				/>
			);
		case 'drizzle':
			return (
				<SimpleIcon
					className={className}
					hex={siDrizzle.hex}
					path={siDrizzle.path}
					title={siDrizzle.title}
				/>
			);
		case 'prisma':
			return (
				<SimpleIcon
					className={className}
					hex={siPrisma.hex}
					path={siPrisma.path}
					title={siPrisma.title}
				/>
			);
		case 'sliders-horizontal':
			return <SlidersHorizontal className={className} />;
		case 'table-properties':
			return <TableProperties className={className} />;
		case 'plug-zap':
			return <PlugZap className={className} />;
		case 'triangle-alert':
			return <TriangleAlert className={className} />;
		case 'terminal':
			return <Terminal className={className} />;
		default:
			return <BookOpen className={className} />;
	}
}
