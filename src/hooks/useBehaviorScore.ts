import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface BehaviorScore {
  id: string;
  user_id: string;
  user_type: string;
  avg_response_time_hours: number;
  response_count: number;
  ghost_rate: number;
  sla_compliance_rate: number;
  interview_show_rate: number;
  behavior_class: string;
  risk_score: number;
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

export function useBehaviorScore(userId?: string) {
  const { user } = useAuth();
  const [score, setScore] = useState<BehaviorScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchScore = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_behavior_scores')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      setScore(data as BehaviorScore | null);
    } catch (err) {
      console.error('Error fetching behavior score:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return {
    score,
    loading,
    error,
    refetch: fetchScore,
  };
}

export function useSlaDeadlines() {
  const { user } = useAuth();
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeadlines = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('sla_deadlines')
        .select(`
          *,
          sla_rules (rule_name, deadline_hours, warning_hours)
        `)
        .eq('responsible_user_id', user.id)
        .in('status', ['active', 'warning_sent'])
        .order('deadline_at', { ascending: true });

      if (fetchError) throw fetchError;
      
      setDeadlines(data || []);
    } catch (err) {
      console.error('Error fetching SLA deadlines:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDeadlines();
    
    // Refresh every minute
    const interval = setInterval(fetchDeadlines, 60000);
    return () => clearInterval(interval);
  }, [fetchDeadlines]);

  return {
    deadlines,
    loading,
    refetch: fetchDeadlines,
    activeCount: deadlines.filter(d => d.status === 'active').length,
    warningCount: deadlines.filter(d => d.status === 'warning_sent').length,
  };
}