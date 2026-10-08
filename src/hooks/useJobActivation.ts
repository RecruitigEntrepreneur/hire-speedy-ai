import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { endJobSearch, errorHint, errorText, mySearchCapacity, startJobSearch, type StartSearchResult } from '@/lib/jobSearch';

export interface JobActivation {
  id: string;
  recruiter_id: string;
  job_id: string;
  activated_at: string;
  first_submission_at: string | null;
  has_submitted: boolean;
  status: 'active' | 'paused' | 'ended';
  ends_at: string | null;
  paused_at: string | null;
  review_hold: boolean;
  ended_at: string | null;
  end_reason: string | null;
  slot_until: string | null;
  company_revealed_at: string | null;
}

/**
 * Suchen des Headhunters („Ich suche“). Starten und Beenden laufen über die
 * Datenbankfunktionen (Platzregel, 30-Tage-Frist, Namensprotokoll), lesen per RLS.
 */
export function useJobActivation(jobIds?: string[]) {
  const { user } = useAuth();
  const [activations, setActivations] = useState<Map<string, JobActivation>>(new Map());
  const [capacity, setCapacity] = useState<{ used: number; limit: number }>({ used: 0, limit: 10 });
  const [loading, setLoading] = useState(true);

  const fetchActivations = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      let query = supabase.from('recruiter_job_activations').select('*').eq('recruiter_id', user.id);
      if (jobIds && jobIds.length > 0) query = query.in('job_id', jobIds);
      const [{ data, error }, cap] = await Promise.all([query, mySearchCapacity().catch(() => null)]);
      if (error) throw error;
      const map = new Map<string, JobActivation>();
      ((data ?? []) as unknown as JobActivation[]).forEach((a) => map.set(a.job_id, { ...a, status: a.status ?? 'active' }));
      setActivations(map);
      if (cap) setCapacity(cap);
    } catch (err) {
      console.warn('Suchen konnten nicht geladen werden:', err);
    } finally {
      setLoading(false);
    }
  }, [user, jobIds?.join(',')]);

  useEffect(() => {
    fetchActivations();
  }, [fetchActivations]);

  /** Einreichen möglich: Suche läuft (nicht ruhend, nicht beendet). */
  const isActivated = useCallback((jobId: string) => activations.get(jobId)?.status === 'active', [activations]);
  /** Sucht (auch ruhend) – für Anzeige „Du suchst“. */
  const isSearching = useCallback(
    (jobId: string) => ['active', 'paused'].includes(activations.get(jobId)?.status ?? ''),
    [activations],
  );
  const getActivation = useCallback((jobId: string) => activations.get(jobId), [activations]);

  const activateJob = useCallback(
    async (jobId: string, forSubmission = false): Promise<{ success: boolean; result?: StartSearchResult; error?: string; hint?: string }> => {
      if (!user) return { success: false, error: 'Nicht eingeloggt' };
      try {
        const result = await startJobSearch(jobId, forSubmission);
        await fetchActivations();
        return { success: true, result };
      } catch (err) {
        return { success: false, error: errorText(err), hint: errorHint(err) };
      }
    },
    [user, fetchActivations],
  );

  const endSearch = useCallback(
    async (jobId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        await endJobSearch(jobId);
        await fetchActivations();
        return { success: true };
      } catch (err) {
        return { success: false, error: errorText(err) };
      }
    },
    [fetchActivations],
  );

  const activatedJobIds = Array.from(activations.values())
    .filter((a) => a.status === 'active' || a.status === 'paused')
    .map((a) => a.job_id);

  return {
    activations,
    capacity,
    loading,
    refetch: fetchActivations,
    isActivated,
    isSearching,
    getActivation,
    activateJob,
    endSearch,
    activatedJobIds,
  };
}
