import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TimeSlot {
  datetime: string;
  status: 'pending' | 'accepted' | 'declined';
}

export function useInterviewScheduling() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSlots = async (interviewId: string, durationMinutes: number = 60) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('schedule-interview', {
        body: {
          action: 'generate-slots',
          interview_id: interviewId,
          duration_minutes: durationMinutes,
        },
      });

      if (fnError) throw fnError;

      toast.success('Zeitvorschläge wurden generiert');
      return data as { slots: TimeSlot[]; selection_token: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Generieren';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const selectSlot = async (selectionToken: string, slotIndex: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('schedule-interview', {
        body: {
          action: 'select-slot',
          selection_token: selectionToken,
          slot_index: slotIndex,
        },
      });

      if (fnError) throw fnError;

      toast.success('Interview wurde bestätigt');
      return data as { success: boolean; scheduled_at: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Auswahl';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const confirmAttendance = async (interviewId: string, userType: 'client' | 'candidate') => {
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('schedule-interview', {
        body: {
          action: 'confirm-attendance',
          interview_id: interviewId,
          user_type: userType,
        },
      });

      if (fnError) throw fnError;

      toast.success('Teilnahme bestätigt');
      return data;
    } catch (err) {
      toast.error('Fehler bei der Bestätigung');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reportNoShow = async (interviewId: string, noShowBy: 'client' | 'candidate', notes?: string) => {
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('schedule-interview', {
        body: {
          action: 'report-no-show',
          interview_id: interviewId,
          no_show_by: noShowBy,
          notes,
        },
      });

      if (fnError) throw fnError;

      toast.success('No-Show wurde gemeldet');
      return data;
    } catch (err) {
      toast.error('Fehler beim Melden');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const formatSlotDate = (datetime: string): string => {
    return new Date(datetime).toLocaleString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return {
    loading,
    error,
    generateSlots,
    selectSlot,
    confirmAttendance,
    reportNoShow,
    formatSlotDate,
  };
}
