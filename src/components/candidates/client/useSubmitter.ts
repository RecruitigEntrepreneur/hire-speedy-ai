import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { avatarUrl, getJobSearchers, TIER_LABEL } from '@/lib/jobSearch';

export interface Submitter {
  recruiterId: string;
  /** Name aus der Suchenden-Liste der Stelle; null bei alten Einreichungen ohne „Ich suche“. */
  name: string | null;
  company: string | null;
  tierLabel: string | null;
  /** Wie viele Kandidaten er für diese Stelle eingereicht hat. */
  candidates: number | null;
  photo: string | null;
}

/** Name, der überall angezeigt wird: der Headhunter oder neutral „Ihr Headhunter“. */
export const submitterName = (s: Submitter | null | undefined) => s?.name?.trim() || 'Ihr Headhunter';

/**
 * Wer hat diesen Kandidaten eingereicht? Der Kunde liest submissions.recruiter_id
 * und findet den Headhunter in der Suchenden-Liste seiner Stelle (get_job_searchers,
 * dieselbe Quelle wie „Suchen gerade für Sie“). Profile selbst darf der Kunde nicht lesen.
 */
export function useSubmitter(submissionId: string | undefined, jobId: string | undefined) {
  return useQuery<Submitter | null>({
    queryKey: ['submitter', submissionId, jobId],
    enabled: !!submissionId && !!jobId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: sub } = await supabase.from('submissions').select('recruiter_id').eq('id', submissionId!).maybeSingle();
      const recruiterId = (sub as { recruiter_id?: string } | null)?.recruiter_id;
      if (!recruiterId) return null;
      const searchers = await getJobSearchers(jobId!).catch(() => null);
      const s = (searchers ?? []).find((x) => x.recruiter_id === recruiterId) ?? null;
      return {
        recruiterId,
        name: s?.full_name ?? null,
        company: s?.company_name ?? null,
        tierLabel: s?.tier ? TIER_LABEL[s.tier] : null,
        candidates: s?.candidates ?? null,
        photo: s?.avatar_path ? await avatarUrl(s.avatar_path).catch(() => null) : null,
      };
    },
  });
}

/** Mehrere Stellen auf einmal (Bewerberliste): recruiter_id → Name je Einreichung. */
export function useSubmitterNames(rows: { submissionId: string; jobId: string }[]) {
  const ids = rows.map((r) => r.submissionId).sort();
  return useQuery<Record<string, string>>({
    queryKey: ['submitter-names', ids.join(',')],
    enabled: rows.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: subs } = await supabase.from('submissions').select('id, recruiter_id, job_id').in('id', ids);
      const jobIds = [...new Set(((subs ?? []) as { job_id: string }[]).map((s) => s.job_id))];
      const lists = await Promise.all(jobIds.map((j) => getJobSearchers(j).catch(() => null)));
      const names = new Map<string, string>();
      for (const list of lists) for (const s of list ?? []) if (s.full_name) names.set(s.recruiter_id, s.full_name);
      const out: Record<string, string> = {};
      for (const s of (subs ?? []) as { id: string; recruiter_id: string }[]) {
        const n = names.get(s.recruiter_id);
        if (n) out[s.id] = n;
      }
      return out;
    },
  });
}
