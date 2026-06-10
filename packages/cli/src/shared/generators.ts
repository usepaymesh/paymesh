export function generateClientCode(
	provider: string,
	database?: string | null,
	providerConfig?: {
		apiKeyEnv: string;
		webhookSecretEnv: string;
		paramName: string;
	} | null,
): string {
	const lines: string[] = [];

	if (provider === 'custom' || !providerConfig) {
		lines.push(`import { createClient } from 'paymesh';`, '');
		lines.push('export const paymesh = createClient({');
		lines.push('  // TODO: configure your provider');
		lines.push('  provider: stripe(),');
		lines.push('});', '');
		return lines.join('\n');
	}

	lines.push(`import { createClient } from 'paymesh';`);
	lines.push(`import { ${provider} } from '@paymesh/${provider}';`);

	const dbImports: Record<string, string> = {
		postgres: "import { postgres } from '@paymesh/postgres';",
		prisma: "import { prisma } from '@paymesh/prisma';",
		drizzle: "import { drizzle } from '@paymesh/drizzle';",
	};
	if (database && dbImports[database]) lines.push(dbImports[database]);

	lines.push('');
	lines.push('export const paymesh = createClient({');

	const opts: string[] = [];
	opts.push(
		`    ${providerConfig.paramName}: process.env.${providerConfig.apiKeyEnv}!`,
	);
	opts.push(
		`    webhookSecret: process.env.${providerConfig.webhookSecretEnv}!`,
	);

	lines.push(`  provider: ${provider}({`);
	lines.push(opts.join(',\n'));
	lines.push(`  }),`);

	const dbInits: Record<string, string> = {
		postgres: 'postgres(process.env.PAYMESH_DATABASE_URL!)',
		prisma: 'prisma(prismaClient)',
		drizzle: 'drizzle(db)',
	};
	if (database && dbInits[database])
		lines.push(`  database: ${dbInits[database]},`);

	lines.push('});');
	lines.push('');
	return lines.join('\n');
}
