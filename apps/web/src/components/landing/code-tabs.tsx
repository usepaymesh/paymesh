'use client';

import { useState } from 'react';

interface HighlightToken {
	content: string;
	offset: number;
	color?: string;
	fontStyle?: number;
}

interface HighlightLine {
	key: string;
	tokens: HighlightToken[];
}

interface CodeTab {
	id: string;
	label: string;
	source: string;
	lines: HighlightLine[];
}

interface CodeTabsProps {
	codeForeground: string;
	tabs: CodeTab[];
}

function cn(...classNames: Array<string | false | null | undefined>) {
	return classNames.filter(Boolean).join(' ');
}

function getTokenStyle(color: string, fontStyle = 0) {
	return {
		color,
		fontStyle: fontStyle & 1 ? 'italic' : 'normal',
		fontWeight: fontStyle & 2 ? 700 : 400,
		textDecoration: fontStyle & 4 ? 'underline' : 'none',
	} as const;
}

export function CodeTabs({ codeForeground, tabs }: CodeTabsProps) {
	const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
	const [copied, setCopied] = useState(false);

	const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

	const copyActiveCode = async () => {
		if (!active) return;
		await navigator.clipboard.writeText(active.source);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1200);
	};

	if (!active) return null;

	return (
		<div className="relative mb-6 rounded-md border border-white/[0.1]">
			<div className="flex items-center border-b border-white/[0.1]">
				{tabs.map((tab) => (
					<button
						className={cn(
							'relative px-4 py-2 text-[12px] transition-colors',
							tab.id === active.id ? 'text-neutral-200' : 'text-white/35',
						)}
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						type="button"
					>
						{tab.label}
						{tab.id === active.id ? (
							<div className="absolute bottom-0 left-4 right-4 h-[1.5px] bg-neutral-400" />
						) : null}
					</button>
				))}
			</div>

			<div
				className="relative overflow-x-auto bg-[#050505]"
				id="code"
				style={{ color: codeForeground }}
			>
				<pre className="code-pre">
					<code>
						{active.lines.map((line) => (
							<span className="code-line" key={line.key}>
								{line.tokens.length === 0 ? (
									<span> </span>
								) : (
									line.tokens.map((token) => (
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
				<button
					aria-label="Copy snippet"
					className="absolute right-4 top-4 text-white/35 transition-colors hover:text-white/60"
					onClick={copyActiveCode}
					type="button"
				>
					{copied ? (
						<span className="font-mono text-[11px] text-white/60">copied</span>
					) : (
						<svg
							aria-hidden="true"
							fill="none"
							height="16"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="1.8"
							viewBox="0 0 24 24"
							width="16"
							xmlns="http://www.w3.org/2000/svg"
						>
							<rect height="13" rx="2" width="13" x="9" y="9" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
					)}
				</button>
			</div>
		</div>
	);
}
