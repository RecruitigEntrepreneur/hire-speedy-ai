// Rechnungsabsender, Bankverbindung und Nummernkreis (Paket 4a, 22.10.2026).
// Absender laut Impressum. Bankverbindung und Anschluss an die bestehenden
// Rechnungsnummern trägt Marko ein; solange sie fehlen, bleibt „Freigeben“
// gesperrt und Rechnungen entstehen nur als Entwurf.

export const ISSUER = {
  name: 'Bluewater & Bridge GmbH',
  brand: 'Matchunt – eine Marke der Bluewater & Bridge GmbH',
  street: 'Adlzreiterstraße 2',
  city: '80337 München',
  country: 'Deutschland',
  managingDirector: 'Marko Benko',
  register: 'Amtsgericht München, HRB 288632',
  vatId: 'DE365690081',
  email: 'info@bluewater-bridge.de',
  phone: '089 380 30 73 0',
};

// Werte können ohne Code-Änderung als Secret gesetzt werden (Lovable › Secrets):
// BILLING_BANK_HOLDER, BILLING_BANK_IBAN, BILLING_BANK_BIC, BILLING_BANK_NAME,
// BILLING_NUMBER_INVOICE, BILLING_NUMBER_CANCELLATION, BILLING_NUMBER_CREDIT_NOTE
// (Vorlage z. B. „RE-{YYYY}-{NNNN}“), BILLING_NUMBER_*_START (erste Nummer).
const env = (key: string): string => {
  try {
    // deno-lint-ignore no-explicit-any
    const d = (globalThis as any).Deno;
    return (d?.env?.get?.(key) ?? '').trim();
  } catch (_e) {
    return '';
  }
};

/** Bankverbindung für das Zahlungsziel auf der Rechnung (fehlt noch). */
export const BANK = {
  holder: env('BILLING_BANK_HOLDER'),
  iban: env('BILLING_BANK_IBAN').replace(/\s+/g, '').toUpperCase(),
  bic: env('BILLING_BANK_BIC').replace(/\s+/g, '').toUpperCase(),
  bank: env('BILLING_BANK_NAME'),
};

/**
 * Nummernkreise. template: {YYYY} = Jahr, {NNNN} = laufende Nummer (Stellen = Anzahl N).
 * startNext: erste Nummer, die das System im laufenden Jahr vergibt (Anschluss an
 * bestehende Rechnungen). Leeres template = noch nicht eingerichtet.
 */
const startOf = (key: string) => {
  const n = Number(env(key));
  return Number.isInteger(n) && n > 0 ? n : 1;
};
export const NUMBERING: Record<'invoice' | 'cancellation' | 'credit_note', { template: string; startNext: number }> = {
  invoice: { template: env('BILLING_NUMBER_INVOICE'), startNext: startOf('BILLING_NUMBER_INVOICE_START') },
  cancellation: { template: env('BILLING_NUMBER_CANCELLATION'), startNext: startOf('BILLING_NUMBER_CANCELLATION_START') },
  credit_note: { template: env('BILLING_NUMBER_CREDIT_NOTE'), startNext: startOf('BILLING_NUMBER_CREDIT_NOTE_START') },
};

/** Basiszinssatz in Prozent für Verzugszinsen (§ 288 BGB); leer = beim Mahnen eintragen. */
export const BASE_RATE_PCT: number | null = env('BILLING_BASE_RATE_PCT') ? Number(env('BILLING_BASE_RATE_PCT').replace(',', '.')) : null;

export const VAT_RATE = 19;
export const PAYMENT_TERMS_DAYS = 14;

/** Was für die Freigabe noch fehlt (leer = bereit). */
export function releaseBlockers(kind: 'invoice' | 'cancellation' | 'credit_note' = 'invoice'): string[] {
  const out: string[] = [];
  if (!NUMBERING[kind].template) {
    out.push(kind === 'credit_note' ? 'Nummernkreis für Gutschriften' : kind === 'cancellation' ? 'Nummernkreis für Stornorechnungen' : 'Nummernkreis (Anschluss an die bestehenden Nummern)');
  }
  if (kind !== 'cancellation' && (!BANK.iban || !BANK.holder)) out.push('Bankverbindung');
  return out;
}

export function formatNumber(template: string, year: number, n: number): string {
  return template
    .replace('{YYYY}', String(year))
    .replace('{YY}', String(year).slice(2))
    .replace(/\{(N+)\}/, (_m, ns: string) => String(n).padStart(ns.length, '0'));
}

/** EU-Ausland mit USt-IdNr.: Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG). */
export function isReverseCharge(vatId: string | null | undefined): boolean {
  const v = (vatId ?? '').replace(/\s/g, '').toUpperCase();
  return /^(AT|BE|BG|CY|CZ|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[0-9A-Z]{2,12}$/.test(v);
}

const EU = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'GR', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];

export type TaxCase = 'domestic' | 'reverse_charge' | 'not_taxable';

/**
 * Steuerfall einer Rechnung aus Land und USt-IdNr. (K12, A3):
 *   Deutschland (oder Land fehlt, aber deutsche/keine USt-IdNr.)  → 19 % USt
 *   EU-Ausland mit USt-IdNr.                                       → Reverse Charge, § 13b UStG
 *   Drittland (z. B. Schweiz)                                      → nicht im Inland steuerbar, § 3a Abs. 2 UStG
 *   EU-Ausland ohne USt-IdNr.                                      → missing: USt-IdNr. fehlt
 */
export function taxCaseFor(country: string | null | undefined, vatId: string | null | undefined): { taxCase: TaxCase; vatRate: number; note: string | null; missing: string | null } {
  const c = String(country ?? '').trim().toUpperCase();
  const v = String(vatId ?? '').replace(/\s/g, '').toUpperCase();
  const vatCountry = v.slice(0, 2);
  const land = c || (vatCountry && /^[A-Z]{2}$/.test(vatCountry) ? (vatCountry === 'EL' ? 'GR' : vatCountry) : 'DE');
  if (land === 'DE') return { taxCase: 'domestic', vatRate: VAT_RATE, note: null, missing: null };
  if (EU.includes(land)) {
    if (isReverseCharge(v)) return { taxCase: 'reverse_charge', vatRate: 0, note: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG).', missing: null };
    return { taxCase: 'domestic', vatRate: VAT_RATE, note: null, missing: 'USt-IdNr. des Kunden (EU-Ausland)' };
  }
  return { taxCase: 'not_taxable', vatRate: 0, note: 'Nicht im Inland steuerbare Leistung (§ 3a Abs. 2 UStG).', missing: null };
}

/** Land für die Anzeige. */
export const COUNTRY_NAMES: Record<string, string> = {
  DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', NL: 'Niederlande', BE: 'Belgien', FR: 'Frankreich', IT: 'Italien', ES: 'Spanien',
  PL: 'Polen', CZ: 'Tschechien', DK: 'Dänemark', SE: 'Schweden', FI: 'Finnland', LU: 'Luxemburg', IE: 'Irland', PT: 'Portugal',
  GB: 'Vereinigtes Königreich', US: 'USA', LI: 'Liechtenstein', NO: 'Norwegen', SI: 'Slowenien', HR: 'Kroatien', HU: 'Ungarn',
};
