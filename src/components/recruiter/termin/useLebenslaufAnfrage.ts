import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { TASKS_CHANGED } from '@/hooks/useUnifiedTaskInbox';

/** Offene Lebenslauf-Anfrage eines Kandidaten (05.11.2026), aus cv_requests. */
export interface LebenslaufAnfrage {
  id: string;
  weg: 'einladung' | 'mail' | 'selbst';
  created_at: string;
  sent_at: string | null;
  reminded_at: string | null;
  linkedin_at: string | null;
}

// Tabelle aus Migration 20261105100000, im generierten Supabase-Typ noch nicht enthalten.
const tabelle = (name: string) => (supabase as unknown as { from: (t: string) => any }).from(name); // eslint-disable-line @typescript-eslint/no-explicit-any

export function useLebenslaufAnfrage(candidateId: string) {
  // Lädt die Texte für vorTagenKurz (Namespace recruiterTermin), bevor die Karte sie braucht.
  useTranslation('recruiterTermin');
  const qc = useQueryClient();
  const key = ['lebenslauf-anfrage', candidateId];
  const query = useQuery({
    queryKey: key,
    staleTime: 15_000,
    queryFn: async (): Promise<LebenslaufAnfrage | null> => {
      const { data, error } = await tabelle('cv_requests').select('id, weg, created_at, sent_at, reminded_at, linkedin_at')
        .eq('candidate_id', candidateId).is('fulfilled_at', null).is('revoked_at', null)
        .order('created_at', { ascending: false }).limit(1);
      if (error) return null;
      return ((data ?? [])[0] ?? null) as LebenslaufAnfrage | null;
    },
  });
  // Nach Einladen, Anfragen oder Erinnern neu laden, wie die übrigen Karten.
  useEffect(() => {
    const neu = () => { void qc.invalidateQueries({ queryKey: ['lebenslauf-anfrage', candidateId] }); };
    window.addEventListener(TASKS_CHANGED, neu);
    return () => window.removeEventListener(TASKS_CHANGED, neu);
  }, [qc, candidateId]);
  return { anfrage: query.data ?? null, neuLaden: () => qc.invalidateQueries({ queryKey: key }) };
}

/** „vor 2 Tagen“, „heute“, „gestern“ */
export function vorTagenKurz(iso: string): string {
  const tage = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return tage <= 0 ? i18n.t('recruiterTermin:ago.today') : tage === 1 ? i18n.t('recruiterTermin:ago.yesterday') : i18n.t('recruiterTermin:ago.days', { count: tage });
}
