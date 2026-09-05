import { z } from 'zod';
import { parseIsbn } from './isbn';
import { CATEGORY_IDS } from './config';

export const loginSchema = z.object({
	email: z.email('Enter a valid email'),
	password: z.string().min(1, 'Password is required')
});

export const setupSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	email: z.email('Enter a valid email'),
	password: z.string().min(8, 'At least 8 characters')
});

export const volunteerSchema = setupSchema.extend({
	role: z.enum(['admin', 'user'])
});

const optionalText = z
	.string()
	.trim()
	.transform((s) => (s === '' ? null : s))
	.nullable()
	.optional();

const optionalInt = z.preprocess(
	(v) => (v === '' || v === null || v === undefined ? null : Number(v)),
	z.number().int().nullable()
);

export const bookSchema = z.object({
	isbn: z
		.string()
		.trim()
		.transform((s) => (s === '' ? null : s))
		.nullable()
		.optional()
		.refine((s) => s == null || parseIsbn(s) !== null, 'Not a valid ISBN'),
	title: z.string().trim().min(1, 'Title is required'),
	authors: optionalText,
	publisher: optionalText,
	publishedYear: optionalInt,
	language: optionalText,
	pageCount: optionalInt,
	description: optionalText,
	coverUrl: optionalText,
	shelf: optionalText,
	category: z.preprocess((v) => (v === '' ? null : v), z.enum(CATEGORY_IDS).nullable()).optional(),
	featured: z
		.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())
		.default(false),
	notes: optionalText,
	rfidUid: optionalText,
	status: z.enum(['active', 'lost', 'withdrawn']).default('active')
});

export const familySchema = z.object({
	name: z.string().trim().min(1, 'Family name is required'),
	email: optionalText,
	phone: optionalText,
	address: optionalText,
	notes: optionalText,
	status: z.enum(['active', 'inactive']).default('active')
});

export const memberSchema = z.object({
	name: z.string().trim().min(1, 'Name is required'),
	birthYear: optionalInt,
	notes: optionalText
});
