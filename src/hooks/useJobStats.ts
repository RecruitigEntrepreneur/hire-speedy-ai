import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface JobStats {
  id: string;
  title: string;
  companyName: string;
  status: string;
  createdAt: string;
  /** Recruiter mit mindestens einer NICHT abgelehnten Einreichung. */
  activeRecruiters: number;
  /** Zeitpunkt der juengsten Einreichung — null, wenn es keine gibt. */
  lastSubmittedAt: string | null;
  totalCandidates: number;
  newCandidates: number;
  shortlisted: number;
  interviews: number;
  offers: number;
  placed: number;
}

export function useJobStats(limit: number = 5) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobStats = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch jobs with aggregated stats
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, company_name, status, created_at')
        .eq('client_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!jobsData) {
        setJobs([]);
        return;
      }

      const jobStats: JobStats[] = await Promise.all(
        jobsData.map(async (job) => {
          // Get submissions for this job
          const { data: submissions } = await supabase
            .from('submissions')
            .select('id, status, recruiter_id, submitted_at')
            .eq('job_id', job.id);

          const submissionsList = submissions || [];

          // "Aktiv" heisst: mindestens eine Einreichung, die nicht abgelehnt ist.
          // Vorher zaehlte hier jede Einreichung mit, auch eine vor Monaten
          // abgelehnte — die Kachel meldete dann Arbeit, die niemand tut.
          const uniqueRecruiters = new Set(
            submissionsList.filter(s => s.status !== 'rejected').map(s => s.recruiter_id)
          );

          const lastSubmittedAt = submissionsList
            .map(s => s.submitted_at)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null;

          // Count by status
          const statusCounts = submissionsList.reduce((acc, sub) => {
            acc[sub.status] = (acc[sub.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return {
            id: job.id,
            title: job.title,
            companyName: job.company_name || '',
            status: job.status,
            createdAt: job.created_at,
            activeRecruiters: uniqueRecruiters.size,
            lastSubmittedAt,
            totalCandidates: submissionsList.length,
            newCandidates: statusCounts['submitted'] || 0,
            shortlisted: statusCounts['accepted'] || 0,
            interviews: statusCounts['interview'] || 0,
            offers: statusCounts['offer'] || 0,
            placed: statusCounts['hired'] || 0,
          };
        })
      );

      setJobs(jobStats);
    } catch (error) {
      console.error('Error fetching job stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => {
    fetchJobStats();
  }, [fetchJobStats]);

  return { jobs, loading, refetch: fetchJobStats };
}
