import { useEffect, useState } from 'react';
import { weekStartOf, type AvailabilityResult } from '@/lib/interviewScheduling';
import { initialWeekStart } from '@/lib/interviewRequestUtils';

/** So viele Wochen springt das Raster höchstens von selbst weiter. */
const AUTO_WEEKS = 3;

const nextWeek = (weekStart: string, delta: number) => weekStartOf(`${weekStart}T12:00:00.000Z`, delta);
const freeSlots = (data: AvailabilityResult) =>
  data.days.reduce((n, d) => n + d.slots.filter((s) => s.status === 'all' || s.status === 'required').length, 0);

interface WeekState { weekStart: string; skipped: number; settled: boolean; found: boolean }

/**
 * Angezeigte Woche im Terminraster (Anfrage und Verschieben, Live-Test 23.10.2026):
 * Ist in der Startwoche nichts mehr frei, springt das Raster in die erste Woche mit
 * freien Zeiten – höchstens drei Wochen weit und nur, bis jemand selbst blättert oder
 * eine Woche mit freien Zeiten gezeigt wurde.
 */
export function useProposalWeek(nowIso: string, maxWeek: string) {
  const [state, setState] = useState<WeekState>(() => ({ weekStart: initialWeekStart(nowIso), skipped: 0, settled: false, found: false }));

  const go = (delta: number) => setState((s) => ({ weekStart: nextWeek(s.weekStart, delta), skipped: 0, settled: true, found: false }));

  const skipIfEmpty = (data: AvailabilityResult) =>
    setState((s) => {
      if (s.settled) return s;
      if (freeSlots(data) > 0) return { ...s, settled: true, found: true };
      if (s.skipped >= AUTO_WEEKS || s.weekStart >= maxWeek) return { ...s, settled: true };
      return { ...s, weekStart: nextWeek(s.weekStart, 1), skipped: s.skipped + 1 };
    });

  return {
    weekStart: state.weekStart,
    go,
    skipIfEmpty,
    // Hinweis nur, solange die von selbst gewählte Woche zu sehen ist
    note: state.skipped > 0 && state.found ? 'Vorher ist nichts mehr frei – das ist die erste Woche mit freien Zeiten.' : null,
  };
}

/** Nach jedem geladenen Raster der angezeigten Woche prüfen (Platzhalter einer anderen Woche zählen nicht). */
export function useSkipEmptyWeek(week: ReturnType<typeof useProposalWeek>, data: AvailabilityResult | undefined, isPlaceholder: boolean) {
  useEffect(() => {
    if (data && !isPlaceholder) week.skipIfEmpty(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isPlaceholder]);
}
