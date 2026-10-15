// Passung beim Einreichen (14.10.2026): Unpassende Kandidaten und Stellen werden
// nirgends zum Einreichen angeboten. Quelle ist dasselbe Matching wie unter
// „Passende Stellen“ im Profil (Match V4.1, Stufe + Übersteuerung des Headhunters).
import { supabase } from '@/integrations/supabase/client';
import { fetchMatchV41, type MatchTier, type MatchV41Item } from './matchV41';

export type Fit = MatchTier | 'ausgeblendet';

const RANK: Record<Fit, number> = { sehr_passend: 0, passend: 1, pruefen: 2, ausgeschlossen: 3, ausgeblendet: 4 };

export const FIT_LABEL: Record<'sehr_passend' | 'passend' | 'pruefen', string> = {
  sehr_passend: 'Sehr passend',
  passend: 'Passend',
  pruefen: 'Teilweise',
};

/** Stufe nach Übersteuerung: „Trotzdem vorschlagen“ holt einen Ausschluss als „Teilweise“ zurück. */
export function fitOf(tier: MatchTier, decision: 'show' | 'hide' | null | undefined): Fit {
  if (decision === 'hide') return 'ausgeblendet';
  if (decision === 'show' && tier === 'ausgeschlossen') return 'pruefen';
  return tier;
}

export const isFitting = (fit: Fit | null | undefined): fit is 'sehr_passend' | 'passend' | 'pruefen' =>
  fit === 'sehr_passend' || fit === 'passend' || fit === 'pruefen';

export const byFit = (a: Fit, b: Fit) => RANK[a] - RANK[b];

/** Muss-Kriterien in zwei Gruppen: belegt und noch offen (nicht belegt, teilweise, unbekannt). */
export function mustSplit(item: Pick<MatchV41Item, 'requirements'>): { met: string[]; open: string[] } {
  const musts = item.requirements.filter((r) => r.class === 'must');
  return {
    met: musts.filter((r) => r.status === 'met').map((r) => r.text),
    open: musts.filter((r) => r.status !== 'met').map((r) => r.text),
  };
}

/**
 * Eine Zeile für Listen: „Belegt: AWS, Linux · offen: Kubernetes“. Hat die Stelle keine
 * einzeln prüfbaren Muss-Kriterien, der wichtigste Hinweis des Matchings.
 */
export function fitLine(item: Pick<MatchV41Item, 'requirements' | 'exclusion'> & Partial<Pick<MatchV41Item, 'gaps' | 'summary'>>): string {
  if (item.exclusion) return item.exclusion.text;
  const { met, open } = mustSplit(item);
  const line = [
    met.length ? `Belegt: ${met.slice(0, 3).join(', ')}${met.length > 3 ? ' …' : ''}` : null,
    open.length ? `offen: ${open.slice(0, 2).join(', ')}${open.length > 2 ? ` +${open.length - 2}` : ''}` : null,
  ].filter(Boolean).join(' · ');
  return line || item.gaps?.[0] || item.summary || '';
}

/** Gespeicherte Urteile für eine Stelle und mehrere Kandidaten (eigene, per RLS). */
export async function storedPoolFit(jobId: string, candidateIds: string[]): Promise<Map<string, Fit>> {
  if (!candidateIds.length) return new Map();
  const [{ data: results }, { data: overrides }] = await Promise.all([
    supabase.from('match_v41_results' as never).select('candidate_id, tier').eq('job_id', jobId).in('candidate_id', candidateIds),
    supabase.from('match_v41_overrides' as never).select('candidate_id, decision').eq('job_id', jobId).in('candidate_id', candidateIds),
  ]);
  const decision = new Map(((overrides ?? []) as { candidate_id: string; decision: 'show' | 'hide' }[]).map((o) => [o.candidate_id, o.decision]));
  return new Map(((results ?? []) as { candidate_id: string; tier: MatchTier }[]).map((r) => [r.candidate_id, fitOf(r.tier, decision.get(r.candidate_id))]));
}

/**
 * Kandidaten ohne gespeichertes Urteil einmal prüfen lassen (Ergebnis speichert der
 * Server). Höchstens `limit` Kandidaten, je zwei parallel; jedes Ergebnis kommt
 * sofort über `onResult`.
 */
export async function checkPoolFit(
  jobId: string,
  candidateIds: string[],
  onResult: (candidateId: string, fit: Fit | null) => void,
  limit = 20,
): Promise<void> {
  const queue = candidateIds.slice(0, limit);
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const res = await fetchMatchV41(id, { jobIds: [jobId] });
        const item = res.results.find((r) => r.job_id === jobId);
        onResult(id, item ? fitOf(item.tier, item.override?.decision) : null);
      } catch {
        onResult(id, null);
      }
    }
  };
  await Promise.all([worker(), worker()]);
}
