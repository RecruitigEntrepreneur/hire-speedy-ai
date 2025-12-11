import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface CandidateActivity {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  activity_type: 'call' | 'email' | 'note' | 'status_change' | 'playbook_used' | 'alert_actioned' | 'hubspot_import';
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  related_submission_id: string | null;
  related_alert_id: string | null;
  created_at: string;
}

export function useCandidateActivityLog(candidateId?: string) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<CandidateActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!user || !candidateId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('candidate_activity_log')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setActivities((data || []) as CandidateActivity[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Aktivitäten');
    } finally {
      setLoading(false);
    }
  }, [user, candidateId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const logActivity = async (
    targetCandidateId: string,
    activityType: CandidateActivity['activity_type'],
    title: string,
    description?: string,
    metadata: Record<string, unknown> = {},
    relatedSubmissionId?: string,
    relatedAlertId?: string
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('candidate_activity_log')
        .insert({
          candidate_id: targetCandidateId,
          recruiter_id: user.id,
          activity_type: activityType,
          title,
          description: description || null,
          metadata: metadata as any,
          related_submission_id: relatedSubmissionId || null,
          related_alert_id: relatedAlertId || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // If viewing this candidate, update local state
      if (candidateId === targetCandidateId) {
        setActivities(prev => [data as CandidateActivity, ...prev]);
      }

      return data;
    } catch (err) {
      console.error('Error logging activity:', err);
      return null;
    }
  };

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities,
    logActivity,
  };
}

// Global activity logger that can be used without needing to view a specific candidate
export function useActivityLogger() {
  const { user } = useAuth();

  const logActivity = async (
    candidateId: string,
    activityType: CandidateActivity['activity_type'],
    title: string,
    description?: string,
    metadata: Record<string, unknown> = {},
    relatedSubmissionId?: string,
    relatedAlertId?: string
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('candidate_activity_log')
        .insert({
          candidate_id: candidateId,
          recruiter_id: user.id,
          activity_type: activityType,
          title,
          description: description || null,
          metadata: metadata as any,
          related_submission_id: relatedSubmissionId || null,
          related_alert_id: relatedAlertId || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error logging activity:', err);
      return null;
    }
  };

  return { logActivity };
}
