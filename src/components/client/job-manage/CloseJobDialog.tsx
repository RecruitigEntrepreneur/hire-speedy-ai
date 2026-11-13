import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

/** Beschriftung unter clientJobs:close.choice.<key>. */
const CHOICES: Choice[] = ['filled_via_matchunt', 'filled_elsewhere', 'no_candidates', 'cancelled', 'temporary'];

/** Gespeicherte Werte (gehen in die Notiz an Matchunt); angezeigt über clientJobs:close.how.h<n>. */
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
  const { t } = useTranslation('clientJobs');
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
      toast.success(choice === 'filled_via_matchunt' ? t('close.hireReported') : t('close.closed'));
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
      toast.success(t('close.callbackDone'));
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
          <DialogTitle>{t('close.title')}</DialogTitle>
          <DialogDescription>{jobTitle}</DialogDescription>
        </DialogHeader>

        {step === 'reason' && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">{t('close.why')}</p>
            {CHOICES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setChoice(key)}
                className={cn(
                  'block w-full rounded-md border px-3 py-2 text-left transition-colors',
                  choice === key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                )}
              >
                {t(`close.choice.${key}`)}
                {key === 'temporary' && <span className="block text-xs text-muted-foreground">{t('close.pauseBetter')}</span>}
              </button>
            ))}
          </div>
        )}

        {step === 'detail' && choice === 'filled_via_matchunt' && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{t('close.withWhom')}</p>
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('close.noCandidates')}</p>
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
                <Label htmlFor="hire-start" className="text-xs">{t('close.startDate')}</Label>
                <Input id="hire-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hire-salary" className="text-xs">{t('close.salary')}</Label>
                <Input id="hire-salary" inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder={t('close.salaryPh')} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('close.hireNote')}</p>
          </div>
        )}

        {step === 'detail' && choice === 'filled_elsewhere' && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{t('close.how.title')}</p>
            <div className="flex flex-wrap gap-2">
              {ELSEWHERE.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHow(h)}
                  className={cn('rounded-md border px-2.5 py-1 text-xs', how === h ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50')}
                >
                  {t(`close.how.h${ELSEWHERE.indexOf(h)}`)}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox checked={notMatchunt} onCheckedChange={(v) => setNotMatchunt(v === true)} className="mt-0.5" />
              <span className="text-xs">{t('close.notMatchunt')}</span>
            </label>
            <p className="text-xs text-muted-foreground">
              {t('close.wasMatchunt')}{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setChoice('filled_via_matchunt')}>
                {t('close.thisWay')}
              </button>
            </p>
          </div>
        )}

        {step === 'detail' && choice === 'no_candidates' && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{t('close.before')}</p>
            <p className="text-muted-foreground">
              {t('close.beforeLead')}
            </p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('close.notePh')} rows={2} />
            <Button variant="default" className="w-full gap-1.5" disabled={busy} onClick={callback}>
              <PhoneCall className="h-4 w-4" />
              {t('close.callback')}
            </Button>
          </div>
        )}

        {step === 'detail' && choice === 'cancelled' && (
          <div className="space-y-2 text-sm">
            <Label htmlFor="close-note" className="text-xs">{t('close.noteLabel')}</Label>
            <Textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        )}

        {step === 'detail' && choice !== 'filled_via_matchunt' && (
          <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <li>{t('close.info1')}</li>
            <li>{t('close.info2')}</li>
            <li>{t('close.info3')}</li>
          </ul>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {step === 'detail' ? (
            <Button variant="ghost" className="gap-1" onClick={() => setStep('reason')} disabled={busy}>
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
          )}
          {step === 'reason' ? (
            <Button onClick={next} disabled={!choice}>
              {t('common.next')}
            </Button>
          ) : choice === 'no_candidates' ? (
            <Button variant="outline" className="text-destructive" disabled={busy} onClick={submit}>
              {t('close.closeAnyway')}
            </Button>
          ) : (
            <Button variant={choice === 'filled_via_matchunt' ? 'default' : 'destructive'} disabled={busy || !detailValid} onClick={submit}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {choice === 'filled_via_matchunt' ? t('close.reportHire') : t('close.title')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
