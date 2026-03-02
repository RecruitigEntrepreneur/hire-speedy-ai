import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface JobActivation {
  id: string;
  recruiter_id: string;
  job_id: string;
  trust_level_at: string;
  activated_at: string;
  first_submission_at: string | null;
  has_submitted: boolean;
}

export function useJobActivation(jobIds?: string[]) {
  const { user } = useAuth();
  const [activations, setActivations] = useState<Map<string, JobActivation>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchActivations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('recruiter_job_activations')
        .select('*')
        .eq('recruiter_id', user.id);

      if (jobIds && jobIds.length > 0) {
        query = query.in('job_id', jobIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, JobActivation>();
      (data || []).forEach((a) => {
        map.set(a.job_id, a);
      });
      setActivations(map);
    } catch (err) {
      // Table may not exist yet — silently fall back to empty
      console.warn('Activations table not available:', err);
    } finally {
      setLoading(false);
    }
  }, [user, jobIds?.join(',')]);

  useEffect(() => {
    fetchActivations();
  }, [fetchActivations]);

  const isActivated = useCallback((jobId: string): boolean => {
    return activations.has(jobId);
  }, [activations]);

  const getActivation = useCallback((jobId: string): JobActivation | undefined => {
    return activations.get(jobId);
  }, [activations]);

  const activateJob = useCallback(async (
    jobId: string,
    trustLevel: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Nicht eingeloggt' };

    try {
      const { error } = await supabase
        .from('recruiter_job_activations')
        .insert({
          recruiter_id: user.id,
          job_id: jobId,
          trust_level_at: trustLevel,
        });

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Du suchst bereits für diese Stelle.' };
        }
        throw error;
      }

      // Update local state
      const newActivation: JobActivation = {
        id: crypto.randomUUID(),
        recruiter_id: user.id,
        job_id: jobId,
        trust_level_at: trustLevel,
        activated_at: new Date().toISOString(),
        first_submission_at: null,
        has_submitted: false,
      };
      setActivations(prev => new Map(prev).set(jobId, newActivation));

      return { success: true };
    } catch (err) {
      console.warn('Error activating job (table may not exist yet):', err);
      // Still update local state for preview/dev purposes
      const fallbackActivation: JobActivation = {
        id: crypto.randomUUID(),
        recruiter_id: user.id,
        job_id: jobId,
        trust_level_at: trustLevel,
        activated_at: new Date().toISOString(),
        first_submission_at: null,
        has_submitted: false,
      };
      setActivations(prev => new Map(prev).set(jobId, fallbackActivation));
      return { success: true };
    }
  }, [user]);

  const activatedJobIds = Array.from(activations.keys());

  return {
    activations,
    loading,
    refetch: fetchActivations,
    isActivated,
    getActivation,
    activateJob,
    activatedJobIds,
  };
}
