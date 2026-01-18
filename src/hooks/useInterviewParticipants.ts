import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ParticipantRole = 'lead' | 'panel' | 'observer';

export interface InterviewParticipant {
  id: string;
  interview_id: string;
  user_id: string;
  role: ParticipantRole;
  confirmed: boolean;
  confirmed_at: string | null;
  feedback_submitted: boolean;
  notes: string | null;
  created_at: string;
  // Joined user info
  user_email?: string;
  user_name?: string;
}

export function useInterviewParticipants(interviewId?: string) {
  const [participants, setParticipants] = useState<InterviewParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchParticipants = useCallback(async () => {
    if (!interviewId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('interview_participants')
        .select('*')
        .eq('interview_id', interviewId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setParticipants((data || []) as InterviewParticipant[]);
    } catch (error) {
      console.error('Error fetching participants:', error);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const addParticipant = async (
    userId: string, 
    role: ParticipantRole = 'panel',
    targetInterviewId?: string
  ) => {
    const targetId = targetInterviewId || interviewId;
    if (!targetId) return null;

    try {
      const { data, error } = await supabase
        .from('interview_participants')
        .insert({
          interview_id: targetId,
          user_id: userId,
          role
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Hinweis',
            description: 'Diese Person ist bereits als Interviewer hinzugefügt.',
            variant: 'default'
          });
          return null;
        }
        throw error;
      }

      if (interviewId) {
        await fetchParticipants();
      }

      toast({
        title: 'Interviewer hinzugefügt',
        description: 'Der Interviewer wurde erfolgreich hinzugefügt.'
      });

      return data as InterviewParticipant;
    } catch (error) {
      console.error('Error adding participant:', error);
      toast({
        title: 'Fehler',
        description: 'Interviewer konnte nicht hinzugefügt werden.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('interview_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => prev.filter(p => p.id !== participantId));

      toast({
        title: 'Interviewer entfernt',
        description: 'Der Interviewer wurde entfernt.'
      });

      return true;
    } catch (error) {
      console.error('Error removing participant:', error);
      toast({
        title: 'Fehler',
        description: 'Interviewer konnte nicht entfernt werden.',
        variant: 'destructive'
      });
      return false;
    }
  };

  const updateRole = async (participantId: string, role: ParticipantRole) => {
    try {
      const { error } = await supabase
        .from('interview_participants')
        .update({ role })
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => 
        prev.map(p => p.id === participantId ? { ...p, role } : p)
      );

      return true;
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Fehler',
        description: 'Rolle konnte nicht aktualisiert werden.',
        variant: 'destructive'
      });
      return false;
    }
  };

  const confirmAttendance = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('interview_participants')
        .update({ 
          confirmed: true,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => 
        prev.map(p => p.id === participantId 
          ? { ...p, confirmed: true, confirmed_at: new Date().toISOString() } 
          : p
        )
      );

      return true;
    } catch (error) {
      console.error('Error confirming attendance:', error);
      return false;
    }
  };

  const submitFeedback = async (participantId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('interview_participants')
        .update({ 
          feedback_submitted: true,
          notes
        })
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => 
        prev.map(p => p.id === participantId 
          ? { ...p, feedback_submitted: true, notes } 
          : p
        )
      );

      toast({
        title: 'Feedback gespeichert',
        description: 'Ihr Feedback wurde erfolgreich gespeichert.'
      });

      return true;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Fehler',
        description: 'Feedback konnte nicht gespeichert werden.',
        variant: 'destructive'
      });
      return false;
    }
  };

  return {
    participants,
    loading,
    addParticipant,
    removeParticipant,
    updateRole,
    confirmAttendance,
    submitFeedback,
    refreshParticipants: fetchParticipants
  };
}
