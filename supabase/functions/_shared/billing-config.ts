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

/** Bankverbindung für das Zahlungsziel auf der Rechnung (fehlt noch). */
export const BANK = {
  holder: '',
  iban: '',
  bic: '',
  bank: '',
};

/**
 * Nummernkreise. template: {YYYY} = Jahr, {NNNN} = laufende Nummer (Stellen = Anzahl N).
 * startNext: erste Nummer, die das System im laufenden Jahr vergibt (Anschluss an
 * bestehende Rechnungen). Leeres template = noch nicht eingerichtet.
 */
export const NUMBERING: Record<'invoice' | 'cancellation' | 'credit_note', { template: string; startNext: number }> = {
  invoice: { template: '', startNext: 1 },
  cancellation: { template: '', startNext: 1 },
  credit_note: { template: '', startNext: 1 },
};

export const VAT_RATE = 19;
export const PAYMENT_TERMS_DAYS = 14;

/** Was für die Freigabe noch fehlt (leer = bereit). */
export function releaseBlockers(kind: 'invoice' | 'cancellation' | 'credit_note' = 'invoice'): string[] {
  const out: string[] = [];
  if (!NUMBERING[kind].template) out.push('Nummernkreis (Anschluss an die bestehenden Nummern)');
  if (!BANK.iban || !BANK.holder) out.push('Bankverbindung');
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
