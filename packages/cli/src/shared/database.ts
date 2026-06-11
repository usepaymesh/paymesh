export const DATABASE_ADAPTERS = [
	{
		value: 'memory',
		label: 'Memory adapter with @paymesh/memory',
		package: '@paymesh/memory',
		deps: [],
		devDeps: [],
	},
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
