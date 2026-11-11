// deno-lint-ignore-file no-explicit-any
// Welche Konditionen-Fassung gilt für einen Headhunter? (Umbau 11.11.2026)
// Liest Stichtag (billing_settings 'conditions_v2'), Zustimmung (H2) und
// Vertragsunterschrift. Rechnen: konditionen.ts.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { conditionsVersionAt, type ConditionsVersion } from './konditionen.ts';

export interface ConditionsSettings {
  /** Ab diesem Tag gibt es Fassung 2 (für neue Headhunter und alle, die zustimmen). */
  activeFrom: string | null;
  /** Ab diesem Tag gilt Fassung 2 für alle (§ 18 Abs. 2: 12 Monate fix, 8 Wochen angekündigt). */
  forcedFrom: string | null;
  /** Wann die Headhunter informiert wurden. */
  announcedAt: string | null;
}

export const CONDITIONS_KEY = 'conditions_v2';

export async function conditionsSettings(db: SupabaseClient): Promise<ConditionsSettings> {
  try {
    const { data, error } = await db.from('billing_settings').select('value').eq('key', CONDITIONS_KEY).maybeSingle();
    if (error) return { activeFrom: null, forcedFrom: null, announcedAt: null };
    const v = ((data as any)?.value ?? {}) as Record<string, unknown>;
    const str = (x: unknown) => (typeof x === 'string' && x ? x : null);
    return { activeFrom: str(v.activeFrom), forcedFrom: str(v.forcedFrom), announcedAt: str(v.announcedAt) };
  } catch (_e) {
    return { activeFrom: null, forcedFrom: null, announcedAt: null };
  }
}

/** Zustimmung zu Fassung 2 und erste Vertragsunterschrift des Headhunters. */
export async function recruiterConditionFacts(db: SupabaseClient, recruiterId: string) {
  let consentedAt: string | null = null;
  try {
    const { data } = await db.from('recruiter_condition_consents').select('consented_at').eq('recruiter_id', recruiterId).eq('version', 2).maybeSingle();
    consentedAt = (data as any)?.consented_at ?? null;
  } catch (_e) { /* Tabelle fehlt: keine Zustimmung */ }
  let contractSignedAt: string | null = null;
  try {
    const { data: cases } = await db.from('recruiter_onboarding_cases').select('id').eq('claimed_by', recruiterId);
    const ids = ((cases ?? []) as any[]).map((c) => c.id);
    if (ids.length) {
      const { data: env } = await db.from('recruiter_contract_envelopes').select('recruiter_signed_at').in('case_id', ids).not('recruiter_signed_at', 'is', null).order('recruiter_signed_at', { ascending: true }).limit(1);
      contractSignedAt = ((env ?? []) as any[])[0]?.recruiter_signed_at ?? null;
    }
  } catch (_e) { /* ohne Vertragsdaten: Bestand */ }
  return { consentedAt, contractSignedAt };
}

/** Fassung für einen Headhunter an einem Tag. */
export async function recruiterVersionAt(db: SupabaseClient, recruiterId: string, atIso: string, settings?: ConditionsSettings): Promise<ConditionsVersion> {
  const s = settings ?? await conditionsSettings(db);
  if (!s.activeFrom) return 1;
  const facts = await recruiterConditionFacts(db, recruiterId);
  return conditionsVersionAt({ at: atIso, activeFrom: s.activeFrom, forcedFrom: s.forcedFrom, ...facts });
}

/** Fassung für eine Stelle: zählt der Tag der Aktivierung („Ich suche“), sonst heute. */
export async function recruiterVersionForJob(db: SupabaseClient, recruiterId: string, jobId: string, nowIso: string, settings?: ConditionsSettings): Promise<ConditionsVersion> {
  let at = nowIso;
  try {
    const { data } = await db.from('recruiter_job_activations').select('activated_at').eq('recruiter_id', recruiterId).eq('job_id', jobId).order('activated_at', { ascending: true }).limit(1);
    at = ((data ?? []) as any[])[0]?.activated_at ?? nowIso;
  } catch (_e) { /* ohne Aktivierung: heute */ }
  return recruiterVersionAt(db, recruiterId, at, settings);
}
