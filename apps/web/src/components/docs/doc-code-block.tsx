import type { BundledLanguage, SpecialLanguage } from 'shiki';
import { codeToTokens } from 'shiki';
import { CopyCodeButton } from './copy-code-button';

interface DocCodeBlockProps {
	code: string;
	filename?: string;
	lang?: BundledLanguage | SpecialLanguage;
	variant?: 'default' | 'minimal';
}

function getTokenStyle(color: string, fontStyle = 0) {
	return {
		color,
		fontStyle: fontStyle & 1 ? 'italic' : 'normal',
		fontWeight: fontStyle & 2 ? 700 : 400,
		textDecoration: fontStyle & 4 ? 'underline' : 'none',
	} as const;
}

function renderLines(
	lines: Awaited<ReturnType<typeof codeToTokens>>['tokens'],
	codeForeground: string,
) {
	return lines.map((line, index) => (
		<span
			className="code-line"
			key={`line-${line[0]?.offset ?? index}-${line.length}`}
		>
			{line.length === 0 ? (
				<span> </span>
			) : (
				line.map((token) => (
					<span
						key={`${token.offset}-${token.content}`}
						style={getTokenStyle(
							token.color ?? codeForeground,
							token.fontStyle,
						)}
					>
						{token.content}
					</span>
				))
			)}
		</span>
	));
}

export async function DocCodeBlock({
	code,
	filename,
	lang = 'ts',
	variant = 'default',
}: DocCodeBlockProps) {
	const [lightHighlighted, darkHighlighted] = await Promise.all([
		codeToTokens(code, {
			lang,
			theme: 'min-light',
		}),
		codeToTokens(code, {
			lang,
			theme: 'min-dark',
		}),
	]);
	const lightForeground = lightHighlighted.fg ?? '#24292e';
	const darkForeground = darkHighlighted.fg ?? '#b392f0';

	if (variant === 'minimal') {
		return (
			<div className="install-code-block relative overflow-x-auto bg-[var(--code-block-bg)]">
				<div className="absolute top-3 right-3 z-10">
					<CopyCodeButton code={code} />
				</div>
				<pre
					className="code-pre dark:hidden"
					style={{ color: lightForeground }}
				>
					<code>{renderLines(lightHighlighted.tokens, lightForeground)}</code>
				</pre>
				<pre
					className="code-pre hidden dark:block"
					style={{ color: darkForeground }}
				>
					<code>{renderLines(darkHighlighted.tokens, darkForeground)}</code>
				</pre>
			</div>
		);
	}

	return (
		<div className="my-5 overflow-hidden rounded-md border border-[var(--code-block-border)]">
			<div className="flex items-center justify-between border-b border-[var(--code-block-border)] bg-[var(--code-block-bg)] px-4 py-2">
				<div className="flex items-center gap-3">
					{filename ? (
						<span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--code-block-muted-strong)]">
							{filename}
						</span>
					) : null}
					<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--code-block-muted)]">
						{lang}
					</span>
				</div>
				<CopyCodeButton code={code} />
			</div>
			<div className="relative overflow-x-auto bg-[var(--code-block-bg)]">
				<pre
					className="code-pre dark:hidden"
					style={{ color: lightForeground }}
				>
					<code>{renderLines(lightHighlighted.tokens, lightForeground)}</code>
				</pre>
				<pre
					className="code-pre hidden dark:block"
					style={{ color: darkForeground }}
				>
					<code>{renderLines(darkHighlighted.tokens, darkForeground)}</code>
				</pre>
			</div>
		</div>
	);
}
