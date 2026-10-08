// Suchen, Kundensicht, Bestandskunden und Partner-Stufen: eine Stelle für alle
// Aufrufe der Datenbankfunktionen aus 20261008120000_suchen_kundenschutz_stufen.sql.
// Die Funktionen sind noch nicht im generierten Supabase-Typ, deshalb die Casts.

import { supabase } from '@/integrations/supabase/client';

type RpcResult<T> = { data: T | null; error: { message: string; hint?: string; code?: string } | null };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = (await (supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<RpcResult<T>>)(
    fn,
    args,
  ));
  if (error) {
    const err = new Error(error.message) as Error & { hint?: string; code?: string };
    err.hint = error.hint;
    err.code = error.code;
    throw err;
  }
  return data as T;
}

export const errorHint = (e: unknown): string | undefined => (e as { hint?: string })?.hint;
export const errorText = (e: unknown, fallback = 'Das hat nicht geklappt. Bitte gleich noch einmal versuchen.'): string =>
  (e as { message?: string })?.message || fallback;

// ---------------------------------------------------------------------------
// Partner-Stufen
// ---------------------------------------------------------------------------

export type PartnerTier = 'partner' | 'silver' | 'gold';

export const TIER_LABEL: Record<PartnerTier, string> = {
  partner: 'Partner',
  silver: 'Silber Partner',
  gold: 'Gold Partner',
};

export const TIER_COLOR: Record<PartnerTier, string> = {
  partner: 'text-muted-foreground',
  silver: 'text-slate-400',
  gold: 'text-amber-500',
};

export const TIER_THRESHOLDS = {
  silver: { interviews: 5, placements: 1, quote: 0.2 },
  gold: { placements: 3, quote: 0.35, months: 6 },
};

export interface TierMetrics {
  submissions: number;
  interviews: number;
  placements: number;
  interview_quote: number | null;
  months_active: number;
  violation: boolean;
}

export interface PartnerProgress {
  tier: PartnerTier;
  tier_since: string | null;
  tier_valid_until: string | null;
  partner_number: string;
  metrics: TierMetrics;
  override: boolean;
}

export const myPartnerProgress = () => rpc<PartnerProgress | null>('my_partner_progress');

/** Was fehlt bis zur nächsten Stufe – in Worten für den Headhunter. */
export function nextTierHint(p: PartnerProgress): string | null {
  const m = p.metrics;
  if (p.tier === 'partner') {
    const iv = Math.max(0, TIER_THRESHOLDS.silver.interviews - m.interviews);
    return iv > 0 && m.placements < 1
      ? `Noch ${iv} Kunden-${iv === 1 ? 'Interview' : 'Interviews'} oder 1 Einstellung bis Silber`
      : null;
  }
  if (p.tier === 'silver') {
    const pl = Math.max(0, TIER_THRESHOLDS.gold.placements - m.placements);
    const mo = Math.max(0, TIER_THRESHOLDS.gold.months - m.months_active);
    const parts = [
      pl > 0 ? `${pl} ${pl === 1 ? 'Einstellung' : 'Einstellungen'}` : null,
      mo > 0 ? `${mo} ${mo === 1 ? 'Monat' : 'Monate'} dabei` : null,
    ].filter(Boolean);
    return parts.length ? `Noch ${parts.join(' und ')} bis Gold` : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Suchen des Headhunters
// ---------------------------------------------------------------------------

export interface StartSearchResult {
  activation_id: string;
  status: 'active' | 'paused' | 'ended';
  company_name: string | null;
  location: string | null;
  ends_at: string | null;
  needs_client_answer: boolean;
  slots_used: number;
  slot_limit: number;
  over_limit: boolean;
}

export const startJobSearch = (jobId: string, forSubmission = false) =>
  rpc<StartSearchResult>('start_job_search', { p_job_id: jobId, p_for_submission: forSubmission });

export const endJobSearch = (jobId: string) => rpc<{ status: string; slot_until: string | null }>('end_job_search', { p_job_id: jobId });

export const mySearchCapacity = () => rpc<{ used: number; limit: number }>('my_search_capacity');

export type ClientAnswer = 'no' | 'client' | 'direct_position';

export const answerClientQuestion = (jobId: string, answer: ClientAnswer) =>
  rpc<{ client_declaration_id: string | null; direct_declaration_id: string | null }>('answer_client_question', {
    p_job_id: jobId,
    p_answer: answer,
  });

/** Beleg hochladen (privater Ordner des Headhunters) und an die Angabe hängen. */
export async function uploadDeclarationProof(userId: string, declarationId: string, kind: 'contract' | 'assignment', file: File) {
  const safe = file.name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
  const path = `${userId}/${declarationId}/${kind}-${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from('recruiter-proofs').upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  await rpc<void>('attach_declaration_proof', { p_declaration_id: declarationId, p_kind: kind, p_path: path });
  return path;
}

export interface MySearch {
  job_id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  status: 'active' | 'paused' | 'ended';
  started_at: string;
  ends_at: string | null;
  ended_at: string | null;
  end_reason: 'self' | 'expired' | 'job_closed' | 'direct_position' | 'admin' | null;
  slot_until: string | null;
  review_hold: boolean;
  job_status: string | null;
  job_paused_until: string | null;
  job_pause_reason: string | null;
  submissions: number;
  in_process: number;
  last_submission_at: string | null;
  /** „no:none“, „client:pending“, „client:confirmed“, „client:rejected“ oder null (offen) */
  client_declaration: string | null;
  client_declaration_id: string | null;
  direct_declaration: 'pending' | 'confirmed' | 'rejected' | null;
  direct_declaration_id: string | null;
}

export const mySearches = () => rpc<MySearch[]>('my_searches');

export const daysUntil = (iso: string | null | undefined): number | null =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : null;

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

export const fmtDayShort = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';

// ---------------------------------------------------------------------------
// Kunde
// ---------------------------------------------------------------------------

export interface JobSearcher {
  activation_id: string;
  recruiter_id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_path: string | null;
  partner_number: string | null;
  tier: PartnerTier | null;
  is_new: boolean;
  status: 'active' | 'paused' | 'ended';
  started_at: string;
  ended_at: string | null;
  candidates: number;
  last_submission_at: string | null;
}

export const getJobSearchers = (jobId: string) => rpc<JobSearcher[]>('get_job_searchers', { p_job_id: jobId });

export async function getJobsSearcherCounts(jobIds: string[]): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};
  const rows = await rpc<{ job_id: string; searching: number }[]>('get_jobs_searcher_counts', { p_job_ids: jobIds });
  return Object.fromEntries((rows ?? []).map((r) => [r.job_id, r.searching]));
}

export type ContactChannel = 'phone' | 'email' | 'linkedin' | 'other';

export const reportDirectContact = (jobId: string, recruiterId: string, channel: ContactChannel, note: string) =>
  rpc<string>('report_direct_contact', { p_job_id: jobId, p_recruiter_id: recruiterId, p_channel: channel, p_note: note });

export interface DirectPositionRequest {
  declaration_id: string;
  recruiter_name: string;
  created_at: string;
  client_answer: 'yes' | 'no' | null;
}

export const getDirectPositionRequests = (jobId: string) =>
  rpc<DirectPositionRequest[]>('get_job_direct_position_requests', { p_job_id: jobId });

export const answerDirectPosition = (declarationId: string, answer: 'yes' | 'no') =>
  rpc<void>('client_answer_direct_position', { p_declaration_id: declarationId, p_answer: answer });

export const pauseJob = (jobId: string, until: Date, reason: string) =>
  rpc<void>('client_pause_job', { p_job_id: jobId, p_until: until.toISOString(), p_reason: reason });

export const resumeJob = (jobId: string) => rpc<void>('client_resume_job', { p_job_id: jobId });

export type CloseReason = 'filled_via_matchunt' | 'filled_elsewhere' | 'no_candidates' | 'cancelled';

export const closeJob = (p: {
  jobId: string;
  reason: CloseReason;
  note?: string;
  hireSubmissionId?: string | null;
  hireStart?: string | null;
  hireSalary?: number | null;
  notMatchunt?: boolean;
}) =>
  rpc<void>('client_close_job', {
    p_job_id: p.jobId,
    p_reason: p.reason,
    p_note: p.note ?? null,
    p_hire_submission_id: p.hireSubmissionId ?? null,
    p_hire_start: p.hireStart ?? null,
    p_hire_salary: p.hireSalary ?? null,
    p_not_matchunt: p.notMatchunt ?? null,
  });

export const requestCallback = (jobId: string, note?: string) =>
  rpc<void>('client_request_callback', { p_job_id: jobId, p_note: note ?? null });

/** Signierter Link zum Foto eines Headhunters (privater Bucket, Policy für Kunden seiner Stellen). */
export async function avatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('recruiter-avatars').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminContactReport {
  id: string;
  created_at: string;
  status: 'open' | 'confirmed' | 'dismissed';
  channel: ContactChannel;
  note: string | null;
  admin_note: string | null;
  job_id: string | null;
  job_title: string | null;
  company_name: string | null;
  recruiter_id: string;
  recruiter_name: string;
  reporter_name: string | null;
  name_shown_at: string | null;
}

export interface AdminDeclaration {
  id: string;
  created_at: string;
  answer: 'client' | 'direct_position';
  status: 'pending' | 'confirmed' | 'rejected';
  recruiter_id: string;
  recruiter_name: string;
  company_name: string | null;
  job_id: string | null;
  job_title: string | null;
  stichtag: string | null;
  contract_path: string | null;
  assignment_path: string | null;
  client_answer: 'yes' | 'no' | null;
  reject_reason: string | null;
}

export interface AdminJobChange {
  job_id: string;
  title: string;
  company_name: string;
  state: 'paused' | 'closed' | 'filled' | 'callback';
  paused_at: string | null;
  pause_until: string | null;
  pause_reason: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  closed_note: string | null;
  hire_candidate: string | null;
  hire_start: string | null;
  hire_salary: number | null;
  not_matchunt_confirmed: boolean | null;
  callback_requested_at: string | null;
}

export interface AdminPartnerTier {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  partner_number: string;
  tier: PartnerTier;
  tier_since: string | null;
  tier_valid_until: string | null;
  tier_override: PartnerTier | null;
  tier_override_reason: string | null;
  metrics: TierMetrics;
}

export const adminContactReports = () => rpc<AdminContactReport[]>('admin_contact_reports');
export const adminSetReportStatus = (id: string, status: AdminContactReport['status'], note: string) =>
  rpc<void>('admin_set_report_status', { p_id: id, p_status: status, p_note: note });
export const adminDeclarations = () => rpc<AdminDeclaration[]>('admin_declarations');
export const adminDecideDeclaration = (id: string, decision: 'confirm' | 'reject', reason: string) =>
  rpc<void>('admin_decide_declaration', { p_declaration_id: id, p_decision: decision, p_reason: reason });
export const adminJobChanges = () => rpc<AdminJobChange[]>('admin_job_changes');
export const adminPartnerTiers = () => rpc<AdminPartnerTier[]>('admin_partner_tiers');
export const adminSetPartnerTier = (userId: string, tier: PartnerTier | null, reason: string) =>
  rpc<PartnerTier>('admin_set_partner_tier', { p_user_id: userId, p_tier: tier, p_reason: reason });

export async function proofUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('recruiter-proofs').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
