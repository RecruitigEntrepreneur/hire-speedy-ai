import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CandidateBehavior {
  id: string;
  submission_id: string;
  candidate_id: string;
  opt_in_response_time_hours: number | null;
  emails_sent: number;
  emails_opened: number;
  links_clicked: number;
  prep_materials_viewed: number;
  company_profile_viewed: boolean;
  salary_tool_used: boolean;
  confidence_score: number;
  interview_readiness_score: number;
  closing_probability: number;
  engagement_level: string;
  hesitation_signals: string[];
  motivation_indicators: string[];
  last_engagement_at: string | null;
  days_since_engagement: number;
  created_at: string;
  updated_at: string;
}

export function useCandidateBehavior(submissionId?: string) {
  const [behavior, setBehavior] = useState<CandidateBehavior | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBehavior = useCallback(async () => {
    if (!submissionId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('candidate_behavior')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (data) {
        setBehavior({
          ...data,
          hesitation_signals: Array.isArray(data.hesitation_signals) ? data.hesitation_signals : [],
          motivation_indicators: Array.isArray(data.motivation_indicators) ? data.motivation_indicators : [],
        } as CandidateBehavior);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchBehavior();
  }, [fetchBehavior]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getEngagementLabel = (level: string) => {
    const labels: Record<string, string> = {
      high: 'Hoch',
      medium: 'Mittel',
      low: 'Niedrig',
      neutral: 'Neutral',
    };
    return labels[level] || level;
  };

  return {
    behavior,
    loading,
    error,
    refetch: fetchBehavior,
    getScoreColor,
    getScoreBgColor,
    getEngagementLabel,
  };
}

export function useCandidateBehaviors(submissionIds: string[]) {
  const [behaviors, setBehaviors] = useState<Record<string, CandidateBehavior>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (submissionIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchBehaviors = async () => {
      const { data, error } = await supabase
        .from('candidate_behavior')
        .select('*')
        .in('submission_id', submissionIds);

      if (!error && data) {
        const behaviorMap: Record<string, CandidateBehavior> = {};
        data.forEach((b) => {
          behaviorMap[b.submission_id] = {
            ...b,
            hesitation_signals: Array.isArray(b.hesitation_signals) ? b.hesitation_signals : [],
            motivation_indicators: Array.isArray(b.motivation_indicators) ? b.motivation_indicators : [],
          } as CandidateBehavior;
        });
        setBehaviors(behaviorMap);
      }
      setLoading(false);
    };

    fetchBehaviors();
  }, [submissionIds.join(',')]);

  return { behaviors, loading };
}
