import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Clock, Building2, Tag } from 'lucide-react';

import { CandidateHeroMatching } from './CandidateHeroMatching';
import { CandidateSkillsCard } from './CandidateSkillsCard';
import { CandidateCvAiSummaryCard } from './CandidateCvAiSummaryCard';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { QuickInterviewSummary } from './QuickInterviewSummary';
import { CandidateExperienceTimeline } from './CandidateExperienceTimeline';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { CandidateTag } from '@/hooks/useCandidateTags';

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
  tags: CandidateTag[];
  activities: any[];
  activitiesLoading: boolean;
  onAddActivity: () => void;
  onStartInterview: () => void;
}

export function CandidateMainContent({
  candidate,
  tags,
  activities,
  activitiesLoading,
  onAddActivity,
  onStartInterview,
}: CandidateMainContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <CandidateHeroMatching candidateId={candidate.id} onNavigateToMatching={() => {}} />
        <CandidateSkillsCard skills={candidate.skills} certifications={candidate.certifications} />
        <CandidateCvAiSummaryCard summary={candidate.cv_ai_summary || null} bullets={candidate.cv_ai_bullets} />
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
      <div className="space-y-6">
        <QuickInterviewSummary
          candidateId={candidate.id}
          onViewDetails={onStartInterview}
        />
        {tags.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <Badge key={tag.id} variant="secondary" className="text-xs" style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' } : undefined}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
        <CandidateDocumentsManager candidateId={candidate.id} />
      </div>
    </div>
  );
}
