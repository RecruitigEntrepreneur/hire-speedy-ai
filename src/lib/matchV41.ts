/**
 * Match V4.1 im Frontend: Typen der Antwort von match-v41 und Anzeige-Helfer.
 *
 * Die Stufe setzt der Server (KI-Urteil je Kriterium + feste Regeln). Das
 * Frontend zeigt Stufe, Belege und Klärfragen – nie eine Prozentzahl als Urteil.
 */

import { supabase } from '@/integrations/supabase/client';

export type MatchTier = 'sehr_passend' | 'passend' | 'pruefen' | 'ausgeschlossen';
export type ReqStatus = 'met' | 'partial' | 'not_met' | 'unknown';
export type FrameStatus = 'ok' | 'check' | 'unknown' | 'exclude';

export interface MatchRequirementRow {
  id: string;
  text: string;
  class: 'must' | 'nice' | 'trainable';
  status: ReqStatus;
  evidence: string;
  note: string;
}

export interface MatchFrameItem {
  key: 'blocked' | 'work_model' | 'location' | 'visa' | 'language' | 'salary' | 'start' | 'employment';
  status: FrameStatus;
  text: string;
}

export interface MatchV41Item {
  job_id: string;
  version: string;
  tier: MatchTier;
  label: string;
  sort_score: number;
  confidence: number;
  exclusion: { code: string; text: string; overridable: true } | null;
  caps: string[];
  requirements: MatchRequirementRow[];
  frame: MatchFrameItem[];
  summary: string;
  reasons: string[];
  gaps: string[];
  talking_points: string[];
  override: { decision: 'show' | 'hide'; reason: string | null } | null;
}

export interface MatchV41Response {
  version: string;
  candidate_id: string;
  results: MatchV41Item[];
  pending: string[];
  stats: { jobs: number; cached: number; judged_now: number; without_ai: number; pending: number; candidate_understood_by_ai: boolean; ms: number };
}

export class MatchV41Unavailable extends Error {}

function safeLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Ruft match-v41. Wirft MatchV41Unavailable, wenn die Function (noch) nicht deployt ist. */
export async function fetchMatchV41(candidateId: string, opts: { force?: boolean; jobIds?: string[] } = {}): Promise<MatchV41Response> {
  if (import.meta.env.DEV && safeLocal('matchV41Mock') === '1') {
    const [{ matchV41Mock }, { data: jobs }] = await Promise.all([
      import('@/dev/matchV41Mock'),
      supabase.from('recruiter_jobs_view').select('id').eq('status', 'published').limit(5),
    ]);
    return matchV41Mock(candidateId, ((jobs ?? []) as { id: string }[]).map((j) => j.id));
  }
  const { data, error } = await supabase.functions.invoke('match-v41', { body: { candidateId, ...opts } });
  if (error) {
    const res = (error as { context?: unknown }).context;
    if (res instanceof Response) {
      if (res.status === 404) throw new MatchV41Unavailable('match-v41 ist nicht deployt.');
      const detail = await res.clone().json().catch(() => null);
      throw new Error(typeof detail?.message === 'string' ? detail.message : 'Matching gerade nicht erreichbar.');
    }
    throw new MatchV41Unavailable(error.message);
  }
  return data as MatchV41Response;
}

export const TIER_STYLE: Record<MatchTier, { label: string; className: string }> = {
  sehr_passend: { label: 'Sehr passend', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900' },
  passend: { label: 'Passend', className: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900' },
  pruefen: { label: 'Prüfen', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900' },
  ausgeschlossen: { label: 'Ausgeschlossen', className: 'bg-muted text-muted-foreground border-border' },
};

export const FRAME_LABEL: Record<MatchFrameItem['key'], string> = {
  blocked: 'Sperre',
  work_model: 'Arbeitsmodell',
  location: 'Arbeitsort',
  visa: 'Arbeitserlaubnis',
  language: 'Sprachen',
  salary: 'Gehalt',
  start: 'Start',
  employment: 'Anstellungsart',
};

/** Stufe nach Übersteuerung des Headhunters: „hide" blendet aus, „show" holt einen Ausschluss zurück. */
export function effectiveTier(m: MatchV41Item): MatchTier | 'ausgeblendet' {
  if (m.override?.decision === 'hide') return 'ausgeblendet';
  if (m.override?.decision === 'show' && m.tier === 'ausgeschlossen') return 'pruefen';
  return m.tier;
}

/** Eine Zeile für die Liste: was belegt ist und was fehlt – kurz. */
export function shortLine(m: MatchV41Item): string {
  if (m.exclusion) return m.exclusion.text;
  const met = m.requirements.filter((r) => r.class === 'must' && r.status === 'met').map((r) => r.text);
  const missing = m.requirements.filter((r) => r.class === 'must' && (r.status === 'not_met' || r.status === 'partial')).map((r) => r.text);
  const parts: string[] = [];
  if (met.length) parts.push(met.slice(0, 3).join(', '));
  if (missing.length) parts.push(`fehlt: ${missing.slice(0, 2).join(', ')}`);
  const frameIssue = m.frame.find((f) => f.status === 'check');
  if (frameIssue) parts.push(frameIssue.text);
  return parts.join(' · ') || m.gaps[0] || m.summary;
}

export function confidenceLabel(c: number): 'hoch' | 'mittel' | 'niedrig' {
  return c >= 0.75 ? 'hoch' : c >= 0.5 ? 'mittel' : 'niedrig';
}
