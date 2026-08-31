/**
 * Fassungen der Rechtstexte.
 *
 * Bisher gab es keine belastbare Versionsangabe: ClientOnboarding.tsx:73
 * übergibt terms_version hart als '1.0', die AGB-Seite trägt „Stand: Juni
 * 2026", und zugestimmt wird faktisch einem dritten, nur im Onboarding
 * existierenden Kurztext. Ein Nachweis, der auf '1.0' verweist, belegt nichts.
 *
 * Diese Konstante ist die eine Quelle: die AGB-Seite zeigt sie an, die
 * Konditionsvorlage referenziert sie, und jede Zustimmung speichert sie.
 * Wird der Text der AGB geändert, MUSS die Fassung hier hochgezählt und in der
 * Konditionsvorlage nachgezogen werden — sonst verweisen Nachweise auf einen
 * Text, den es so nicht mehr gibt.
 */
export const AGB_VERSION = '2026-06';

/** Anzeigeform für die Fußzeile der Rechtstexte. */
export const AGB_VERSION_LABEL = 'Fassung 2026-06 (Stand: Juni 2026)';

export const DATENSCHUTZ_VERSION = '2026-06';

/**
 * Der Vertragspartner. Matchunt ist eine Marke der Bluewater & Bridge GmbH.
 *
 * Eine Quelle für alle Rechtstexte und für die Vermittlungsvereinbarung. Die
 * Angaben entsprechen dem Impressum (src/pages/public/Impressum.tsx:32-68).
 *
 * Notwendig, weil im Produkt bisher zwei verschiedene Firmierungen standen:
 * AGB, Impressum und Datenschutz nennen die Bluewater & Bridge GmbH,
 * src/pages/onboarding/RecruiterOnboarding.tsx:254 und :404 dagegen eine
 * „MatchHub GmbH, Musterstraße 1, 10115 Berlin" — eine Firma, die es nicht
 * gibt, an einer Platzhalter-Adresse, in einem Text, den Recruiter annehmen.
 */
export const VENDOR = {
  brand: 'Matchunt',
  legalName: 'Bluewater & Bridge GmbH',
  street: 'Adlzreiterstraße 2',
  postalCode: '80337',
  city: 'München',
  country: 'Deutschland',
  register: 'Amtsgericht München, HRB 288632',
  vatId: 'DE365690081',
  email: 'info@bluewater-bridge.de',
  phone: '089 380 30 73 0',
} as const;

/** Einzeilige Anschrift für Fließtext und Vertragsköpfe. */
export const VENDOR_ADDRESS_LINE =
  `${VENDOR.street}, ${VENDOR.postalCode} ${VENDOR.city}`;

/** Wie der Vertragspartner in einem Vertragstext eingeführt wird. */
export const VENDOR_INTRO =
  `${VENDOR.brand} — eine Marke der ${VENDOR.legalName}, ${VENDOR_ADDRESS_LINE}`;
