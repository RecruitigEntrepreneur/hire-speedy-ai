import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { fetchDossier } from '@/hooks/useCandidateDossier';
import { fetchMatchV41, type MatchV41Item } from '@/lib/matchV41';
import { fitOf, isFitting, type Fit } from '@/lib/matchFit';

export interface CandidateForJob {
  loading: boolean;
  candidate: { id: string; full_name: string; firstName: string } | null;
  item: MatchV41Item | null;
  fit: Fit | null;
  /** Matching nicht erreichbar: dann entscheidet nur Bereitschaft + Doppelung */
  matchDown: boolean;
  readiness: { isReady: boolean; done: number; total: number } | null;
  submittedAt: string | null;
  /** Kandidat passt, ist bereit und noch nicht eingereicht: Stelle wird für ihn geöffnet */
  usable: boolean;
}

const EMPTY: CandidateForJob = { loading: false, candidate: null, item: null, fit: null, matchDown: false, readiness: null, submittedAt: null, usable: false };

/**
 * Stellenseite mit Kandidat (?fuer=<id>, aus „Ansehen“ in der Stellenwahl, 15.10.2026):
 * Passung, Bereitschaft und ob der Kandidat hier schon eingereicht ist.
 */
export function useCandidateForJob(candidateId: string | null, jobId: string | undefined, revision = 0): CandidateForJob {
  const { user } = useAuth();
  const [state, setState] = useState<CandidateForJob>(EMPTY);

  useEffect(() => {
    if (!candidateId || !jobId || !user) { setState(EMPTY); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const [{ data: cand }, { data: sub }, dossier, match] = await Promise.all([
        supabase.from('candidates').select('id, full_name').eq('id', candidateId).eq('recruiter_id', user.id).maybeSingle(),
        supabase.from('submissions').select('submitted_at').eq('candidate_id', candidateId).eq('job_id', jobId).eq('recruiter_id', user.id).limit(1).maybeSingle(),
        fetchDossier(candidateId).catch(() => null),
        fetchMatchV41(candidateId, { jobIds: [jobId] }).then((r) => r.results.find((x) => x.job_id === jobId) ?? null).catch(() => undefined),
      ]);
      if (!alive) return;
      if (!cand) { setState(EMPTY); return; }
      const item = match ?? null;
      const fit = item ? fitOf(item.tier, item.override?.decision) : null;
      const matchDown = match === undefined;
      const r = dossier?.readiness;
      const readiness = r ? { isReady: r.isReady, done: r.done, total: r.total } : null;
      const submittedAt = (sub as { submitted_at?: string } | null)?.submitted_at ?? null;
      setState({
        loading: false,
        candidate: { id: cand.id, full_name: cand.full_name, firstName: cand.full_name.trim().split(/\s+/)[0] || cand.full_name },
        item,
        fit,
        matchDown,
        readiness,
        submittedAt,
        usable: (matchDown || isFitting(fit)) && !!readiness?.isReady && !submittedAt,
      });
    })();
    return () => { alive = false; };
  }, [candidateId, jobId, user, revision]);

  return state;
}
