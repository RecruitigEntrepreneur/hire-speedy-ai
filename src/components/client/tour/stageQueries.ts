import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DemoJobRow } from '@/lib/clientDemoData';

/**
 * Was die Beispiel-Bühne des Kunden-Rundgangs vom Konto braucht: die Stelle und den Honorarsatz.
 * Als eigene Datei, damit die Begrüßung beides schon lädt, während der Kunde liest (23.11.2026):
 * Vorher begann das Laden erst mit dem Klick auf „Los geht's“, der erste Schritt stand gut zwei
 * Sekunden leer.
 */
type FeeRow = { pricing_snapshot?: { clientFeePct?: unknown } | null; organization_id?: string | null; package_key?: string | null };
type FeeQuery = { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => PromiseLike<{ data: FeeRow[] | null }> } } };

export const STAGE_STALE_MS = 5 * 60_000;
export const stageJobKey = (jobId: string | null) => ['client-tour-job-row', jobId] as const;
export const stageFeeKey = (userId: string | undefined) => ['client-tour-fee', userId] as const;

export async function loadStageJob(jobId: string): Promise<DemoJobRow | null> {
  const { data } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  return (data as DemoJobRow | null) ?? null;
}

/** Honorar laut Rahmenvertrag, wie im echten Angebotsfenster (supabase/functions/_shared/offer-service.ts). */
export async function loadStageFee(): Promise<{ pct: number | null; packageKey: string | null }> {
  const { data } = await (supabase as unknown as FeeQuery).from('client_framework_agreements').select('pricing_snapshot, organization_id, package_key').eq('status', 'active');
  const rows = data ?? [];
  const rv = rows.find((r) => r.organization_id) ?? rows[0];
  const pct = Number(rv?.pricing_snapshot?.clientFeePct);
  return { pct: Number.isFinite(pct) && pct > 0 ? pct : null, packageKey: rv?.package_key ?? null };
}

/** Lädt beides vor; Fehler sind egal, die Bühne lädt dann selbst. */
export function prefetchStage(queryClient: QueryClient, jobId: string | null, userId: string | undefined): void {
  if (jobId) void queryClient.prefetchQuery({ queryKey: stageJobKey(jobId), queryFn: () => loadStageJob(jobId), staleTime: STAGE_STALE_MS });
  if (userId) void queryClient.prefetchQuery({ queryKey: stageFeeKey(userId), queryFn: loadStageFee, staleTime: STAGE_STALE_MS });
}
