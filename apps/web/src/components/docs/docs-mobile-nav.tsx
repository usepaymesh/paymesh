'use client';

import {
	BookOpen,
	Braces,
	Cable,
	Database,
	Package,
	Plug,
	Sparkles,
	X,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { docsNavigation } from '../../lib/docs-navigation';
import { cn } from '../../lib/utils';
import { ThemeToggle } from '../theme-toggle';
import { DocNavIcon } from './doc-nav-icon';

const sectionIcons = {
	'Get Started': BookOpen,
	Concepts: Braces,
	Guides: Cable,
	Providers: Package,
	Adapters: Plug,
	Plugins: Package,
	Database: Database,
	Reference: Braces,
	'Using with AI': Sparkles,
} as const;

export function DocsMobileNav() {
	const pathname = usePathname() || '/docs/introduction';
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	return (
		<>
			<div className="flex items-center gap-2 lg:hidden">
				<div className="[&_button]:text-foreground/65 [&_button:hover]:text-foreground">
					<ThemeToggle />
				</div>
				<button
					aria-expanded={open}
					aria-label={open ? 'Close navigation' : 'Open navigation'}
					className="inline-flex size-8 items-center justify-center border border-foreground/10 bg-background/80 text-foreground/70 transition-colors hover:text-foreground"
					onClick={() => setOpen((value) => !value)}
					type="button"
				>
					{open ? <X className="size-4" /> : <BookOpen className="size-4" />}
				</button>
			</div>

			{open ? (
				<div className="fixed inset-x-0 bottom-0 top-12 z-50 overflow-y-auto border-t border-foreground/8 bg-background/96 backdrop-blur-xl lg:hidden">
					<nav className="mx-auto flex max-w-3xl flex-col px-4 py-4">
						{docsNavigation.map((section) => {
							const Icon =
								sectionIcons[section.title as keyof typeof sectionIcons] ??
								BookOpen;

							return (
								<div
									className="border-b border-foreground/6 py-3 last:border-b-0"
									key={section.title}
								>
									<div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
										<Icon className="size-4" />
										<span>{section.title}</span>
									</div>

									<div className="space-y-1">
										{section.items.map((item) => {
											if (!item.href) {
												return (
													<div
														className="flex items-center justify-between border border-dashed border-foreground/18 px-3 py-2 text-sm text-foreground/50"
														key={item.label}
													>
														<div className="flex min-w-0 items-center gap-2">
															<DocNavIcon
																className="size-3.5 shrink-0"
																icon={item.icon}
															/>
															<span className="truncate">{item.label}</span>
														</div>
														<span className="font-mono text-[10px] uppercase tracking-wider text-foreground/35">
															planned
														</span>
													</div>
												);
											}

											const active = pathname === item.href;

											return (
												<Link
													className={cn(
														'flex items-center gap-2 px-3 py-2 text-sm transition-colors',
														active
															? 'bg-foreground/6 text-foreground'
															: 'text-foreground/70 hover:bg-foreground/4 hover:text-foreground',
													)}
													href={item.href as Route}
													key={item.href}
													onClick={() => setOpen(false)}
												>
													<DocNavIcon
														className="size-3.5 shrink-0"
														icon={item.icon}
													/>
													<span className="truncate">{item.label}</span>
												</Link>
											);
										})}
									</div>
								</div>
							);
						})}

						<div className="mt-4 flex items-center gap-3 px-1 pb-3 text-sm text-foreground/55">
							<a
								className="inline-flex items-center gap-2 hover:text-foreground"
								href="https://github.com/usepaymesh/paymesh"
								rel="noreferrer noopener"
								target="_blank"
							>
								<svg
									aria-hidden="true"
									className="size-4"
									fill="currentColor"
									viewBox="0 0 24 24"
								>
									<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
								</svg>
								<span>GitHub</span>
							</a>
						</div>
					</nav>
				</div>
			) : null}
		</>
	);
}
