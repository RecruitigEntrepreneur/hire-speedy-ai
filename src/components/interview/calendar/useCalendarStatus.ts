// Kalender-Verbindung und Interview-Zeiten des angemeldeten Kunden (02.10.2026).
// Dünne react-query-Schicht über calendarApi und hoursApi aus
// lib/interviewScheduling.ts -- die Logik selbst liegt in den Edge Functions.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import {
  calendarApi, hoursApi, normalizeRules,
  type CalendarStatus, type InterviewHoursRules,
} from '@/lib/interviewScheduling';

/** Merker im Konto: Die Kalender-Karte im Dashboard wurde weggeklickt. */
export const CALENDAR_CARD_HIDDEN_KEY = 'calendar_card_hidden_at';

const NOT_CONNECTED: CalendarStatus = { state: 'not_connected', provider: null, accountEmail: null, itRequest: null };

export function useCalendarStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['calendar-status', user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: () => calendarApi.status(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['calendar-status'] });

  /** Führt zur Microsoft-Anmeldung; der Rücksprung landet auf returnPath (?kalender=…). */
  const connect = useMutation({
    mutationFn: (returnPath: string) => calendarApi.connect(returnPath),
    onSuccess: ({ url }) => { window.location.href = url; },
  });

  const disconnect = useMutation({
    mutationFn: () => calendarApi.disconnect(),
    onSuccess: () => {
      queryClient.setQueryData<CalendarStatus>(queryKey, NOT_CONNECTED);
      void refresh();
    },
  });

  /** Schickt der IT den Freigabe-Link; die Antwort enthält den Link zum Kopieren. */
  const requestIt = useMutation({
    mutationFn: (itEmail: string) => calendarApi.requestIt(itEmail),
    onSuccess: () => { void refresh(); },
  });

  return {
    status: query.data ?? null,
    state: query.data?.state ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    connect,
    disconnect,
    requestIt,
  };
}

export function useInterviewHours() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['interview-hours', user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: () => hoursApi.load(user!.id),
  });

  const save = useMutation({
    mutationFn: async (rules: InterviewHoursRules) => {
      if (!user?.id) throw new Error('Bitte melden Sie sich erneut an.');
      await hoursApi.save(user.id, rules);
      return normalizeRules(rules);
    },
    onSuccess: (saved) => { queryClient.setQueryData(queryKey, saved); },
  });

  return { rules: query.data ?? null, isLoading: query.isLoading, isError: query.isError, save };
}

// ---------------------------------------------------------------------------
// Rücksprung aus Microsoft: ?kalender=verbunden | it | fehler[&grund=consent]
// ---------------------------------------------------------------------------

type CalendarReturn = 'connected' | 'it' | 'error' | null;

function parseReturn(search: string): CalendarReturn {
  const params = new URLSearchParams(search);
  const kalender = params.get('kalender');
  if (kalender === 'verbunden') return 'connected';
  if (kalender === 'it' || (kalender === 'fehler' && params.get('grund') === 'consent')) return 'it';
  if (kalender === 'fehler') return 'error';
  return null;
}

// Ein Rücksprung ist ein frischer Seitenaufruf: Meldungen höchstens einmal je Laden,
// auch wenn mehrere Karten gleichzeitig auf der Seite stehen.
let returnNotified = false;

/**
 * Liest den Rücksprung beim ersten Anzeigen, entfernt die Parameter aus der
 * Adresse (der Hash wie #kalender bleibt) und meldet Erfolg oder Fehler.
 * itFlow: Microsoft verlangt die Zustimmung der IT -- die Karte zeigt das Panel.
 */
export function useCalendarReturn() {
  const queryClient = useQueryClient();
  const [ret] = useState<CalendarReturn>(() => (typeof window === 'undefined' ? null : parseReturn(window.location.search)));
  const [itFlow, setItFlow] = useState(ret === 'it');

  useEffect(() => {
    if (!ret) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('kalender')) {
      url.searchParams.delete('kalender');
      url.searchParams.delete('grund');
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (returnNotified) return;
    returnNotified = true;
    if (ret === 'connected') void queryClient.invalidateQueries({ queryKey: ['calendar-status'] });
    // Der Toaster abonniert erst nach seinem eigenen Effekt -- vorher gesendete Meldungen gingen verloren.
    window.setTimeout(() => {
      if (ret === 'connected') toast.success('Outlook ist verbunden.');
      else if (ret === 'error') toast.error('Outlook konnte nicht verbunden werden. Bitte versuchen Sie es noch einmal.');
    }, 0);
  }, [ret, queryClient]);

  return { itFlow, openIt: () => setItFlow(true), closeIt: () => setItFlow(false) };
}

/** „heute“, „gestern“, „vor 3 Tagen“ -- nach Kalendertagen in deutscher Zeit. */
export function sentAgo(iso: string, now = new Date()): string {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(new Date(iso)))) / 86_400_000);
  if (!Number.isFinite(days) || days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}
