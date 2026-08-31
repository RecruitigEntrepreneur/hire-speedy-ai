import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { intakeDb } from '@/lib/intakeDb';

/**
 * Aus einem Edge-Function-Fehler eine Meldung machen, mit der man etwas
 * anfangen kann. Ohne das steht überall nur "Edge Function returned a non-2xx
 * status code" — und eine nicht deployte Function sieht aus wie ein Bug.
 */
async function describeFunctionError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: { json?: () => Promise<any> } })?.context;
  if (ctx && typeof ctx.json === 'function') {
    const body = await ctx.json().catch(() => null);
    if (body?.message) return new Error(body.message);
  }
  if ((error as { name?: string })?.name === 'FunctionsFetchError') {
    return new Error(
      'Die Edge Function ist nicht erreichbar — vermutlich noch nicht deployt. Siehe LOVABLE_DB_PROMPTS.md, Prompt 8.',
    );
  }
  return error instanceof Error ? error : new Error('Unbekannter Fehler.');
}

/**
 * Datenzugriff des Admins auf Aufnahmen, Links und Vereinbarungen.
 *
 * Lesen läuft direkt über PostgREST — die Admin-Policy auf den neuen Tabellen
 * deckt das ab. Jeder schreibende Vorgang läuft über Edge Functions: dort
 * hängen Kontoanlage, Mailversand, Statusübergänge und der Audit-Eintrag
 * zusammen, und die Rollenprüfung findet serverseitig statt.
 *
 * Bewusst NICHT das Muster aus AdminJobs.tsx:62-71 (select('*') ohne Limit
 * über die gesamte Tabelle plus Filterung im Browser) — das skaliert nicht und
 * lädt Kontaktdaten in den Speicher, die auf dem Bildschirm nie auftauchen.
 */

export type ReviewState = 'not_submitted' | 'pending_admin' | 'accepted' | 'changes_requested' | 'rejected';

export interface AdminIntakeRow {
  id: string;
  link_id: string | null;
  title: string | null;
  company_name: string | null;
  company_domain: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  is_freemail: boolean;
  completeness: number;
  contract_type: string;
  capture_state: string;
  identity_state: string;
  commercial_state: string;
  review_state: ReviewState;
  created_at: string;
  last_activity_at: string;
  submitted_at: string | null;
  job_id: string | null;
  owner_user_id: string | null;
  matched_organization_id: string | null;
  matched_outreach_company_id: string | null;
  match_confidence: string | null;
  rejection_reason: string | null;
  admin_note: string | null;
  purge_after: string;
}

const LIST_COLUMNS =
  'id, link_id, title, company_name, company_domain, contact_name, contact_email, contact_role,' +
  ' is_freemail, completeness, contract_type, capture_state, identity_state, commercial_state,' +
  ' review_state, created_at, last_activity_at, submitted_at, job_id, owner_user_id,' +
  ' matched_organization_id, matched_outreach_company_id, match_confidence, rejection_reason,' +
  ' admin_note, purge_after';

export type IntakeTab = 'queue' | 'followup' | 'all';

export function useAdminIntakes(tab: IntakeTab, search: string) {
  return useQuery({
    queryKey: ['admin-intakes', tab, search],
    queryFn: async () => {
      let q = intakeDb('intake_drafts').select(LIST_COLUMNS);

      if (tab === 'queue') {
        q = q.eq('review_state', 'pending_admin').order('submitted_at', { ascending: true });
      } else if (tab === 'followup') {
        // Genau die Abgrenzung aus der Anforderung: unvollständige Vorgänge mit
        // Kontaktdaten sind nachzufassen und dürfen die Prüfliste nicht füllen.
        q = q
          .in('review_state', ['not_submitted', 'changes_requested'])
          .not('contact_email', 'is', null)
          .order('last_activity_at', { ascending: false });
      } else {
        q = q.order('last_activity_at', { ascending: false });
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        q = q.or(`company_name.ilike.${term},contact_email.ilike.${term},title.ilike.${term},contact_name.ilike.${term}`);
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as AdminIntakeRow[];
    },
    staleTime: 30_000,
  });
}

export function useIntakeCounts() {
  return useQuery({
    queryKey: ['admin-intake-counts'],
    queryFn: async () => {
      const [queue, followup, terms, week] = await Promise.all([
        intakeDb('intake_drafts').select('id', { count: 'exact', head: true }).eq('review_state', 'pending_admin'),
        intakeDb('intake_drafts').select('id', { count: 'exact', head: true })
          .in('review_state', ['not_submitted', 'changes_requested']).not('contact_email', 'is', null),
        intakeDb('intake_drafts').select('id', { count: 'exact', head: true }).eq('commercial_state', 'discussion_requested'),
        intakeDb('intake_drafts').select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
      ]);
      return {
        queue: queue.count ?? 0,
        followup: followup.count ?? 0,
        termsOpen: terms.count ?? 0,
        thisWeek: week.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

export function useIntakeDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-intake', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [draft, mandates, events, tokens] = await Promise.all([
        intakeDb('intake_drafts').select('*').eq('id', id!).maybeSingle(),
        intakeDb('commercial_mandates').select('*').eq('draft_id', id!).order('created_at', { ascending: false }),
        intakeDb('intake_link_events').select('*').eq('draft_id', id!).order('occurred_at', { ascending: false }).limit(120),
        intakeDb('intake_draft_tokens')
          .select('id, origin, recipient_email, recipient_name, expires_at, revoked_at, last_used_at, use_count, created_at')
          .eq('draft_id', id!).order('created_at', { ascending: false }),
      ]);
      if (draft.error) throw draft.error;

      let link: Record<string, any> | null = null;
      if (draft.data?.link_id) {
        const { data } = await intakeDb('intake_links')
          .select('id, label, link_type, campaign_key, source, owner_user_id, terms_template_id')
          .eq('id', draft.data.link_id).maybeSingle();
        link = data ?? null;
      }
      let job: Record<string, any> | null = null;
      if (draft.data?.job_id) {
        const { data } = await supabase.from('jobs')
          .select('id, title, status, fee_percentage, recruiter_fee_percentage, approved_at, published_at:approved_at')
          .eq('id', draft.data.job_id).maybeSingle();
        job = data ?? null;
      }

      return {
        draft: draft.data as Record<string, any> | null,
        mandates: (mandates.data ?? []) as Record<string, any>[],
        events: (events.data ?? []) as Record<string, any>[],
        tokens: (tokens.data ?? []) as Record<string, any>[],
        link,
        job,
      };
    },
  });
}

/** Alle schreibenden Vorgänge laufen über intake-admin. */
export function useIntakeAction(draftId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('intake-admin', {
        body: { draft_id: draftId, ...payload },
      });
      if (error) throw await describeFunctionError(error);
      if (data && typeof data === 'object' && 'reason' in data) throw new Error((data as any).message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-intake', draftId] });
      qc.invalidateQueries({ queryKey: ['admin-intakes'] });
      qc.invalidateQueries({ queryKey: ['admin-intake-counts'] });
    },
  });
}

export function useMandateDocument() {
  return useMutation({
    mutationFn: async (mandateId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-mandate-pdf', {
        body: { mandate_id: mandateId },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'reason' in data) throw new Error((data as any).message);
      return data as { url: string | null; path: string; mandate_number: string };
    },
  });
}

/** Aufnahme-Links. */
export function useIntakeLinks() {
  return useQuery({
    queryKey: ['admin-intake-links'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('intake-link-admin', { body: { action: 'list' } });
      if (error) throw error;
      return ((data as any)?.links ?? []) as Record<string, any>[];
    },
    staleTime: 30_000,
  });
}

export function useLinkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('intake-link-admin', { body: payload });
      if (error) throw await describeFunctionError(error);
      if (data && typeof data === 'object' && 'reason' in data) throw new Error((data as any).message);
      return data as Record<string, any>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-intake-links'] }),
  });
}

export function useTermsTemplates() {
  return useQuery({
    queryKey: ['commercial-terms-templates'],
    queryFn: async () => {
      const { data, error } = await intakeDb('commercial_terms_templates')
        .select('*').order('key').order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Record<string, any>[];
    },
    staleTime: 300_000,
  });
}
