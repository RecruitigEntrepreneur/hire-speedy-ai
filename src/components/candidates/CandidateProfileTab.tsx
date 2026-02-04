import { CandidateKeyFactsCard } from './CandidateKeyFactsCard';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { QuickInterviewSummary } from './QuickInterviewSummary';
import { SimilarCandidates } from './SimilarCandidates';
import { CandidateTag } from '@/hooks/useCandidateTags';

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
  };
  tags: CandidateTag[];
  onViewFullInterview: () => void;
}

export function CandidateProfileTab({ candidate, tags, onViewFullInterview }: CandidateProfileTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Key Facts - All candidate data at a glance */}
        <CandidateKeyFactsCard candidate={candidate} tags={tags} />
        
        {/* Interview Summary */}
        <QuickInterviewSummary 
          candidateId={candidate.id}
          onViewDetails={onViewFullInterview}
        />
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Documents */}
        <CandidateDocumentsManager candidateId={candidate.id} />
        
        {/* Similar Candidates */}
        <SimilarCandidates candidateId={candidate.id} limit={5} />
      </div>
    </div>
  );
}
