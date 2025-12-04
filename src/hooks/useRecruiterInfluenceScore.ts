import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface RecruiterInfluenceScore {
  id: string;
  recruiter_id: string;
  influence_score: number;
  opt_in_acceleration_rate: number;
  show_rate_improvement: number;
  candidate_satisfaction_score: number;
  closing_speed_improvement: number;
  alerts_actioned: number;
  alerts_ignored: number;
  playbooks_used: number;
  total_influenced_placements: number;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

export function useRecruiterInfluenceScore() {
  const { user } = useAuth();
  const [score, setScore] = useState<RecruiterInfluenceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('recruiter_influence_scores')
        .select('*')
        .eq('recruiter_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setScore(data as RecruiterInfluenceScore | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const getScoreLevel = (score: number): 'excellent' | 'good' | 'average' | 'poor' => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'poor';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Ausgezeichnet';
    if (score >= 60) return 'Gut';
    if (score >= 40) return 'Durchschnittlich';
    return 'Verbesserungsbedarf';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const alertActionRate = score 
    ? score.alerts_actioned / Math.max(score.alerts_actioned + score.alerts_ignored, 1) * 100
    : 0;

  return {
    score,
    loading,
    error,
    refetch: fetchScore,
    getScoreLevel,
    getScoreLabel,
    getScoreColor,
    alertActionRate,
  };
}
