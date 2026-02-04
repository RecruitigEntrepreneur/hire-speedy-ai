import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import { useCvParsing } from '@/hooks/useCvParsing';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { parseCV, extractTextFromPdf, saveParsedCandidate, parsing, extractingPdf } = useCvParsing();
  const [isReparsing, setIsReparsing] = useState(false);

  const handleReparse = async () => {
    if (!user) {
      toast.error('Bitte einloggen');
      return;
    }

    setIsReparsing(true);
    try {
      // Get current CV document
      const { data: docs, error: docError } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_id', candidate.id)
        .eq('document_type', 'cv')
        .eq('is_current', true)
        .single();

      if (docError || !docs) {
        toast.error('Kein CV zum Parsen gefunden');
        return;
      }

      // Extract path from stored URL
      const urlPath = docs.file_url.split('/cv-documents/')[1];
      if (!urlPath) {
        toast.error('CV-Pfad konnte nicht ermittelt werden');
        return;
      }

      // Extract text from PDF
      const text = await extractTextFromPdf(decodeURIComponent(urlPath));
      if (!text) {
        return; // Error already shown by hook
      }

      // Parse CV with AI
      const parsed = await parseCV(text);
      if (!parsed) {
        return; // Error already shown by hook
      }

      // Save parsed data with existing candidate ID
      await saveParsedCandidate(parsed, text, user.id, candidate.id);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['candidate-experiences', candidate.id] });
      queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      
      toast.success('CV erfolgreich erneut geparst');
    } catch (error) {
      console.error('Reparse error:', error);
      toast.error('Fehler beim erneuten Parsen');
    } finally {
      setIsReparsing(false);
    }
  };

  const isProcessing = isReparsing || parsing || extractingPdf;

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
              <CandidateExperienceTimeline 
                candidateId={candidate.id} 
                onReparse={handleReparse}
                isReparsing={isProcessing}
              />
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
