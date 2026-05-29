'use client';

import { useState } from 'react';

interface DocCodeBlockProps {
	code: string;
	filename?: string;
	lang?: string;
}

function CopyIcon() {
	return (
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
		>
			<rect height="13" rx="2" width="13" x="9" y="9" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

export function DocCodeBlock({
	code,
	filename,
	lang = 'ts',
}: DocCodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1200);
	};

	return (
		<div className="my-5 overflow-hidden rounded-md border border-white/[0.1] bg-[#050505]">
			<div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2">
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
				<button
					aria-label="Copy code"
					className="text-white/32 transition-colors hover:text-white/58"
					onClick={copy}
					type="button"
				>
					{copied ? (
						<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
							Copied
						</span>
					) : (
						<CopyIcon />
					)}
				</button>
			</div>
			<pre className="m-0 overflow-x-auto px-4 py-3 text-[13px] leading-7 text-white/84">
				<code>{code}</code>
			</pre>
		</div>
	);
}
