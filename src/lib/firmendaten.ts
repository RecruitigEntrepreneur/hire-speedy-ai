import { supabase } from '@/integrations/supabase/client';

/**
 * Die Firmendaten eines Kunden -- EINE Quelle fuer Einstellungen und Aufnahme.
 *
 * Ein verifizierter Kunde soll seine Firma in der Positionsaufnahme weder
 * pruefen noch ergaenzen muessen (Durchklicken 24.09.2026). Bisher gab es
 * dafuer keinen Datensatz: das Firmenprofil kannte nur Name, eine freie
 * Adresszeile und die USt-ID, Handelsregister und USt-ID der Verifizierung
 * waren leer, eine Firmierung gab es nirgends.
 *
 * Neue Spalten (Migration 20260924120000): legal_name, street, postal_code,
 * city, registration_number. Solange sie live fehlen, wird aus den alten
 * Feldern gelesen (address, company_name, client_verifications).
 */
export interface Firmendaten {
  company_name: string;
  legal_name: string;
  street: string;
  postal_code: string;
  city: string;
  registration_number: string;
  vat_id: string;
  industry: string;
  website: string;
  headcount: number | null;
  /** Wann Matchunt den Kunden verifiziert hat (KYC). */
  verified_at: string | null;
}

/** "Torstrasse 150, 10115 Berlin" -> Strasse, PLZ, Ort. */
export function splitAddress(address: string | null | undefined): { street: string; postal_code: string; city: string } {
  const raw = String(address ?? '').trim();
  if (!raw) return { street: '', postal_code: '', city: '' };
  const m = /^(.*?)[,\n]\s*(\d{4,5})\s+(.+)$/s.exec(raw);
  if (!m) return { street: raw, postal_code: '', city: '' };
  return { street: m[1].trim(), postal_code: m[2], city: m[3].trim() };
}

export function joinAddress(f: Pick<Firmendaten, 'street' | 'postal_code' | 'city'>): string {
  const ort = [f.postal_code, f.city].filter(Boolean).join(' ');
  return [f.street, ort].filter(Boolean).join(', ');
}

const t = (v: unknown) => String(v ?? '').trim();

export function firmendatenAus(profile: Record<string, any> | null, verif: Record<string, any> | null): Firmendaten {
  const alt = splitAddress(profile?.address);
  return {
    company_name: t(profile?.company_name),
    legal_name: t(profile?.legal_name) || t(profile?.company_name),
    street: t(profile?.street) || alt.street,
    postal_code: t(profile?.postal_code) || alt.postal_code,
    city: t(profile?.city) || alt.city,
    registration_number: t(profile?.registration_number) || t(verif?.company_registration_number),
    vat_id: t(profile?.tax_id) || t(verif?.vat_id),
    industry: t(profile?.industry),
    website: t(profile?.website),
    headcount: profile?.headcount ?? null,
    verified_at: verif?.kyc_status === 'verified' ? verif?.kyc_verified_at ?? null : null,
  };
}

export async function ladeFirmendaten(userId: string): Promise<{ firma: Firmendaten; profile: Record<string, any> | null }> {
  const [p, v] = await Promise.all([
    supabase.from('company_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('client_verifications').select('kyc_status, kyc_verified_at, company_registration_number, vat_id')
      .eq('client_id', userId).maybeSingle(),
  ]);
  const profile = (p.data ?? null) as Record<string, any> | null;
  return { firma: firmendatenAus(profile, (v.data ?? null) as Record<string, any> | null), profile };
}

/** Vollstaendig genug fuer die Vereinbarung? */
export function firmendatenVollstaendig(f: Firmendaten): boolean {
  return Boolean(f.legal_name && f.street && f.postal_code && f.city);
}
