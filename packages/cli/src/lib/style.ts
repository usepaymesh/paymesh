import { bold, cyan, dim, underline, white } from 'picocolors';

const PAYMESH_LOGO = [
	'  ▗▄██▙▟███▙▖',
	' ▟██████████▙',
	' ████████████',
	'▟████████████▙',
	'██████████████',
	'▜████████████▌',
	' ▝██████████▛',
	'   ▜██▛▀▀▀▘',
] as const;

export function printWelcome({
	version,
	docsUrl = 'https://paymesh-six.vercel.app/',
}: {
	version: string;
	docsUrl?: string;
}) {
	const title = `${bold('Paymesh')} ${dim(`v${version}`)}`;
	const subtitle = dim('Unified payments for modern TypeScript products.');
	const docs = `${dim('Docs')} ${cyan(underline(docsUrl))}`;
	const hint = dim(
		'Start with providers, webhooks, checkout, coupons, and Pix.',
	);

	const logoWidth = Math.max(...PAYMESH_LOGO.map((line) => line.length));

	const lines = PAYMESH_LOGO.map((line, index) => {
		const right =
			index === 2
				? title
				: index === 3
					? subtitle
					: index === 5
						? docs
						: index === 6
							? hint
							: '';

		return `${bold(white(line.padEnd(logoWidth)))}  ${right}`;
	});

	console.log();
	console.log(lines.join('\n'));
	console.log();
}
