import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { buildTourData, type TourData, type TourFallback, type TourJobSource } from '@/lib/clientDemo';

/**
 * Woraus der Kunden-Rundgang seine Bilder baut: die neueste eingereichte Stelle des
 * Kunden und, solange Matchunt noch nicht gegengezeichnet hat, der Titel aus der Aufnahme.
 */
export interface TourSource { job: TourJobSource | null; waitingTitle: string | null }

export const ClientTourSourceContext = createContext<TourSource>({ job: null, waitingTitle: null });

const COLUMNS = 'id,title,status,location,salary_min,salary_max,employment_type,experience_level,remote_type,must_haves';
/** Eingereicht: live oder in Prüfung. Entwürfe zeigt der Rundgang nicht als „Ihre Stelle“. */
const SUBMITTED = ['published', 'pending_approval', 'pending_client_approval'];

/** Neueste eingereichte Stelle des Kunden; im Zweifel keine, dann läuft alles am Beispiel. */
export function useClientTourJob(userId: string | null) {
  return useQuery({
    queryKey: ['client-tour-job', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<TourJobSource | null> => {
      const { data, error } = await supabase.from('jobs').select(COLUMNS)
        .eq('client_id', userId!).in('status', SUBMITTED)
        .order('created_at', { ascending: false }).limit(1);
      if (error) return null;
      const row = (data?.[0] ?? null) as Record<string, unknown> | null;
      if (!row) return null;
      const list = row.must_haves;
      return { ...(row as unknown as TourJobSource), must_haves: Array.isArray(list) ? list.map(String) : null };
    },
  });
}

/** Ersatzwerte ohne eigene Stelle, in der Sprache der Oberfläche. */
function fallbackOf(t: (key: string) => string): TourFallback {
  return {
    title: t('demo.example.title'),
    location: t('demo.example.location'),
    band: { min: 75_000, max: 90_000 },
    level: 'senior',
    remote: 'hybrid',
    criteria: [t('demo.example.criterion1'), t('demo.example.criterion2')],
  };
}

/** Alles, was Begrüßung und Bühne zeigen. Nur innerhalb geladener `clientGuide`-Texte aufrufen. */
export function useTourData(): TourData {
  const source = useContext(ClientTourSourceContext);
  const { t, i18n } = useTranslation('clientGuide');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu bei anderer Stelle oder Sprache
  return useMemo(() => buildTourData(source.job, fallbackOf(t), { waitingTitle: source.waitingTitle }), [source, i18n.language]);
}
