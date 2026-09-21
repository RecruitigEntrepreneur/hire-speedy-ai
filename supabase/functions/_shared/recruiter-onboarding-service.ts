import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fail, type FailureReason, isMissingRelation } from './http.ts';
import { type ContractDocument, type RecruiterProfile, signingEvidence } from './recruiter-contract-policy.ts';
import { accessToken, docusignConfig, type DocuSignConfig } from './docusign.ts';
import { noticeRecruiterSigned } from './recruiter-signed-notice.ts';

export interface OnboardingCase {
  id: string; revision: number; created_by: string | null; contract_template_hash: string | null; kind: string; email: string; token_hash: string;
  expires_at: string; revoked_at: string | null; claimed_by: string | null;
  profile: RecruiterProfile; state: string; feedback: string;
  checks: Record<string, boolean>; reviewed_at: string | null;
}
export interface RecruiterEnvelope {
  id: string; case_id: string; revision: number; state: string; envelope_id: string | null;
  transaction_id: string; create_started_at: string | null; snapshot: RecruiterProfile;
  documents: ContractDocument[]; package_version: string; source_reference: string;
  recruiter_client_user_id: string | null; counter_user_id: string; counter_name: string; counter_email: string;
  recruiter_signed_at: string | null; countersigned_at: string | null;
  signed_document_path: string | null; certificate_path: string | null; last_synced_at: string | null;
}
export class WorkflowError extends Error {
  constructor(public reason: FailureReason, message: string) { super(message); }
}
export function must(condition: unknown, message: string, reason: FailureReason = 'invalid_request'): asserts condition {
  if (!condition) throw new WorkflowError(reason, message);
}
export function dbError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (isMissingRelation(error)) throw new WorkflowError('not_deployed', 'Die Recruiter-Onboarding-Migration ist noch nicht installiert.');
  if (['40001','23505'].includes(error.code ?? '')) throw new WorkflowError('conflict', 'Der Vorgang wurde inzwischen geändert. Bitte neu laden.');
  // Do not expose database statements, internal notes or provider responses.
  console.error('[recruiter-onboarding] Database error', error.code);
  throw new WorkflowError('internal_error', 'Der Vorgang konnte nicht gespeichert werden.');
}
export function workflowFailure(e: unknown) {
  if (e instanceof WorkflowError) return fail(e.reason, e.message);
  console.error('[recruiter-onboarding] Operation failed', e instanceof Error ? e.name : 'unknown');
  return fail('upstream_error', 'Die Anfrage konnte nicht abgeschlossen werden. Bitte den gespeicherten Stand neu laden.');
}
export async function verifiedUser(req: Request): Promise<User> {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  must(!error && data.user?.email && data.user.email_confirmed_at, 'Bitte anmelden und die E-Mail-Adresse bestätigen.', 'not_allowed');
  return data.user!;
}
export async function caseById(db: SupabaseClient, id: unknown): Promise<OnboardingCase> {
  must(typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id), 'Ungültiger Vorgang.');
  const { data, error } = await db.from('recruiter_onboarding_cases').select('*').eq('id', id).maybeSingle();
  dbError(error); must(data, 'Vorgang nicht gefunden.', 'not_found'); return data;
}
export async function patchCase(db: SupabaseClient, c: OnboardingCase, patch: Record<string, unknown>) {
  const { data, error } = await db.from('recruiter_onboarding_cases').update({ ...patch, revision: c.revision + 1 })
    .eq('id', c.id).eq('revision', c.revision).select('*').maybeSingle();
  dbError(error); must(data, 'Der Vorgang wurde inzwischen geändert. Bitte neu laden.', 'conflict'); return data as OnboardingCase;
}
export async function envelopeById(db: SupabaseClient, id: unknown): Promise<RecruiterEnvelope> {
  must(typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id), 'Ungültiger Vertragsvorgang.');
  const { data, error } = await db.from('recruiter_contract_envelopes').select('*').eq('id', id).maybeSingle();
  dbError(error); must(data, 'Vertragsvorgang nicht gefunden.', 'not_found'); return data;
}
export async function patchEnvelope(db: SupabaseClient, e: RecruiterEnvelope, patch: Record<string, unknown>) {
  const { data, error } = await db.from('recruiter_contract_envelopes').update({ ...patch, revision: e.revision + 1 })
    .eq('id', e.id).eq('revision', e.revision).select('*').maybeSingle();
  dbError(error); must(data, 'Der Vertragsvorgang wurde inzwischen geändert. Bitte neu laden.', 'conflict'); return data as RecruiterEnvelope;
}
export const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
export function signatureConfig(): DocuSignConfig {
  const config = docusignConfig();
  must(Deno.env.get('RECRUITER_DOCUSIGN_ENABLED') !== 'false' && config, 'DocuSign für Recruiter ist noch nicht eingerichtet.', 'not_deployed');
  return config;
}
export async function providerRequest(config: DocuSignConfig, path: string, init?: RequestInit) {
  const token = await accessToken(config);
  const res = await fetch(`${config.apiBase}/v2.1/accounts/${config.accountId}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers }, signal: AbortSignal.timeout(25000),
  });
  must(res.ok, `DocuSign konnte die Anfrage nicht abschließen (${res.status}).`, 'upstream_error');
  return res;
}
export async function syncEnvelope(db: SupabaseClient, e: RecruiterEnvelope, cfg: DocuSignConfig): Promise<RecruiterEnvelope> {
  must(e.envelope_id, 'Noch kein DocuSign-Umschlag vorhanden.', 'conflict');
  if (['completed','declined','voided','manual_review'].includes(e.state)) return e;
  // Browser events and webhook payloads are never accepted as signing proof.
  const status = await (await providerRequest(cfg, `/envelopes/${e.envelope_id}?include=recipients`)).json();
  const proof = signingEvidence(status.status, status.recipients?.signers ?? [], e.snapshot.signerEmail, e.counter_email);
  const patch: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
  if (proof.recruiter && !e.recruiter_signed_at) patch.recruiter_signed_at = proof.recruiter;
  if (proof.counter && !e.countersigned_at) patch.countersigned_at = proof.counter;
  if (proof.late) patch.state = 'manual_review';
  else if (proof.terminal) patch.state = proof.terminal;
  else if (proof.completed) {
    for (const [providerId, name] of [['combined','signed_document'], ['certificate','certificate']] as const) {
      const bytes = new Uint8Array(await (await providerRequest(cfg, `/envelopes/${e.envelope_id}/documents/${providerId}`)).arrayBuffer());
      must(new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-', 'DocuSign hat keinen gültigen PDF-Nachweis geliefert.', 'upstream_error');
      const path = `${e.case_id}/${e.id}/${providerId}.pdf`;
      const { error } = await db.storage.from('recruiter-contracts').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      dbError(error);
      patch[`${name}_path`] = path; patch[`${name}_sha256`] = await sha256(bytes);
    }
    patch.state = 'completed';
  } else if (status.status !== 'created') patch.state = 'sent';
  const updated = await patchEnvelope(db, e, patch);
  // Headhunter hat unterschrieben: Matchunt per Mail zum Gegenzeichnen auffordern (einmal je Vertrag, wirft nie).
  await noticeRecruiterSigned(db, updated, cfg);
  return updated;
}
export async function publicCase(db: SupabaseClient, c: OnboardingCase) {
  const { data, error } = await db.from('recruiter_contract_envelopes')
    .select('id,state,package_version,documents,recruiter_client_user_id,recruiter_signed_at,countersigned_at,last_synced_at,signed_document_path,certificate_path')
    .eq('case_id', c.id).order('created_at', { ascending: false });
  dbError(error);
  // Freischaltung ist ein eigener Admin-Schritt (user_roles.verified). Die Seite
  // zeigt danach das Einrichten des Passworts statt der Wartemeldung.
  let activated = false;
  if (c.claimed_by) {
    const { data: role, error: roleError } = await db.from('user_roles').select('verified').eq('user_id', c.claimed_by).eq('role', 'recruiter').maybeSingle();
    dbError(roleError); activated = role?.verified === true;
  }
  // Explicit allowlist: never return token hash, internal notes or checks/evidence
  // about other contacts through the recruiter endpoint.
  return { id: c.id, revision: c.revision, kind: c.kind, email: c.email, profile: c.profile,
    state: c.state, feedback: c.feedback, contracts: data ?? [], activated };
}
