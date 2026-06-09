'use client';

import { useState } from 'react';

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

export function CopyCodeButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1200);
	};

	return (
		<button
			aria-label="Copy code"
			className="text-[color:var(--code-block-muted)] transition-colors hover:text-[color:var(--code-block-muted-strong)]"
			onClick={copy}
			type="button"
		>
			{copied ? (
				<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--code-block-muted-strong)]">
					Copied
				</span>
			) : (
				<CopyIcon />
			)}
		</button>
	);
}
