'use client';

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import {
	BookOpen,
	Braces,
	Cable,
	ChevronDownIcon,
	Database,
	Package,
	Plug,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
	'Using with AI': Cable,
} as const;

export function DocsSidebar() {
	const pathname = usePathname() || '/docs/introduction';
	const { setOpenSearch } = useSearchContext();
	const [currentOpen, setCurrentOpen] = useState(0);
	const navRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const nextIndex = docsNavigation.findIndex((group) =>
			group.items.some((item) => item.href === pathname),
		);
		setCurrentOpen(nextIndex === -1 ? 0 : nextIndex);
	}, [pathname]);

	useEffect(() => {
		const timer = setTimeout(() => {
			const nav = navRef.current;
			if (!nav) return;
			const activeEl = nav.querySelector<HTMLElement>("[data-active='true']");
			activeEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		}, 380);

		return () => clearTimeout(timer);
	}, []);

	return (
		<motion.aside
			animate={{ opacity: 1, x: 0 }}
			className="fixed left-0 top-(--landing-topbar-height) bottom-0 z-30 hidden w-[22vw] max-w-[300px] flex-col border-r border-foreground/5 bg-background lg:flex"
			initial={{ opacity: 0, x: -24 }}
			transition={{ duration: 0.28, ease: 'easeOut' }}
		>
			<div className="border-b border-foreground/5 px-4 py-2">
				<button
					className="group/search flex w-full items-center gap-2 rounded-md border border-foreground/10 bg-foreground/3 px-3 py-2 text-sm text-foreground/55 transition-colors hover:text-foreground/80"
					onClick={() => setOpenSearch(true)}
					type="button"
				>
					<svg
						aria-hidden="true"
						className="size-4 shrink-0 text-foreground opacity-55 transition-opacity group-hover/search:opacity-80"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.5"
						viewBox="0 0 24 24"
					>
						<circle cx="11" cy="11" r="5.5" />
						<path d="m15 15l4 4" />
					</svg>
					<span className="truncate">Search</span>
					<kbd className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border border-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground/40">
						<span className="text-[11px]">&#8984;</span>K
					</kbd>
				</button>
			</div>

			<nav
				className="sidebar-scroll flex-1 overflow-x-hidden overflow-y-auto pb-3"
				ref={navRef}
				style={{
					maskImage:
						'linear-gradient(to bottom, transparent, white 1rem, white calc(100% - 2rem), transparent 100%)',
				}}
			>
				<MotionConfig
					transition={{ bounce: 0, duration: 0.35, type: 'spring' }}
				>
					<div className="flex flex-col">
						{docsNavigation.map((section, index) => {
							const Icon =
								sectionIcons[section.title as keyof typeof sectionIcons] ??
								BookOpen;

							return (
								<div key={section.title}>
									<button
										className={cn(
											'flex w-full items-center gap-2 border-b border-foreground/6 px-4 py-2.5 text-left text-sm font-medium tracking-wider transition-colors',
											currentOpen === index
												? 'bg-foreground/3 text-foreground'
												: 'text-foreground/70 hover:bg-foreground/3 hover:text-foreground',
										)}
										onClick={() =>
											setCurrentOpen((prev) => (prev === index ? -1 : index))
										}
										type="button"
									>
										<Icon className="size-4.5" />
										<span className="grow tracking-normal">
											{section.title}
										</span>
										<ChevronDownIcon
											className={cn(
												'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
												currentOpen === index && 'rotate-180',
											)}
										/>
									</button>

									<AnimatePresence initial={false}>
										{currentOpen === index ? (
											<motion.div
												animate={{ height: 'auto', opacity: 1 }}
												className="relative overflow-hidden"
												exit={{ height: 0, opacity: 0 }}
												initial={{ height: 0, opacity: 0 }}
											>
												<div className="pb-1 pt-0 text-sm">
													{section.items.map((item) => {
														if (!item.href) {
															return (
																<div
																	className="mx-4 my-1.5 flex items-center justify-between border border-dashed border-foreground/25 px-3 py-2 text-[12px] text-foreground/55"
																	key={item.label}
																>
																	<div className="flex min-w-0 items-center gap-2">
																		<DocNavIcon
																			className="size-3.5"
																			icon={item.icon}
																		/>
																		<span className="truncate">
																			{item.label}
																		</span>
																	</div>
																	<span className="border border-dashed border-foreground/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-foreground/45">
																		Planned
																	</span>
																</div>
															);
														}

														const active = pathname === item.href;

														return (
															<Link
																className={cn(
																	'mx-4 my-0.5 flex items-center gap-2 px-3 py-2 text-[13px] transition-colors',
																	active
																		? 'bg-foreground/6 text-foreground'
																		: 'text-foreground/55 hover:bg-foreground/3 hover:text-foreground/80',
																)}
																data-active={active ? 'true' : 'false'}
																href={item.href as Route}
																key={item.href}
															>
																<DocNavIcon
																	className="size-3.5 shrink-0"
																	icon={item.icon}
																/>
																<span
																	className={cn(
																		'truncate',
																		active
																			? 'text-foreground'
																			: 'text-foreground/55',
																	)}
																>
																	{item.label}
																</span>
															</Link>
														);
													})}
												</div>
											</motion.div>
										) : null}
									</AnimatePresence>
								</div>
							);
						})}
					</div>
				</MotionConfig>
			</nav>

			<div className="flex items-center gap-1 border-t border-foreground/5 p-2 text-foreground/40">
				<a
					aria-label="GitHub"
					className="inline-flex size-8 items-center justify-center transition-colors hover:bg-foreground/5 hover:text-foreground/70"
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
					<span className="sr-only">GitHub</span>
				</a>
				<div className="ms-auto [&_button]:text-foreground/40 [&_button:hover]:text-foreground/70">
					<ThemeToggle />
				</div>
			</div>
		</motion.aside>
	);
}
