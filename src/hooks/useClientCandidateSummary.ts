import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TARGET_VERSION = 'v2-job-context';

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface PositiveFactor {
  factor: string;
  strength: 'low' | 'medium' | 'high';
  detail: string;
}

export interface JobHopperAnalysis {
  is_job_hopper: boolean;
  avg_tenure_months: number;
  concern_level: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface ClientCandidateSummary {
  id: string;
  candidate_id: string;
  submission_id: string | null;
  executive_summary: string;
  risk_factors: RiskFactor[];
  positive_factors: PositiveFactor[];
  change_motivation_summary: string;
  career_goals: string;
  job_hopper_analysis: JobHopperAnalysis;
  // NOTE: recommendation_score REMOVED - V3.1 Match Engine is the single source of truth
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no';
  key_selling_points: string[];
  generated_at: string;
  model_version: string;
}

export function useClientCandidateSummary(candidateId?: string, submissionId?: string) {
  const [summary, setSummary] = useState<ClientCandidateSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  
  // Track if we've already auto-regenerated for this candidate/submission combo
  const hasAutoRegenerated = useRef(false);
  const lastFetchKey = useRef<string>('');

  const fetchSummary = useCallback(async () => {
    if (!candidateId) return;

    const fetchKey = `${candidateId}-${submissionId || 'none'}`;
    
    // Reset auto-regeneration flag if the key changed
    if (lastFetchKey.current !== fetchKey) {
      hasAutoRegenerated.current = false;
      lastFetchKey.current = fetchKey;
    }

    setLoading(true);
    try {
      let data = null;
      
      // Strategy 1: If submissionId is provided, fetch by submission_id first
      if (submissionId) {
        const { data: submissionData, error: submissionError } = await supabase
          .from('candidate_client_summary')
          .select('*')
          .eq('submission_id', submissionId)
          .maybeSingle();
        
        if (!submissionError && submissionData) {
          data = submissionData;
        }
      }
      
      // Strategy 2: Fallback to candidate_id for legacy v1 data
      if (!data) {
        const { data: candidateData, error: candidateError } = await supabase
          .from('candidate_client_summary')
          .select('*')
          .eq('candidate_id', candidateId)
          .maybeSingle();
        
        if (candidateError) throw candidateError;
        data = candidateData;
      }

      if (data) {
        const riskFactors = Array.isArray(data.risk_factors) 
          ? (data.risk_factors as unknown as RiskFactor[]) 
          : [];
        const positiveFactors = Array.isArray(data.positive_factors) 
          ? (data.positive_factors as unknown as PositiveFactor[]) 
          : [];
        const keySellingPoints = Array.isArray(data.key_selling_points) 
          ? (data.key_selling_points as unknown as string[]) 
          : [];
        const jobHopperAnalysis = (data.job_hopper_analysis as unknown as JobHopperAnalysis) || {
          is_job_hopper: false,
          avg_tenure_months: 0,
          concern_level: 'low' as const,
          explanation: '',
        };

        const parsedSummary: ClientCandidateSummary = {
          id: data.id,
          candidate_id: data.candidate_id,
          submission_id: data.submission_id,
          executive_summary: data.executive_summary || '',
          risk_factors: riskFactors,
          positive_factors: positiveFactors,
          change_motivation_summary: data.change_motivation_summary || '',
          career_goals: data.career_goals || '',
          job_hopper_analysis: jobHopperAnalysis,
          // NOTE: recommendation_score removed - V3.1 Match Engine is the single source of truth
          recommendation: (data.recommendation as ClientCandidateSummary['recommendation']) || 'maybe',
          key_selling_points: keySellingPoints,
          generated_at: data.generated_at || '',
          model_version: data.model_version || 'v1',
        };

        setSummary(parsedSummary);
        return { summary: parsedSummary };
      }
      
      return { summary: null };
    } catch (error) {
      console.error('Error fetching client summary:', error);
      return { summary: null };
    } finally {
      setLoading(false);
    }
  }, [candidateId, submissionId]);

  const generateSummary = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    if (!candidateId) return null;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-candidate-summary', {
        body: { candidateId, submissionId, force: options?.force },
      });

      // Handle specific error cases
      if (error) {
        // Check for payment/credit limit errors
        const errorMessage = error.message || '';
        if (errorMessage.includes('402') || errorMessage.includes('Payment required')) {
          throw new Error('AI-Kredit-Limit erreicht. Bitte kontaktieren Sie den Support.');
        }
        if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
          throw new Error('Zu viele Anfragen. Bitte warten Sie einen Moment.');
        }
        throw error;
      }

      // Handle error responses from the function
      if (data?.error) {
        if (data.error.includes('Payment required') || data.error.includes('402')) {
          throw new Error('AI-Kredit-Limit erreicht. Bitte kontaktieren Sie den Support.');
        }
        throw new Error(data.error);
      }

      if (data?.success) {
        if (!options?.silent) {
          toast({
            title: 'Zusammenfassung erstellt',
            description: 'Die Kunden-Zusammenfassung wurde erfolgreich generiert.',
          });
        }

        await fetchSummary();
        return data.summary;
      } else {
        throw new Error('Unbekannter Fehler bei der Generierung');
      }
    } catch (error) {
      console.error('Error generating client summary:', error);
      if (!options?.silent) {
        toast({
          title: 'Fehler bei der Generierung',
          description: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
          variant: 'destructive',
        });
      }
      return null;
    } finally {
      setGenerating(false);
    }
  }, [candidateId, submissionId, fetchSummary, toast]);

  // Initial fetch only - NO auto-regeneration to prevent constant pop-ups
  // Regeneration is now triggered manually or via smart policies
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    generating,
    refetch: fetchSummary,
    generateSummary,
  };
}
