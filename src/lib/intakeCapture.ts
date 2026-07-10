import { supabase } from '@/integrations/supabase/client';

/**
 * Capture-Integrität (ULTIMATE_INTAKE_PLAN P0/P1):
 * Jobs werden mit dem vollen Hybrid-Payload angelegt — typisierte Matching-
 * Spalten + intake_payload (narratives Briefing, recruiter-privat).
 *
 * Die Spalten aus 20260619120000_intake_hybrid_foundation.sql (intake_payload,
 * visa_sponsorship, experience_min/max, …) sind evtl. noch nicht deployed.
 * Deshalb: Insert zuerst MIT den erweiterten Feldern versuchen; meldet
 * PostgREST eine unbekannte Spalte, ohne sie erneut versuchen. So funktioniert
 * der Flow vor UND nach der Migration — danach ohne Datenverlust.
 */

/** Felder, die erst mit der Hybrid-Migration existieren. */
const EXTENDED_COLUMNS = [
  'intake_payload',
  'reveal_envelope',
  'reveal_trigger',
  'search_difficulty',
  'target_companies',
  'nogo_companies',
  'visa_sponsorship',
  'experience_min',
  'experience_max',
] as const;

export type ExtendedJobFields = Partial<Record<(typeof EXTENDED_COLUMNS)[number], unknown>>;

export const isMissingColumnError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === 'PGRST204') return true; // PostgREST: column not found in schema cache
  const msg = (error.message || '').toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('could not find'));
};

export async function insertJobWithIntake(
  base: Record<string, unknown>,
  extended: ExtendedJobFields,
): Promise<{ data: any; error: any; extendedPersisted: boolean }> {
  const cleanExtended = Object.fromEntries(
    Object.entries(extended).filter(([, v]) => v !== undefined && v !== null),
  );

  if (Object.keys(cleanExtended).length > 0) {
    const first = await supabase
      .from('jobs')
      .insert({ ...base, ...cleanExtended } as any)
      .select()
      .single();
    if (!first.error) return { data: first.data, error: null, extendedPersisted: true };
    if (!isMissingColumnError(first.error)) return { data: null, error: first.error, extendedPersisted: false };
    console.warn('Hybrid-Spalten fehlen noch (Migration nicht deployed) — Insert ohne erweiterte Felder:', first.error.message);
  }

  const fallback = await supabase.from('jobs').insert(base as any).select().single();
  return { data: fallback.data, error: fallback.error, extendedPersisted: false };
}

/** Wie insertJobWithIntake, aber als UPDATE (Entwurf speichern / erneut einreichen). */
export async function updateJobWithIntake(
  jobId: string,
  base: Record<string, unknown>,
  extended: ExtendedJobFields,
): Promise<{ data: any; error: any; extendedPersisted: boolean }> {
  const cleanExtended = Object.fromEntries(
    Object.entries(extended).filter(([, v]) => v !== undefined && v !== null),
  );

  if (Object.keys(cleanExtended).length > 0) {
    const first = await supabase
      .from('jobs')
      .update({ ...base, ...cleanExtended } as any)
      .eq('id', jobId)
      .select()
      .single();
    if (!first.error) return { data: first.data, error: null, extendedPersisted: true };
    if (!isMissingColumnError(first.error)) return { data: null, error: first.error, extendedPersisted: false };
    console.warn('Hybrid-Spalten fehlen noch — Update ohne erweiterte Felder:', first.error.message);
  }

  const fallback = await supabase.from('jobs').update(base as any).eq('id', jobId).select().single();
  return { data: fallback.data, error: fallback.error, extendedPersisted: false };
}

/** Zahl aus freiem Text ziehen ("3-5 Kandidaten" → 3), statt lossy parseInt. */
export const coerceLeadingInt = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const m = String(raw).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};
