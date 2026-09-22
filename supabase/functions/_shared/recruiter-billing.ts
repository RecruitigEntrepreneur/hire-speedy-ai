/**
 * Abrechnungsdaten des Headhunters im Profil (Entscheidung 22.09.2026): Firma,
 * Anschrift, Steuerangaben und Auszahlungskonto. Der Headhunter ändert sie selbst,
 * Matchunt bekommt bei jeder Änderung eine Mail mit altem und neuem Stand. Der
 * unterschriebene Vertrag bleibt unberührt; dort ist alles eingefroren.
 *
 * Reine Funktionen ohne Deno-Bezug, damit die Profilseite dieselbe Prüfung nutzt.
 */
export const BILLING_FIELDS = {
  company_name: 'Firma',
  company_address: 'Anschrift',
  tax_id: 'USt-IdNr. / Steuernummer',
  bank_account_holder: 'Kontoinhaber',
  bank_iban: 'IBAN',
  bank_bic: 'BIC',
} as const;
export type BillingField = keyof typeof BILLING_FIELDS;
export type Billing = Record<BillingField, string>;

const text = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const compactIban = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toUpperCase();
const compactBic = (value: unknown) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

export function cleanBilling(input: unknown): Billing {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    company_name: text(src.company_name, 200),
    company_address: text(src.company_address, 300),
    tax_id: text(src.tax_id, 60),
    bank_account_holder: text(src.bank_account_holder, 200),
    bank_iban: compactIban(src.bank_iban).slice(0, 34),
    bank_bic: compactBic(src.bank_bic).slice(0, 11),
  };
}

/** Prüfziffer nach ISO 13616 (mod 97). Leer gilt als gültig: Dann ist noch kein Konto hinterlegt. */
export function ibanValid(value: string): boolean {
  const iban = compactIban(value);
  if (!iban) return true;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  let rest = 0;
  for (const ch of iban.slice(4) + iban.slice(0, 4)) {
    for (const digit of /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch) rest = (rest * 10 + Number(digit)) % 97;
  }
  return rest === 1;
}

/** BIC mit 8 oder 11 Zeichen; leer ist erlaubt. */
export const bicValid = (value: string) => !value || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compactBic(value));

/** IBAN für Mails und Anzeigen: Land, Prüfziffer und die letzten vier Stellen. */
export const maskIban = (value: string) => {
  const iban = compactIban(value);
  return iban.length > 8 ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : iban;
};

export interface BillingChange { field: BillingField; label: string; before: string; after: string }

/** Nur geänderte Felder; die IBAN erscheint gekürzt. */
export function billingChanges(before: Partial<Record<BillingField, string | null>>, after: Billing): BillingChange[] {
  const old = cleanBilling(before);
  return (Object.keys(BILLING_FIELDS) as BillingField[]).flatMap(field => {
    if (old[field] === after[field]) return [];
    const show = (value: string) => (field === 'bank_iban' ? maskIban(value) : value) || '(leer)';
    return [{ field, label: BILLING_FIELDS[field], before: show(old[field]), after: show(after[field]) }];
  });
}
