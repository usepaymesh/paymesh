'use client';

import { useMemo, useState } from 'react';
import { CopyCodeButton } from './copy-code-button';

const installers = [
	{ id: 'npm', command: 'npm install' },
	{ id: 'pnpm', command: 'pnpm add' },
	{ id: 'yarn', command: 'yarn add' },
	{ id: 'bun', command: 'bun add' },
] as const;

export function InstallPackageTabs({ packages }: { packages: string }) {
	const [active, setActive] =
		useState<(typeof installers)[number]['id']>('npm');

	const commands = useMemo(
		() =>
			Object.fromEntries(
				installers.map((installer) => [
					installer.id,
					`${installer.command} ${packages}`,
				]),
			) as Record<(typeof installers)[number]['id'], string>,
		[packages],
	);

	const activeCommand = commands[active];

	return (
		<div className="install-package-tabs not-prose">
			<div className="install-package-tabs__list" role="tablist">
				{installers.map((installer) => (
					<button
						aria-selected={active === installer.id}
						className="install-package-tabs__trigger"
						data-state={active === installer.id ? 'active' : 'inactive'}
						key={installer.id}
						onClick={() => setActive(installer.id)}
						role="tab"
						type="button"
					>
						{installer.id}
					</button>
				))}
			</div>

			<div className="install-package-tabs__panel" role="tabpanel">
				<div className="install-package-tabs__copy">
					<CopyCodeButton code={activeCommand} />
				</div>
				<pre className="install-package-tabs__pre">
					<code className="install-package-tabs__code">
						<span className="install-package-tabs__command">
							{active === 'npm'
								? 'npm install'
								: active === 'pnpm'
									? 'pnpm i'
									: activeCommand.replace(` ${packages}`, '')}
						</span>
						<span> </span>
						<span className="install-package-tabs__packages">{packages}</span>
					</code>
				</pre>
			</div>
		</div>
	);
}
