import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

export type FitVerdict = 'strong_fit' | 'good_fit' | 'partial_fit' | 'weak_fit' | 'no_fit';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface RequirementAssessment {
  requirement: string;
  requirement_type: 'must_have' | 'nice_to_have' | 'inferred';
  verdict: 'fulfilled' | 'partially_fulfilled' | 'inferred_from_experience' | 'trainable' | 'gap';
  confidence: ConfidenceLevel;
  evidence: string[];
  evidence_source?: string;
  reasoning: string;
  score: number;
}

export interface BonusQualification {
  qualification: string;
  relevance: 'high' | 'medium' | 'low';
  evidence: string;
  potential_value: string;
}

export interface GapItem {
  requirement: string;
  gap_severity: 'critical' | 'significant' | 'minor';
  is_trainable: boolean;
  trainability_assessment: string;
  mitigation_suggestion: string;
  deal_breaker: boolean;
}

export interface CareerTrajectory {
  trajectory_type: 'ascending' | 'lateral' | 'pivoting' | 'specialist_deepening' | 'declining' | 'mixed';
  trajectory_summary: string;
  growth_velocity: 'fast' | 'normal' | 'slow';
  implied_competencies: string[];
  career_stage_fit: string;
}

export interface ImplicitCompetency {
  competency: string;
  inferred_from: string;
  confidence: ConfidenceLevel;
  relevance_to_role: string;
}

export interface MotivationFit {
  alignment_score: number;
  alignment_summary: string;
  motivational_match_points?: string[];
  motivational_risk_points?: string[];
  retention_prediction: 'high' | 'medium' | 'low';
  retention_reasoning: string;
}

export interface DimensionScores {
  technical: number;
  experience: number;
  leadership: number;
  cultural: number;
  growth_potential: number;
}

export interface CandidateFitAssessment {
  id: string;
  submission_id: string;
  candidate_id: string;
  job_id: string;
  overall_verdict: FitVerdict;
  overall_score: number;
  executive_summary: string;
  verdict_confidence: ConfidenceLevel;
  requirement_assessments: RequirementAssessment[];
  bonus_qualifications: BonusQualification[];
  gap_analysis: GapItem[];
  career_trajectory: CareerTrajectory;
  implicit_competencies: ImplicitCompetency[];
  motivation_fit: MotivationFit | null;
  dimension_scores: DimensionScores;
  rejection_reasoning: string | null;
  model_used: string;
  prompt_version: string;
  generation_time_ms: number | null;
  generated_at: string;
  created_at: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useCandidateFitAssessment(submissionId?: string) {
  const [assessment, setAssessment] = useState<CandidateFitAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const hasTriedGenerate = useRef(false);
  const lastFetchKey = useRef<string>('');

  const fetchAssessment = useCallback(async () => {
    if (!submissionId) return;

    if (lastFetchKey.current !== submissionId) {
      hasTriedGenerate.current = false;
      lastFetchKey.current = submissionId;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_fit_assessments')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const parsed: CandidateFitAssessment = {
          id: data.id,
          submission_id: data.submission_id,
          candidate_id: data.candidate_id,
          job_id: data.job_id,
          overall_verdict: data.overall_verdict as FitVerdict,
          overall_score: data.overall_score,
          executive_summary: data.executive_summary,
          verdict_confidence: data.verdict_confidence as ConfidenceLevel,
          requirement_assessments: (data.requirement_assessments as unknown as RequirementAssessment[]) || [],
          bonus_qualifications: (data.bonus_qualifications as unknown as BonusQualification[]) || [],
          gap_analysis: (data.gap_analysis as unknown as GapItem[]) || [],
          career_trajectory: (data.career_trajectory as unknown as CareerTrajectory) || {} as CareerTrajectory,
          implicit_competencies: (data.implicit_competencies as unknown as ImplicitCompetency[]) || [],
          motivation_fit: (data.motivation_fit as unknown as MotivationFit) || null,
          dimension_scores: (data.dimension_scores as unknown as DimensionScores) || {} as DimensionScores,
          rejection_reasoning: data.rejection_reasoning,
          model_used: data.model_used,
          prompt_version: data.prompt_version,
          generation_time_ms: data.generation_time_ms,
          generated_at: data.generated_at,
          created_at: data.created_at,
        };
        setAssessment(parsed);
      } else {
        setAssessment(null);
      }
    } catch (error) {
      console.error('Error fetching fit assessment:', error);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  const generateAssessment = useCallback(async (options?: { force?: boolean; silent?: boolean }) => {
    if (!submissionId) return null;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('assess-candidate-fit', {
        body: { submissionId, force: options?.force },
      });

      if (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('402') || errorMessage.includes('Payment required')) {
          throw new Error('AI-Kredit-Limit erreicht. Bitte kontaktieren Sie den Support.');
        }
        if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
          throw new Error('Zu viele Anfragen. Bitte warten Sie einen Moment.');
        }
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.assessment) {
        if (!options?.silent) {
          toast({
            title: 'Fit-Analyse erstellt',
            description: 'Die intelligente Fit-Analyse wurde erfolgreich generiert.',
          });
        }
        await fetchAssessment();
        return data.assessment;
      } else {
        throw new Error('Unbekannter Fehler bei der Generierung');
      }
    } catch (error) {
      console.error('Error generating fit assessment:', error);
      if (!options?.silent) {
        toast({
          title: 'Fehler bei der Analyse',
          description: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
          variant: 'destructive',
        });
      }
      return null;
    } finally {
      setGenerating(false);
    }
  }, [submissionId, fetchAssessment, toast]);

  // Initial fetch
  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  return {
    assessment,
    loading,
    generating,
    refetch: fetchAssessment,
    generateAssessment,
    hasTriedGenerate,
  };
}
