import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { clientHasPosition, clientIsWaiting, type ClientWaitingInfo, type StartFramework } from '@/lib/clientStart';

interface ContractState { waiting: boolean; closed?: boolean; title?: string | null; signer_email?: string | null; self?: boolean }

/**
 * Wartet der Kunde auf die Gegenzeichnung (lib/clientStart.ts)? Läuft für jede Kundenseite,
 * deshalb nur zwei kurze Abfragen; Titel und Unterzeichner holt der Server erst im
 * Wartezustand. Im Zweifel nicht sperren: Die Seite zeigt dann nur leere Listen.
 */
export function useClientWaiting() {
  const { user, role } = useAuth();
  const userId = user?.id;
  const base = useQuery({
    queryKey: ['client-waiting', userId],
    enabled: !!userId && role === 'client',
    staleTime: 30_000,
    // Die Sperre fällt von selbst, sobald Matchunt gegengezeichnet hat.
    refetchInterval: (query) => (query.state.data?.waiting ? 60_000 : false),
    queryFn: async () => {
      const [rv, jobs] = await Promise.all([
        supabase.from('client_framework_agreements').select('agreement_number,status,countersigned_at'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('client_id', userId!),
      ]);
      if (rv.error || jobs.error) return { waiting: false, hasPosition: false };
      const rows = (rv.data ?? []) as StartFramework[];
      return { waiting: clientIsWaiting(rows, jobs.count ?? 0), hasPosition: clientHasPosition(rows, jobs.count ?? 0) };
    },
  });
  const isWaiting = base.data?.waiting === true;
  const detail = useQuery({
    queryKey: ['client-contract-state', userId],
    enabled: isWaiting,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('client-login', { body: { action: 'contract-state' } });
      if (error) throw error;
      return data as ContractState;
    },
  });
  const closed = detail.data?.closed === true;
  const info: ClientWaitingInfo | null = isWaiting
    ? { title: detail.data?.title ?? null, signerEmail: detail.data?.signer_email ?? null, self: detail.data?.self ?? true, closed }
    : null;
  // Der Rundgang wartet darauf: sonst spielte die Bühne kurz an der Beispielstelle statt an der eingereichten.
  const infoLoading = base.isLoading || (isWaiting && detail.isLoading);
  return { waiting: isWaiting && !closed, hasPosition: base.data?.hasPosition === true, info, infoLoading };
}
