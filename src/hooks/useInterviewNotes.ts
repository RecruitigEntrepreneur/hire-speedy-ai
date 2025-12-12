import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useActivityLogger } from './useCandidateActivityLog';

export interface InterviewNotes {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  
  // Block 1: Karriereziele
  career_ultimate_goal: string | null;
  career_3_5_year_plan: string | null;
  career_actions_taken: string | null;
  career_what_worked: string | null;
  career_what_didnt_work: string | null;
  
  // Block 2: Aktuelle Situation & Wechselmotivation
  current_positive: string | null;
  current_negative: string | null;
  change_motivation: string | null;
  change_motivation_tags: string[];
  specific_incident: string | null;
  frequency_of_issues: string | null;
  would_stay_if_matched: boolean | null;
  why_now: string | null;
  previous_process_issues: string | null;
  discussed_internally: string | null;
  
  // Block 3: Gehalt
  salary_current: string | null;
  salary_desired: string | null;
  salary_minimum: string | null;
  offer_requirements: string[];
  
  // Block 4: Vertragsrahmen
  notice_period: string | null;
  earliest_start_date: string | null;
  
  // Abschluss
  would_recommend: boolean | null;
  recommendation_notes: string | null;
  
  // Freitext
  additional_notes: string | null;
  
  // Zusammenfassung
  summary_motivation: string | null;
  summary_salary: string | null;
  summary_notice: string | null;
  summary_key_requirements: string | null;
  summary_cultural_fit: string | null;
  
  // Metadaten
  interview_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type InterviewNotesFormData = Omit<InterviewNotes, 'id' | 'candidate_id' | 'recruiter_id' | 'created_at' | 'updated_at'>;

const emptyFormData: InterviewNotesFormData = {
  career_ultimate_goal: null,
  career_3_5_year_plan: null,
  career_actions_taken: null,
  career_what_worked: null,
  career_what_didnt_work: null,
  current_positive: null,
  current_negative: null,
  change_motivation: null,
  change_motivation_tags: [],
  specific_incident: null,
  frequency_of_issues: null,
  would_stay_if_matched: null,
  why_now: null,
  previous_process_issues: null,
  discussed_internally: null,
  salary_current: null,
  salary_desired: null,
  salary_minimum: null,
  offer_requirements: [],
  notice_period: null,
  earliest_start_date: null,
  would_recommend: null,
  recommendation_notes: null,
  additional_notes: null,
  summary_motivation: null,
  summary_salary: null,
  summary_notice: null,
  summary_key_requirements: null,
  summary_cultural_fit: null,
  interview_date: null,
  status: 'draft',
};

export function useInterviewNotes(candidateId?: string) {
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();
  const [notes, setNotes] = useState<InterviewNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!user || !candidateId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('candidate_interview_notes')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('recruiter_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setNotes(data as InterviewNotes | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [user, candidateId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const saveNotes = async (formData: InterviewNotesFormData): Promise<boolean> => {
    if (!user || !candidateId) return false;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        candidate_id: candidateId,
        recruiter_id: user.id,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (notes?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('candidate_interview_notes')
          .update(payload as never)
          .eq('id', notes.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('candidate_interview_notes')
          .insert(payload as never)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      setNotes(result as InterviewNotes);

      // Log activity
      await logActivity(
        candidateId,
        'note',
        notes?.id ? 'Interview-Notizen aktualisiert' : 'Interview-Notizen erstellt',
        `Status: ${formData.status === 'completed' ? 'Abgeschlossen' : 'Entwurf'}`,
        {
          section: 'interview_notes',
          status: formData.status,
          interview_date: formData.interview_date,
        }
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const getFormData = (): InterviewNotesFormData => {
    if (!notes) return emptyFormData;
    
    const { id, candidate_id, recruiter_id, created_at, updated_at, ...formFields } = notes;
    return {
      ...emptyFormData,
      ...formFields,
      change_motivation_tags: formFields.change_motivation_tags || [],
      offer_requirements: formFields.offer_requirements || [],
    };
  };

  return {
    notes,
    loading,
    saving,
    error,
    refetch: fetchNotes,
    saveNotes,
    getFormData,
    emptyFormData,
  };
}
