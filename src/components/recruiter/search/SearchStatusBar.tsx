import { useCallback, useEffect, useState } from 'react';
import { Clock, HelpCircle, PauseCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { daysUntil, endJobSearch, errorText, fmtDayShort, mySearches, type MySearch } from '@/lib/jobSearch';
import { ClientQuestionFlow } from './ClientQuestionFlow';

/**
 * Stand der eigenen Suche auf der Stellenseite: Frist, Pause, offene Kundenfrage,
 * Suche beenden. Ohne Suche zeigt die Leiste nichts (der Einreichen-Knopf startet sie).
 */
export function SearchStatusBar({ jobId, jobTitle, onChanged }: { jobId: string; jobTitle: string; onChanged?: () => void }) {
  const { toast } = useToast();
  const [row, setRow] = useState<MySearch | null>(null);
  const [question, setQuestion] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await mySearches();
      setRow((rows ?? []).find((r) => r.job_id === jobId) ?? null);
    } catch {
      setRow(null);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!row || row.status === 'ended') return null;

  const openQuestion = !row.client_declaration && !row.review_hold;
  const days = daysUntil(row.ends_at);
  let text: string;
  let Icon = Search;
  if (row.status === 'paused') {
    Icon = PauseCircle;
    text = row.review_hold
      ? 'Deine Suche ruht: Matchunt prüft „Stelle schon direkt“.'
      : `Deine Suche ruht: Der Kunde hat pausiert${row.job_paused_until ? ` bis ${fmtDayShort(row.job_paused_until)}` : ''}.`;
  } else if (row.submissions > 0) {
    text = `Du suchst · ${row.submissions} ${row.submissions === 1 ? 'Kandidat' : 'Kandidaten'} eingereicht · belegt keinen Platz`;
  } else {
    Icon = Clock;
    text = `Du suchst · noch ${days ?? 30} ${days === 1 ? 'Tag' : 'Tage'} für deine erste Einreichung`;
  }

  const end = async () => {
    setBusy(true);
    try {
      await endJobSearch(jobId);
      toast({ title: 'Suche beendet' });
      setConfirmEnd(false);
      await load();
      onChanged?.();
    } catch (err) {
      toast({ title: 'Beenden hat nicht geklappt', description: errorText(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">{text}</span>
        {openQuestion && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setQuestion(true)}>
            <HelpCircle className="h-3.5 w-3.5" />
            Ist {row.company_name || 'das Unternehmen'} schon dein Kunde?
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setConfirmEnd(true)}>
          Suche beenden
        </Button>
      </div>

      <Dialog open={question} onOpenChange={setQuestion}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{jobTitle}</DialogTitle>
            <DialogDescription>Bitte vor der ersten Einreichung beantworten.</DialogDescription>
          </DialogHeader>
          <ClientQuestionFlow
            jobId={jobId}
            jobTitle={jobTitle}
            companyName={row.company_name}
            onDone={() => {
              setQuestion(false);
              void load();
              onChanged?.();
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suche beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              {row.submissions > 0
                ? 'Deine eingereichten Kandidaten laufen weiter. Neue Einreichungen gehen erst nach erneutem „Ich suche“.'
                : 'Ohne Einreichung bleibt der Platz bis 30 Tage nach deinem „Ich suche“ belegt. Der Kunde sieht dich weiter als „hat gesucht“.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void end();
              }}
            >
              Suche beenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
