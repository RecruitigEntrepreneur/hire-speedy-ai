/**
 * Was eine Vereinbarung über die Firma zwingend braucht -- EINE Regel für
 * Aufnahme (Frontend) und Firmenprüfung (verify-company).
 *
 * Befund (Live-Test 24.09.2026, ASMPT): Der Kontakt-Schritt nannte Firmierung
 * und Anschrift „kann später ergänzt werden“, die Firmenprüfung behandelte sie
 * als Pflicht und hielt den Vertrag an. Der Kunde erfuhr davon nichts und
 * konnte den Vertrag weder öffnen noch weiterleiten. Dazu meldete die Prüfung
 * „Firmierung fehlt“, obwohl der Firmenname „ASMPT GmbH & Co. KG“ sie schon trug.
 */

/**
 * Rechtsformen, an denen man eine vollständige Firmierung erkennt.
 * Groß-/Kleinschreibung zählt: „AG“ ist eine Rechtsform, „ag“ nicht.
 */
const RECHTSFORM = new RegExp(
  [
    'GmbH\\s*&\\s*Co\\.?\\s*KG(?:aA)?', 'gGmbH', 'GmbH', 'mbH', 'UG', 'AG', 'SE', 'KGaA', 'KG', 'OHG', 'GbR',
    'e\\.\\s?K\\.', 'e\\.\\s?V\\.', 'eG', 'PartG(?:\\s*mbB)?',
    'Ltd\\.?', 'Limited', 'Inc\\.?', 'LLC', 'plc', 'B\\.V\\.', 'N\\.V\\.', 'S\\.A\\.', 'S\\.r\\.l\\.', 'S\\.p\\.A\\.',
    'A/S', 'AB', 'Oy', 's\\.r\\.o\\.', 'sp\\.\\s*z\\s*o\\.o\\.', 'SARL', 'SAS',
  ].map((f) => `(?:^|[\\s,(])${f}(?=$|[\\s,.;)])`).join('|'),
);

export const hatRechtsform = (name: unknown): boolean => RECHTSFORM.test(String(name ?? '').trim());

const text = (v: unknown) => String(v ?? '').trim();

interface FirmaFelder {
  company_name?: unknown;
  company_legal_name?: unknown;
  company_street?: unknown;
  company_postal_code?: unknown;
  company_city?: unknown;
}

/** Die Firmierung für den Vertrag: ausdrücklich angegeben, sonst der Firmenname, wenn er die Rechtsform trägt. */
export function firmierungAus(d: FirmaFelder): string {
  const legal = text(d.company_legal_name);
  if (legal) return legal;
  const name = text(d.company_name);
  return hatRechtsform(name) ? name : '';
}

/** Ohne diese Angaben stellt Matchunt keine Vereinbarung aus (Entscheidung 02.09.2026). */
export const PFLICHT_FIRMA = ['company_legal_name', 'company_street', 'company_postal_code', 'company_city'] as const;
export type PflichtFeld = typeof PFLICHT_FIRMA[number];

export function fehlendeFirmenangaben(d: FirmaFelder): PflichtFeld[] {
  return PFLICHT_FIRMA.filter((f) =>
    f === 'company_legal_name' ? !firmierungAus(d) : !text((d as Record<string, unknown>)[f]),
  );
}

/** Beschriftungen für den Kunden. */
export const FIRMA_LABEL: Record<string, string> = {
  company_legal_name: 'vollständige Firmierung',
  company_street: 'Straße und Hausnummer',
  company_postal_code: 'PLZ',
  company_city: 'Ort',
  company_vat_id: 'USt-IdNr.',
  company_registration_number: 'Handelsregister',
};
