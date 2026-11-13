import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { errorText, fmtDayShort, pauseJob } from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

const DURATIONS = [1, 2, 4];

/** Gespeicherte Werte (Grund der Pause, sehen die Headhunter); angezeigt über clientJobs:pause.reason.r<n>. */
const REASONS = [
  'Wir prüfen erst die vorhandenen Kandidaten',
  'Interne Freigabe offen',
  'Anforderungen werden überarbeitet',
  'Urlaub',
];

/** Pausieren mit Ende und Grund (K3). Danach läuft die Stelle von selbst wieder an. */
export function PauseJobDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  jobTitle: string;
  onDone: () => void;
}) {
  const { t } = useTranslation('clientJobs');
  const [weeks, setWeeks] = useState(2);
  const reasonLabel = (r: string) => (r === 'Sonstiges' ? t('pause.other') : t(`pause.reason.r${REASONS.indexOf(r)}`));
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const until = new Date(Date.now() + weeks * 7 * 86_400_000);
  const finalReason = reason === 'Sonstiges' ? other.trim() : reason;

  const confirm = async () => {
    setBusy(true);
    try {
      await pauseJob(jobId, until, finalReason);
      toast.success(t('pause.done', { title: jobTitle, date: fmtDayShort(until.toISOString()) }));
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pause.title')}</DialogTitle>
          <DialogDescription>{jobTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1.5 font-medium">{t('pause.until')}</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(w)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm transition-colors',
                    weeks === w ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50',
                  )}
                >
                  {t('pause.weeks', { count: w })}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-medium">
              {t('pause.why')} <span className="font-normal text-muted-foreground">{t('pause.whyHint')}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {[...REASONS, 'Sonstiges'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r === reason ? '' : r)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                    reason === r ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50',
                  )}
                >
                  {reasonLabel(r)}
                </button>
              ))}
            </div>
            {reason === 'Sonstiges' && (
              <Input className="mt-2" value={other} onChange={(e) => setOther(e.target.value)} placeholder={t('pause.otherPh')} maxLength={120} />
            )}
          </div>
          <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <li>{t('pause.info1', { date: fmtDayShort(until.toISOString()) })}</li>
            <li>{t('pause.info2')}</li>
            <li>{t('pause.info3')}</li>
            <li>{t('pause.info4')}</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={confirm} disabled={busy || (reason === 'Sonstiges' && !other.trim())}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('pause.confirm', { date: fmtDayShort(until.toISOString()) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
