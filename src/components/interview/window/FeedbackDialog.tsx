import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtDayLong, interviewApi, type FeedbackWay } from '@/lib/interviewScheduling';
import { useLiveInterviewNotes } from '@/hooks/useLiveInterviewNotes';
import { FeedbackPanel } from './FeedbackPanel';

interface Props {
  interviewId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  /** Nach dem Speichern: nächste Runde, Angebot, Absage (unsicher schließt nur) */
  onNext: (way: FeedbackWay) => void;
  onSaved?: () => void;
}

const FORMAT = { teams: 'Teams', phone: 'Telefon', onsite: 'Vor Ort' } as const;

/** Feedback nach dem Gespräch als Fenster in der Mitte (aus Profil und Agenda). */
export function FeedbackDialog({ interviewId, open, onOpenChange, candidateName, onNext, onSaved }: Props) {
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
          <DialogTitle>Wie war {d && d.round > 1 ? `Interview ${d.round}` : 'das Interview'} mit {first}?</DialogTitle>
          <DialogDescription>
            {d?.scheduledAt ? `${fmtDayLong(d.scheduledAt)} · ${FORMAT[d.format]}` : ''}{people ? ` · mit ${people}` : ''}
          </DialogDescription>
        </DialogHeader>
        {details.isLoading || !d ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>
        ) : (
          <FeedbackPanel
            interviewId={d.id}
            round={d.round}
            candidateName={candidateName}
            recruiterName={d.recruiterName}
            feedback={d.feedback ?? null}
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
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
