import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { fmtRange, interviewApi } from '@/lib/interviewScheduling';
import { CandidateName } from './CandidateIdentity';
import { toast } from 'sonner';
import { ArrowLeftRight, CalendarCheck, Loader2, MessageSquareQuote } from 'lucide-react';

interface Props {
  interview: AgendaInterview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  /** öffnet „Interview anfragen“ mit neuen Terminen (ersetzt diese Anfrage) */
  onProposeNew: (iv: AgendaInterview) => void;
}

/** Der Kandidat fragt eine andere Zeit an (counter_slots[0]) – hier bestätigt der
 *  Kunde sie (Termin steht, Einladungen mit Teams-Link gehen raus) oder schlägt
 *  neue Termine vor. */
export function CounterProposalDialog({ interview: iv, open, onOpenChange, onDone, onProposeNew }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  if (!iv) return null;
  const requested = iv.counterSlots[0]?.datetime ?? null;
  const requestedOpen = !!requested && new Date(requested).getTime() > Date.now();

  const confirm = async () => {
    if (!requestedOpen) return;
    setSaving(true);
    try {
      await interviewApi.confirmAlternative(iv.id);
      toast.success('Termin steht. Einladungen mit Teams-Link sind unterwegs.');
      queryClient.invalidateQueries({ queryKey: ['client-interview-agenda'] });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Termin konnte nicht bestätigt werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-warning" />
            Andere Zeit angefragt
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1">
            <CandidateName iv={iv} /> · {iv.jobTitle}
          </DialogDescription>
        </DialogHeader>

        {requested ? (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Der Kandidat fragt an:</p>
            <p className={requestedOpen ? 'mt-0.5 font-medium' : 'mt-0.5 font-medium text-muted-foreground line-through'}>
              {fmtRange(requested, iv.durationMinutes)}
            </p>
          </div>
        ) : null}

        {iv.candidateMessage && (
          <div className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
            <MessageSquareQuote className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="italic text-muted-foreground">„{iv.candidateMessage}“</p>
          </div>
        )}

        {!requestedOpen && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            {requested
              ? 'Die angefragte Zeit liegt inzwischen in der Vergangenheit. Bitte schlagen Sie neue Termine vor.'
              : 'Der Kandidat hat keine konkrete Zeit genannt. Bitte schlagen Sie neue Termine vor.'}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant={requestedOpen ? 'ghost' : 'default'}
            className={requestedOpen ? 'text-muted-foreground' : undefined}
            disabled={saving}
            onClick={() => {
              onOpenChange(false);
              onProposeNew(iv);
            }}
          >
            Neue Termine vorschlagen
          </Button>
          {requestedOpen && (
            <Button onClick={confirm} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
              Zeit bestätigen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
