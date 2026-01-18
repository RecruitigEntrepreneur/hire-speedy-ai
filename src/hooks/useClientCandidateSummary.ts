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
  recommendation_score: number;
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
          recommendation_score: data.recommendation_score || 0,
          recommendation: (data.recommendation as ClientCandidateSummary['recommendation']) || 'maybe',
          key_selling_points: keySellingPoints,
          generated_at: data.generated_at || '',
          model_version: data.model_version || 'v1',
        };

        setSummary(parsedSummary);
        
        // Check if summary is outdated and needs regeneration
        const isOutdated = 
          parsedSummary.model_version !== TARGET_VERSION ||
          !parsedSummary.career_goals ||
          (submissionId && parsedSummary.submission_id !== submissionId);
        
        return { summary: parsedSummary, isOutdated };
      }
      
      return { summary: null, isOutdated: true };
    } catch (error) {
      console.error('Error fetching client summary:', error);
      return { summary: null, isOutdated: true };
    } finally {
      setLoading(false);
    }
  }, [candidateId, submissionId]);

  const generateSummary = useCallback(async (options?: { silent?: boolean }) => {
    if (!candidateId) return null;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-candidate-summary', {
        body: { candidateId, submissionId },
      });

      if (error) throw error;

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
        throw new Error(data?.error || 'Unbekannter Fehler');
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

  // Initial fetch and auto-regeneration
  useEffect(() => {
    const fetchAndAutoRegenerate = async () => {
      const result = await fetchSummary();
      
      // Auto-regenerate if outdated and we haven't already tried
      if (result?.isOutdated && !hasAutoRegenerated.current && candidateId) {
        hasAutoRegenerated.current = true;
        console.log('[useClientCandidateSummary] Auto-regenerating outdated summary for candidate:', candidateId);
        generateSummary({ silent: true });
      }
    };
    
    fetchAndAutoRegenerate();
  }, [fetchSummary, candidateId, generateSummary]);

  return {
    summary,
    loading,
    generating,
    refetch: fetchSummary,
    generateSummary,
  };
}
