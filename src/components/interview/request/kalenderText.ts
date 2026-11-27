// Texte im Anfrage-Fenster wurden für Outlook geschrieben (26.11.2026: auch Google Kalender).
// Ist der Kalender der Person Google, tauschen wir „Outlook“ gegen „Google Kalender“,
// ohne jeden Schlüssel in vier Sprachen zu verdoppeln.
import { createContext, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { toolText, type CalendarProvider } from '@/lib/interviewScheduling';

export const KalenderAnbieter = createContext<CalendarProvider | null>(null);

/** Wie useTranslation, nur mit dem Namen des eigenen Kalenders. */
export function useKalenderT(ns: string | string[] = 'clientInterviews') {
  const res = useTranslation(ns);
  const anbieter = useContext(KalenderAnbieter);
  const base = res.t;
  const t = useCallback((...args: Parameters<typeof base>) => {
    const text = (base as (...a: unknown[]) => unknown)(...args);
    return anbieter === 'google' && typeof text === 'string' ? toolText(text, null, 'google') : text;
  }, [base, anbieter]) as unknown as typeof base;
  return { ...res, t };
}
