import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('clientInterviews');
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
    if (!iso) return setCheck({ state: 'error', message: t('custom.format') });
    if (selected.some((s) => Date.parse(s) === Date.parse(iso))) return setCheck({ state: 'error', message: t('custom.already') });
    const id = ++seq.current;
    setCheck({ state: 'checking', iso });
    const timer = window.setTimeout(() => {
      onCheckTime(iso)
        .then((result) => { if (id === seq.current) setCheck({ state: 'done', iso, result }); })
        .catch((e) => { if (id === seq.current) setCheck({ state: 'error', message: e instanceof Error ? e.message : t('custom.checkFailed') }); });
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

  let status: ReactNode = <span className="text-muted-foreground">{t('custom.enter')}</span>;
  let action: ReactNode = null;
  if (check.state === 'checking') {
    status = <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('custom.checking')}</span>;
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
          {r.status === 'booked' ? t('custom.overlapInterview', { range }) : t('custom.overlapOutlook', { range })}
        </span>
      );
    } else {
      const notes = [
        !r.inHours ? t('custom.outsideHours') : '',
        r.shortNotice ? t('custom.shortNotice') : '',
        r.missing.length ? t('custom.notThere', { names: r.missing.join(', ') }) : '',
      ].filter(Boolean);
      status = unchecked ? (
        <span className="inline-flex items-center gap-1 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" /> {r.connected ? t('custom.uncheckedUnreadable', { range }) : t('custom.uncheckedNotConnected', { range })}
          {notes.length ? ` · ${notes.join(' · ')}` : ''}
        </span>
      ) : notes.length ? (
        <span className="inline-flex items-center gap-1 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" /> {t('custom.free', { range })} · {notes.join(' · ')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="h-3.5 w-3.5" /> {t('custom.free', { range })}
        </span>
      );
      const hesitant = unchecked || !r.inHours || r.shortNotice;
      action = full ? (
        <span className="text-xs text-muted-foreground">{t('grid.max', { n: MAX_PROPOSALS })}</span>
      ) : (
        <Button type="button" size="sm" variant={hesitant ? 'outline' : 'default'} className="h-8" onClick={() => add(check.iso)}>
          {hesitant ? t('custom.addAnyway') : t('custom.add')}
        </Button>
      );
    }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-medium text-muted-foreground">{t('custom.dayTime', { day: dayLabel })}</span>
        <Input
          type="time"
          step={900}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          className="h-8 w-28"
          aria-label={t('custom.timeAria', { day: dayLabel })}
          autoFocus
        />
        <span className="min-w-0 flex-1 text-xs">{status}</span>
        {action}
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t('custom.closeAria')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
