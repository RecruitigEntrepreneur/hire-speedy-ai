import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { parseTicket } from '@/lib/feedback/labels';

export type FeedbackRow = Tables<'product_feedback'>;
export type FeedbackEvent = Tables<'product_feedback_events'>;
export type FeedbackPatch = Pick<TablesUpdate<'product_feedback'>, 'status' | 'priority' | 'assignee_id' | 'criteria_done' | 'duplicate_of' | 'title'>;

export const FEEDBACK_BUCKET = 'feedback-screenshots';

const KEYS = {
  list: ['admin-feedback'] as const,
  one: (ticket: string) => ['admin-feedback', 'ticket', ticket] as const,
  duplicates: (id: string) => ['admin-feedback', 'duplicates', id] as const,
  events: (id: string) => ['admin-feedback-events', id] as const,
};

/** Alle Tickets. Für den Live-Test reicht es, alles zu laden und im Browser zu filtern. */
export function useFeedbackTickets() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as FeedbackRow[];
    },
    refetchInterval: 60_000,
  });
}

/** Ein Ticket über „FB-0012“, „12“ oder seine ID (Link aus der Glocke). */
export function useFeedbackTicket(param: string | undefined) {
  return useQuery({
    queryKey: KEYS.one(param ?? ''),
    enabled: !!param,
    queryFn: async () => {
      const no = parseTicket(param);
      const query = supabase.from('product_feedback').select('*');
      const { data, error } = no != null ? await query.eq('ticket_no', no).maybeSingle() : await query.eq('id', param!).maybeSingle();
      if (error) throw error;
      return data as FeedbackRow | null;
    },
    // Solange die KI noch schreibt, regelmäßig nachsehen.
    refetchInterval: (q) => ((q.state.data as FeedbackRow | null | undefined)?.ai_status === 'pending' ? 4000 : 60_000),
  });
}

export function useTicketDuplicates(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.duplicates(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_feedback')
        .select('*')
        .eq('duplicate_of', id!)
        .order('created_at');
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });
}

export function useTicketEvents(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.events(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_feedback_events')
        .select('*')
        .eq('feedback_id', id!)
        .order('created_at');
      if (error) throw error;
      return data as FeedbackEvent[];
    },
    refetchInterval: 30_000,
  });
}

export interface TeamMember {
  user_id: string;
  name: string | null;
  email: string | null;
}

export function useFeedbackTeam() {
  return useQuery({
    queryKey: ['admin-feedback-team'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('feedback_team');
      if (error) return [] as TeamMember[];
      return (data ?? []) as TeamMember[];
    },
    staleTime: 10 * 60_000,
  });
}

/** Zahl „Neu“ für die Admin-Navigation. Fehlt die Tabelle noch, bleibt es bei 0. */
export function useNewFeedbackCount(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-feedback-new-count'],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('product_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

/** Signierte Adressen für Bild und Ausschnitte (eine Stunde gültig). */
export function useFeedbackImageUrls(paths: string[]) {
  return useQuery({
    queryKey: ['admin-feedback-images', paths],
    enabled: paths.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(FEEDBACK_BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) as Record<string, string>;
    },
    staleTime: 50 * 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['admin-feedback'] });
    qc.invalidateQueries({ queryKey: ['admin-feedback-events'] });
    qc.invalidateQueries({ queryKey: ['admin-feedback-new-count'] });
  };
}

export function useUpdateTickets() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: FeedbackPatch }) => {
      const { error } = await supabase.from('product_feedback').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Duplikate in ein Hauptticket zusammenführen. Ihre Absender bekommen die Glocke mit dem Hauptticket. */
export function useMergeTickets() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ mainId, duplicateIds }: { mainId: string; duplicateIds: string[] }) => {
      const ids = duplicateIds.filter((id) => id !== mainId);
      if (!ids.length) return;
      // Was schon in den Duplikaten hing, hängt jetzt am Hauptticket.
      await supabase.from('product_feedback').update({ duplicate_of: mainId }).in('duplicate_of', ids);
      const { error } = await supabase
        .from('product_feedback')
        .update({ status: 'duplicate', duplicate_of: mainId })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useAddComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ feedbackId, body }: { feedbackId: string; body: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('product_feedback_events').insert({
        feedback_id: feedbackId,
        actor_id: auth.user?.id ?? null,
        kind: 'comment',
        body,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRegenerateBrief() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('product-feedback', { body: { action: 'brief', id } });
      if (!error) return;
      let message = 'Die KI hat gerade nicht geantwortet.';
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.reason && body?.message) message = body.message;
      } catch {
        /* allgemein bleiben */
      }
      throw new Error(message);
    },
    onSuccess: invalidate,
  });
}

export function useFeedbackSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('feedback_settings')
        .update({ enabled, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback-settings'] }),
  });
}
