import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnaInterview, AnaJob, AnaOffer } from '@/lib/clientAnalytics';

/**
 * Grunddaten der Analytics: alle laufenden und abgeschlossenen Stellen des Kunden,
 * dazu Interviews und Angebote (nur Zeitpunkte). Geteilt von der Analytics-Seite
 * und der Auswertung einer einzelnen Stelle, die den eigenen Schnitt daraus braucht.
 */
export function useClientAnalyticsBase() {
  return useQuery({
    queryKey: ['client-analytics-base'],
    queryFn: async () => {
      const [jobsRes, ivRes, offerRes] = await Promise.all([
        supabase.from('jobs').select('*').in('status', ['published', 'filled', 'closed']).order('created_at', { ascending: false }),
        supabase.from('interviews').select('submission_id, scheduled_at, status'),
        supabase.from('offers').select('submission_id, status, created_at, sent_at, decision_at, responded_at'),
      ]);
      if (jobsRes.error) throw jobsRes.error;
      const jobs: AnaJob[] = (jobsRes.data ?? []).map((j) => {
        const raw = j as unknown as Record<string, unknown>;
        return {
          id: j.id, title: j.title, status: j.status, created_at: j.created_at,
          approved_at: (raw.approved_at as string | null) ?? null,
          closed_at: (raw.closed_at as string | null) ?? null,
        };
      });
      // Interviews und Angebote sind Zusatz: fehlen sie, entfallen nur die Abschnitte, die sie brauchen.
      return {
        jobs,
        interviews: (ivRes.data ?? []) as unknown as AnaInterview[],
        offers: (offerRes.data ?? []) as unknown as AnaOffer[],
      };
    },
  });
}
