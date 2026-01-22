import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface SamplePhrase {
  category: string;
  phrases: string[];
}

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface CoachingPlaybook {
  id: string;
  trigger_type: string;
  title: string;
  description: string | null;
  phone_script: string | null;
  email_template: string | null;
  whatsapp_template: string | null;
  talking_points: string[];
  objection_handlers: ObjectionHandler[];
  quick_checklist: string[] | null;
  sample_phrases: SamplePhrase[];
  red_flags: string[] | null;
  success_indicators: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper to safely parse JSON arrays
const parseJsonArray = <T>(data: Json | null, defaultValue: T[] = []): T[] => {
  if (!data) return defaultValue;
  if (Array.isArray(data)) return data as T[];
  return defaultValue;
};

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
        talking_points: parseJsonArray<string>(data.talking_points as Json),
        objection_handlers: parseJsonArray<ObjectionHandler>(data.objection_handlers as Json),
        sample_phrases: parseJsonArray<SamplePhrase>(data.sample_phrases as Json),
        quick_checklist: data.quick_checklist || null,
        red_flags: data.red_flags || null,
        success_indicators: data.success_indicators || null,
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
        talking_points: parseJsonArray<string>(d.talking_points as Json),
        objection_handlers: parseJsonArray<ObjectionHandler>(d.objection_handlers as Json),
        sample_phrases: parseJsonArray<SamplePhrase>(d.sample_phrases as Json),
        quick_checklist: d.quick_checklist || null,
        red_flags: d.red_flags || null,
        success_indicators: d.success_indicators || null,
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
