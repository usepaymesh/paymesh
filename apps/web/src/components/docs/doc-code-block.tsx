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

export async function DocCodeBlock({
	code,
	filename,
	lang = 'ts',
	variant = 'default',
}: DocCodeBlockProps) {
	const highlighted = await codeToTokens(code, {
		lang,
		theme: 'min-dark',
	});
	const codeForeground = highlighted.fg ?? '#b392f0';

	if (variant === 'minimal') {
		return (
			<div
				className="install-code-block relative overflow-x-auto bg-[#050505]"
				style={{ color: codeForeground }}
			>
				<div className="absolute top-3 right-3 z-10">
					<CopyCodeButton code={code} />
				</div>
				<pre className="code-pre">
					<code>
						{highlighted.tokens.map((line, index) => (
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
						))}
					</code>
				</pre>
			</div>
		);
	}

	return (
		<div className="my-5 overflow-hidden rounded-md border border-white/[0.1]">
			<div className="flex items-center justify-between border-b border-white/[0.08] bg-[#050505] px-4 py-2">
				<div className="flex items-center gap-3">
					{filename ? (
						<span className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/45">
							{filename}
						</span>
					) : null}
					<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">
						{lang}
					</span>
				</div>
				<CopyCodeButton code={code} />
			</div>
			<div
				className="relative overflow-x-auto bg-[#050505]"
				style={{ color: codeForeground }}
			>
				<pre className="code-pre">
					<code>
						{highlighted.tokens.map((line, index) => (
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
						))}
					</code>
				</pre>
			</div>
		</div>
	);
}
