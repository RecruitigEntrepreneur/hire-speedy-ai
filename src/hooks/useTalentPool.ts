import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface TalentPoolEntry {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  pool_type: 'general' | 'silver_medalist' | 'future_fit' | 'passive';
  skills_snapshot: string[] | null;
  experience_years: number | null;
  preferred_roles: string[] | null;
  preferred_locations: string[] | null;
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  availability: string | null;
  last_contacted_at: string | null;
  contact_frequency: 'monthly' | 'quarterly' | 'yearly';
  next_contact_at: string | null;
  source_submission_id: string | null;
  added_reason: string | null;
  is_active: boolean;
  opted_out_at: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  candidates?: {
    full_name: string;
    email: string;
    phone: string | null;
    skills: string[] | null;
    experience_years: number | null;
  };
}

export interface TalentAlert {
  id: string;
  talent_pool_id: string;
  job_id: string;
  match_score: number | null;
  match_reasons: Array<{ reason: string; score: number; details?: string }>;
  status: 'pending' | 'contacted' | 'submitted' | 'dismissed';
  created_at: string;
  jobs?: {
    title: string;
    company_name: string;
    location: string | null;
  };
  talent_pool?: TalentPoolEntry;
}

export function useTalentPool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
    queryKey: ['talent-pool', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('talent_pool')
        .select(`
          *,
          candidates (
            full_name,
            email,
            phone,
            skills,
            experience_years
          )
        `)
        .eq('recruiter_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TalentPoolEntry[];
    },
    enabled: !!user,
  });

  const addToPool = useMutation({
    mutationFn: async (data: {
      candidate_id: string;
      pool_type?: string;
      added_reason?: string;
      source_submission_id?: string;
      skills_snapshot?: string[];
      experience_years?: number;
      preferred_roles?: string[];
      preferred_locations?: string[];
      salary_expectation_min?: number;
      salary_expectation_max?: number;
      availability?: string;
      contact_frequency?: string;
      notes?: string;
      tags?: string[];
    }) => {
      const nextContact = new Date();
      const frequency = data.contact_frequency || 'quarterly';
      if (frequency === 'monthly') nextContact.setMonth(nextContact.getMonth() + 1);
      else if (frequency === 'quarterly') nextContact.setMonth(nextContact.getMonth() + 3);
      else nextContact.setFullYear(nextContact.getFullYear() + 1);

      const { data: entry, error } = await supabase
        .from('talent_pool')
        .insert({
          ...data,
          recruiter_id: user!.id,
          next_contact_at: nextContact.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
      toast.success('Kandidat zum Talent Pool hinzugefügt');
    },
    onError: (error: any) => {
      console.error('Error adding to pool:', error);
      if (error.code === '23505') {
        toast.error('Kandidat ist bereits im Pool');
      } else {
        toast.error('Fehler beim Hinzufügen');
      }
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TalentPoolEntry> & { id: string }) => {
      const { error } = await supabase
        .from('talent_pool')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
      toast.success('Eintrag aktualisiert');
    },
    onError: (error) => {
      console.error('Error updating entry:', error);
      toast.error('Fehler beim Aktualisieren');
    },
  });

  const removeFromPool = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('talent_pool')
        .update({ is_active: false })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
      toast.success('Aus Pool entfernt');
    },
    onError: (error) => {
      console.error('Error removing from pool:', error);
      toast.error('Fehler beim Entfernen');
    },
  });

  const markContacted = useMutation({
    mutationFn: async (entryId: string) => {
      const entry = entries?.find(e => e.id === entryId);
      const nextContact = new Date();
      const frequency = entry?.contact_frequency || 'quarterly';
      if (frequency === 'monthly') nextContact.setMonth(nextContact.getMonth() + 1);
      else if (frequency === 'quarterly') nextContact.setMonth(nextContact.getMonth() + 3);
      else nextContact.setFullYear(nextContact.getFullYear() + 1);

      const { error } = await supabase
        .from('talent_pool')
        .update({
          last_contacted_at: new Date().toISOString(),
          next_contact_at: nextContact.toISOString(),
        })
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pool'] });
      toast.success('Als kontaktiert markiert');
    },
    onError: (error) => {
      console.error('Error marking contacted:', error);
      toast.error('Fehler');
    },
  });

  return {
    entries,
    isLoading,
    addToPool,
    updateEntry,
    removeFromPool,
    markContacted,
  };
}

export function useTalentAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['talent-alerts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('talent_alerts')
        .select(`
          *,
          jobs (
            title,
            company_name,
            location
          ),
          talent_pool (
            *,
            candidates (
              full_name,
              email
            )
          )
        `)
        .eq('status', 'pending')
        .order('match_score', { ascending: false });

      if (error) throw error;
      return data as TalentAlert[];
    },
    enabled: !!user,
  });

  const updateAlert = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('talent_alerts')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-alerts'] });
    },
    onError: (error) => {
      console.error('Error updating alert:', error);
      toast.error('Fehler beim Aktualisieren');
    },
  });

  return {
    alerts,
    isLoading,
    updateAlert,
  };
}
