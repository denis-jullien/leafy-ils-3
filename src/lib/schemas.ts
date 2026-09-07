import { z } from 'zod';
import { parseIsbn } from './isbn';

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
	shelfId: optionalInt,
	featured: z
		.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())
		.default(false),
	notes: optionalText,
	status: z.enum(['active', 'lost', 'withdrawn', 'returned']).default('active'),
	/** Set for books lent by the departmental library; null for the library's own. */
	depositId: optionalInt,
	/** The lender's sticker, required on deposit books; own books derive their barcode. */
	barcode: optionalText
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

export const eventSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
	time: optionalText,
	title: z.string().trim().min(1, 'Le titre est obligatoire'),
	tag: optionalText,
	description: optionalText,
	free: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()).default(true)
});

/** Fields editable straight from the books table. No defaults: a PATCH must only touch what it names. */
export const bookQuickSchema = z
	.object({
		shelfId: z.preprocess(
			(v) => (v === '' || v === null || v === undefined ? null : Number(v)),
			z.number().int().nullable()
		),
		featured: z.boolean({ error: 'Valeur invalide' }),
		status: z.enum(['active', 'lost', 'withdrawn', 'returned'], { error: 'État inconnu' })
	})
	.partial()
	.strict();

/** Fields editable straight from the families table. */
export const familyQuickSchema = z
	.object({
		phone: optionalText,
		status: z.enum(['active', 'inactive'], { error: 'Abonnement inconnu' })
	})
	.partial()
	.strict();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide');

export const depositSchema = z
	.object({
		label: z.string().trim().min(1, 'Le nom est obligatoire'),
		receivedOn: isoDate,
		returnOn: isoDate,
		notes: optionalText
	})
	.refine((d) => d.returnOn > d.receivedOn, {
		message: 'La date de retour doit suivre la date de réception',
		path: ['returnOn']
	});

export const shelfSchema = z.object({
	name: z.string().trim().min(1, 'Le nom est obligatoire'),
	keywords: optionalText,
	dewey: optionalText,
	description: optionalText
});
