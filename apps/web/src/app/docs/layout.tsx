import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import paymeshIcon from '../../../assets/icon.png';
import { DocsSidebar } from '../../components/docs/docs-sidebar';

export default function DocsLayout({ children }: { children: ReactNode }) {
	return (
		<main className="min-h-dvh bg-[#050505] text-neutral-100">
			<header className="fixed left-0 right-0 top-0 z-40 border-b border-white/[0.08] bg-[#050505]/95 backdrop-blur">
				<div className="flex h-11 items-center gap-4 px-4 sm:px-6">
					<Link className="flex items-center gap-2.5" href="/">
						<span className="inline-flex h-[17px] w-[17px] items-center justify-center overflow-hidden rounded-[2px]">
							<Image
								alt="Paymesh"
								className="h-full w-full object-contain invert"
								priority
								src={paymeshIcon}
							/>
						</span>
						<span className="text-[15px] font-medium tracking-tight text-neutral-100">
							PAYMESH.
						</span>
					</Link>

					<span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/24">
						/docs
					</span>

					<div className="ml-auto flex items-center gap-2">
						<Link
							className="inline-flex items-center border border-white/[0.08] px-3 py-1.5 text-[12px] tracking-[0.08em] text-white/60 transition-colors hover:text-white/85"
							href="/"
						>
							README
						</Link>
						<Link
							className="inline-flex items-center border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] tracking-[0.08em] text-white/85"
							href="/docs/introduction"
						>
							DOCS
						</Link>
					</div>
				</div>
			</header>

			<DocsSidebar />

			<div className="pt-11 lg:pl-[300px]">{children}</div>
		</main>
	);
}
