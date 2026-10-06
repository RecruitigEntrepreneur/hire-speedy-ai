import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_PROPOSALS, fmtTime, type CheckTimeResult } from '@/lib/interviewScheduling';
import { berlinLocalToIso } from '@/lib/interviewRequestUtils';

interface Props {
  dayKey: string;
  dayLabel: string;
  durationMinutes: number;
  selected: string[];
  onAdd: (iso: string) => void;
  onClose: () => void;
  onCheckTime: (iso: string) => Promise<CheckTimeResult>;
}

type Check =
  | { state: 'idle' }
  | { state: 'checking'; iso: string }
  | { state: 'done'; iso: string; result: CheckTimeResult }
  | { state: 'error'; message: string };

/**
 * „+ Uhrzeit“ unter einer Tagesspalte: eigene Startzeit (15-Minuten-Schritte),
 * sofort geprüft wie eine Kachel im Raster.
 */
export function CustomTimeRow({ dayKey, dayLabel, durationMinutes, selected, onAdd, onClose, onCheckTime }: Props) {
  const [time, setTime] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const seq = useRef(0);

  useEffect(() => {
    setTime('');
    setCheck({ state: 'idle' });
  }, [dayKey, durationMinutes]);

  useEffect(() => {
    if (!/^\d{1,2}:\d{2}$/.test(time)) return setCheck({ state: 'idle' });
    const iso = berlinLocalToIso(dayKey, time);
    if (!iso) return setCheck({ state: 'error', message: 'Bitte eine Uhrzeit im Format HH:MM eingeben.' });
    if (selected.some((s) => Date.parse(s) === Date.parse(iso))) return setCheck({ state: 'error', message: 'Diese Zeit ist schon ausgewählt.' });
    const id = ++seq.current;
    setCheck({ state: 'checking', iso });
    const timer = window.setTimeout(() => {
      onCheckTime(iso)
        .then((result) => { if (id === seq.current) setCheck({ state: 'done', iso, result }); })
        .catch((e) => { if (id === seq.current) setCheck({ state: 'error', message: e instanceof Error ? e.message : 'Die Zeit konnte nicht geprüft werden.' }); });
    }, 350);
    return () => window.clearTimeout(timer);
    // onCheckTime ändert sich mit jedem Render des Formulars; geprüft wird bei neuer Eingabe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, dayKey, durationMinutes, selected.length]);

  const full = selected.length >= MAX_PROPOSALS;
  const add = (iso: string) => {
    onAdd(iso);
    onClose();
  };

  let status: ReactNode = <span className="text-muted-foreground">Uhrzeit eingeben, z. B. 14:30</span>;
  let action: ReactNode = null;
  if (check.state === 'checking') {
    status = <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> wird geprüft …</span>;
  } else if (check.state === 'error') {
    status = <span className="text-destructive">{check.message}</span>;
  } else if (check.state === 'done') {
    const r = check.result;
    const range = `${fmtTime(r.start)}–${fmtTime(new Date(Date.parse(r.start) + durationMinutes * 60000).toISOString())}`;
    const unchecked = !r.connected || !r.selfVisible;
    if (r.status === 'busy' || r.status === 'booked') {
      status = (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
          {r.status === 'booked' ? `${range} überschneidet sich mit einem Matchunt-Interview` : `${range} überschneidet sich mit einem Termin in Outlook`}
        </span>
      );
    } else {
      const notes = [
        !r.inHours ? 'außerhalb Ihrer Interview-Zeiten' : '',
        r.shortNotice ? 'kurzfristig' : '',
        r.missing.length ? `nicht dabei: ${r.missing.join(', ')}` : '',
      ].filter(Boolean);
      status = unchecked ? (
        <span className="inline-flex items-center gap-1 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" /> {range} ungeprüft – Outlook nicht {r.connected ? 'lesbar' : 'verbunden'}
          {notes.length ? ` · ${notes.join(' · ')}` : ''}
        </span>
      ) : notes.length ? (
        <span className="inline-flex items-center gap-1 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" /> {range} frei · {notes.join(' · ')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="h-3.5 w-3.5" /> {range} frei
        </span>
      );
      const hesitant = unchecked || !r.inHours || r.shortNotice;
      action = full ? (
        <span className="text-xs text-muted-foreground">Höchstens {MAX_PROPOSALS} Vorschläge</span>
      ) : (
        <Button type="button" size="sm" variant={hesitant ? 'outline' : 'default'} className="h-8" onClick={() => add(check.iso)}>
          {hesitant ? 'Trotzdem hinzufügen' : 'Hinzufügen'}
        </Button>
      );
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium text-muted-foreground">{dayLabel} · Uhrzeit</span>
        <Input
          type="time"
          step={900}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          className="h-8 w-28"
          aria-label={`Uhrzeit am ${dayLabel}`}
          autoFocus
        />
        <span className="min-w-0 flex-1 text-xs">{status}</span>
        {action}
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Uhrzeit-Eingabe schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
