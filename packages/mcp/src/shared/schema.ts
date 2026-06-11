import * as z from 'zod/v4';

export const requestOptionsSchema = z.object({
	includeRaw: z.boolean().optional(),
	sandbox: z.boolean().optional(),
});

export const dataInputSchema = requestOptionsSchema.extend({
	data: z.looseObject({}),
});

export const idInputSchema = requestOptionsSchema.extend({
	id: z.string().min(1),
});

export const emailInputSchema = requestOptionsSchema.extend({
	email: z.email(),
});

export const externalIdInputSchema = requestOptionsSchema.extend({
	externalId: z.string().min(1),
});

export const customersListSchema = requestOptionsSchema.extend({
	limit: z.number().int().positive().optional(),
	after: z.string().min(1).optional(),
	before: z.string().min(1).optional(),
});

export const emptyInputSchema = z.object({});
