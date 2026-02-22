import { CandidateKeyFactsGrid } from './CandidateKeyFactsGrid';
import { QuickInterviewSummary } from './QuickInterviewSummary';
import { CandidateInterviewsCard } from './CandidateInterviewsCard';
import { CandidateTasksSection } from './CandidateTasksSection';
import { CandidateJobMatchingV3 } from './CandidateJobMatchingV3';
import { ClientCandidateSummaryCard } from './ClientCandidateSummaryCard';
import { CandidateJobsOverview } from './CandidateJobsOverview';
import { CandidateExperienceTimeline } from './CandidateExperienceTimeline';
import { SimilarCandidates } from './SimilarCandidates';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Clock, Building2 } from 'lucide-react';

interface CandidateMainContentProps {
  candidate: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string | null;
    job_title?: string | null;
    seniority?: string | null;
    experience_years?: number | null;
    city?: string | null;
    expected_salary?: number | null;
    salary_expectation_min?: number | null;
    salary_expectation_max?: number | null;
    current_salary?: number | null;
    notice_period?: string | null;
    availability_date?: string | null;
    remote_possible?: boolean | null;
    remote_preference?: string | null;
    skills?: string[] | null;
    certifications?: string[] | null;
    target_roles?: string[] | null;
    max_commute_minutes?: number | null;
    commute_mode?: string | null;
    address_lat?: number | null;
    address_lng?: number | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown | null;
  };
  activeTaskId?: string;
  activities: any[];
  activitiesLoading: boolean;
  onAddActivity: () => void;
  onStartInterview: () => void;
}

export function CandidateMainContent({
  candidate,
  activeTaskId,
  activities,
  activitiesLoading,
  onAddActivity,
  onStartInterview,
}: CandidateMainContentProps) {
  return (
    <div className="flex-1 min-w-0 space-y-6">
      {/* 1. Key Facts Grid */}
      <CandidateKeyFactsGrid candidate={candidate} />

      {/* 2. Interview-Erkenntnisse */}
      <QuickInterviewSummary
        candidateId={candidate.id}
        onViewDetails={onStartInterview}
      />

      {/* 3. Interviews */}
      <CandidateInterviewsCard
        candidateId={candidate.id}
        showAddForm={true}
      />

      {/* 4. Open Tasks */}
      <CandidateTasksSection candidateId={candidate.id} activeTaskId={activeTaskId} />

      {/* 5. Job Matching */}
      <div id="job-matching-section">
        <CandidateJobMatchingV3
          candidate={{
            id: candidate.id,
            full_name: candidate.full_name,
            skills: candidate.skills || null,
            experience_years: candidate.experience_years || null,
            expected_salary: candidate.expected_salary || null,
            salary_expectation_min: candidate.salary_expectation_min || null,
            salary_expectation_max: candidate.salary_expectation_max || null,
            city: candidate.city || null,
            seniority: candidate.seniority || null,
            target_roles: candidate.target_roles || null,
            job_title: candidate.job_title || null,
            max_commute_minutes: candidate.max_commute_minutes || null,
            commute_mode: candidate.commute_mode || null,
            address_lat: candidate.address_lat || null,
            address_lng: candidate.address_lng || null,
            email: candidate.email,
            phone: candidate.phone || undefined,
            availability_date: candidate.availability_date,
            notice_period: candidate.notice_period,
            cv_ai_summary: candidate.cv_ai_summary,
            cv_ai_bullets: candidate.cv_ai_bullets as unknown[] | null,
          }}
        />
      </div>

      {/* 6. AI Assessment */}
      <ClientCandidateSummaryCard candidateId={candidate.id} />

      {/* 7. Active Submissions */}
      <CandidateJobsOverview candidateId={candidate.id} />

      {/* 8. Career Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Karriere-Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CandidateExperienceTimeline candidateId={candidate.id} />
        </CardContent>
      </Card>

      {/* 9. Similar Candidates */}
      <SimilarCandidates candidateId={candidate.id} limit={3} />

      {/* 10. Activity Timeline */}
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
          activities={activities.slice(0, 10)}
          loading={activitiesLoading}
        />
        {activities.length > 10 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            +{activities.length - 10} weitere Aktivitäten
          </p>
        )}
      </div>
    </div>
  );
}
