import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const fetchSummary = useCallback(async () => {
    if (!candidateId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_client_summary')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();

      if (error) throw error;

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

        setSummary({
          id: data.id,
          candidate_id: data.candidate_id,
          submission_id: data.submission_id,
          executive_summary: data.executive_summary || '',
          risk_factors: riskFactors,
          positive_factors: positiveFactors,
          change_motivation_summary: data.change_motivation_summary || '',
          job_hopper_analysis: jobHopperAnalysis,
          recommendation_score: data.recommendation_score || 0,
          recommendation: (data.recommendation as ClientCandidateSummary['recommendation']) || 'maybe',
          key_selling_points: keySellingPoints,
          generated_at: data.generated_at || '',
          model_version: data.model_version || 'v1',
        });
      }
    } catch (error) {
      console.error('Error fetching client summary:', error);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const generateSummary = useCallback(async () => {
    if (!candidateId) return null;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-candidate-summary', {
        body: { candidateId, submissionId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Zusammenfassung erstellt',
          description: 'Die Kunden-Zusammenfassung wurde erfolgreich generiert.',
        });

        await fetchSummary();
        return data.summary;
      } else {
        throw new Error(data?.error || 'Unbekannter Fehler');
      }
    } catch (error) {
      console.error('Error generating client summary:', error);
      toast({
        title: 'Fehler bei der Generierung',
        description: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
        variant: 'destructive',
      });
      return null;
    } finally {
      setGenerating(false);
    }
  }, [candidateId, submissionId, fetchSummary, toast]);

  return {
    summary,
    loading,
    generating,
    refetch: fetchSummary,
    generateSummary,
  };
}
