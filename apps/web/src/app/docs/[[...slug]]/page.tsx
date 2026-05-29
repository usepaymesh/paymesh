import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
	docsNavigation,
	docsPages,
	getDocHref,
	getDocPage,
	getPrevNextDoc,
} from '../../../lib/docs';

export async function generateStaticParams() {
	return docsPages.map((page) => ({
		slug: page.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const page = slug?.length ? getDocPage(slug) : null;

	if (!page) {
		return {
			title: 'Docs | Paymesh',
		};
	}

	return {
		title: `${page.title} | Paymesh`,
		description: page.description,
	};
}

export default async function DocsPage({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}) {
	const { slug } = await params;

	if (!slug?.length) {
		redirect('/docs/introduction');
	}

	const page = getDocPage(slug);

	if (!page) {
		notFound();
	}

	const { prev, next } = getPrevNextDoc(page.slug);

	return (
		<div className="min-h-[calc(100dvh-44px)]">
			<div className="border-b border-white/[0.06] px-4 py-3 lg:hidden">
				<div className="no-scrollbar flex gap-2 overflow-x-auto">
					{docsNavigation
						.flatMap((group) => group.items)
						.map((item) => {
							const active = item.slug.join('/') === page.slug.join('/');
							return (
								<Link
									className={`shrink-0 rounded-sm border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] ${
										active
											? 'border-white/[0.12] bg-white/[0.04] text-white'
											: 'border-white/[0.08] text-white/50'
									}`}
									href={getDocHref(item.slug)}
									key={item.slug.join('/')}
								>
									{item.label}
								</Link>
							);
						})}
				</div>
			</div>

			<div className="flex">
				<div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 xl:px-14">
					<div className="mx-auto max-w-3xl">
						<div className="mb-10 border-b border-white/[0.06] pb-8">
							<div className="mb-3 flex items-center gap-3">
								<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35">
									{page.group}
								</span>
								{page.status === 'coming-soon' ? (
									<span className="rounded-[2px] border border-amber-500/18 bg-amber-500/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200/75">
										Coming Soon
									</span>
								) : null}
							</div>
							<h1 className="max-w-3xl text-4xl leading-tight tracking-tight text-white sm:text-5xl">
								{page.title}
							</h1>
							<p className="mt-4 max-w-2xl text-[16px] leading-8 text-white/66 sm:text-[17px]">
								{page.description}
							</p>
						</div>

						<div className="space-y-10">
							{page.sections.map((section) => (
								<section
									className="scroll-mt-20 border-t border-white/[0.06] pt-8 first:border-t-0 first:pt-0"
									id={section.id}
									key={section.id}
								>
									<h2 className="mb-4 text-[32px] tracking-tight text-white">
										{section.title}
									</h2>
									<div className="space-y-4">{section.content}</div>
								</section>
							))}
						</div>

						<div className="mt-12 grid gap-3 border-t border-white/[0.06] pt-8 sm:grid-cols-2">
							{prev ? (
								<Link
									className="rounded-md border border-white/[0.08] px-4 py-3 transition-colors hover:bg-white/[0.03]"
									href={getDocHref(prev.slug)}
								>
									<div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
										Previous
									</div>
									<div className="mt-1 text-[15px] text-white/85">
										{prev.label}
									</div>
								</Link>
							) : (
								<div />
							)}
							{next ? (
								<Link
									className="rounded-md border border-white/[0.08] px-4 py-3 text-right transition-colors hover:bg-white/[0.03]"
									href={getDocHref(next.slug)}
								>
									<div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
										Next
									</div>
									<div className="mt-1 text-[15px] text-white/85">
										{next.label}
									</div>
								</Link>
							) : null}
						</div>
					</div>
				</div>

				<aside className="hidden w-[260px] shrink-0 border-l border-white/[0.06] xl:block">
					<div className="sticky top-11 px-6 py-8">
						<div className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/30">
							On this page
						</div>
						<div className="space-y-2">
							{page.sections.map((section) => (
								<a
									className="block text-[14px] leading-6 text-white/55 transition-colors hover:text-white/88"
									href={`#${section.id}`}
									key={section.id}
								>
									{section.title}
								</a>
							))}
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
