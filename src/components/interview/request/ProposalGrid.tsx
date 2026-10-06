import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  MAX_PROPOSALS,
  fmtDayShort,
  fmtTime,
  type AvailabilityResult,
  type CalendarStatus,
  type CheckTimeResult,
  type ScheduleSlot,
} from '@/lib/interviewScheduling';
import { addDays, berlinDateKey, dayHeaderLabel, slotText, weekRangeLabel } from '@/lib/interviewRequestUtils';
import { CustomTimeRow } from './CustomTimeRow';

interface Props {
  weekStart: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onWeekChange: (delta: number) => void;
  data: AvailabilityResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
  selected: string[];
  onToggle: (iso: string) => void;
  onAdd: (iso: string) => void;
  peopleCount: number;
  durationMinutes: number;
  /** Eigene Uhrzeit prüfen wie eine Kachel (Outlook, Kollegen, Puffer) */
  onCheckTime: (iso: string) => Promise<CheckTimeResult>;
  calendar: CalendarStatus;
  onConnectCalendar: () => void;
  onOpenHoursSettings: () => void;
}

// Farben über die Theme-Tokens (success/warning): die App ist dunkel zuerst, „dark:“ greift hier im hellen Modus.
const TILE: Record<ScheduleSlot['status'], string> = {
  all: 'border-success/40 bg-success/10 text-foreground hover:bg-success/20',
  required: 'border-warning/50 bg-warning/15 text-foreground hover:bg-warning/25',
  busy: 'cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground',
  booked: 'cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground',
};

const DOT: Record<ScheduleSlot['status'], string> = {
  all: 'bg-success',
  required: 'bg-warning',
  busy: 'bg-muted-foreground/40',
  booked: 'bg-muted-foreground/40',
};

// Freie Zeit ohne gelesenen eigenen Kalender: wählbar, aber nicht grün
const UNCHECKED_TILE = 'border-dashed border-muted-foreground/50 bg-transparent text-foreground hover:bg-muted/40';

const normalizeDayKey = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : berlinDateKey(date));

export function ProposalGrid({
  weekStart, canGoBack, canGoForward, onWeekChange, data, isLoading, isFetching, error, onRetry,
  selected, onToggle, onAdd, peopleCount, durationMinutes, onCheckTime, calendar, onConnectCalendar, onOpenHoursSettings,
}: Props) {
  const [customDay, setCustomDay] = useState<string | null>(null);
  const byKey = new Map((data?.days ?? []).map((d) => [normalizeDayKey(d.date), d]));
  const columns = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => {
      const key = addDays(weekStart, i);
      return { key, label: dayHeaderLabel(key), slots: byKey.get(key)?.slots ?? [] };
    })
    // Sa/So nur, wenn es dort Zeiten gibt
    .filter((c, i) => i < 5 || c.slots.length > 0);
  const lastKey = columns[columns.length - 1].key;
  const todayKey = berlinDateKey(new Date().toISOString());
  const customColumn = columns.find((c) => c.key === customDay) ?? null;
  // Selbst eingegebene Zeiten (keine Kachel im Raster) als gewählte Kachel in ihrer Spalte zeigen
  const customFor = (dayKey: string) => {
    const starts = new Set((byKey.get(dayKey)?.slots ?? []).map((s) => Date.parse(s.start)));
    return selected.filter((iso) => berlinDateKey(iso) === dayKey && !starts.has(Date.parse(iso)));
  };
  type Item = { kind: 'slot'; at: number; slot: ScheduleSlot } | { kind: 'custom'; at: number; iso: string };
  const itemsFor = (dayKey: string, slots: ScheduleSlot[]): Item[] =>
    [
      ...slots.map((slot): Item => ({ kind: 'slot', at: Date.parse(slot.start), slot })),
      ...customFor(dayKey).map((iso): Item => ({ kind: 'custom', at: Date.parse(iso), iso })),
    ].sort((a, b) => a.at - b.at);
  const totalSlots = columns.reduce((n, c) => n + c.slots.length, 0);
  const selectable = columns.reduce((n, c) => n + c.slots.filter((s) => s.status === 'all' || s.status === 'required').length, 0);

  const selectedSet = new Set(selected.map((s) => Date.parse(s)));
  const sortedSelected = [...selected].sort((a, b) => Date.parse(a) - Date.parse(b));
  const full = selected.length >= MAX_PROPOSALS;
  const notConnected = calendar.state !== 'connected';
  // Verbunden, aber der eigene Kalender war nicht lesbar: freie Zeiten sind nur ungeprüft
  const unchecked = !notConnected && !!data && data.selfVisible === false;

  return (
    <div className="space-y-3">
      {notConnected && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="hidden h-4 w-4 shrink-0 text-warning sm:block" />
          <p className="flex-1">
            {calendar.state === 'expired'
              ? 'Ihre Outlook-Verbindung ist abgelaufen. Prüfen Sie Ihre Vorschläge in Outlook. '
              : calendar.state === 'not_configured'
                ? 'Prüfen Sie Ihre Vorschläge in Ihrem Kalender. '
                : 'Ihr Kalender ist nicht verbunden. Prüfen Sie Ihre Vorschläge in Outlook. '}
            Andere Zeiten kann der Kandidat nur anfragen, Sie bestätigen sie.
          </p>
          {calendar.state !== 'not_configured' && (
            <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 bg-background" onClick={onConnectCalendar}>
              {calendar.state === 'expired' ? 'Outlook neu verbinden' : 'Outlook verbinden'}
            </Button>
          )}
        </div>
      )}

      {unchecked && (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="hidden h-4 w-4 shrink-0 text-warning sm:block" />
          <p className="flex-1">
            Ihre Outlook-Termine konnten gerade nicht gelesen werden. Die Zeiten sind ungeprüft – prüfen Sie Ihre Vorschläge in Outlook.
          </p>
          <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 bg-background" onClick={onConnectCalendar}>
            Outlook neu verbinden
          </Button>
        </div>
      )}

      {/* Wochennavigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange(-1)}
            disabled={!canGoBack}
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium tabular-nums">{weekRangeLabel(weekStart, lastKey)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onWeekChange(1)}
            disabled={!canGoForward}
            aria-label="Nächste Woche"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {isFetching && !isLoading && <span className="text-xs text-muted-foreground">wird aktualisiert …</span>}
      </div>

      {/* Raster */}
      {error && !data ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm">
          <p className="text-muted-foreground">{error.message || 'Die freien Zeiten konnten nicht geladen werden.'}</p>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
          </Button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-14" />
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {totalSlots === 0 ? (
            <p className="text-xs text-muted-foreground">
              Keine passenden Zeiten in dieser Woche. Blättern Sie weiter, wählen Sie „+ Uhrzeit“ unter einem Tag oder{' '}
              <button type="button" className="font-medium text-primary underline underline-offset-2 hover:opacity-80" onClick={onOpenHoursSettings}>
                ändern Sie Ihre Interview-Zeiten
              </button>
              .
            </p>
          ) : selectable === 0 && (
            <p className="text-xs text-muted-foreground">In dieser Woche ist alles belegt. Blättern Sie weiter oder wählen Sie „+ Uhrzeit“ unter einem Tag.</p>
          )}
          <div className={cn('-mx-1 overflow-x-auto px-1 pb-1 transition-opacity', isFetching && 'opacity-60')}>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(8rem, 1fr))` }}>
              {columns.map((col) => (
                <div key={col.key} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{col.label}</p>
                  {col.slots.length === 0 && !customFor(col.key).length && <p className="py-2 text-xs text-muted-foreground/60">–</p>}
                  {itemsFor(col.key, col.slots).map((item) => {
                    if (item.kind === 'custom') {
                      return (
                        <button
                          key={item.iso}
                          type="button"
                          aria-pressed
                          onClick={() => onToggle(item.iso)}
                          title="Eigene Zeit · zum Entfernen klicken"
                          className="flex w-full items-center gap-1.5 rounded-md border border-foreground bg-foreground px-2 py-1.5 text-left text-xs font-medium tabular-nums text-background transition-colors hover:bg-foreground/90"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-background" />
                          <span className="truncate">{fmtTime(item.iso)} · eigene Zeit</span>
                        </button>
                      );
                    }
                    const slot = item.slot;
                    const clickable = slot.status === 'all' || slot.status === 'required';
                    const isSelected = selectedSet.has(Date.parse(slot.start));
                    const blocked = clickable && !isSelected && full;
                    const hint = [
                      unchecked && clickable ? 'Ungeprüft: Outlook nicht lesbar' : '',
                      slot.unknown.length ? `Kalender nicht sichtbar: ${slot.unknown.join(', ')}` : '',
                      blocked ? `Höchstens ${MAX_PROPOSALS} Vorschläge` : '',
                    ].filter(Boolean).join(' · ');
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={!clickable || blocked}
                        aria-pressed={clickable ? isSelected : undefined}
                        onClick={() => onToggle(slot.start)}
                        title={hint || undefined}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs tabular-nums transition-colors',
                          isSelected
                            ? 'border-foreground bg-foreground font-medium text-background hover:bg-foreground/90'
                            : unchecked && clickable ? UNCHECKED_TILE : TILE[slot.status],
                          blocked && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isSelected ? 'bg-background' : unchecked && clickable ? 'bg-muted-foreground/60' : DOT[slot.status])} />
                        <span className="truncate">{slotText(slot, peopleCount)}</span>
                      </button>
                    );
                  })}
                  {col.key >= todayKey && (
                    <button
                      type="button"
                      onClick={() => setCustomDay(customDay === col.key ? null : col.key)}
                      aria-expanded={customDay === col.key}
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors hover:text-foreground',
                        customDay === col.key ? 'font-medium text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      <Plus className="h-3 w-3" /> Uhrzeit
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {customColumn && (
            <CustomTimeRow
              dayKey={customColumn.key}
              dayLabel={customColumn.label}
              durationMinutes={durationMinutes}
              selected={selected}
              onAdd={onAdd}
              onClose={() => setCustomDay(null)}
              onCheckTime={onCheckTime}
            />
          )}
        </>
      )}

      {/* Auswahl */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-medium">
            Ausgewählt {selected.length} von {MAX_PROPOSALS}
          </span>
          {sortedSelected.map((iso) => (
            <span key={iso} className="inline-flex items-center gap-1 rounded-full bg-foreground py-0.5 pl-2.5 pr-1 text-background">
              {fmtDayShort(iso)} {fmtTime(iso)}
              <button
                type="button"
                onClick={() => onToggle(iso)}
                className="rounded-full p-0.5 hover:bg-background/20"
                aria-label={`${fmtDayShort(iso)} ${fmtTime(iso)} entfernen`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-success" /> grün = alle frei
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warning" /> gelb = alle Pflicht-Teilnehmer frei
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> grau = belegt
            </span>
            {unchecked && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm border border-dashed border-muted-foreground" /> gestrichelt = ungeprüft
                </span>
              </>
            )}
            <span>· deutsche Zeit</span>
          </p>
        </div>
      </div>
    </div>
  );
}
