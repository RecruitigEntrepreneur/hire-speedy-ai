import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CandidateName } from './CandidateIdentity';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, CheckCircle2, Loader2, MessageSquareQuote } from 'lucide-react';

interface Props {
  interview: AgendaInterview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  onProposeNew: (iv: AgendaInterview) => void;
}

const slotLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
};

/** Der Kandidat hat Gegenvorschläge gemacht – hier bestätigt der Kunde einen
 *  davon (Interview wird fix terminiert) oder schlägt neue Zeiten vor. */
export function CounterProposalDialog({ interview: iv, open, onOpenChange, onDone, onProposeNew }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!iv) return null;
  const slots = iv.counterSlots.filter((s) => new Date(s.datetime).getTime() > Date.now());
  const expired = iv.counterSlots.length > 0 && slots.length === 0;

  const acceptSlot = async () => {
    if (selected === null || !slots[selected]) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('interviews')
        .update({
          scheduled_at: slots[selected].datetime,
          status: 'scheduled',
          client_confirmed: true,
          client_confirmed_at: new Date().toISOString(),
        })
        .eq('id', iv.id);
      if (error) throw error;

      // Recruiter informieren – er bestätigt dem Kandidaten den Termin.
      const { data: sub } = await supabase
        .from('submissions')
        .select('recruiter_id')
        .eq('id', iv.submissionId)
        .single();
      if (sub?.recruiter_id) {
        await supabase.from('notifications').insert({
          user_id: sub.recruiter_id,
          type: 'interview_scheduled',
          title: 'Gegenvorschlag angenommen',
          message: `Der Kunde hat für "${iv.jobTitle}" den Terminvorschlag ${slotLabel(slots[selected].datetime)} bestätigt. Bitte dem Kandidaten den Termin bestätigen.`,
          related_type: 'interview',
          related_id: iv.id,
        });
      }

      toast.success('Termin bestätigt – der Recruiter informiert den Kandidaten.');
      onOpenChange(false);
      onDone();
    } catch (e) {
      console.error('Counter-Accept-Fehler:', e);
      toast.error('Termin konnte nicht bestätigt werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-destructive" />
            Gegenvorschlag beantworten
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1">
            <CandidateName iv={iv} /> · {iv.jobTitle}
          </DialogDescription>
        </DialogHeader>

        {iv.candidateMessage && (
          <div className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
            <MessageSquareQuote className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="italic text-muted-foreground">„{iv.candidateMessage}"</p>
          </div>
        )}

        {expired ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            Alle vorgeschlagenen Zeiten liegen inzwischen in der Vergangenheit. Bitte neue Slots vorschlagen.
          </p>
        ) : (
          <div className="space-y-2">
            {slots.map((s, i) => (
              <button
                key={s.datetime}
                onClick={() => setSelected(i)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-all',
                  selected === i ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30',
                )}
                aria-pressed={selected === i}
              >
                <span className="font-medium">{slotLabel(s.datetime)}</span>
                {selected === i && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              onOpenChange(false);
              onProposeNew(iv);
            }}
          >
            Neue Slots vorschlagen
          </Button>
          <Button onClick={acceptSlot} disabled={saving || selected === null || expired} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Termin bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
