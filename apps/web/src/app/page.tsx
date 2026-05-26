const providers = ['Stripe', 'More providers soon'];

export default function Home() {
	return (
		<main className="min-h-screen px-6 py-8 sm:px-10">
			<header className="mx-auto flex max-w-6xl items-center justify-between border-white/10 border-b pb-6">
				<div className="font-semibold text-lg">Paymesh</div>
				<a
					className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white"
					href="https://github.com"
				>
					GitHub
				</a>
			</header>

			<section className="mx-auto grid max-w-6xl gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
				<div>
					<p className="mb-4 text-sm text-[var(--accent)] uppercase tracking-[0.18em]">
						TypeScript payments toolkit
					</p>
					<h1 className="max-w-3xl font-semibold text-5xl leading-tight sm:text-6xl">
						One clean payment API across providers.
					</h1>
					<p className="mt-6 max-w-2xl text-lg text-[var(--muted)] leading-8">
						Paymesh starts as a small SDK for checkout flows, provider adapters,
						and framework-friendly payment primitives.
					</p>
				</div>

				<div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
					<div className="mb-4 flex items-center justify-between">
						<span className="text-sm text-[var(--muted)]">packages</span>
						<span className="rounded bg-[var(--accent)] px-2 py-1 font-medium text-black text-xs">
							Bun workspace
						</span>
					</div>
					<div className="space-y-3">
						{providers.map((provider) => (
							<div
								className="flex items-center justify-between rounded-md border border-white/10 px-4 py-3"
								key={provider}
							>
								<span>{provider}</span>
								<span className="text-[var(--muted)] text-sm">adapter</span>
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
