import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InterviewIntelligence {
  id: string;
  interview_id: string;
  submission_id: string;
  candidate_prep: {
    key_strengths?: string[];
    improvement_areas?: string[];
    likely_questions?: string[];
    recommended_answers?: { question: string; answer: string }[];
  };
  company_insights: {
    culture?: string;
    values?: string[];
    recent_news?: string[];
    interview_style?: string;
  };
  interviewer_guide: {
    questions_to_ask?: string[];
    red_flags?: string[];
    focus_areas?: string[];
  };
  candidate_summary: string | null;
  interview_feedback: Record<string, unknown>;
  ai_assessment: {
    technical_fit?: number;
    culture_fit?: number;
    communication?: number;
    overall?: number;
  };
  risk_assessment: {
    risks?: string[];
    mitigations?: string[];
  };
  hiring_recommendation: 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no' | null;
  recommendation_reasoning: string | null;
  recruiter_next_steps: {
    action: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  created_at: string;
  updated_at: string;
}

export function useInterviewIntelligence(interviewId?: string) {
  const [intelligence, setIntelligence] = useState<InterviewIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = useCallback(async () => {
    if (!interviewId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('interview_intelligence')
        .select('*')
        .eq('interview_id', interviewId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setIntelligence(data as InterviewIntelligence | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  return { intelligence, loading, error, refetch: fetchIntelligence };
}

export function useGenerateInterviewPrep() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePrep = async (interviewId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-interview-prep', {
        body: { interview_id: interviewId },
      });

      if (fnError) throw fnError;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Generierung';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generatePrep, loading, error };
}

export function useAnalyzeInterview() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeInterview = async (interviewId: string, feedback: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-interview', {
        body: { interview_id: interviewId, feedback },
      });

      if (fnError) throw fnError;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Analyse';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { analyzeInterview, loading, error };
}

export function getRecommendationLabel(recommendation: string | null): string {
  const labels: Record<string, string> = {
    strong_yes: 'Klare Empfehlung',
    yes: 'Empfehlung',
    maybe: 'Unentschieden',
    no: 'Nicht empfohlen',
    strong_no: 'Ablehnung',
  };
  return labels[recommendation || ''] || 'Ausstehend';
}

export function getRecommendationColor(recommendation: string | null): string {
  const colors: Record<string, string> = {
    strong_yes: 'text-emerald-600',
    yes: 'text-green-600',
    maybe: 'text-amber-600',
    no: 'text-orange-600',
    strong_no: 'text-red-600',
  };
  return colors[recommendation || ''] || 'text-muted-foreground';
}

export function getRecommendationBadgeVariant(recommendation: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (recommendation === 'strong_yes' || recommendation === 'yes') return 'default';
  if (recommendation === 'maybe') return 'secondary';
  if (recommendation === 'no' || recommendation === 'strong_no') return 'destructive';
  return 'outline';
}
