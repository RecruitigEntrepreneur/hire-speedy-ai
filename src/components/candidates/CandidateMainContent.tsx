import { useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Clock, Building2, Tag, LayoutGrid, Briefcase, BarChart3, History } from 'lucide-react';

import { CandidateKeyFactsGrid } from './CandidateKeyFactsGrid';
import { CandidateSkillsCard } from './CandidateSkillsCard';
import { CandidateCvAiSummaryCard } from './CandidateCvAiSummaryCard';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { QuickInterviewSummary } from './QuickInterviewSummary';
import { CandidateInterviewsCard } from './CandidateInterviewsCard';
import { CandidateTasksSection } from './CandidateTasksSection';
import { CandidateJobMatchingV3 } from './CandidateJobMatchingV3';
import { ClientCandidateSummaryCard } from './ClientCandidateSummaryCard';
import { CandidateJobsOverview } from './CandidateJobsOverview';
import { CandidateExperienceTimeline } from './CandidateExperienceTimeline';
import { SimilarCandidates } from './SimilarCandidates';
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
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeTaskId?: string;
  activities: any[];
  activitiesLoading: boolean;
  onAddActivity: () => void;
  onStartInterview: () => void;
}

const TAB_ICONS: Record<string, React.ElementType> = {
  overview: LayoutGrid,
  process: Briefcase,
  matching: BarChart3,
  history: History,
};

export function CandidateMainContent({
  candidate,
  tags,
  activeTab,
  onTabChange,
  activeTaskId,
  activities,
  activitiesLoading,
  onAddActivity,
  onStartInterview,
}: CandidateMainContentProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const map: Record<string, string> = { '1': 'overview', '2': 'process', '3': 'matching', '4': 'history' };
      if (map[e.key]) onTabChange(map[e.key]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTabChange]);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full justify-start h-11 bg-muted/50 rounded-lg p-1">
        <TabsTrigger value="overview" className="gap-1.5 text-sm">
          <LayoutGrid className="h-3.5 w-3.5" />
          Übersicht
        </TabsTrigger>
        <TabsTrigger value="process" className="gap-1.5 text-sm">
          <Briefcase className="h-3.5 w-3.5" />
          Prozess
        </TabsTrigger>
        <TabsTrigger value="matching" className="gap-1.5 text-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Matching
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5 text-sm">
          <History className="h-3.5 w-3.5" />
          Historie
        </TabsTrigger>
      </TabsList>

      {/* Tab 1: Übersicht */}
      <TabsContent value="overview" className="space-y-6 mt-4">
        <QuickInterviewSummary
          candidateId={candidate.id}
          onViewDetails={onStartInterview}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <CandidateSkillsCard skills={candidate.skills} certifications={candidate.certifications} />
            <CandidateCvAiSummaryCard summary={candidate.cv_ai_summary || null} bullets={candidate.cv_ai_bullets} />
          </div>
          <div className="space-y-6">
            <CandidateDocumentsManager candidateId={candidate.id} />
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
          </div>
        </div>
      </TabsContent>

      {/* Tab 2: Prozess */}
      <TabsContent value="process" className="space-y-6 mt-4">
        <CandidateInterviewsCard
          candidateId={candidate.id}
          showAddForm={true}
        />
        <CandidateTasksSection candidateId={candidate.id} activeTaskId={activeTaskId} />
      </TabsContent>

      {/* Tab 3: Matching */}
      <TabsContent value="matching" className="space-y-6 mt-4">
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
        <ClientCandidateSummaryCard candidateId={candidate.id} />
        <CandidateJobsOverview candidateId={candidate.id} />
      </TabsContent>

      {/* Tab 4: Historie */}
      <TabsContent value="history" className="space-y-6 mt-4">
        <SimilarCandidates candidateId={candidate.id} limit={3} />
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
      </TabsContent>
    </Tabs>
  );
}
