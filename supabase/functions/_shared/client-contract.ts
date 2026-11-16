import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { docusignAppOrigin, docusignConfig, envelopeStatus, recipientView } from './docusign.ts';
import { applyEnvelopeState, type SignerState } from './docusign-apply.ts';
import { dbError, must } from './recruiter-onboarding-service.ts';

/**
 * Der Vertrag des Kunden aus Sicht seines Dashboards (Wartezustand, 30.10.2026):
 * Stand lesen, unterschreiben, wenn er das Fenster vorher geschlossen hat, und
 * nachfragen, ob die Unterschrift angekommen ist. Immer der eigene Rahmenvertrag,
 * erkannt über client_user_id.
 */
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

async function ownFrameworks(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from('client_framework_agreements')
    .select('id,agreement_number,status,envelope_id,origin_draft_id,customer_signed_at,customer_signer_name,customer_signer_email')
    .eq('client_user_id', userId).order('created_at', { ascending: false });
  dbError(error);
  return data ?? [];
}

export interface ClientContractState {
  waiting: boolean;
  /** Abgelehnt: Es kam kein Vertrag zustande, der Kunde wartet nicht mehr. */
  closed?: boolean;
  status?: string;
  agreement_number?: string | null;
  /** Die erste Position; der Rahmenvertrag gilt darüber hinaus für alle weiteren. */
  title?: string | null;
  signer_email?: string | null;
  /** Der Kunde unterschreibt selbst, sonst liegt der Vertrag bei einer anderen Person. */
  self?: boolean;
  signed_at?: string | null;
}

export async function clientContractState(db: SupabaseClient, user: User): Promise<ClientContractState> {
  const rows = await ownFrameworks(db, user.id);
  if (rows.some(r => r.status === 'active')) return { waiting: false };
  const { count, error } = await db.from('jobs').select('id', { count: 'exact', head: true }).eq('client_id', user.id);
  dbError(error);
  if ((count ?? 0) > 0) return { waiting: false };
  const rv = rows.find(r => ['customer_signed', 'sent'].includes(r.status));
  if (!rv) return { waiting: false };
  const { data: draft } = rv.origin_draft_id
    ? await db.from('intake_drafts').select('title,review_state').eq('id', rv.origin_draft_id).maybeSingle()
    : { data: null };
  const closed = draft?.review_state === 'rejected';
  return {
    waiting: !closed, closed, status: rv.status, agreement_number: rv.agreement_number, title: draft?.title ?? null,
    signer_email: rv.customer_signer_email ?? null, self: norm(rv.customer_signer_email) === norm(user.email), signed_at: rv.customer_signed_at ?? null,
  };
}

/** Frische Unterschriftsansicht im Dashboard; gilt nur für die benannte Person, die selbst unterschreibt. */
export async function clientContractSignUrl(db: SupabaseClient, user: User): Promise<{ url: string }> {
  const cfg = docusignConfig();
  must(cfg, 'DocuSign ist nicht eingerichtet.', 'not_deployed');
  const rv = (await ownFrameworks(db, user.id)).find(r => r.status === 'sent' && r.envelope_id);
  must(rv, 'Zu Ihrem Konto liegt kein offener Vertrag vor.', 'not_found');
  must(norm(rv.customer_signer_email) === norm(user.email), 'Der Vertrag liegt bei der benannten unterzeichnenden Person.', 'not_allowed');
  const appUrl = getPublicAppUrl();
  const url = await recipientView(cfg, {
    envelopeId: rv.envelope_id!, name: rv.customer_signer_name || user.email!, email: rv.customer_signer_email!,
    clientUserId: `client-${rv.origin_draft_id}`, returnUrl: `${appUrl}/aufnahme/unterschrift-fertig`,
    frameAncestors: [appUrl, docusignAppOrigin(cfg)], messageOrigins: [docusignAppOrigin(cfg)],
  });
  return { url };
}

/** Bei DocuSign nachfragen und anwenden, dieselbe Logik wie docusign-status. */
export async function clientContractCheck(db: SupabaseClient, user: User) {
  const cfg = docusignConfig();
  must(cfg, 'DocuSign ist nicht eingerichtet.', 'not_deployed');
  const rv = (await ownFrameworks(db, user.id)).find(r => ['sent', 'customer_signed'].includes(r.status) && r.envelope_id);
  must(rv, 'Zu Ihrem Konto liegt kein offener Vertrag vor.', 'not_found');
  await db.from('commercial_mandates').update({ envelope_last_synced_at: new Date().toISOString() }).eq('envelope_id', rv.envelope_id!);
  const stand = await envelopeStatus(cfg, rv.envelope_id!);
  const ergebnis = await applyEnvelopeState(db, rv.envelope_id!, (stand?.recipients?.signers ?? []) as SignerState[]);
  return { customer_signed: ergebnis.customerSigned, countersigned: ergebnis.countersigned, declined: ergebnis.declined };
}
