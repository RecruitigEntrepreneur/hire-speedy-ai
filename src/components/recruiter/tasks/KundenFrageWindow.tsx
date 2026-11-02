import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { offerApi, type RecruiterOfferContext } from '@/lib/offerApi';

/**
 * Kunde ist noch unsicher (02.11.2026): seine Frage, „anrufen“ für den Kandidaten und die Antwort.
 * Die Antwort läuft über client-question; danach entscheidet der Kunde sofort. Der Headhunter
 * benachrichtigt den Kunden, er ruft ihn nicht an.
 */
export function KundenFrageWindow({ submissionId, onClose, onDone, onNachgespraech, laterSlot }: {
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
  onNachgespraech?: (c: RecruiterOfferContext) => void;
  laterSlot?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const ctx = useQuery({
    queryKey: ['offer-recruiter-context', submissionId],
    queryFn: () => offerApi.recruiterContext(submissionId!),
    enabled: !!submissionId,
    staleTime: 10_000,
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const c = ctx.data;
  const name = (c?.candidateName ?? '').split(' ')[0] || 'der Kandidat';
  const fb = c?.clientFeedback;

  const send = async () => {
    if (!c) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-question', { body: { action: 'answer', submission_id: c.submissionId, text: text.trim() } });
      const failure = error?.message || (data as { error?: string } | null)?.error;
      if (failure) throw new Error(failure);
      toast.success(`Deine Antwort ist bei ${c.companyName}.`);
      setText('');
      queryClient.invalidateQueries({ queryKey: ['offer-recruiter-context', c.submissionId] });
      notifyTasksChanged();
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Antwort konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!submissionId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {!c ? (
          <>
            <DialogHeader><DialogTitle>Frage des Kunden</DialogTitle><DialogDescription>wird geladen …</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : 'Konnte nicht geladen werden.'}</p>
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Frage von {c.companyName} zu {c.candidateName}</DialogTitle>
              <DialogDescription>{c.jobTitle}</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              {fb?.impression && <p className="text-muted-foreground">Eindruck: „{fb.impression}“</p>}
              <p className="font-medium">{fb?.question ? `„${fb.question}“` : `${c.companyName} ist noch unsicher und hat keine genaue Frage genannt.`}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {onNachgespraech && c.lastInterview ? (
                <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onNachgespraech(c); }}>
                  {c.nachgespraech ? 'Dein Nachgespräch ansehen' : 'Nachgespräch führen'}
                </button>
              ) : <span />}
              {c.candidatePhone && (
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                  <a href={`tel:${c.candidatePhone}`}><Phone className="h-3 w-3" />{name} anrufen</a>
                </Button>
              )}
            </div>
            <label className="block text-sm">
              <span className="text-muted-foreground">Antwort an {c.companyName}</span>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} className="mt-1" placeholder="Was du herausgefunden hast" />
            </label>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              {laterSlot}
              <Button disabled={busy || text.trim().length < 2} onClick={() => void send()}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Antwort senden
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
