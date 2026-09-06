/**
 * Public site content that rarely changes: name, contact, hours, membership.
 * Events are edited from the desk and live in the database.
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
	/** The entrance of the library: the map marker and the directions point here. */
	gps: { lat: 43.743715425289864, lon: 4.000731798416467 },
	/** How to find the door once there, shown under the map. Leave empty to hide. */
	access: ''
};

/** OpenStreetMap views of the library: embedded, full page, and directions to it. */
export function mapLinks({ lat, lon } = CONTACT.gps) {
	// A window of about 350 m × 250 m around the entrance: close enough to see the
	// building and the surrounding streets, with the village name still on the map.
	const dLon = 0.0022;
	const dLat = 0.0012;
	return {
		embed: `https://www.openstreetmap.org/export/embed.html?bbox=${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}&layer=mapnik&marker=${lat},${lon}`,
		page: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
		route: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
	};
}

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
