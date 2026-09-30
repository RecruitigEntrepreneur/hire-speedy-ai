import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { fetchMatchV41, MatchV41Unavailable, type MatchV41Item, type MatchV41Response } from '@/lib/matchV41';

export interface MatchJobInfo {
  id: string;
  title: string;
  location: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
}

export interface MatchV41Row extends MatchV41Item {
  job: MatchJobInfo | null;
  submittedAt: string | null;
}

const MAX_FOLLOW_UPS = 6;

type DbResult = PromiseLike<{ error: { message: string } | null }>;
interface Filterable extends DbResult { eq: (column: string, value: string) => Filterable }
interface OverrideTable {
  upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => DbResult;
  delete: () => Filterable;
}

/**
 * Passende Stellen für einen Kandidaten (Match V4.1). Liefert je Stelle Stufe,
 * Belege und Klärfragen, dazu Titel/Ort aus recruiter_jobs_view (ohne Firmennamen)
 * und ob der Kandidat dort schon eingereicht ist.
 *
 * Große Pools rechnet der Server in Etappen (`pending`); der Hook fragt dann
 * selbst nach, höchstens MAX_FOLLOW_UPS-mal.
 */
export function useMatchV41(candidateId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const followUps = useRef(0);

  const match = useQuery<MatchV41Response, Error>({
    queryKey: ['match-v41', candidateId],
    queryFn: () => fetchMatchV41(candidateId!),
    enabled: !!candidateId && !!user,
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof MatchV41Unavailable) && count < 1,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const pending = q.state.data?.pending.length ?? 0;
      if (pending > 0 && followUps.current < MAX_FOLLOW_UPS) {
        followUps.current += 1;
        return 3_000;
      }
      return false;
    },
  });

  const jobIds = useMemo(() => (match.data?.results ?? []).map((r) => r.job_id), [match.data]);

  const jobs = useQuery({
    queryKey: ['match-v41-jobs', jobIds],
    enabled: jobIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('recruiter_jobs_view')
        .select('id, title, location, remote_type, salary_min, salary_max')
        .in('id', jobIds);
      return new Map(((data ?? []) as MatchJobInfo[]).map((j) => [j.id, j]));
    },
  });

  const submissions = useQuery({
    queryKey: ['match-v41-submissions', candidateId, user?.id],
    enabled: !!candidateId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('submissions')
        .select('job_id, submitted_at')
        .eq('candidate_id', candidateId!)
        .eq('recruiter_id', user!.id);
      return new Map(((data ?? []) as { job_id: string | null; submitted_at: string | null }[])
        .filter((s) => s.job_id)
        .map((s) => [s.job_id as string, s.submitted_at]));
    },
  });

  const rows: MatchV41Row[] = useMemo(() => (match.data?.results ?? [])
    // Stellen, die der Headhunter nicht (mehr) sehen darf, fallen raus.
    .filter((r) => !jobs.data || jobs.data.has(r.job_id))
    .map((r) => ({
      ...r,
      job: jobs.data?.get(r.job_id) ?? null,
      submittedAt: submissions.data?.get(r.job_id) ?? null,
    })), [match.data, jobs.data, submissions.data]);

  const override = useMutation({
    mutationFn: async (v: { jobId: string; decision: 'show' | 'hide' | null; reason?: string }) => {
      // Tabelle ist neu und noch nicht in den generierten Typen.
      const table = supabase.from('match_v41_overrides' as never) as unknown as OverrideTable;
      if (v.decision === null) {
        const { error } = await table.delete().eq('candidate_id', candidateId!).eq('job_id', v.jobId).eq('recruiter_id', user!.id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await table.upsert(
        { candidate_id: candidateId, job_id: v.jobId, recruiter_id: user!.id, decision: v.decision, reason: v.reason?.slice(0, 500) || null },
        { onConflict: 'candidate_id,job_id,recruiter_id' },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match-v41', candidateId] }),
  });

  const recompute = async () => {
    followUps.current = 0;
    const data = await fetchMatchV41(candidateId!, { force: true });
    queryClient.setQueryData(['match-v41', candidateId], data);
  };

  return {
    rows,
    loading: match.isLoading || (jobIds.length > 0 && jobs.isLoading),
    unavailable: match.error instanceof MatchV41Unavailable,
    error: match.error && !(match.error instanceof MatchV41Unavailable) ? match.error.message : null,
    pending: match.data?.pending.length ?? 0,
    stats: match.data?.stats ?? null,
    override,
    recompute,
    refetchSubmissions: submissions.refetch,
  };
}
