import './docs-theme.css';

import { DocsLayout as FumaDocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import { DocsMobileNav } from '../../components/docs/docs-mobile-nav';
import { DocsSidebar } from '../../components/docs/docs-sidebar';
import { source } from '../../lib/source';

export default function DocsLayout({ children }: { children: ReactNode }) {
	return (
		<RootProvider>
			<main className="paymesh-docs-shell min-h-dvh text-foreground">
				<header className="fixed left-0 right-0 top-0 z-40 border-b border-foreground/6 bg-background/80 backdrop-blur-xl">
					<div className="flex h-12 items-center justify-end px-4 lg:pr-5">
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
