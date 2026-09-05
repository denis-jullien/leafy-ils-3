/**
 * Public site content: everything a volunteer might want to change without
 * touching the database. Edit, commit, deploy.
 */

export const SITE = {
	name: 'Les lecteurs des Arbousiers',
	tagline: 'Bibliothèque · Saint-Jean-de-Cornies',
	footerTagline: 'Bibliothèque municipale · Saint-Jean-de-Cornies (34)',
	footerNote: 'Une bibliothèque animée par des bénévoles du village. Bienvenue à toutes et à tous.',
	/** Drop the real emblem at static/logo.jpg; the fallback is used until then. */
	logo: '/logo.jpg'
};

export const CONTACT = {
	place: 'Salle des Arbousiers — Mairie',
	address: '2 rue de la Fontaine, 34160 Saint-Jean-de-Cornies',
	phone: '04 67 00 00 00',
	email: 'bibliotheque@saintjeandecornies.fr',
	mapLabel: "plan d'accès — Saint-Jean-de-Cornies",
	/** Optional: a Google Maps / OpenStreetMap link for the map placeholder. */
	mapUrl: ''
};

/** Monday first, like the wall calendar. */
export const HOURS: { day: string; slots: string; closed?: boolean }[] = [
	{ day: 'Lundi', slots: 'Fermé', closed: true },
	{ day: 'Mardi', slots: 'Fermé', closed: true },
	{ day: 'Mercredi', slots: '9h30 – 12h' },
	{ day: 'Jeudi', slots: 'Fermé', closed: true },
	{ day: 'Vendredi', slots: 'Fermé', closed: true },
	{ day: 'Samedi', slots: '9h30 – 12h' },
	{ day: 'Dimanche', slots: 'Fermé', closed: true }
];

export const MEMBERSHIP = {
	lead: "L'inscription est gratuite pour tous les habitants du village. Apportez un justificatif de domicile.",
	/** The bold word in the lead. */
	highlight: 'gratuite',
	points: [
		'Un exemplaire par titre — premier arrivé, premier servi',
		'Emprunt de 4 livres pour 3 semaines',
		'Consultation du catalogue sur place & en ligne',
		'Espace jeux et coin lecture enfants'
	]
};

export interface SiteEvent {
	id: number;
	/** ISO date, e.g. 2026-09-16. Past events are hidden automatically. */
	date: string;
	time: string;
	title: string;
	tag: string;
	desc: string;
	free?: boolean;
}

export const EVENTS: SiteEvent[] = [
	{
		id: 1,
		date: '2026-09-16',
		time: '10h30',
		title: 'Heure du conte',
		tag: 'Jeunesse',
		desc: "Histoires et comptines pour les 3–6 ans, suivies d'un goûter.",
		free: true
	},
	{
		id: 2,
		date: '2026-09-19',
		time: '15h00',
		title: 'Club de lecture',
		tag: 'Adultes',
		desc: 'On échange autour du roman du mois : « La Maison de jade ».',
		free: true
	},
	{
		id: 3,
		date: '2026-09-30',
		time: '14h00',
		title: 'Atelier numérique',
		tag: 'Seniors',
		desc: 'Prise en main de la tablette et du catalogue en ligne. Sur inscription.',
		free: true
	},
	{
		id: 4,
		date: '2026-10-10',
		time: '10h00',
		title: 'Rencontre avec Élise Roca',
		tag: 'Tout public',
		desc: "L'autrice des « Carnets de garrigue » présente son travail. Dédicaces.",
		free: true
	}
];
