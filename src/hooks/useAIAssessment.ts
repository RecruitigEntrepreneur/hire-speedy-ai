import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AIAssessment {
  id: string;
  candidate_id: string;
  risk_factors: string[];
  risk_level: 'low' | 'medium' | 'high';
  opportunity_factors: string[];
  opportunity_level: 'low' | 'medium' | 'high';
  key_highlights: string[];
  overall_score: number;
  placement_probability: number;
  technical_fit: number | null;
  culture_fit: number | null;
  communication_score: number | null;
  recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' | null;
  reasoning: string | null;
  generated_at: string;
  model_version: string;
}

export function useAIAssessment(candidateId?: string) {
  const [assessment, setAssessment] = useState<AIAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchAssessment = useCallback(async () => {
    if (!candidateId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_ai_assessment')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setAssessment({
          ...data,
          risk_factors: Array.isArray(data.risk_factors) ? data.risk_factors : [],
          opportunity_factors: Array.isArray(data.opportunity_factors) ? data.opportunity_factors : [],
          key_highlights: Array.isArray(data.key_highlights) ? data.key_highlights : [],
        } as AIAssessment);
      }
    } catch (error) {
      console.error('Error fetching AI assessment:', error);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  const processInterviewNotes = async (
    interviewNotes: Record<string, unknown>,
    additionalNotes: string,
    candidateData: Record<string, unknown>
  ) => {
    if (!candidateId) return null;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-interview-notes', {
        body: {
          candidateId,
          interviewNotes,
          additionalNotes,
          candidateData,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'AI-Analyse abgeschlossen',
          description: 'Die Interview-Notizen wurden erfolgreich analysiert.',
        });
        
        // Refetch to get the saved assessment
        await fetchAssessment();
        
        return data;
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error processing interview notes:', error);
      toast({
        title: 'Fehler bei der AI-Analyse',
        description: error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten',
        variant: 'destructive',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  return {
    assessment,
    loading,
    processing,
    refetch: fetchAssessment,
    processInterviewNotes,
  };
}
