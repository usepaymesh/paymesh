export const DATABASE_ADAPTERS = [
	{
		value: 'postgres',
		label: 'Postgres (raw SQL with @paymesh/postgres)',
		package: '@paymesh/postgres',
		deps: ['postgres'],
		devDeps: [],
	},
	{
		value: 'prisma',
		label: 'Prisma ORM with @paymesh/prisma',
		package: '@paymesh/prisma',
		deps: ['@prisma/client'],
		devDeps: ['prisma'],
	},
	{
		value: 'drizzle',
		label: 'Drizzle ORM with @paymesh/drizzle',
		package: '@paymesh/drizzle',
		deps: ['drizzle-orm'],
		devDeps: ['drizzle-kit'],
	},
] as const;
