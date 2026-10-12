import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { firmendatenAus, joinAddress } from '@/lib/firmendaten';
import { arbeitgeberVorschlaege, listeAus, type VorschlagStelle } from '@/lib/arbeitgeberVorschlaege';

export interface CompanyProfile {
  id?: string;
  company_name: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  address: string | null;
  tax_id: string | null;
  billing_email: string | null;
  // Firmendaten fuer die Vereinbarung (Migration 20260924120000)
  legal_name?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  registration_number?: string | null;
  // Partner Facts
  headcount: number | null;
  annual_revenue: string | null;
  founded_year: number | null;
  unique_selling_point: string | null;
  company_awards: string[] | null;
  // Arbeitgeberprofil (Variante B, 26.09.2026) -- Listen, beim Tippen roh
  // mit leeren Zeilen, beim Speichern bereinigt.
  culture_values?: unknown;
  employer_selling_points?: unknown;
  benefits?: unknown;
  target_companies?: unknown;
  excluded_companies?: unknown;
  /** Welche Felder aus der Aufnahme kamen (Migration 20260926170000). */
  intake_source?: { draft_id?: string | null; at?: string; fields?: string[] } | null;
}

/** Die still aus der Aufnahme übernommenen Felder -- markiert, bis der Kunde sie ändert. */
export const HERKUNFT_FELDER = [
  'company_name', 'legal_name', 'street', 'postal_code', 'city', 'registration_number',
  'tax_id', 'website', 'industry', 'billing_email', 'headcount',
] as const;
export type HerkunftFeld = (typeof HERKUNFT_FELDER)[number];

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const LEER: CompanyProfile = {
  company_name: '', logo_url: null, industry: null, website: null, description: null, address: null,
  tax_id: null, billing_email: null, headcount: null, annual_revenue: null, founded_year: null,
  unique_selling_point: null, company_awards: null,
};

/**
 * Firmenprofil des Kontos laden und automatisch speichern (800 ms nach der
 * letzten Eingabe). Die Speicherlogik ist die der früheren Einstellungsseite:
 * neue Spalten getrennt (falls live noch nicht eingespielt), HRB und USt-ID
 * auch in der Verifizierung, geänderte Felder verlieren „aus Aufnahme“.
 */
export function useCompanyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile>(LEER);
  // Stand beim Laden: daran erkennt die Seite, ob ein Feld aus der Aufnahme
  // noch unverändert ist ("aus Aufnahme") oder vom Kunden geändert wurde.
  const [geladen, setGeladen] = useState<Record<string, unknown>>({});
  // Die jüngste Stelle aus einer Aufnahme -- Quelle der Vorschläge.
  const [stelle, setStelle] = useState<VorschlagStelle | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<number | null>(null);
  const latest = useRef<CompanyProfile>(LEER);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('company_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      const { data: verif } = await supabase
        .from('client_verifications')
        .select('kyc_status, kyc_verified_at, company_registration_number, vat_id')
        .eq('client_id', user.id)
        .maybeSingle();
      const f = firmendatenAus(data as never, verif as never);
      setVerifiedAt(f.verified_at);
      if (data) {
        // Die Felder kommen aus den neuen Spalten -- oder, solange es die live
        // noch nicht gibt, aus Adresszeile und Verifizierung.
        const stand = {
          ...(data as unknown as CompanyProfile),
          legal_name: f.legal_name, street: f.street, postal_code: f.postal_code, city: f.city,
          registration_number: f.registration_number, tax_id: f.vat_id || null,
        };
        setProfile(stand);
        latest.current = stand;
        setGeladen(stand as unknown as Record<string, unknown>);
      } else {
        // Noch kein Firmenprofil: Namen aus Konto oder Organisation vorbelegen,
        // damit die erste Antwort (etwa in „Noch offen“) das Profil anlegen kann.
        const [{ data: prof }, { data: org }] = await Promise.all([
          supabase.from('profiles').select('company_name').eq('user_id', user.id).maybeSingle(),
          supabase.from('organizations').select('name').eq('owner_id', user.id).limit(1).maybeSingle(),
        ]);
        const name = (prof?.company_name || (org as { name?: string } | null)?.name || '').trim();
        if (name) {
          const stand = { ...LEER, company_name: name };
          setProfile(stand);
          latest.current = stand;
        }
      }
      const { data: job } = await supabase
        .from('jobs')
        .select('id, title, employment_type, company_culture, unique_selling_points, benefits, target_companies, nogo_companies')
        .eq('client_id', user.id)
        .not('intake_draft_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setStelle((job as VorschlagStelle | null) ?? null);
    } catch (error) {
      console.error('Error fetching company profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (p: CompanyProfile) => {
    if (!user) return;
    // Ohne Firmennamen lässt sich kein Profil anlegen -- sichtbar machen statt still verwerfen.
    if (!p.id && !p.company_name.trim()) { setSaveState('error'); return; }
    setSaveState('saving');
    try {
      const adresse = joinAddress({ street: p.street ?? '', postal_code: p.postal_code ?? '', city: p.city ?? '' }) || p.address;
      const liste = (v: unknown) => { const l = listeAus(v); return l.length ? l : null; };
      // Ein geändertes Feld ist nicht mehr "aus Aufnahme".
      const herkunft = p.intake_source
        ? {
            ...p.intake_source,
            fields: (p.intake_source.fields ?? []).filter(
              (feld) => String((p as unknown as Record<string, unknown>)[feld] ?? '') === String(geladen[feld] ?? '')),
          }
        : null;
      const neueFelder = {
        legal_name: p.legal_name || null, street: p.street || null, postal_code: p.postal_code || null,
        city: p.city || null, registration_number: p.registration_number || null,
        culture_values: liste(p.culture_values), employer_selling_points: liste(p.employer_selling_points),
        benefits: liste(p.benefits), target_companies: liste(p.target_companies), excluded_companies: liste(p.excluded_companies),
        intake_source: herkunft,
      };
      const basis = {
        company_name: p.company_name, logo_url: p.logo_url, industry: p.industry, website: p.website,
        description: p.description, address: adresse, tax_id: p.tax_id, billing_email: p.billing_email,
        headcount: p.headcount, annual_revenue: p.annual_revenue, founded_year: p.founded_year,
        unique_selling_point: p.unique_selling_point, company_awards: p.company_awards,
      };
      // HRB und USt-ID auch in der Verifizierung -- die gibt es live schon.
      await supabase
        .from('client_verifications')
        .update({ company_registration_number: p.registration_number || null, vat_id: p.tax_id || null } as never)
        .eq('client_id', user.id);

      let id = p.id;
      if (!id) {
        const { data, error } = await supabase.from('company_profiles').insert({ user_id: user.id, ...basis }).select().single();
        if (error) throw error;
        id = (data as { id: string }).id;
        latest.current = { ...latest.current, id };
        setProfile((cur) => ({ ...cur, id }));
      } else {
        const { error } = await supabase.from('company_profiles').update(basis).eq('id', id);
        if (error) throw error;
      }
      // Fehlen die neuen Spalten live noch (Migration nicht eingespielt), bleibt der Rest gespeichert.
      const nach = await supabase.from('company_profiles').update({ ...neueFelder, address: adresse } as never).eq('id', id);
      if (nach.error && !/column/i.test(nach.error.message ?? '')) throw nach.error;
      setSaveState('saved');
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveState('error');
    }
  }, [user, geladen]);

  /** Felder ändern; gespeichert wird automatisch kurz nach der letzten Eingabe. */
  const update = useCallback((patch: Partial<CompanyProfile>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setProfile(next);
    setSaveState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(latest.current), 800);
  }, [save]);

  // Beim Verlassen der Unterseite nichts verlieren.
  useEffect(() => () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      void save(latest.current);
    }
  }, [save]);

  const vorschlaege = arbeitgeberVorschlaege(stelle, profile as never);
  const ausAufnahme = (feld: HerkunftFeld) =>
    !!profile.intake_source?.fields?.includes(feld)
    && String((profile as unknown as Record<string, unknown>)[feld] ?? '') === String(geladen[feld] ?? '');

  return { profile, update, loading, saveState, vorschlaege, ausAufnahme, stelle, verifiedAt, reload: load };
}

/** Fehlende Angaben für „Noch offen“ und die Kachel „Auftritt bei Headhuntern“. */
export function fehlendeAuftrittAngaben(p: CompanyProfile): { feld: 'headcount' | 'unique_selling_point'; frage: string; hilfe: string }[] {
  const offen: { feld: 'headcount' | 'unique_selling_point'; frage: string; hilfe: string }[] = [];
  if (p.headcount == null) offen.push({ feld: 'headcount', frage: 'Wie viele Mitarbeitende hat Ihr Unternehmen?', hilfe: 'Headhunter nennen das im ersten Gespräch mit Kandidaten.' });
  if (!p.unique_selling_point?.trim()) offen.push({ feld: 'unique_selling_point', frage: 'Was macht Sie als Arbeitgeber besonders?', hilfe: 'Ein Satz, mit dem Headhunter Sie vorstellen.' });
  return offen;
}

/** Fehlende Rechnungsangaben (für den Vertrag nötig). */
export function fehlendeFirmendaten(p: CompanyProfile): string[] {
  const fehlt: string[] = [];
  if (!p.company_name?.trim()) fehlt.push('Firmenname');
  if (!p.legal_name?.trim()) fehlt.push('Firmierung');
  if (!p.street?.trim() || !p.postal_code?.trim() || !p.city?.trim()) fehlt.push('Anschrift');
  if (!p.billing_email?.trim()) fehlt.push('Rechnungs-E-Mail');
  return fehlt;
}
