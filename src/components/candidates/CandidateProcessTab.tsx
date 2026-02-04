import { CandidateTasksSection } from './CandidateTasksSection';
import { CandidateJobMatchingV3 } from './CandidateJobMatchingV3';
import { ClientCandidateSummaryCard } from './ClientCandidateSummaryCard';
import { CandidateJobsOverview } from './CandidateJobsOverview';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { Button } from '@/components/ui/button';
import { Plus, Clock } from 'lucide-react';

interface CandidateProcessTabProps {
  candidate: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
    job_title?: string | null;
    skills: string[] | null;
    experience_years: number | null;
    expected_salary: number | null;
    salary_expectation_min: number | null;
    salary_expectation_max: number | null;
    city: string | null;
    seniority: string | null;
    target_roles: string[] | null;
    max_commute_minutes: number | null;
    commute_mode: string | null;
    address_lat: number | null;
    address_lng: number | null;
    availability_date?: string | null;
    notice_period?: string | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown[] | null;
  };
  activeTaskId?: string;
  activities: any[];
  activitiesLoading: boolean;
  onAddActivity: () => void;
}

export function CandidateProcessTab({ 
  candidate, 
  activeTaskId,
  activities,
  activitiesLoading,
  onAddActivity
}: CandidateProcessTabProps) {
  return (
    <div className="space-y-6">
      {/* Tasks Section - Prominent at top */}
      <CandidateTasksSection candidateId={candidate.id} activeTaskId={activeTaskId} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left Column - Matching & Submissions */}
        <div className="space-y-6 min-w-0">
          {/* Job Matching */}
          <CandidateJobMatchingV3 
            candidate={{
              id: candidate.id,
              full_name: candidate.full_name,
              skills: candidate.skills,
              experience_years: candidate.experience_years,
              expected_salary: candidate.expected_salary,
              salary_expectation_min: candidate.salary_expectation_min,
              salary_expectation_max: candidate.salary_expectation_max,
              city: candidate.city,
              seniority: candidate.seniority,
              target_roles: candidate.target_roles,
              job_title: candidate.job_title || null,
              max_commute_minutes: candidate.max_commute_minutes,
              commute_mode: candidate.commute_mode,
              address_lat: candidate.address_lat,
              address_lng: candidate.address_lng,
              email: candidate.email,
              phone: candidate.phone || undefined,
              availability_date: candidate.availability_date,
              notice_period: candidate.notice_period,
              cv_ai_summary: candidate.cv_ai_summary,
              cv_ai_bullets: candidate.cv_ai_bullets,
            }}
          />

          {/* Active Submissions */}
          <CandidateJobsOverview candidateId={candidate.id} />
        </div>

        {/* Right Column - AI Assessment & Timeline */}
        <div className="space-y-6 min-w-0">
          {/* AI Assessment - Optimal placement next to matching */}
          <ClientCandidateSummaryCard candidateId={candidate.id} />

          {/* Activity Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Letzte Aktivitäten
              </h3>
              <Button variant="ghost" size="sm" onClick={onAddActivity}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <CandidateActivityTimeline
              activities={activities.slice(0, 5)}
              loading={activitiesLoading}
            />
            {activities.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                +{activities.length - 5} weitere Aktivitäten
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
