'use client';

import {
	BookOpen,
	Braces,
	Cable,
	ChevronRight,
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
				<button
					aria-expanded={open}
					aria-label={open ? 'Close docs navigation' : 'Open docs navigation'}
					className="inline-flex items-center gap-2 border border-foreground/10 bg-background/80 px-3 py-1.5 text-sm text-foreground/75 transition-colors hover:text-foreground"
					onClick={() => setOpen((value) => !value)}
					type="button"
				>
					<BookOpen className="size-4" />
					<span>Docs</span>
				</button>
				<div className="[&_button]:text-foreground/65 [&_button:hover]:text-foreground">
					<ThemeToggle />
				</div>
			</div>

			{open ? (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						aria-label="Close docs navigation"
						className="absolute inset-0 bg-black/55"
						onClick={() => setOpen(false)}
						type="button"
					/>

					<aside className="absolute bottom-0 left-0 top-0 flex w-[86vw] max-w-[340px] flex-col border-r border-foreground/8 bg-background shadow-2xl">
						<div className="flex items-center justify-between border-b border-foreground/8 px-4 py-3">
							<div className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/55">
								Documentation
							</div>
							<button
								aria-label="Close docs navigation"
								className="inline-flex size-8 items-center justify-center text-foreground/65"
								onClick={() => setOpen(false)}
								type="button"
							>
								<X className="size-4" />
							</button>
						</div>

						<nav className="flex-1 overflow-y-auto px-3 py-3">
							<div className="space-y-4">
								{docsNavigation.map((section) => {
									const Icon =
										sectionIcons[section.title as keyof typeof sectionIcons] ??
										BookOpen;

									return (
										<div key={section.title}>
											<div className="mb-2 flex items-center gap-2 px-2 text-sm font-medium text-foreground">
												<Icon className="size-4" />
												<span>{section.title}</span>
											</div>

											<div className="space-y-1">
												{section.items.map((item) => {
													if (!item.href) {
														return (
															<div
																className="flex items-center justify-between border border-dashed border-foreground/18 px-3 py-2 text-sm text-foreground/45"
																key={item.label}
															>
																<div className="flex min-w-0 items-center gap-2">
																	<DocNavIcon
																		className="size-3.5 shrink-0"
																		icon={item.icon}
																	/>
																	<span className="truncate">{item.label}</span>
																</div>
																<span className="font-mono text-[9px] uppercase tracking-wider">
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
																	: 'text-foreground/65 hover:bg-foreground/4 hover:text-foreground',
															)}
															href={item.href as Route}
															key={item.href}
															onClick={() => setOpen(false)}
														>
															<DocNavIcon
																className="size-3.5 shrink-0"
																icon={item.icon}
															/>
															<span className="min-w-0 flex-1 truncate">
																{item.label}
															</span>
															<ChevronRight className="size-3.5 shrink-0 text-foreground/30" />
														</Link>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>
						</nav>
					</aside>
				</div>
			) : null}
		</>
	);
}
