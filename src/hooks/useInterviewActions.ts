import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';

/** Adapter für Bestandskomponenten (EditDialog, Kalender), die das alte
 *  Interview-Shape mit submission.candidate erwarten – Name ist hier bereits
 *  reveal-sicher (anonymer Code bis Opt-In). */
export const toLegacyShape = (iv: AgendaInterview) => ({
  id: iv.id,
  scheduled_at: iv.scheduledAt,
  duration_minutes: iv.durationMinutes,
  meeting_type: iv.meetingType,
  meeting_link: iv.joinUrl,
  status: iv.status,
  notes: iv.notes,
  feedback: iv.feedback,
  submission: {
    id: iv.submissionId,
    candidate: { full_name: iv.candidateName, email: '' },
    job: { title: iv.jobTitle, company_name: '' },
  },
});

export interface EditForm {
  scheduled_at: string;
  duration_minutes: number;
  meeting_type: string;
  meeting_link: string;
  notes: string;
}

/**
 * Gemeinsame Interview-Aktionen für Client-Oberflächen (Agenda-Seite und
 * Bewerber-Inbox). Kapselt die Supabase-Mutationen + Recruiter-Benachrichtigung,
 * damit beide Einstiegspunkte identisch handeln (keine Logik-Dublette).
 */
export function useInterviewActions(refetch: () => void) {
  const [processing, setProcessing] = useState(false);

  const notifyRecruiter = async (iv: AgendaInterview, type: string, title: string, message: string) => {
    const { data: sub } = await supabase
      .from('submissions')
      .select('recruiter_id')
      .eq('id', iv.submissionId)
      .single();
    if (sub?.recruiter_id) {
      await supabase.from('notifications').insert({
        user_id: sub.recruiter_id,
        type,
        title,
        message,
        related_type: 'interview',
        related_id: iv.id,
      });
    }
  };

  const remind = async (iv: AgendaInterview) => {
    try {
      await notifyRecruiter(
        iv,
        'interview_reminder_requested',
        'Kunde bittet um Erinnerung',
        `Der Kandidat ${iv.candidateName} hat auf die Interview-Anfrage für "${iv.jobTitle}" seit ${Math.floor(iv.waitingHours / 24) || iv.waitingHours} ${iv.waitingHours >= 48 ? 'Tagen' : 'Stunden'} nicht geantwortet. Bitte nachfassen.`,
      );
      toast.success('Der Recruiter wurde gebeten, beim Kandidaten nachzufassen.');
    } catch (e) {
      console.error('Erinnern-Fehler:', e);
      toast.error('Erinnerung konnte nicht gesendet werden.');
    }
  };

  const noShow = async (iv: AgendaInterview) => {
    setProcessing(true);
    const { error } = await supabase
      .from('interviews')
      .update({
        status: 'no_show',
        no_show_reported: true,
        no_show_by: 'candidate',
        notes: `${iv.notes || ''}\n\n[No-Show: Kandidat nicht erschienen]`.trim(),
      })
      .eq('id', iv.id);
    setProcessing(false);
    if (error) {
      toast.error('No-Show konnte nicht gemeldet werden.');
      return;
    }
    await notifyRecruiter(iv, 'interview_no_show', 'No-Show gemeldet', `Der Kandidat ist zum Interview für "${iv.jobTitle}" nicht erschienen.`);
    toast.success('No-Show gemeldet.');
    refetch();
  };

  /** Termin bearbeiten/umbuchen. Gibt true bei Erfolg zurück, damit der
   *  Aufrufer den Dialog erst dann schließt. */
  const saveEdit = async (iv: AgendaInterview, form: EditForm): Promise<boolean> => {
    setProcessing(true);

    const dateChanged =
      !iv.scheduledAt || new Date(form.scheduled_at).getTime() !== new Date(iv.scheduledAt).getTime();

    const update: Record<string, unknown> = {
      scheduled_at: form.scheduled_at,
      duration_minutes: form.duration_minutes,
      meeting_type: form.meeting_type,
      meeting_link: form.meeting_link,
      notes: form.notes,
    };
    // Status nur bei echter (Um-)Terminierung setzen – Notiz-Edits
    // reanimieren keine No-Shows/Absagen mehr.
    if (dateChanged) {
      update.status = 'scheduled';
      update.client_confirmed = true;
      update.client_confirmed_at = new Date().toISOString();
    }

    const { error } = await supabase.from('interviews').update(update).eq('id', iv.id);
    setProcessing(false);
    if (error) {
      toast.error('Fehler beim Speichern');
      return false;
    }
    if (dateChanged) {
      await notifyRecruiter(
        iv,
        'interview_rescheduled',
        'Interview umgebucht',
        `Der Kunde hat das Interview für "${iv.jobTitle}" auf ${new Date(form.scheduled_at).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })} gelegt. Bitte den Kandidaten informieren.`,
      );
      toast.success('Termin gespeichert – der Recruiter informiert den Kandidaten.');
    } else {
      toast.success('Interview aktualisiert');
    }
    refetch();
    return true;
  };

  return { processing, notifyRecruiter, remind, noShow, saveEdit };
}
