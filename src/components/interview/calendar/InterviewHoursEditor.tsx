import { useId, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { dfLocale, fmtDate as fmtDay } from '@/lib/localeFormat';
import type { DateRange } from 'react-day-picker';
import { CalendarPlus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { weekdayLabel, type InterviewHoursRules, type Weekday } from '@/lib/interviewScheduling';

const WORKDAYS: Weekday[] = ['1', '2', '3', '4', '5'];
const WEEKEND: Weekday[] = ['6', '7'];

// Beschriftungen beim Aufruf übersetzt (Namespace interviews); die Werte bleiben Zahlen.
const hx = (key: string, options?: Record<string, unknown>) => i18n.t(`interviews:hours.${key}`, options);
const bufferOptions = () => [{ value: 0, label: hx('bufferNone') }, ...[5, 10, 15].map((n) => ({ value: n, label: hx('bufferMinutes', { n }) }))];
const noticeDefault = () => [{ value: 0, label: hx('noticeNow') }, { value: 24, label: hx('noticeTomorrow') }, { value: 48, label: hx('noticeTwoDays') }];
const horizonOptions = () => [{ value: 7, label: hx('horizonWeek') }, { value: 14, label: hx('horizonWeeks', { n: 2 }) }, { value: 21, label: hx('horizonWeeks', { n: 3 }) }, { value: 30, label: hx('horizonDays', { n: 30 }) }];

/** HH:MM ± Minuten, begrenzt auf den Tag. */
function shift(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Vorschlag für ein neues Fenster: morgens, oder im Anschluss an das letzte. */
function suggestWindow(windows: [string, string][]): [string, string] {
  if (!windows.length) return ['09:00', '12:00'];
  const lastEnd = windows[windows.length - 1][1];
  const start = shift(lastEnd, 60);
  return [start, shift(start, 180)];
}

const fmtDate = (ymd: string) => fmtDay(new Date(`${ymd}T12:00:00`));
const fmtAbsence = (a: { from: string; to: string }) => (a.from === a.to ? fmtDate(a.from) : `${fmtDate(a.from)} – ${fmtDate(a.to)}`);

function ChoiceChips({ label, options, value, onChange, compact }: {
  label: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  // Ein Wert vom Server, der in keiner Auswahl steht, bleibt sichtbar statt still zu verschwinden.
  const list = options.some((o) => o.value === value) ? options : [...options, { value, label: String(value) }];
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', compact ? 'text-xs' : 'text-sm')}>
      <span className={cn('text-muted-foreground', compact ? 'w-28' : 'w-36')}>{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {list.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-full border px-2.5 transition-colors',
              compact ? 'py-0.5 text-xs' : 'py-1 text-xs',
              o.value === value
                ? 'border-primary bg-primary/10 font-medium text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddWindow({ day, windows, onAdd, compact }: {
  day: Weekday;
  windows: [string, string][];
  onAdd: (w: [string, string]) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation('interviews');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('12:00');

  const error = !from || !to
    ? t('hours.errorBoth')
    : from >= to
    ? t('hours.errorOrder')
    : windows.some(([a, b]) => from < b && a < to)
    ? t('hours.errorOverlap')
    : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) { const [a, b] = suggestWindow(windows); setFrom(a); setTo(b); }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('hours.addWindowAria', { day: weekdayLabel(day) })}
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary',
            compact ? 'h-6 w-6' : 'h-7 w-7',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <p className="text-sm font-medium">{t('hours.windowTitle', { day: weekdayLabel(day) })}</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (error) return;
            onAdd([from, to]);
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-von`} className="text-xs">{t('hours.from')}</Label>
              <Input id={`${id}-von`} type="time" step={300} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-bis`} className="text-xs">{t('hours.to')}</Label>
              <Input id={`${id}-bis`} type="time" step={300} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" className="w-full" disabled={!!error}>{t('hours.add')}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function AddAbsence({ onAdd }: { onAdd: (a: { from: string; to: string }) => void }) {
  const { t } = useTranslation('interviews');
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Popover open={open} onOpenChange={(next) => { if (next) setRange(undefined); setOpen(next); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <CalendarPlus className="h-4 w-4" /> {t('hours.addAbsence')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          locale={dfLocale()}
          selected={range}
          onSelect={setRange}
          disabled={{ before: today }}
          defaultMonth={range?.from ?? today}
          initialFocus
        />
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {range?.from
              ? fmtAbsence({ from: format(range.from, 'yyyy-MM-dd'), to: format(range.to ?? range.from, 'yyyy-MM-dd') })
              : t('hours.pickRange')}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!range?.from}
            onClick={() => {
              if (!range?.from) return;
              onAdd({ from: format(range.from, 'yyyy-MM-dd'), to: format(range.to ?? range.from, 'yyyy-MM-dd') });
              setOpen(false);
            }}
          >
            {t('hours.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Interview-Zeiten des Kunden: Wochenraster mit Zeitfenstern je Tag, Puffer,
 * Vorlauf, Planungshorizont, Feiertage und Abwesenheiten. Rein kontrolliert --
 * Laden und Speichern macht der Aufrufer (useInterviewHours).
 */
export function InterviewHoursEditor({ value, onChange, compact, noticeOptions }: {
  value: InterviewHoursRules;
  onChange: (v: InterviewHoursRules) => void;
  compact?: boolean;
  /** Auswahl „Frühester Termin“; die Terminseite des Headhunters rechnet in Stunden (21.10.2026). */
  noticeOptions?: { value: number; label: string }[];
}) {
  const { t } = useTranslation('interviews');
  const holidayId = useId();
  const weekendUsed = WEEKEND.some((d) => (value.weekly[d]?.length ?? 0) > 0);
  const [weekendOpen, setWeekendOpen] = useState(weekendUsed);
  const days = weekendOpen || weekendUsed ? [...WORKDAYS, ...WEEKEND] : WORKDAYS;

  const setDay = (day: Weekday, windows: [string, string][]) => {
    const weekly = { ...value.weekly };
    if (windows.length) weekly[day] = [...windows].sort((a, b) => a[0].localeCompare(b[0]));
    else delete weekly[day];
    onChange({ ...value, weekly });
  };

  const section = (title: string, children: ReactNode) => (
    <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      <p className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      {children}
    </div>
  );

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {section(t('hours.weekdays'), (
        <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
          {days.map((day) => {
            const windows = value.weekly[day] ?? [];
            return (
              <div key={day} className={cn('flex flex-wrap items-center gap-1.5', compact ? 'min-h-7' : 'min-h-8')}>
                <span className={cn('w-8 shrink-0 font-medium', compact ? 'text-xs' : 'text-sm')}>{weekdayLabel(day)}</span>
                {windows.length === 0 && <span className="text-xs text-muted-foreground">{t('hours.none')}</span>}
                {windows.map(([from, to], i) => (
                  <span
                    key={`${from}-${to}`}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 pl-2.5 pr-1 tabular-nums',
                      compact ? 'py-0 text-xs' : 'py-0.5 text-xs',
                    )}
                  >
                    {from}–{to}
                    <button
                      type="button"
                      aria-label={t('hours.removeWindowAria', { day: weekdayLabel(day), from, to })}
                      onClick={() => setDay(day, windows.filter((_, j) => j !== i))}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <AddWindow day={day} windows={windows} compact={compact} onAdd={(w) => setDay(day, [...windows, w])} />
              </div>
            );
          })}
          {!weekendOpen && !weekendUsed && (
            <button
              type="button"
              onClick={() => setWeekendOpen(true)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {t('hours.weekendAdd')}
            </button>
          )}
          {weekendOpen && !weekendUsed && (
            <button
              type="button"
              onClick={() => setWeekendOpen(false)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {t('hours.weekendHide')}
            </button>
          )}
        </div>
      ))}

      {section(t('hours.rules'), (
        <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
          <ChoiceChips label={t('hours.buffer')} compact={compact} options={bufferOptions()} value={value.bufferMinutes}
                       onChange={(v) => onChange({ ...value, bufferMinutes: v })} />
          <ChoiceChips label={t('hours.notice')} compact={compact} options={noticeOptions ?? noticeDefault()} value={value.minNoticeHours}
                       onChange={(v) => onChange({ ...value, minNoticeHours: v })} />
          <ChoiceChips label={t('hours.horizon')} compact={compact} options={horizonOptions()} value={value.horizonDays}
                       onChange={(v) => onChange({ ...value, horizonDays: v })} />
          <div className={cn('flex items-center gap-3', compact ? 'text-xs' : 'text-sm')}>
            <Switch
              id={holidayId}
              checked={value.skipHolidays}
              onCheckedChange={(checked) => onChange({ ...value, skipHolidays: checked })}
            />
            <Label htmlFor={holidayId} className={cn('font-normal', compact ? 'text-xs' : 'text-sm')}>
              {t('hours.holidays')}
            </Label>
          </div>
        </div>
      ))}

      {!compact && section(t('hours.absences'), (
        <div className="space-y-2">
          {value.absences.length === 0 && <p className="text-xs text-muted-foreground">{t('hours.noAbsences')}</p>}
          {value.absences.length > 0 && (
            <ul className="space-y-1">
              {value.absences.map((a, i) => (
                <li key={`${a.from}-${a.to}-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="tabular-nums">{fmtAbsence(a)}</span>
                  <button
                    type="button"
                    aria-label={t('hours.removeAbsenceAria', { range: fmtAbsence(a) })}
                    onClick={() => onChange({ ...value, absences: value.absences.filter((_, j) => j !== i) })}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddAbsence
            onAdd={(a) => onChange({
              ...value,
              absences: [...value.absences, a].sort((x, y) => x.from.localeCompare(y.from)),
            })}
          />
        </div>
      ))}
    </div>
  );
}
