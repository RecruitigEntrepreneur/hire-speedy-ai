import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { anonymizeCompanyName, anonymizeRegionBroad } from '@/lib/anonymization';

export type BewerberSortOption = 'match_score' | 'waiting_time' | 'newest';

export interface CareerEntry {
  jobTitle: string;
  companyAnonymized: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  durationYears: number | null;
}

export interface BewerberItem {
  submissionId: string;
  candidateId: string;
  anonymizedName: string;
  jobId: string;
  jobTitle: string;
  matchScore: number | null;
  stage: string;
  status: string;
  submittedAt: string;
  recruiterNotes: string | null;
  currentRole: string | null;
  experienceYears: number | null;
  city: string | null;
  region: string;
  skills: string[] | null;
  salaryMin: number | null;
  salaryMax: number | null;
  remotePreference: string | null;
  availabilityDate: string | null;
  noticePeriod: string | null;
  seniority: string | null;
  aiSummary: string | null;
  hoursWaiting: number;
  urgency: 'critical' | 'warning' | 'normal';
  career: CareerEntry[];
}

export interface BewerberFilters {
  stage: string | null;
  jobId: string | null;
  search: string;
  sort: BewerberSortOption;
}

interface JobOption {
  id: string;
  title: string;
}

function computeHoursWaiting(submittedAt: string): number {
  const diff = Date.now() - new Date(submittedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}

function computeUrgency(hours: number): 'critical' | 'warning' | 'normal' {
  if (hours >= 48) return 'critical';
  if (hours >= 24) return 'warning';
  return 'normal';
}

export function useBewerber(filters: BewerberFilters) {
  const { user } = useAuth();

  const submissionsQuery = useQuery({
    queryKey: ['bewerber', user?.id, filters.stage, filters.jobId, filters.sort],
    queryFn: async () => {
      let query = supabase
        .from('submissions')
        .select(`
          id, status, stage, match_score, submitted_at, recruiter_notes,
          candidates!inner (
            id, job_title, experience_years, city, skills,
            salary_expectation_min, salary_expectation_max,
            remote_preference, availability_date, notice_period,
            seniority, cv_ai_summary,
            candidate_experiences (
              job_title, company_name, start_date, end_date, is_current, location, sort_order
            )
          ),
          jobs!inner (id, title, client_id)
        `)
        .eq('jobs.client_id', user!.id)
        .not('status', 'eq', 'rejected')
        .not('status', 'eq', 'hired');

      if (filters.stage) {
        query = query.eq('stage', filters.stage);
      }

      if (filters.jobId) {
        query = query.eq('job_id', filters.jobId);
      }

      if (filters.sort === 'match_score') {
        query = query.order('match_score', { ascending: false, nullsFirst: false });
      } else {
        query = query.order('submitted_at', { ascending: false });
      }

      query = query.limit(50);

      const { data, error } = await query;
      if (error) throw error;

      const items: BewerberItem[] = (data || []).map((row: any) => {
        const candidate = row.candidates;
        const job = row.jobs;
        const hours = computeHoursWaiting(row.submitted_at);

        // Map and anonymize career entries
        const rawExperiences = candidate.candidate_experiences || [];
        const career: CareerEntry[] = rawExperiences
          .sort((a: any, b: any) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
          .slice(0, 5)
          .map((exp: any) => {
            const start = exp.start_date ? new Date(exp.start_date) : null;
            const end = exp.end_date ? new Date(exp.end_date) : null;
            let durationYears: number | null = null;
            if (start) {
              const endDate = end || new Date();
              durationYears = Math.round((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
              if (durationYears < 1) durationYears = 1;
            }
            return {
              jobTitle: exp.job_title,
              companyAnonymized: anonymizeCompanyName(null),
              startDate: exp.start_date,
              endDate: exp.end_date,
              isCurrent: exp.is_current || false,
              durationYears,
            };
          });

        return {
          submissionId: row.id,
          candidateId: candidate.id,
          anonymizedName: `PR-${candidate.id.slice(0, 6).toUpperCase()}`,
          jobId: job.id,
          jobTitle: job.title,
          matchScore: row.match_score,
          stage: row.stage || row.status || 'submitted',
          status: row.status || 'submitted',
          submittedAt: row.submitted_at,
          recruiterNotes: row.recruiter_notes,
          currentRole: candidate.job_title,
          experienceYears: candidate.experience_years,
          city: candidate.city,
          region: anonymizeRegionBroad(candidate.city),
          skills: candidate.skills,
          salaryMin: candidate.salary_expectation_min,
          salaryMax: candidate.salary_expectation_max,
          remotePreference: candidate.remote_preference,
          availabilityDate: candidate.availability_date,
          noticePeriod: candidate.notice_period,
          seniority: candidate.seniority,
          aiSummary: candidate.cv_ai_summary,
          hoursWaiting: hours,
          urgency: computeUrgency(hours),
          career,
        };
      });

      // Client-side sort for waiting_time (computed field)
      if (filters.sort === 'waiting_time') {
        items.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
      }

      return items;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const jobsQuery = useQuery({
    queryKey: ['bewerber-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('client_id', user!.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as JobOption[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Client-side search filtering
  const filteredItems = (submissionsQuery.data || []).filter((item) => {
    if (!filters.search) return true;
    const s = filters.search.toLowerCase();
    return (
      item.anonymizedName.toLowerCase().includes(s) ||
      (item.currentRole || '').toLowerCase().includes(s) ||
      item.jobTitle.toLowerCase().includes(s) ||
      (item.city || '').toLowerCase().includes(s) ||
      (item.skills || []).some((skill) => skill.toLowerCase().includes(s))
    );
  });

  // Compute stage counts from unfiltered data
  const allItems = submissionsQuery.data || [];
  const stageCounts: Record<string, number> = {};
  for (const item of allItems) {
    const stage = item.stage;
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }

  return {
    items: filteredItems,
    allItems,
    stageCounts,
    totalCount: allItems.length,
    jobs: jobsQuery.data || [],
    isLoading: submissionsQuery.isLoading,
    error: submissionsQuery.error,
    refetch: submissionsQuery.refetch,
  };
}
