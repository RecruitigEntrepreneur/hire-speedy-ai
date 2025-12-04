import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CoachingPlaybook {
  id: string;
  trigger_type: string;
  title: string;
  description: string | null;
  phone_script: string | null;
  email_template: string | null;
  whatsapp_template: string | null;
  talking_points: string[];
  objection_handlers: { objection: string; response: string }[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCoachingPlaybook(playbookId?: string) {
  const [playbook, setPlaybook] = useState<CoachingPlaybook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaybook = useCallback(async () => {
    if (!playbookId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('coaching_playbooks')
        .select('*')
        .eq('id', playbookId)
        .single();

      if (fetchError) throw fetchError;
      
      setPlaybook({
        ...data,
        talking_points: Array.isArray(data.talking_points) ? data.talking_points : [],
        objection_handlers: Array.isArray(data.objection_handlers) ? data.objection_handlers : [],
      } as CoachingPlaybook);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [playbookId]);

  useEffect(() => {
    fetchPlaybook();
  }, [fetchPlaybook]);

  return { playbook, loading, error, refetch: fetchPlaybook };
}

export function useCoachingPlaybooks(triggerType?: string) {
  const [playbooks, setPlaybooks] = useState<CoachingPlaybook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaybooks = useCallback(async () => {
    try {
      let query = supabase
        .from('coaching_playbooks')
        .select('*')
        .eq('is_active', true)
        .order('title');

      if (triggerType) {
        query = query.eq('trigger_type', triggerType);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      
      setPlaybooks((data || []).map(d => ({
        ...d,
        talking_points: Array.isArray(d.talking_points) ? d.talking_points : [],
        objection_handlers: Array.isArray(d.objection_handlers) ? d.objection_handlers : [],
      })) as CoachingPlaybook[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [triggerType]);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  return { playbooks, loading, error, refetch: fetchPlaybooks };
}
