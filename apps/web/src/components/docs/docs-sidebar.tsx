'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { docsNavigation, getDocHref, getFlattenedDocs } from '../../lib/docs';

function cn(...classNames: Array<string | false | null | undefined>) {
	return classNames.filter(Boolean).join(' ');
}

function SearchIcon() {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height="16"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.5"
			viewBox="0 0 24 24"
			width="16"
		>
			<circle cx="11" cy="11" r="5.5" />
			<path d="m15 15l4 4" />
		</svg>
	);
}

function ChevronDownIcon({ open }: { open: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
			fill="none"
			height="16"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.8"
			viewBox="0 0 24 24"
			width="16"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function GroupIcon({ title }: { title: string }) {
	if (title === 'Get Started') {
		return (
			<svg
				aria-hidden="true"
				fill="currentColor"
				height="15"
				viewBox="0 0 24 24"
				width="15"
			>
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-1 14H9V8h2zm1 0V8l5 4z" />
			</svg>
		);
	}

	if (title === 'Concepts') {
		return (
			<svg
				aria-hidden="true"
				fill="currentColor"
				height="15"
				viewBox="0 0 24 24"
				width="15"
			>
				<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3zm0 0a3 3 0 0 0-3 3v13h3a3 3 0 0 1 3-3h9V7a3 3 0 0 0-3-3z" />
			</svg>
		);
	}

	if (title === 'Providers') {
		return (
			<svg
				aria-hidden="true"
				fill="currentColor"
				height="15"
				viewBox="0 0 24 24"
				width="15"
			>
				<path d="M7 7h10v10H7zM4 4h4v2H6v2H4zm12 0h4v4h-2V6h-2zM4 16h2v2h2v2H4zm14 0h2v4h-4v-2h2z" />
			</svg>
		);
	}

	return (
		<svg
			aria-hidden="true"
			fill="currentColor"
			height="15"
			viewBox="0 0 24 24"
			width="15"
		>
			<path d="M6 4h12a2 2 0 0 1 2 2v3H4V6a2 2 0 0 1 2-2m-2 7h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm4 2v2h8v-2z" />
		</svg>
	);
}

function PageMarker() {
	return (
		<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-white/[0.08] bg-white/[0.03]">
			<span className="h-[7px] w-[7px] rounded-[1px] bg-white/38" />
		</span>
	);
}

export function DocsSidebar() {
	const pathname = usePathname();
	const [searchOpen, setSearchOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [currentOpen, setCurrentOpen] = useState(0);
	const navRef = useRef<HTMLElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const currentIndex = docsNavigation.findIndex((group) =>
			group.items.some((item) => pathname === getDocHref(item.slug)),
		);
		setCurrentOpen(currentIndex === -1 ? 0 : currentIndex);
		setSearchOpen(false);
		setQuery('');
	}, [pathname]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				setSearchOpen((open) => !open);
			}

			if (event.key === 'Escape') {
				setSearchOpen(false);
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, []);

	useEffect(() => {
		if (!searchOpen) return;
		searchInputRef.current?.focus();
	}, [searchOpen]);

	useEffect(() => {
		const nav = navRef.current;
		if (!nav || currentOpen < 0) return;

		const activeItem = nav.querySelector<HTMLElement>(`a[href="${pathname}"]`);
		if (!activeItem) return;

		activeItem.scrollIntoView({
			block: 'center',
		});
	}, [pathname, currentOpen]);

	const results = useMemo(() => {
		const value = query.trim().toLowerCase();

		if (!value) return getFlattenedDocs();

		return getFlattenedDocs().filter((item) => {
			return (
				item.label.toLowerCase().includes(value) ||
				item.group.toLowerCase().includes(value)
			);
		});
	}, [query]);

	return (
		<>
			<aside className="fixed bottom-0 left-0 top-11 z-30 hidden w-[22vw] max-w-[300px] flex-col border-r border-white/[0.06] bg-[#050505] lg:flex">
				<button
					className="flex w-full items-center gap-2 border-b border-white/[0.06] px-4 py-[9px] text-left text-sm text-white/50 transition-colors hover:bg-white/[0.02] hover:text-white/80"
					onClick={() => setSearchOpen(true)}
					type="button"
				>
					<SearchIcon />
					<span className="truncate">Search docs</span>
					<kbd className="ml-auto inline-flex items-center gap-0.5 rounded-md border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-white/35">
						<span className="text-[11px]">&#8984;</span>K
					</kbd>
				</button>

				<nav
					className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden pb-3"
					ref={navRef}
					style={{
						maskImage:
							'linear-gradient(to bottom, transparent, white 1rem, white calc(100% - 2rem), transparent 100%)',
					}}
				>
					<div className="flex flex-col">
						{docsNavigation.map((group, index) => {
							const open = currentOpen === index;
							return (
								<div key={group.title}>
									<button
										className={cn(
											'flex w-full items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 text-left text-sm font-medium tracking-wide transition-colors',
											open
												? 'bg-white/[0.03] text-white'
												: 'text-white/65 hover:bg-white/[0.02] hover:text-white',
										)}
										onClick={() =>
											setCurrentOpen((current) =>
												current === index ? -1 : index,
											)
										}
										type="button"
									>
										<GroupIcon title={group.title} />
										<span className="grow tracking-normal">{group.title}</span>
										<ChevronDownIcon open={open} />
									</button>

									{open ? (
										<div className="py-1">
											{group.items.map((item) => {
												const active = pathname === getDocHref(item.slug);
												const href = getDocHref(item.slug);

												return (
													<Link
														className={cn(
															'relative flex items-center gap-2.5 px-4 py-1 text-[14px] transition-colors',
															active
																? 'bg-white/[0.06] text-white'
																: 'text-white/60 hover:bg-white/[0.03] hover:text-white/88',
														)}
														data-active={active || undefined}
														href={href}
														key={item.slug.join('/')}
													>
														<PageMarker />
														<span className="min-w-0 grow truncate">
															{item.label}
														</span>
														{item.status === 'coming-soon' ? (
															<span className="rounded-[2px] border border-amber-500/18 bg-amber-500/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-200/75">
																Soon
															</span>
														) : null}
													</Link>
												);
											})}
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				</nav>

				<div className="flex items-center gap-2 border-t border-white/[0.06] p-2 text-white/35">
					<a
						aria-label="GitHub"
						className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-white/[0.04] hover:text-white/72"
						href="https://github.com/usepaymesh/paymesh"
						rel="noreferrer"
						target="_blank"
					>
						<span className="sr-only">GitHub</span>
						<svg
							aria-hidden="true"
							className="h-4 w-4"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
						</svg>
					</a>
					<div className="ml-auto px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/22">
						Paymesh Docs
					</div>
				</div>
			</aside>

			{searchOpen ? (
				<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-16 backdrop-blur-sm">
					<div className="w-full max-w-2xl overflow-hidden rounded-md border border-white/[0.1] bg-[#050505] shadow-2xl shadow-black/40">
						<div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
							<SearchIcon />
							<input
								className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/28"
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search docs..."
								ref={searchInputRef}
								value={query}
							/>
							<button
								className="rounded-sm border border-white/[0.08] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/35"
								onClick={() => setSearchOpen(false)}
								type="button"
							>
								Esc
							</button>
						</div>
						<div className="no-scrollbar max-h-[65dvh] overflow-y-auto p-2">
							{results.length > 0 ? (
								results.map((item) => (
									<Link
										className="flex items-center gap-3 rounded-sm px-3 py-2 text-[14px] text-white/68 transition-colors hover:bg-white/[0.04] hover:text-white"
										href={getDocHref(item.slug)}
										key={item.slug.join('/')}
										onClick={() => {
											setSearchOpen(false);
											setQuery('');
										}}
									>
										<PageMarker />
										<div className="min-w-0 flex-1">
											<div className="truncate">{item.label}</div>
											<div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/28">
												{item.group}
											</div>
										</div>
										{item.status === 'coming-soon' ? (
											<span className="rounded-[2px] border border-amber-500/18 bg-amber-500/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-200/75">
												Soon
											</span>
										) : null}
									</Link>
								))
							) : (
								<div className="px-3 py-8 text-center text-[14px] text-white/45">
									No docs matched your query.
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
