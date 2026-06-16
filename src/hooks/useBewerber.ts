import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

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
  experienceYears: number | null; // gated: nur nach Opt-In, sonst null
  experienceBand: string;        // immer sichtbar (z.B. "6-10 Jahre")
  city: string | null;           // gated: nur nach Opt-In, sonst null
  region: string;                // immer sichtbar (grobe Region)
  skills: string[] | null;
  salaryBand: string;            // immer sichtbar (z.B. "€60k - €70k")
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
      // Triple-Blind: read EXCLUSIVELY from the reveal-gated view. Identity,
      // exact city/experience and the AI bio are gated server-side; only
      // anonymized bands are returned until the candidate has opted in.
      let query = supabase
        .from('client_candidate_view')
        .select(`
          submission_id, candidate_id, job_id, job_title, status, stage,
          match_score, recruiter_notes, submitted_at,
          candidate_role, seniority, skills, remote_preference,
          availability_date, notice_period,
          region_broad, experience_band, salary_band,
          city, experience_years, cv_ai_summary, identity_unlocked
        `)
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

      const rows = (data || []) as any[];

      // Werdegang aus der gated Experiences-View (Arbeitgeber bis Opt-In maskiert)
      const submissionIds = rows.map((r) => r.submission_id);
      const careerBySubmission = new Map<string, CareerEntry[]>();
      if (submissionIds.length > 0) {
        const { data: expData } = await supabase
          .from('client_candidate_experiences_view')
          .select('submission_id, job_title, company_name, start_date, end_date, is_current, sort_order')
          .in('submission_id', submissionIds);

        for (const exp of (expData || []) as any[]) {
          const start = exp.start_date ? new Date(exp.start_date) : null;
          const end = exp.end_date ? new Date(exp.end_date) : null;
          let durationYears: number | null = null;
          if (start) {
            const endDate = end || new Date();
            durationYears = Math.round((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
            if (durationYears < 1) durationYears = 1;
          }
          const entry: CareerEntry = {
            jobTitle: exp.job_title,
            companyAnonymized: exp.company_name || 'Unternehmen', // null bis Opt-In
            startDate: exp.start_date,
            endDate: exp.end_date,
            isCurrent: exp.is_current || false,
            durationYears,
          };
          const list = careerBySubmission.get(exp.submission_id) || [];
          list.push(entry);
          careerBySubmission.set(exp.submission_id, list);
        }
      }

      const items: BewerberItem[] = rows.map((row) => {
        const hours = computeHoursWaiting(row.submitted_at);
        const career = (careerBySubmission.get(row.submission_id) || [])
          .sort((a, b) => 0) // already ordered by view; keep stable
          .slice(0, 5);

        return {
          submissionId: row.submission_id,
          candidateId: row.candidate_id,
          anonymizedName: `PR-${String(row.candidate_id).slice(0, 6).toUpperCase()}`,
          jobId: row.job_id,
          jobTitle: row.job_title,
          matchScore: row.match_score,
          stage: row.stage || row.status || 'submitted',
          status: row.status || 'submitted',
          submittedAt: row.submitted_at,
          recruiterNotes: row.recruiter_notes,
          currentRole: row.candidate_role,
          experienceYears: row.experience_years ?? null, // gated
          experienceBand: row.experience_band || 'Nicht angegeben',
          city: row.city ?? null, // gated
          region: row.region_broad || 'DACH',
          skills: row.skills,
          salaryBand: row.salary_band || 'Nicht freigegeben',
          remotePreference: row.remote_preference,
          availabilityDate: row.availability_date,
          noticePeriod: row.notice_period,
          seniority: row.seniority,
          aiSummary: row.cv_ai_summary, // serverseitig gescrubbt bis Opt-In
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
