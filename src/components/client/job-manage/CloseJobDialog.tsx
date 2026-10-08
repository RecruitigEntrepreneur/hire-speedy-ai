import { useState } from 'react';
import { ArrowLeft, Loader2, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { closeJob, errorText, requestCallback, type CloseReason } from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

export interface CloseCandidate {
  submissionId: string;
  label: string;
}

type Choice = CloseReason | 'temporary';

const CHOICES: { key: Choice; label: string }[] = [
  { key: 'filled_via_matchunt', label: 'Besetzt mit einem Kandidaten von Matchunt' },
  { key: 'filled_elsewhere', label: 'Anderweitig besetzt' },
  { key: 'no_candidates', label: 'Keine passenden Kandidaten, dauert zu lange' },
  { key: 'cancelled', label: 'Stelle entfällt (Budget, Umstrukturierung)' },
  { key: 'temporary', label: 'Nur vorübergehend' },
];

const ELSEWHERE = ['Intern', 'Eigene Bewerbung', 'Andere Agentur', 'Sonstiges'];

/**
 * Schließen mit Grund (K4): je nach Grund ein zweiter Schritt. Besetzt mit unserem
 * Kandidaten meldet die Einstellung, anderweitig besetzt verlangt eine Bestätigung,
 * „keine passenden Kandidaten“ bietet erst einen Rückruf an.
 */
export function CloseJobDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  candidates,
  onClosed,
  onPauseInstead,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  jobTitle: string;
  candidates: CloseCandidate[];
  onClosed: () => void;
  onPauseInstead: () => void;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [step, setStep] = useState<'reason' | 'detail' | 'confirm'>('reason');
  const [hire, setHire] = useState<string>('');
  const [start, setStart] = useState('');
  const [salary, setSalary] = useState('');
  const [how, setHow] = useState('');
  const [notMatchunt, setNotMatchunt] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setChoice(null);
    setStep('reason');
    setHire('');
    setStart('');
    setSalary('');
    setHow('');
    setNotMatchunt(false);
    setNote('');
  };

  const handleOpenChange = (o: boolean) => {
    if (busy) return;
    onOpenChange(o);
    if (!o) reset();
  };

  const next = () => {
    if (choice === 'temporary') {
      handleOpenChange(false);
      onPauseInstead();
      return;
    }
    setStep('detail');
  };

  const submit = async () => {
    if (!choice || choice === 'temporary') return;
    setBusy(true);
    try {
      await closeJob({
        jobId,
        reason: choice,
        note: choice === 'filled_elsewhere' ? [how, note].filter(Boolean).join(' · ') : note,
        hireSubmissionId: choice === 'filled_via_matchunt' ? hire : null,
        hireStart: choice === 'filled_via_matchunt' && start ? start : null,
        hireSalary: choice === 'filled_via_matchunt' && salary ? Number(salary.replace(/\D/g, '')) || null : null,
        notMatchunt: choice === 'filled_elsewhere' ? notMatchunt : undefined,
      });
      toast.success(choice === 'filled_via_matchunt' ? 'Einstellung gemeldet. Matchunt meldet sich.' : 'Stelle geschlossen');
      handleOpenChange(false);
      onClosed();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const callback = async () => {
    setBusy(true);
    try {
      await requestCallback(jobId, note);
      toast.success('Wir rufen Sie an. Die Stelle bleibt offen.');
      handleOpenChange(false);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const detailValid =
    choice === 'filled_via_matchunt' ? !!hire : choice === 'filled_elsewhere' ? notMatchunt && !!how : true;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stelle schließen</DialogTitle>
          <DialogDescription>{jobTitle}</DialogDescription>
        </DialogHeader>

        {step === 'reason' && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Warum schließen Sie die Stelle?</p>
            {CHOICES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setChoice(c.key)}
                className={cn(
                  'block w-full rounded-md border px-3 py-2 text-left transition-colors',
                  choice === c.key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                )}
              >
                {c.label}
                {c.key === 'temporary' && <span className="block text-xs text-muted-foreground">Dann ist Pausieren die bessere Wahl.</span>}
              </button>
            ))}
          </div>
        )}

        {step === 'detail' && choice === 'filled_via_matchunt' && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Mit wem?</p>
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Für diese Stelle sind noch keine Kandidaten von Matchunt vorgestellt.</p>
            ) : (
              <div className="space-y-1.5">
                {candidates.map((c) => (
                  <label key={c.submissionId} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/40">
                    <input type="radio" name="hire" checked={hire === c.submissionId} onChange={() => setHire(c.submissionId)} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="hire-start" className="text-xs">Startdatum</Label>
                <Input id="hire-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hire-salary" className="text-xs">Jahresgehalt (€)</Label>
                <Input id="hire-salary" inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="z. B. 75000" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Damit melden Sie die Einstellung. Matchunt meldet sich, die Rechnung kommt nach Antritt.</p>
          </div>
        )}

        {step === 'detail' && choice === 'filled_elsewhere' && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Wie haben Sie besetzt?</p>
            <div className="flex flex-wrap gap-2">
              {ELSEWHERE.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHow(h)}
                  className={cn('rounded-md border px-2.5 py-1 text-xs', how === h ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50')}
                >
                  {h}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={notMatchunt} onCheckedChange={(v) => setNotMatchunt(v === true)} className="mt-0.5" />
              <span className="text-xs">Die eingestellte Person wurde uns nicht über Matchunt vorgestellt.</span>
            </label>
            <p className="text-xs text-muted-foreground">
              War es doch ein Kandidat von Matchunt?{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setChoice('filled_via_matchunt')}>
                Dann hier entlang
              </button>
            </p>
          </div>
        )}

        {step === 'detail' && choice === 'no_candidates' && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Bevor Sie schließen</p>
            <p className="text-muted-foreground">
              Oft liegt es am Gehaltsband oder an zu vielen Muss-Kriterien. Sollen wir das kurz mit Ihnen anschauen?
            </p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: Was sollen wir wissen?" rows={2} />
            <Button variant="default" className="w-full gap-1.5" disabled={busy} onClick={callback}>
              <PhoneCall className="h-4 w-4" />
              Rückruf von Matchunt
            </Button>
          </div>
        )}

        {step === 'detail' && choice === 'cancelled' && (
          <div className="space-y-2 text-sm">
            <Label htmlFor="close-note" className="text-xs">Optional: kurzer Hinweis für uns</Label>
            <Textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        )}

        {step === 'detail' && choice !== 'filled_via_matchunt' && (
          <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <li>Die Headhunter werden informiert und suchen nicht weiter.</li>
            <li>Laufende Gespräche führen wir zu Ende, wenn Sie nichts anderes sagen.</li>
            <li>Für bereits vorgestellte Kandidaten gilt die Schutzfrist von 12 Monaten weiter.</li>
          </ul>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === 'detail' ? (
            <Button variant="ghost" className="gap-1" onClick={() => setStep('reason')} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Abbrechen
            </Button>
          )}
          {step === 'reason' ? (
            <Button onClick={next} disabled={!choice}>
              Weiter
            </Button>
          ) : choice === 'no_candidates' ? (
            <Button variant="outline" className="text-destructive" disabled={busy} onClick={submit}>
              Trotzdem schließen
            </Button>
          ) : (
            <Button variant={choice === 'filled_via_matchunt' ? 'default' : 'destructive'} disabled={busy || !detailValid} onClick={submit}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {choice === 'filled_via_matchunt' ? 'Einstellung melden' : 'Stelle schließen'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
