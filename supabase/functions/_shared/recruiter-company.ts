import { cleanContractDetails } from './recruiter-contract-data.ts';
import type { RecruiterProfile } from './recruiter-contract-policy.ts';

/**
 * Firmendaten aus dem Impressum: reine Ableitungen, ohne Netz und ohne Deno.
 * Wird von der Edge Function (recruiter-enrich.ts) und vom Frontend geteilt.
 * Rechtsform, Sitzland und Steuerstatus werden abgeleitet, nicht abgefragt.
 */

export interface EnrichmentData {
  name?: string; legal_name?: string; street?: string; postal_code?: string; city?: string; country?: string;
  registration_number?: string; vat_id?: string; ceo_name?: string;
}
export interface CompanySuggestion {
  company: string; legalForm: string; address: string; country: string;
  taxStatus: 'regular' | ''; vatId: string; registration: string; ceo: string; source: string;
}
export const LEGAL_FORMS = ['GmbH', 'UG (haftungsbeschränkt)', 'GmbH & Co. KG', 'AG', 'KG', 'OHG', 'GbR', 'e.K.', 'Einzelunternehmen', 'Freiberuflich', 'Andere'] as const;
export const COUNTRIES = ['Deutschland', 'Österreich', 'Schweiz'] as const;
/** Rechtsformen, bei denen die unterzeichnende Person „Inhaber“ ist, nicht „Geschäftsführer“. */
export const SOLO_FORMS = ['Einzelunternehmen', 'Freiberuflich', 'e.K.'];
export const SIGNER_ROLES = ['Geschäftsführer', 'Inhaber', 'Vorstand', 'Prokurist', 'Partner'] as const;

export function legalFormOf(name: string): string {
  const n = ` ${name.toLowerCase().replace(/\s+/g, ' ')} `;
  if (/gmbh\s*&\s*co\.?\s*kg/.test(n)) return 'GmbH & Co. KG';
  if (/\bug\b|haftungsbeschr/.test(n)) return 'UG (haftungsbeschränkt)';
  if (/\bgmbh\b|\bmbh\b/.test(n)) return 'GmbH';
  if (/\bag\b|\bse\b/.test(n)) return 'AG';
  if (/\bohg\b/.test(n)) return 'OHG';
  if (/\bkg\b/.test(n)) return 'KG';
  if (/\bgbr\b/.test(n)) return 'GbR';
  if (/\be\.\s?k\.?\B|\be\. ?k\. |\beingetragene[rn]? kauf(mann|frau)\b/.test(n)) return 'e.K.';
  if (/\b(ltd|inc|llc|sarl|sa|bv|plc)\b/.test(n)) return 'Andere';
  return '';
}

export function countryOf(data: EnrichmentData): string {
  const c = String(data.country ?? '').trim().toLowerCase();
  if (['de', 'deu', 'germany', 'deutschland'].includes(c)) return 'Deutschland';
  if (['at', 'aut', 'austria', 'österreich', 'oesterreich'].includes(c)) return 'Österreich';
  if (['ch', 'che', 'switzerland', 'schweiz', 'suisse', 'svizzera'].includes(c)) return 'Schweiz';
  const vat = String(data.vat_id ?? '').toUpperCase().replace(/\s+/g, '');
  if (vat.startsWith('DE')) return 'Deutschland';
  if (vat.startsWith('ATU')) return 'Österreich';
  if (vat.startsWith('CHE')) return 'Schweiz';
  if (c) return String(data.country).trim().slice(0, 60);
  if (/^\d{5}$/.test(String(data.postal_code ?? '').trim())) return 'Deutschland';
  return '';
}

export function suggestionFrom(data: EnrichmentData, source: string): CompanySuggestion {
  const s = (v: unknown, max = 200) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  const company = s(data.legal_name) || s(data.name);
  const street = s(data.street); const zip = s(data.postal_code, 12); const city = s(data.city, 80);
  const address = [street, [zip, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const vatId = s(data.vat_id, 20).toUpperCase().replace(/\s+/g, '');
  return {
    company, legalForm: legalFormOf(company), address, country: countryOf(data),
    taxStatus: vatId ? 'regular' : '', vatId, registration: s(data.registration_number, 80), ceo: s(data.ceo_name, 120), source,
  };
}

/** Vorschlag in das Profil übernehmen. Leere Vorschläge überschreiben nichts. */
export function applySuggestion(profile: RecruiterProfile, sug: CompanySuggestion): RecruiterProfile {
  const d = cleanContractDetails(profile.contractDetails);
  return {
    ...profile,
    company: sug.company || profile.company, legalForm: sug.legalForm || profile.legalForm,
    address: sug.address || profile.address, country: sug.country || profile.country,
    taxStatus: sug.taxStatus || profile.taxStatus,
    contractDetails: {
      ...d,
      businessEvidence: sug.registration ? `Handelsregister ${sug.registration} (laut Impressum ${sug.source})` : d.businessEvidence,
      taxNumber: sug.vatId ? `USt-IdNr. ${sug.vatId} (laut Impressum ${sug.source})` : d.taxNumber,
      responsiblePerson: sug.ceo || d.responsiblePerson || profile.name,
    },
  };
}

/** Passt der Geschäftsführer aus dem Impressum zur Person? Dann ist die Berechtigung belegt. */
export const personMatches = (a: string, b: string): boolean => {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-zäöüß ]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const x = norm(a); const y = norm(b);
  return x.length > 0 && y.length > 0 && x.filter(w => y.includes(w)).length >= Math.min(2, x.length, y.length);
};
