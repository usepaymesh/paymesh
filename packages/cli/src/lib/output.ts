import pc from 'picocolors';

const SYMBOLS = {
	error: '✖',
	info: 'ℹ',
	list: '•',
	ok: '✓',
	warn: '⚠',
	spark: '✦',
} as const;

export function logInfo(message: string) {
	console.log(`${pc.cyan(SYMBOLS.info)} ${message}`);
}

export function logSuccess(message: string) {
	console.log(`${pc.green(SYMBOLS.ok)} ${message}`);
}

export function logWarning(message: string) {
	console.log(`${pc.yellow(SYMBOLS.warn)} ${message}`);
}

export function logError(message: string) {
	console.error(`${pc.red(SYMBOLS.error)} ${message}`);
}

export function logTitle(title: string, detail?: string) {
	const suffix = detail ? ` ${pc.dim(detail)}` : '';
	console.log(`${pc.magenta(SYMBOLS.spark)} ${pc.bold(title)}${suffix}`);
}

export function logList(items: string[]) {
	for (const item of items) {
		console.log(`${pc.dim(SYMBOLS.list)} ${item}`);
	}
}

export function formatPath(value: string) {
	return pc.cyan(value);
}

export function formatValue(value: string) {
	return pc.bold(value);
}

export function formatState(
	value: string,
	tone: 'good' | 'bad' | 'warn' = 'good',
) {
	if (tone === 'good') return pc.green(value);
	if (tone === 'warn') return pc.yellow(value);
	return pc.red(value);
}

export function formatBadge(value: string) {
	return pc.magenta(value);
}
