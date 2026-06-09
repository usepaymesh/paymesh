import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from 'fumadocs-ui/page';
import type { Metadata, Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { docsMdxComponents } from '../../../components/docs/mdx-components';
import { source } from '../../../lib/source';

export async function generateStaticParams() {
	return source.generateParams();
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const page = slug?.length ? source.getPage(slug) : null;

	if (!page) {
		return {
			title: 'Docs | Paymesh',
		};
	}

	return {
		title: `${page.data.title} | Paymesh`,
		description: page.data.description,
	};
}

export default async function DocPage({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}) {
	const { slug } = await params;

	if (slug?.join('/') === 'guides/plugin-authoring') {
		redirect('/docs/plugins/overview#create-a-plugin' as Route);
	}

	if (!slug?.length) {
		redirect('/docs/introduction' as Route);
	}

	const page = source.getPage(slug);

	if (!page) {
		notFound();
	}

	const { body: MDX, toc } = await page.data.load();

	return (
		<DocsPage
			breadcrumb={{ enabled: false }}
			footer={{ enabled: false }}
			full={false}
			tableOfContent={{ style: 'clerk' }}
			toc={toc}
		>
			<DocsTitle className="mb-0">{page.data.title}</DocsTitle>
			{page.data.description ? (
				<DocsDescription className="mt-2 mb-0 max-w-3xl">
					{page.data.description}
				</DocsDescription>
			) : null}

			<DocsBody>
				<MDX components={docsMdxComponents} />
			</DocsBody>
		</DocsPage>
	);
}
