import './docs-theme.css';

import { DocsLayout as FumaDocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import paymeshIcon from '../../../assets/icon.png';
import { DocsMobileNav } from '../../components/docs/docs-mobile-nav';
import { DocsSidebar } from '../../components/docs/docs-sidebar';
import { source } from '../../lib/source';

export default function DocsLayout({ children }: { children: ReactNode }) {
	return (
		<RootProvider>
			<main className="paymesh-docs-shell min-h-dvh text-foreground">
				<header className="fixed left-0 right-0 top-0 z-40 border-b border-foreground/6 bg-background/80 backdrop-blur-xl">
					<div className="flex h-12 items-center justify-between px-4 lg:pl-[calc(min(22vw,300px)+20px)] lg:pr-5">
						<Link className="flex items-center gap-2.5" href="/">
							<span className="inline-flex h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-[3px] ring-1 ring-foreground/10">
								<Image
									alt="Paymesh"
									className="h-full w-full object-contain dark:invert"
									priority
									src={paymeshIcon}
								/>
							</span>
							<span className="text-[15px] font-medium tracking-tight text-foreground">
								PAYMESH.
							</span>
						</Link>
						<DocsMobileNav />
					</div>
				</header>

				<DocsSidebar />

				<FumaDocsLayout
					containerProps={{
						className: 'docs-layout',
					}}
					nav={{ enabled: false }}
					searchToggle={{ enabled: false }}
					sidebar={{ enabled: false }}
					themeSwitch={{ enabled: false }}
					tree={source.pageTree}
				>
					{children}
				</FumaDocsLayout>
			</main>
		</RootProvider>
	);
}
