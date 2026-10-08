import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { errorText, fmtDayShort, pauseJob } from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

const DURATIONS = [
  { weeks: 1, label: '1 Woche' },
  { weeks: 2, label: '2 Wochen' },
  { weeks: 4, label: '4 Wochen' },
];

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
  const [weeks, setWeeks] = useState(2);
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const until = new Date(Date.now() + weeks * 7 * 86_400_000);
  const finalReason = reason === 'Sonstiges' ? other.trim() : reason;

  const confirm = async () => {
    setBusy(true);
    try {
      await pauseJob(jobId, until, finalReason);
      toast.success(`„${jobTitle}“ pausiert bis ${fmtDayShort(until.toISOString())}`);
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
          <DialogTitle>Stelle pausieren</DialogTitle>
          <DialogDescription>{jobTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1.5 font-medium">Bis wann?</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.weeks}
                  type="button"
                  onClick={() => setWeeks(d.weeks)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm transition-colors',
                    weeks === d.weeks ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-medium">
              Warum? <span className="font-normal text-muted-foreground">(hilft den Headhuntern)</span>
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
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Sonstiges' && (
              <Input className="mt-2" value={other} onChange={(e) => setOther(e.target.value)} placeholder="Kurz beschreiben" maxLength={120} />
            )}
          </div>
          <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <li>Bis zum {fmtDayShort(until.toISOString())} kommen keine neuen Kandidaten.</li>
            <li>Laufende Kandidaten, Interviews und Angebote gehen weiter.</li>
            <li>Die Headhunter erfahren es, ihre Suche ruht mit.</li>
            <li>Danach läuft die Stelle wieder an. 3 Tage vorher fragen wir Sie: verlängern oder schließen?</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={confirm} disabled={busy || (reason === 'Sonstiges' && !other.trim())}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Pausieren bis {fmtDayShort(until.toISOString())}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
