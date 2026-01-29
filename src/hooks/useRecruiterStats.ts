import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

export interface StatusCount {
  status: string;
  stage: string | null;
  count: number;
  potentialEarning: number;
}

export interface RecruiterStats {
  openJobsCount: number;
  candidatesCount: number;
  submissionsCount: number;
  totalEarnings: number;
  interviewInviteRate: number;
  hireToInterviewRate: number;
  qcRejectionRate: number;
  marketFeedbackCount: number;
  statusBreakdown: StatusCount[];
}

const PLATFORM_AVERAGES = {
  interviewInviteRate: 23.5,
  hireToInterviewRate: 11.9,
  qcRejectionRate: 18.2,
};

export function useRecruiterStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RecruiterStats>({
    openJobsCount: 0,
    candidatesCount: 0,
    submissionsCount: 0,
    totalEarnings: 0,
    interviewInviteRate: 0,
    hireToInterviewRate: 0,
    qcRejectionRate: 0,
    marketFeedbackCount: 0,
    statusBreakdown: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAllStats();
    }
  }, [user]);

  const calculatePotentialEarning = (
    salaryMin: number | null,
    salaryMax: number | null,
    feePercentage: number | null
  ): number => {
    if (!feePercentage || (!salaryMin && !salaryMax)) return 0;
    const avgSalary = salaryMin && salaryMax
      ? (salaryMin + salaryMax) / 2
      : salaryMin || salaryMax || 0;
    return Math.round(avgSalary * (feePercentage / 100));
  };

  const fetchAllStats = async () => {
    try {
      setLoading(true);

      // 1. Open Jobs Count (all published jobs)
      const { count: openJobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      // 2. My Candidates Count
      const { count: candidatesCount } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', user?.id);

      // 3. My Submissions Count
      const { count: submissionsCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', user?.id);

      // 4. All submissions with job data for calculations
      const { data: allSubmissions } = await supabase
        .from('submissions')
        .select('id, status, stage, job_id')
        .eq('recruiter_id', user?.id);

      // Get job data separately to avoid deep type instantiation
      const jobIds = [...new Set(allSubmissions?.map(s => s.job_id) || [])];
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, salary_min, salary_max, recruiter_fee_percentage')
        .in('id', jobIds);

      const jobMap: Record<string, { salary_min: number | null; salary_max: number | null; recruiter_fee_percentage: number | null }> = {};
      jobsData?.forEach(j => {
        jobMap[j.id] = j;
      });

      // Calculate status breakdown with earnings
      const statusMap: Record<string, { count: number; potentialEarning: number; stage: string | null }> = {};
      
      allSubmissions?.forEach(submission => {
        const key = submission.stage || submission.status;
        const job = jobMap[submission.job_id];
        const earning = job ? calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage) : 0;
        
        if (!statusMap[key]) {
          statusMap[key] = { count: 0, potentialEarning: 0, stage: submission.stage };
        }
        statusMap[key].count++;
        statusMap[key].potentialEarning += earning;
      });

      const statusBreakdown: StatusCount[] = Object.entries(statusMap).map(([status, data]) => ({
        status,
        stage: data.stage,
        count: data.count,
        potentialEarning: data.potentialEarning,
      }));

      // 5. Calculate Total Earnings (only hired submissions)
      const hiredSubmissions = allSubmissions?.filter(s => s.status === 'hired') || [];
      const totalEarnings = hiredSubmissions.reduce((sum, s) => {
        const job = jobMap[s.job_id];
        return sum + (job ? calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage) : 0);
      }, 0);

      // 6. Calculate Performance Metrics
      const total = allSubmissions?.length || 0;
      
      // Interview stages include: interview, interview_1, interview_2, offer, hired
      const interviewStages = ['interview', 'interview_1', 'interview_2', 'offer', 'hired'];
      const interviewedCount = allSubmissions?.filter(s => 
        interviewStages.includes(s.stage || '') || interviewStages.includes(s.status)
      ).length || 0;

      const hiredCount = allSubmissions?.filter(s => s.status === 'hired').length || 0;

      // QC Rejected (status = rejected AND stage was in early stages)
      const qcRejectedCount = allSubmissions?.filter(s => 
        s.status === 'rejected' && ['submitted', 'in_review', 'qc_review'].includes(s.stage || '')
      ).length || 0;

      const interviewInviteRate = total > 0 ? (interviewedCount / total) * 100 : 0;
      const hireToInterviewRate = interviewedCount > 0 ? (hiredCount / interviewedCount) * 100 : 0;
      const qcRejectionRate = total > 0 ? (qcRejectedCount / total) * 100 : 0;

      // 7. Market Feedback Count (placeholder - would need a feedback table)
      const marketFeedbackCount = 0;

      setStats({
        openJobsCount: openJobsCount || 0,
        candidatesCount: candidatesCount || 0,
        submissionsCount: submissionsCount || 0,
        totalEarnings,
        interviewInviteRate,
        hireToInterviewRate,
        qcRejectionRate,
        marketFeedbackCount,
        statusBreakdown,
      });
    } catch (error) {
      console.error('Error fetching recruiter stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    loading,
    platformAverages: PLATFORM_AVERAGES,
    refetch: fetchAllStats,
  };
}
