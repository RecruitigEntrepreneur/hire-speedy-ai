import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { fetchRecruiterPlacements } from '@/lib/placementViews';
import { computeRecruiterAnalytics, type AnaInterview, type AnaJob, type AnaPeriod, type AnaPlacement, type AnaSubmission } from '@/lib/recruiterAnalytics';

/** Rohdaten der Auswertung: eigene Vorstellungen, Einladungen, Einstellungen. Stellen nur über recruiter_jobs_view. */
function useRecruiterAnalyticsData() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recruiter-analytics', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from('submissions')
        .select('id, job_id, status, stage, submitted_at, rejection_reason')
        .eq('recruiter_id', user!.id);
      if (error) throw error;
      const submissions = (subs ?? []) as AnaSubmission[];
      const ids = submissions.map((s) => s.id);
      const jobIds = [...new Set(submissions.map((s) => s.job_id).filter(Boolean))];
      const [{ data: ivs }, placementRows, { data: jobRows }] = await Promise.all([
        ids.length ? supabase.from('interviews').select('submission_id, created_at').in('submission_id', ids) : Promise.resolve({ data: [] }),
        fetchRecruiterPlacements(ids),
        jobIds.length ? supabase.from('recruiter_jobs_view').select('id, title, industry, location').in('id', jobIds) : Promise.resolve({ data: [] }),
      ]);
      const placements: AnaPlacement[] = placementRows.map((p) => ({
        submission_id: p.submission_id,
        created_at: p.created_at,
        feeCents: Math.round((p.recruiter_payout ?? 0) * 100),
      }));
      return { submissions, interviews: (ivs ?? []) as AnaInterview[], placements, jobs: (jobRows ?? []) as AnaJob[] };
    },
  });
}

export function useRecruiterAnalytics(period: AnaPeriod) {
  const { data, isLoading, isError } = useRecruiterAnalyticsData();
  const analytics = useMemo(() => (data ? computeRecruiterAnalytics(data, period) : null), [data, period]);
  return { analytics, isLoading, isError };
}
