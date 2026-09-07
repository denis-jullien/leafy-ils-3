/** Library policy. Small enough to live in code until someone asks for a settings page. */
/** How long a loan lasts, in calendar months. */
export const LOAN_MONTHS = 2;
/** Books a family may hold at once; null means no limit. */
export const MAX_LOANS_PER_FAMILY: number | null = null;
export const MAX_RENEWALS = 1;
/** The departmental library that lends batches of books ("dépôts") exchanged on fixed dates. */
export const DEPOSIT_LENDER = 'Médiathèque départementale';
export const DEPOSIT_LENDER_LONG = "Médiathèque départementale de l'Hérault (pierresvives)";
/** How long a deposit usually stays, in months: the default return date of a new one. */
export const DEPOSIT_MONTHS = 6;
/** Deposit books must be back from families this many days before the deposit goes back. */
export const DEPOSIT_MARGIN_DAYS = 14;
export const LIBRARY_NAME = 'Les lecteurs des Arbousiers';
export const TIMEZONE = 'Europe/Paris';
