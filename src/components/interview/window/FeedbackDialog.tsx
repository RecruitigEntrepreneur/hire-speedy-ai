import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtDayLong, interviewApi, type FeedbackWay } from '@/lib/interviewScheduling';
import { useLiveInterviewNotes } from '@/hooks/useLiveInterviewNotes';
import { FeedbackPanel } from './FeedbackPanel';
import { ContextView } from '@/components/client/tasks/ClientTaskParts';
import type { TaskContext, TaskFact } from '@/lib/clientTasksApi';

interface Props {
  interviewId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  /** Nach dem Speichern: nächste Runde, Angebot, Absage (unsicher schließt nur) */
  onNext: (way: FeedbackWay) => void;
  onSaved?: () => void;
  /** Gedächtnisstütze aus der Kunden-Aufgabe (Notizen, Runde davor); Termin steht schon im Kopf */
  context?: TaskContext | null;
}


/** Das Gespräch selbst steht schon oben; Schlüssel statt Etikett, weil das Etikett übersetzt kommt (ohne Schlüssel: Server vor dem Deploy). */
const notMeeting = (f: TaskFact) => (f.key ? f.key !== 'meeting' : f.label !== 'Gespräch');

/** Feedback nach dem Gespräch als Fenster in der Mitte (aus Profil und Agenda). */
export function FeedbackDialog({ interviewId, open, onOpenChange, candidateName, onNext, onSaved, context }: Props) {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ['interview-details', interviewId],
    queryFn: () => interviewApi.details(interviewId!),
    enabled: open && !!interviewId,
    staleTime: 30_000,
  });
  const notes = useLiveInterviewNotes(open ? interviewId : null);
  const d = details.data;
  const first = candidateName.split(' ')[0] || candidateName;
  const people = d?.attendees.map((a) => a.name).filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{d && d.round > 1 ? t('feedbackDialog.titleRound', { n: d.round, name: first }) : t('feedbackDialog.title', { name: first })}</DialogTitle>
          <DialogDescription>
            {d?.scheduledAt ? `${fmtDayLong(d.scheduledAt)} · ${t(`interviews:meeting.${d.format}`)}` : ''}{people ? t('feedbackDialog.with', { people }) : ''}
          </DialogDescription>
        </DialogHeader>
        {context && context.facts.some(notMeeting) && (
          <ContextView context={{ ...context, facts: context.facts.filter(notMeeting), line: [], why: null, foot: null }} />
        )}
        {details.isLoading || !d ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t('feedbackDialog.loading')}</p>
        ) : (
          <FeedbackPanel
            interviewId={d.id}
            round={d.round}
            candidateName={candidateName}
            recruiterName={d.recruiterName}
            feedback={d.feedback ?? null}
            questionAnswer={d.questionAnswer ?? null}
            started={!!d.scheduledAt && Date.parse(d.scheduledAt) <= Date.now()}
            notes={notes.notes}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['interview-details', d.id] });
              queryClient.invalidateQueries({ queryKey: ['client-interview-agenda'] });
              queryClient.invalidateQueries({ queryKey: ['submission-state'] });
              queryClient.invalidateQueries({ queryKey: ['bewerber'] });
              onSaved?.();
            }}
            onNext={(way) => {
              onOpenChange(false);
              if (way !== 'unsure') onNext(way);
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
