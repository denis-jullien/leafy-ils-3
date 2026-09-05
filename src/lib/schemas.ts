import { z } from 'zod';
import { parseIsbn } from './isbn';
import { CATEGORY_IDS } from './config';

export const loginSchema = z.object({
	email: z.email('Adresse email invalide'),
	password: z.string().min(1, 'Le mot de passe est obligatoire')
});

export const setupSchema = z.object({
	name: z.string().trim().min(1, 'Le nom est obligatoire'),
	email: z.email('Adresse email invalide'),
	password: z.string().min(8, 'Au moins 8 caractères')
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
		.refine((s) => s == null || parseIsbn(s) !== null, 'ISBN invalide'),
	title: z.string().trim().min(1, 'Le titre est obligatoire'),
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
	name: z.string().trim().min(1, 'Le nom de la famille est obligatoire'),
	email: optionalText,
	phone: optionalText,
	address: optionalText,
	notes: optionalText,
	status: z.enum(['active', 'inactive']).default('active')
});

export const memberSchema = z.object({
	name: z.string().trim().min(1, 'Le nom est obligatoire'),
	birthYear: optionalInt,
	notes: optionalText
});
