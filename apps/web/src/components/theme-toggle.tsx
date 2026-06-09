'use client';

import { useTheme } from 'next-themes';

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<button
			className="inline-flex size-8 items-center justify-center transition-colors"
			onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
			suppressHydrationWarning
			type="button"
		>
			<svg
				aria-hidden="true"
				className="hidden [html.dark_&]:block h-5 w-5"
				fill="none"
				suppressHydrationWarning
				viewBox="0 0 32 32"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M16 2.66667V29.3333C19.5362 29.3333 22.9276 27.9286 25.4281 25.4281C27.9286 22.9276 29.3333 19.5362 29.3333 16C29.3333 12.4638 27.9286 9.07239 25.4281 6.57191C22.9276 4.07142 19.5362 2.66667 16 2.66667Z"
					fill="#fff"
				/>
			</svg>
			<svg
				aria-hidden="true"
				className="hidden [html.light_&]:block"
				fill="none"
				height="1em"
				suppressHydrationWarning
				viewBox="0 0 24 24"
				width="1em"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g
					fill="none"
					stroke="#888888"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="2"
				>
					<path
						d="M12 21v1M21 12h1M12 3v-1M3 12h-1"
						strokeDasharray="2"
						strokeDashoffset="0"
					/>
					<path
						d="M18.5 18.5l0.5 0.5M18.5 5.5l0.5 -0.5M5.5 5.5l-0.5 -0.5M5.5 18.5l-0.5 0.5"
						strokeDasharray="2"
						strokeDashoffset="0"
					/>
					<animateTransform
						attributeName="transform"
						dur="30s"
						repeatCount="indefinite"
						type="rotate"
						values="0 12 12;360 12 12"
					/>
				</g>
				<circle cx="12" cy="12" fill="#424242" r="6" />
			</svg>
			<span className="sr-only">Toggle theme</span>
		</button>
	);
}
