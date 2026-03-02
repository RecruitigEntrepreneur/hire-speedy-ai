import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

interface JobStats {
  jobId: string;
  submissionCount: number;
  recruiterCount: number;
  hasMySubmission: boolean;
}

interface KpiData {
  totalPotential: number;
  totalJobs: number;
  urgentJobs: number;
  avgEarningPerJob: number;
  newThisWeek: number;
  revealedCount: number;
}

export function useJobSubmissionStats(jobIds: string[]) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string, JobStats>>({});
  const [kpis, setKpis] = useState<KpiData>({
    totalPotential: 0,
    totalJobs: 0,
    urgentJobs: 0,
    avgEarningPerJob: 0,
    newThisWeek: 0,
    revealedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || jobIds.length === 0) {
      setLoading(false);
      return;
    }
    fetchStats();
  }, [user, jobIds.join(',')]);

  const fetchStats = async () => {
    try {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('job_id, recruiter_id')
        .in('job_id', jobIds);

      if (submissions) {
        const map: Record<string, JobStats> = {};
        jobIds.forEach(id => {
          const jobSubs = submissions.filter(s => s.job_id === id);
          const uniqueRecruiters = new Set(jobSubs.map(s => s.recruiter_id));
          map[id] = {
            jobId: id,
            submissionCount: jobSubs.length,
            recruiterCount: uniqueRecruiters.size,
            hasMySubmission: jobSubs.some(s => s.recruiter_id === user?.id),
          };
        });
        setStats(map);
      }
    } catch (err) {
      console.error('Error fetching job submission stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const computeKpis = (
    jobs: Array<{
      id: string;
      salary_min: number | null;
      salary_max: number | null;
      recruiter_fee_percentage: number;
      hiring_urgency: string | null;
      created_at: string;
    }>,
    revealedIds: Set<string>,
  ) => {
    let totalPotential = 0;
    let earningCount = 0;
    let urgentCount = 0;
    let newCount = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    jobs.forEach(job => {
      const avg = job.salary_min && job.salary_max
        ? (job.salary_min + job.salary_max) / 2
        : job.salary_min || job.salary_max;
      if (avg && job.recruiter_fee_percentage) {
        const earning = Math.round(avg * (job.recruiter_fee_percentage / 100));
        totalPotential += earning;
        earningCount++;
      }
      if (job.hiring_urgency === 'urgent') urgentCount++;
      if (new Date(job.created_at) >= oneWeekAgo) newCount++;
    });

    setKpis({
      totalPotential,
      totalJobs: jobs.length,
      urgentJobs: urgentCount,
      avgEarningPerJob: earningCount > 0 ? Math.round(totalPotential / earningCount) : 0,
      newThisWeek: newCount,
      revealedCount: revealedIds.size,
    });
  };

  return { stats, kpis, computeKpis, loading };
}
