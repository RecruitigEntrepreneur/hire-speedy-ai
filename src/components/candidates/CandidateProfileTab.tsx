import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CandidateKeyFactsGrid } from './CandidateKeyFactsGrid';
import { CandidateSkillsCard } from './CandidateSkillsCard';
import { CandidateCvAiSummaryCard } from './CandidateCvAiSummaryCard';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { QuickInterviewSummary } from './QuickInterviewSummary';
import { SimilarCandidates } from './SimilarCandidates';
import { CandidateExperienceTimeline } from './CandidateExperienceTimeline';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { Building2 } from 'lucide-react';

interface CandidateProfileTabProps {
  candidate: {
    id: string;
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
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown | null;
  };
  tags: CandidateTag[];
  onViewFullInterview: () => void;
}

export function CandidateProfileTab({ candidate, tags, onViewFullInterview }: CandidateProfileTabProps) {
  return (
    <div className="space-y-6">
      {/* Key Facts Grid - Full Width */}
      <CandidateKeyFactsGrid candidate={candidate} />
      
      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Skills Card */}
          <CandidateSkillsCard 
            skills={candidate.skills} 
            certifications={candidate.certifications} 
          />
          
          {/* AI Summary from CV */}
          <CandidateCvAiSummaryCard 
            summary={candidate.cv_ai_summary || null} 
            bullets={candidate.cv_ai_bullets} 
          />
          
          {/* Documents (compact) */}
          <CandidateDocumentsManager candidateId={candidate.id} />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* Career Timeline */}
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
          
          {/* Interview Insights */}
          <QuickInterviewSummary 
            candidateId={candidate.id}
            onViewDetails={onViewFullInterview}
          />
          
          {/* Similar Candidates */}
          <SimilarCandidates candidateId={candidate.id} limit={3} />
        </div>
      </div>
    </div>
  );
}
