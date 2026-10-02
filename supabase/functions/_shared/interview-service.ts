// deno-lint-ignore-file no-explicit-any
// Fachlogik der Interview-Terminierung v2. Die Functions interview-request,
// get-interview-by-token, process-interview-response und interview-client-link
// dispatchen nur hierher.
//
// Ablauf: Der Kunde schlägt 1–5 feste Termine vor (Kollegen Pflicht/optional).
// Kandidat und Headhunter werden benachrichtigt. Der Kandidat bestätigt einen
// Termin, wählt eine andere Zeit (bei verbundenem Kalender sofort gebucht,
// sonst bestätigt der Kunde) oder lehnt ab. Steht der Termin, entsteht der
// Teams-Link (im Outlook des Kunden oder über das Matchunt-Konto) und jede
// Seite bekommt ihre eigene Kalendereinladung.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fail, type FailureReason } from './http.ts';
import { canUserActOnJob } from './team-access.ts';
import { generateToken, hashToken } from './tokens.ts';
import { getPublicAppUrl } from './app-url.ts';
import {
  alternativeSlots, isSlotStillFree, normalizeRules, scheduleSlots, stepFor,
  type Interval, type InterviewHoursRules, type ScheduleParticipant,
} from './interview-availability.ts';
import { berlinDateKey, berlinLocalToUtc, formatBerlinDateShort, nextDateKey } from './interview-time.ts';
import { buildIcs, inviteUid } from './interview-ics.ts';
import { sendInterviewMail, type InterviewMail, type MailResult } from './interview-mailer.ts';
import * as mails from './interview-mails.ts';
import {
  cancelEvent, createMatchuntMeeting, createTeamsEvent, deleteMatchuntMeeting, getBusy, msConfig,
  userAccessToken, type MsConfig,
} from './msgraph-calendar.ts';

// ---------------------------------------------------------------------------
// Fehler
// ---------------------------------------------------------------------------

export class InterviewError extends Error {
  constructor(public reason: FailureReason, message: string) { super(message); }
}
export function must(condition: unknown, message: string, reason: FailureReason = 'invalid_request'): asserts condition {
  if (!condition) throw new InterviewError(reason, message);
}
export function dbFail(error: { message: string; code?: string } | null, what = 'Der Vorgang') {
  if (!error) return;
  if (error.code === '42P01' || error.code === '42703' || /does not exist/.test(error.message)) {
    throw new InterviewError('not_deployed', 'Die Migration für die Interview-Terminierung ist noch nicht installiert.');
  }
  console.error('[interview] Datenbankfehler', error.code, error.message);
  throw new InterviewError('internal_error', `${what} konnte nicht gespeichert werden.`);
}
export function interviewFailure(e: unknown): Response {
  if (e instanceof InterviewError) return fail(e.reason, e.message);
  console.error('[interview] Fehler', e instanceof Error ? `${e.name}: ${e.message}` : e);
  return fail('upstream_error', 'Das hat nicht geklappt. Bitte erneut versuchen.');
}

// ---------------------------------------------------------------------------
// Umgebung (für Tests austauschbar)
// ---------------------------------------------------------------------------

export interface ServiceCtx {
  db: SupabaseClient;
  now: () => number;
  appUrl: () => string;
  ms: MsConfig | null;
  fromEmail: string;
  mail: (mail: InterviewMail, log: { template: string; meta: Record<string, unknown> }) => Promise<MailResult>;
}

export function defaultCtx(db: SupabaseClient): ServiceCtx {
  const fromEmail = Deno.env.get('INTERVIEW_FROM_EMAIL') ?? 'termine@matchunt.ai';
  return {
    db,
    now: () => Date.now(),
    appUrl: getPublicAppUrl,
    ms: msConfig(),
    fromEmail,
    mail: async (mail, log) => {
      const { data: row } = await db.from('email_events').insert({ to_email: mail.to, template_name: log.template, subject: mail.subject, status: 'pending', metadata: log.meta }).select('id').maybeSingle();
      const result = await sendInterviewMail(mail);
      if (row?.id) {
        await db.from('email_events').update({ status: result.sent ? 'sent' : 'failed', error_message: result.error ?? null, metadata: { ...log.meta, resend_id: result.id ?? null, via: result.via ?? null } }).eq('id', row.id);
      }
      if (!result.sent) console.warn('[interview] Mail nicht versendet', log.template, result.error);
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLOSED_STAGES = ['hired', 'placed', 'rejected', 'client_rejected', 'withdrawn', 'expired'];

export interface TeamPerson { userId: string; name: string; email: string; title: string | null; role: string }
export interface AttendeeDraft { userId?: string | null; email: string; name: string; title?: string | null; required: boolean; kind: 'client_user' | 'external' }

interface SubmissionBundle {
  submission: any;
  job: any;
  candidate: any;
}

async function loadSubmission(db: SupabaseClient, submissionId: string): Promise<SubmissionBundle> {
  must(typeof submissionId === 'string' && UUID.test(submissionId), 'Ungültige Bewerbung.');
  const { data, error } = await db.from('submissions')
    .select('id, stage, status, identity_unlocked, recruiter_id, candidate_id, job_id, jobs!inner(id, title, company_name, client_id, organization_id, industry), candidates!inner(id, full_name, email, phone, job_title)')
    .eq('id', submissionId).maybeSingle();
  dbFail(error, 'Die Bewerbung');
  must(data, 'Bewerbung nicht gefunden.', 'not_found');
  return { submission: data, job: (data as any).jobs, candidate: (data as any).candidates };
}

async function profileOf(db: SupabaseClient, userId: string | null | undefined): Promise<{ name: string; email: string | null; phone: string | null; title: string | null } | null> {
  if (!userId) return null;
  const { data } = await db.from('profiles').select('full_name, email, phone, role_title').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  return { name: data.full_name || (data.email ? data.email.split('@')[0] : 'Unbekannt'), email: data.email ?? null, phone: data.phone ?? null, title: data.role_title ?? null };
}

async function personOf(db: SupabaseClient, user: User): Promise<TeamPerson> {
  const prof = await profileOf(db, user.id);
  return {
    userId: user.id,
    name: prof?.name || String(user.user_metadata?.full_name ?? '') || (user.email ?? '').split('@')[0],
    email: (prof?.email || user.email || '').toLowerCase(),
    title: prof?.title ?? null,
    role: 'owner',
  };
}

async function teamOf(db: SupabaseClient, job: any, me: TeamPerson): Promise<TeamPerson[]> {
  if (!job.organization_id) return [];
  const ids = new Map<string, string>();
  const { data: org } = await db.from('organizations').select('owner_id').eq('id', job.organization_id).maybeSingle();
  if (org?.owner_id) ids.set(org.owner_id, 'owner');
  const { data: members } = await db.from('organization_members').select('user_id, role, status').eq('organization_id', job.organization_id).eq('status', 'active');
  for (const m of members ?? []) if (!ids.has(m.user_id)) ids.set(m.user_id, m.role);
  ids.delete(me.userId);
  if (!ids.size) return [];
  const { data: profiles } = await db.from('profiles').select('user_id, full_name, email, role_title').in('user_id', [...ids.keys()]);
  return (profiles ?? [])
    .filter((p: any) => p.email && ids.get(p.user_id) !== 'finance')
    .map((p: any) => ({ userId: p.user_id, name: p.full_name || p.email.split('@')[0], email: String(p.email).toLowerCase(), title: p.role_title ?? null, role: ids.get(p.user_id) ?? 'member' }))
    .sort((a: TeamPerson, b: TeamPerson) => a.name.localeCompare(b.name, 'de'));
}

const anonCode = (candidateId: string) => `PR-${String(candidateId ?? '').slice(0, 6).toUpperCase()}`;
const candidateLabel = (b: SubmissionBundle) => (b.submission.identity_unlocked ? b.candidate.full_name : `${b.candidate.job_title || 'Kandidat'} · ${anonCode(b.candidate.id)}`);
const firstName = (full: string | null | undefined) => (full ? full.trim().split(/\s+/)[0] : null);

async function hoursOf(db: SupabaseClient, userId: string): Promise<InterviewHoursRules> {
  const { data } = await db.from('client_interview_hours').select('rules').eq('user_id', userId).maybeSingle();
  return normalizeRules(data?.rules);
}

async function organizerToken(ctx: ServiceCtx, userId: string | null | undefined): Promise<string | null> {
  if (!ctx.ms || !userId) return null;
  try {
    return await userAccessToken(ctx.db, ctx.ms, userId);
  } catch (e) {
    console.warn('[interview] Outlook-Token nicht verfügbar', e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Belegt: Outlook + schon gebuchte bzw. vorgeschlagene Matchunt-Interviews
// ---------------------------------------------------------------------------

async function matchuntBooked(db: SupabaseClient, userIds: string[], fromMs: number, toMs: number, excludeInterviewId?: string | null): Promise<Map<string, Interval[]>> {
  const out = new Map<string, Interval[]>();
  if (!userIds.length) return out;
  const { data } = await db.from('interview_attendees')
    .select('user_id, interviews!inner(id, status, scheduled_at, duration_minutes, proposed_slots)')
    .in('user_id', userIds);
  for (const row of (data ?? []) as any[]) {
    const iv = row.interviews;
    if (!iv || iv.id === excludeInterviewId) continue;
    const dur = (iv.duration_minutes ?? 60) * 60000;
    const starts: number[] = [];
    if (iv.status === 'scheduled' && iv.scheduled_at) starts.push(Date.parse(iv.scheduled_at));
    if (iv.status === 'pending_response') for (const s of (iv.proposed_slots ?? []) as any[]) starts.push(Date.parse(s.datetime));
    for (const start of starts) {
      if (!Number.isFinite(start) || start + dur < fromMs || start > toMs) continue;
      const list = out.get(row.user_id) ?? [];
      list.push({ start, end: start + dur });
      out.set(row.user_id, list);
    }
  }
  return out;
}

interface PeopleQuery { organizerId: string; organizer: { email: string; name: string }; attendees: AttendeeDraft[]; fromMs: number; toMs: number; excludeInterviewId?: string | null }

async function participantsFor(ctx: ServiceCtx, q: PeopleQuery): Promise<{ connected: boolean; participants: (ScheduleParticipant & { visible: boolean })[] }> {
  const others = q.attendees.filter((a) => a.email.toLowerCase() !== q.organizer.email.toLowerCase());
  const token = await organizerToken(ctx, q.organizerId);
  let busy: Record<string, Interval[] | null> = {};
  if (token) {
    try {
      busy = await getBusy(token, [q.organizer.email, ...others.map((a) => a.email)], q.fromMs, q.toMs);
    } catch (e) {
      console.warn('[interview] frei/belegt nicht abrufbar', e instanceof Error ? e.message : e);
    }
  }
  const booked = await matchuntBooked(ctx.db, [q.organizerId, ...others.map((a) => a.userId).filter(Boolean) as string[]], q.fromMs, q.toMs, q.excludeInterviewId);
  const entry = (key: string, name: string, required: boolean, email: string, userId?: string | null, external = false) => {
    const b = token ? busy[email.toLowerCase()] : undefined;
    // Ohne Verbindung kennen wir nur Matchunt-Termine; die Person gilt als „nicht sichtbar“, blockiert aber nichts.
    const visible = !!token && Array.isArray(b);
    return { key, name, required, busy: visible ? b! : (external || token ? null : []), booked: userId ? booked.get(userId) ?? [] : [], visible };
  };
  const participants = [
    entry(q.organizerId, q.organizer.name, true, q.organizer.email, q.organizerId),
    ...others.map((a) => entry(a.userId ?? a.email.toLowerCase(), a.name, a.required, a.email, a.userId, a.kind === 'external')),
  ];
  return { connected: !!token, participants };
}

// ---------------------------------------------------------------------------
// Kunde: Kontext, Verfügbarkeit, Vorschau, Senden
// ---------------------------------------------------------------------------

function cleanAttendees(raw: unknown, me: TeamPerson, team: TeamPerson[]): AttendeeDraft[] {
  const list = Array.isArray(raw) ? raw : [];
  must(list.length <= 12, 'Bitte höchstens 12 Teilnehmer.');
  const byId = new Map(team.map((t) => [t.userId, t]));
  const seen = new Set<string>([me.email]);
  const out: AttendeeDraft[] = [];
  for (const a of list as any[]) {
    const email = String(a?.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    must(EMAIL.test(email), `Ungültige E-Mail-Adresse: ${email}`);
    const member = a?.userId ? byId.get(String(a.userId)) : team.find((t) => t.email === email);
    seen.add(email);
    out.push(member
      ? { userId: member.userId, email: member.email, name: member.name, title: member.title, required: a?.required !== false, kind: 'client_user' }
      : { userId: null, email, name: String(a?.name ?? '').trim().slice(0, 120) || email, title: a?.title ? String(a.title).slice(0, 120) : null, required: a?.required === true, kind: 'external' });
  }
  return out;
}

async function requireClient(ctx: ServiceCtx, user: User, submissionId: string) {
  const bundle = await loadSubmission(ctx.db, submissionId);
  must(await canUserActOnJob(ctx.db, user.id, bundle.job.id), 'Für diese Stelle dürfen Sie keine Interviews anfragen.', 'not_allowed');
  return bundle;
}

async function openInterviewOf(db: SupabaseClient, submissionId: string) {
  const { data } = await db.from('interviews').select('id, status, created_at, round, submission_id').eq('submission_id', submissionId)
    .in('status', ['pending_response', 'counter_proposed']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function nextRound(db: SupabaseClient, submissionId: string): Promise<number> {
  const { data } = await db.from('interviews').select('round, status, scheduled_at').eq('submission_id', submissionId);
  const done = (data ?? []).filter((r: any) => ['completed', 'scheduled'].includes(r.status) || (r.status === 'no_show'));
  return Math.max(0, ...done.map((r: any) => Number(r.round) || 1)) + 1;
}

async function previousAttendees(db: SupabaseClient, submissionId: string): Promise<AttendeeDraft[]> {
  const { data } = await db.from('interviews').select('id').eq('submission_id', submissionId).in('status', ['completed', 'scheduled']).order('scheduled_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return [];
  const { data: rows } = await db.from('interview_attendees').select('user_id, email, name, title, required, kind, is_organizer').eq('interview_id', data.id);
  return (rows ?? []).filter((r: any) => !r.is_organizer).map((r: any) => ({ userId: r.user_id, email: r.email, name: r.name, title: r.title, required: r.required, kind: r.kind }));
}

export async function calendarStatusFor(ctx: ServiceCtx, userId: string) {
  if (!ctx.ms) return { state: 'not_configured', provider: null, accountEmail: null, itRequest: null };
  const { data: conn } = await ctx.db.from('calendar_connections').select('status, account_email').eq('user_id', userId).eq('provider', 'microsoft').maybeSingle();
  const { data: it } = await ctx.db.from('calendar_it_requests').select('it_email, sent_at, status').eq('requested_by', userId).order('sent_at', { ascending: false }).limit(1).maybeSingle();
  const itRequest = it && it.status === 'sent' ? { itEmail: it.it_email, sentAt: it.sent_at } : null;
  if (conn?.status === 'connected') return { state: 'connected', provider: 'microsoft', accountEmail: conn.account_email, itRequest: null };
  if (conn && (conn.status === 'expired' || conn.status === 'error')) return { state: 'expired', provider: 'microsoft', accountEmail: conn.account_email, itRequest };
  return { state: itRequest ? 'it_pending' : 'not_connected', provider: null, accountEmail: null, itRequest };
}

const DEFAULT_MESSAGE = 'Vielen Dank für Ihr Interesse an der Stelle. Wir freuen uns auf ein erstes Kennenlernen und darauf, mehr über Ihre Erfahrungen zu hören.';

export async function requestContext(ctx: ServiceCtx, user: User, submissionId: string) {
  const bundle = await requireClient(ctx, user, submissionId);
  const me = await personOf(ctx.db, user);
  const [team, recruiter, round, prev, calendar, hours, open] = await Promise.all([
    teamOf(ctx.db, bundle.job, me),
    profileOf(ctx.db, bundle.submission.recruiter_id),
    nextRound(ctx.db, submissionId),
    previousAttendees(ctx.db, submissionId),
    calendarStatusFor(ctx, user.id),
    hoursOf(ctx.db, user.id),
    openInterviewOf(ctx.db, submissionId),
  ]);
  return {
    submissionId,
    jobId: bundle.job.id,
    jobTitle: bundle.job.title,
    companyName: bundle.job.company_name,
    candidateLabel: candidateLabel(bundle),
    candidateName: bundle.submission.identity_unlocked ? bundle.candidate.full_name : null,
    identityUnlocked: !!bundle.submission.identity_unlocked,
    recruiterName: recruiter?.name ?? null,
    round: open?.round ?? round,
    me,
    team,
    previousAttendees: prev,
    calendar,
    hours,
    defaultMessage: round > 1 ? 'Vielen Dank für das erste Gespräch. Wir möchten Sie gern zu einem weiteren Gespräch einladen.' : DEFAULT_MESSAGE,
    openRequest: open ? { interviewId: open.id, status: open.status, createdAt: open.created_at } : null,
  };
}

const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export async function availability(ctx: ServiceCtx, user: User, body: any) {
  const bundle = await requireClient(ctx, user, body.submissionId);
  const duration = Number(body.durationMinutes);
  must([30, 45, 60, 90, 120].includes(duration), 'Ungültige Dauer.');
  must(typeof body.weekStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart), 'Ungültige Woche.');
  const me = await personOf(ctx.db, user);
  const team = await teamOf(ctx.db, bundle.job, me);
  const attendees = cleanAttendees(body.attendees, me, team);
  const rules = await hoursOf(ctx.db, user.id);
  const [y, m, d] = body.weekStart.split('-').map(Number);
  const fromMs = berlinLocalToUtc(y, m, d, 0, 0);
  const endKey = nextDateKey(body.weekStart, 7);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const toMs = berlinLocalToUtc(ey, em, ed, 0, 0);
  const { connected, participants } = await participantsFor(ctx, { organizerId: user.id, organizer: me, attendees, fromMs, toMs });
  const slots = scheduleSlots({ rules: { ...rules, horizonDays: 60 }, durationMinutes: duration, fromMs, toMs, nowMs: ctx.now(), participants });
  const days: { date: string; label: string; slots: typeof slots }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = nextDateKey(body.weekStart, i);
    const daySlots = slots.filter((s) => berlinDateKey(Date.parse(s.start)) === key);
    if (i >= 5 && !daySlots.length) continue;
    const [, dm, dd] = key.split('-').map(Number);
    days.push({ date: key, label: `${WEEKDAY_SHORT[i]} ${dd}.${dm}.`, slots: daySlots });
  }
  return {
    connected,
    stepMinutes: stepFor(duration),
    days,
    people: participants.map((p) => ({ key: p.key, name: p.name, required: p.required, visible: p.visible })),
  };
}

interface SendDraft {
  durationMinutes: number;
  slots: string[];
  attendees: AttendeeDraft[];
  allowAlternative: boolean;
  alternativeRules: InterviewHoursRules;
  message: string | null;
  round: number;
  replacesInterviewId: string | null;
}

function validateDraft(ctx: ServiceCtx, body: any, me: TeamPerson, team: TeamPerson[]): SendDraft {
  const duration = Number(body.durationMinutes);
  must([30, 45, 60, 90, 120].includes(duration), 'Bitte eine Dauer wählen.');
  const raw = Array.isArray(body.slots) ? body.slots : [];
  must(raw.length >= 1, 'Bitte mindestens einen Termin vorschlagen.');
  must(raw.length <= 5, 'Bitte höchstens 5 Termine vorschlagen.');
  const slots = [...new Set<string>(raw.map((s: unknown) => String(s)))].map((s: string) => {
    const t = Date.parse(s);
    must(Number.isFinite(t), 'Ungültiger Termin.');
    must(t > ctx.now() + 30 * 60000, 'Termine müssen in der Zukunft liegen.');
    return new Date(t).toISOString();
  }).sort();
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  return {
    durationMinutes: duration,
    slots,
    attendees: cleanAttendees(body.attendees, me, team),
    allowAlternative: body.allowAlternative !== false,
    alternativeRules: normalizeRules(body.alternativeRules),
    message: message || null,
    round: Math.max(1, Math.min(9, Number(body.round) || 1)),
    replacesInterviewId: typeof body.replacesInterviewId === 'string' && UUID.test(body.replacesInterviewId) ? body.replacesInterviewId : null,
  };
}

function interviewerRefs(me: TeamPerson, attendees: AttendeeDraft[]) {
  return [{ name: me.name, title: me.title }, ...attendees.map((a) => ({ name: a.name, title: a.title ?? null }))];
}

export async function preview(ctx: ServiceCtx, user: User, body: any) {
  const bundle = await requireClient(ctx, user, body.submissionId);
  const me = await personOf(ctx.db, user);
  const team = await teamOf(ctx.db, bundle.job, me);
  const draft = validateDraft({ ...ctx, now: () => 0 }, body, me, team);
  const recruiter = await profileOf(ctx.db, bundle.submission.recruiter_id);
  const content = mails.candidateInvitation({
    firstName: bundle.submission.identity_unlocked ? firstName(bundle.candidate.full_name) : '[Vorname]',
    companyName: bundle.job.company_name,
    jobTitle: bundle.job.title,
    durationMinutes: draft.durationMinutes,
    slots: draft.slots,
    link: `${ctx.appUrl()}/interview/respond/vorschau`,
    message: draft.message,
    interviewers: interviewerRefs(me, draft.attendees),
    recruiter: recruiter ? { name: recruiter.name, phone: recruiter.phone } : null,
    round: draft.round,
    allowAlternative: draft.allowAlternative,
    consentRequired: !bundle.submission.identity_unlocked,
  });
  return { subject: content.subject, html: content.html, fromName: recruiter ? `${recruiter.name} über Matchunt` : 'Matchunt' };
}

export async function send(ctx: ServiceCtx, user: User, body: any) {
  const bundle = await requireClient(ctx, user, body.submissionId);
  const stage = String(bundle.submission.stage ?? bundle.submission.status ?? '');
  must(!CLOSED_STAGES.includes(stage) && !CLOSED_STAGES.includes(String(bundle.submission.status ?? '')), 'Diese Bewerbung ist abgeschlossen.', 'conflict');
  must(bundle.candidate.email && EMAIL.test(bundle.candidate.email), 'Für diesen Kandidaten ist keine E-Mail-Adresse hinterlegt. Bitte den Headhunter kontaktieren.', 'conflict');
  const me = await personOf(ctx.db, user);
  const team = await teamOf(ctx.db, bundle.job, me);
  const draft = validateDraft(ctx, body, me, team);
  const recruiter = await profileOf(ctx.db, bundle.submission.recruiter_id);

  // Offene Anfrage ersetzen (oder gezielt die angegebene)
  const open: { id: string; status: string; round: number | null; submission_id: string } | null = draft.replacesInterviewId
    ? (await ctx.db.from('interviews').select('id, status, round, submission_id').eq('id', draft.replacesInterviewId).maybeSingle()).data
    : await openInterviewOf(ctx.db, bundle.submission.id);
  if (draft.replacesInterviewId) must(open && open.submission_id === bundle.submission.id, 'Die zu ersetzende Anfrage gehört nicht zu dieser Bewerbung.');
  const round = open?.round ?? (await nextRound(ctx.db, bundle.submission.id));

  const token = generateToken();
  const lastSlot = Date.parse(draft.slots[draft.slots.length - 1]);
  const expires = Math.max(lastSlot, ctx.now() + draft.alternativeRules.horizonDays * 86400000) + 3 * 86400000;
  const { data: iv, error } = await ctx.db.from('interviews').insert({
    submission_id: bundle.submission.id,
    status: 'pending_response',
    proposed_slots: draft.slots.map((datetime) => ({ datetime, status: 'available' })),
    duration_minutes: draft.durationMinutes,
    meeting_format: 'teams',
    meeting_type: 'teams',
    client_message: draft.message,
    round,
    requested_by: user.id,
    organizer_user_id: user.id,
    allow_alternative: draft.allowAlternative,
    alternative_rules: draft.alternativeRules,
    response_token_hash: await hashToken(token),
    response_token_expires_at: new Date(expires).toISOString(),
    pending_opt_in: !bundle.submission.identity_unlocked,
  }).select('id').single();
  dbFail(error, 'Die Anfrage');

  const attendeeRows = [
    { interview_id: iv!.id, user_id: me.userId, email: me.email, name: me.name, title: me.title, required: true, kind: 'client_user', is_organizer: true },
    ...draft.attendees.map((a) => ({ interview_id: iv!.id, user_id: a.userId ?? null, email: a.email, name: a.name, title: a.title ?? null, required: a.required, kind: a.kind, is_organizer: false })),
  ];
  const { error: attErr } = await ctx.db.from('interview_attendees').insert(attendeeRows);
  dbFail(attErr, 'Die Teilnehmer');

  if (open) {
    await supersede(ctx, open.id, iv!.id, user.id);
  }

  await ctx.db.from('submissions').update({ stage: 'interview_requested', opt_in_requested_at: new Date(ctx.now()).toISOString() }).eq('id', bundle.submission.id);

  const link = `${ctx.appUrl()}/interview/respond/${token}`;
  const fromName = recruiter ? `${recruiter.name} über Matchunt` : 'Matchunt';
  const invitation = mails.candidateInvitation({
    firstName: firstName(bundle.candidate.full_name),
    companyName: bundle.job.company_name,
    jobTitle: bundle.job.title,
    durationMinutes: draft.durationMinutes,
    slots: draft.slots,
    link,
    message: draft.message,
    interviewers: interviewerRefs(me, draft.attendees),
    recruiter: recruiter ? { name: recruiter.name, phone: recruiter.phone } : null,
    round,
    allowAlternative: draft.allowAlternative,
    consentRequired: !bundle.submission.identity_unlocked,
  });
  const candidateMail = await ctx.mail({ fromEmail: ctx.fromEmail, fromName, to: bundle.candidate.email, replyTo: recruiter?.email ?? undefined, ...invitation }, { template: 'interview_invitation_v2', meta: { interview_id: iv!.id, submission_id: bundle.submission.id } });

  let recruiterMail: MailResult = { sent: false };
  if (recruiter?.email) {
    const content = mails.recruiterRequested({
      recruiterFirstName: firstName(recruiter.name),
      candidateName: bundle.candidate.full_name,
      candidatePhone: bundle.candidate.phone ?? null,
      companyName: bundle.job.company_name,
      jobTitle: bundle.job.title,
      slots: draft.slots,
      durationMinutes: draft.durationMinutes,
      round,
      detailUrl: `${ctx.appUrl()}/recruiter/submissions/${bundle.submission.id}`,
    });
    recruiterMail = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: recruiter.email, ...content }, { template: 'interview_requested_recruiter', meta: { interview_id: iv!.id } });
  }
  await notify(ctx, bundle.submission.recruiter_id, 'interview_requested', `${bundle.job.company_name} möchte ${bundle.candidate.full_name} sprechen`, `Interview-Anfrage für ${bundle.job.title}: ${draft.slots.length} Terminvorschläge.`, iv!.id);

  return {
    interviewId: iv!.id,
    candidateMailSent: candidateMail.sent,
    recruiterMailSent: recruiterMail.sent,
    warning: candidateMail.sent ? null : 'Die Einladung an den Kandidaten konnte nicht verschickt werden. Bitte den Headhunter informieren.',
  };
}

/** Alte offene Anfrage durch eine neue ersetzen; war sie schon gebucht, Termin absagen. */
async function supersede(ctx: ServiceCtx, oldId: string, newId: string, userId: string) {
  const { data: old } = await ctx.db.from('interviews').select('*').eq('id', oldId).maybeSingle();
  if (!old) return;
  if (old.status === 'scheduled') await cancelBookedMeeting(ctx, old, 'Der Termin wird neu abgestimmt.');
  await ctx.db.from('interviews').update({
    status: 'cancelled', cancelled_at: new Date(ctx.now()).toISOString(), cancelled_by: userId,
    cancellation_reason: 'Durch neue Terminvorschläge ersetzt', superseded_by: newId,
    response_token_expires_at: new Date(ctx.now()).toISOString(), client_token_hash: null,
  }).eq('id', oldId);
}

async function notify(ctx: ServiceCtx, userId: string | null | undefined, type: string, title: string, message: string, interviewId: string) {
  if (!userId) return;
  const { error } = await ctx.db.from('notifications').insert({ user_id: userId, type, title, message, related_type: 'interview', related_id: interviewId });
  if (error) console.warn('[interview] Benachrichtigung nicht gespeichert', error.code, error.message);
}

// ---------------------------------------------------------------------------
// Gemeinsam: Interview mit Umfeld laden
// ---------------------------------------------------------------------------

interface InterviewBundle extends SubmissionBundle {
  interview: any;
  attendees: any[];
  organizer: any | null;
  recruiter: { name: string; email: string | null; phone: string | null; title: string | null } | null;
}

async function loadInterview(db: SupabaseClient, where: { id?: string; tokenHash?: string; legacyToken?: string; clientTokenHash?: string }): Promise<InterviewBundle | null> {
  let q = db.from('interviews').select('*');
  if (where.id) q = q.eq('id', where.id);
  else if (where.tokenHash) q = q.eq('response_token_hash', where.tokenHash);
  else if (where.clientTokenHash) q = q.eq('client_token_hash', where.clientTokenHash);
  else if (where.legacyToken) q = q.eq('response_token', where.legacyToken);
  else return null;
  const { data: interview, error } = await q.maybeSingle();
  dbFail(error, 'Das Interview');
  if (!interview) return null;
  const bundle = await loadSubmission(db, interview.submission_id);
  const { data: attendees } = await db.from('interview_attendees').select('*').eq('interview_id', interview.id).order('is_organizer', { ascending: false }).order('created_at');
  const recruiter = await profileOf(db, bundle.submission.recruiter_id);
  return { ...bundle, interview, attendees: attendees ?? [], organizer: (attendees ?? []).find((a: any) => a.is_organizer) ?? null, recruiter };
}

async function byCandidateToken(db: SupabaseClient, token: unknown): Promise<InterviewBundle> {
  must(typeof token === 'string' && token.length >= 20 && token.length <= 100, 'Dieser Link ist ungültig.', 'not_found');
  const found = (await loadInterview(db, { tokenHash: await hashToken(token) })) ?? (await loadInterview(db, { legacyToken: token }));
  must(found, 'Dieser Link ist ungültig oder abgelaufen.', 'not_found');
  return found;
}

/** Empfänger auf Kundenseite: Organisator; bei alten Anfragen ohne Teilnehmer der Ersteller der Stelle. */
async function clientRecipients(db: SupabaseClient, b: InterviewBundle): Promise<{ user_id: string | null; email: string; name: string }[]> {
  const organizers = b.attendees.filter((a: any) => a.is_organizer);
  if (organizers.length) return organizers;
  const prof = await profileOf(db, b.interview.requested_by ?? b.job.client_id);
  return prof?.email ? [{ user_id: b.interview.requested_by ?? b.job.client_id, email: prof.email, name: prof.name }] : [];
}

const tokenExpired = (b: InterviewBundle, now: number) => !!b.interview.response_token_expires_at && Date.parse(b.interview.response_token_expires_at) < now;

// ---------------------------------------------------------------------------
// Kandidatenseite
// ---------------------------------------------------------------------------

export const CONSENT_VERSION = '2026-10-v1';
const consentText = (company: string) =>
  `Ich gebe ${company} für dieses Bewerbungsverfahren meinen Namen, meine Kontaktdaten und meinen Lebenslauf frei. Ich kann die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.`;

async function alternativesFor(ctx: ServiceCtx, b: InterviewBundle) {
  const iv = b.interview;
  const rules = normalizeRules(iv.alternative_rules);
  const fromMs = ctx.now();
  const toMs = ctx.now() + rules.horizonDays * 86400000;
  const attendees: AttendeeDraft[] = b.attendees.filter((a: any) => !a.is_organizer).map((a: any) => ({ userId: a.user_id, email: a.email, name: a.name, title: a.title, required: a.required, kind: a.kind }));
  const organizerId = iv.organizer_user_id ?? b.organizer?.user_id;
  const organizer = { email: b.organizer?.email ?? '', name: b.organizer?.name ?? 'Organisator' };
  const { connected, participants } = organizerId
    ? await participantsFor(ctx, { organizerId, organizer, attendees, fromMs, toMs, excludeInterviewId: iv.id })
    : { connected: false, participants: [] };
  const query = { rules, durationMinutes: iv.duration_minutes ?? 60, fromMs, toMs, nowMs: ctx.now(), participants };
  const exclude = ((iv.proposed_slots ?? []) as any[]).map((s) => s.datetime);
  return { connected, query, slots: alternativeSlots({ ...query, exclude }) };
}

function stateOf(b: InterviewBundle, now: number): string {
  const iv = b.interview;
  if (iv.status === 'scheduled') return iv.scheduled_at && Date.parse(iv.scheduled_at) + (iv.duration_minutes ?? 60) * 60000 < now ? 'completed' : 'scheduled';
  if (iv.status === 'counter_proposed') return 'alternative_requested';
  if (iv.status === 'declined') return 'declined';
  if (iv.status === 'cancelled') return 'cancelled';
  if (['completed', 'no_show'].includes(iv.status)) return 'completed';
  if (tokenExpired(b, now)) return 'expired';
  return 'open';
}

export async function candidateView(ctx: ServiceCtx, b: InterviewBundle) {
  const iv = b.interview;
  const now = ctx.now();
  const state = stateOf(b, now);
  const consentRequired = !b.submission.identity_unlocked && !iv.consent_given_at;
  let alternatives: { date: string; label: string; times: string[] }[] = [];
  let alternativeMode: 'book' | 'request' = 'request';
  if (state === 'open' && iv.allow_alternative) {
    const alt = await alternativesFor(ctx, b);
    alternativeMode = alt.connected ? 'book' : 'request';
    const byDay = new Map<string, string[]>();
    for (const s of alt.slots) {
      const key = berlinDateKey(Date.parse(s.start));
      byDay.set(key, [...(byDay.get(key) ?? []), s.start]);
    }
    alternatives = [...byDay.entries()].slice(0, 10).map(([date, times]) => ({ date, label: formatBerlinDateShort(times[0]), times }));
  }
  return {
    state,
    companyName: b.job.company_name,
    jobTitle: b.job.title,
    durationMinutes: iv.duration_minutes ?? 60,
    format: 'teams',
    message: iv.client_message ?? null,
    interviewers: b.attendees.map((a: any) => ({ name: a.name, title: a.title ?? null })),
    recruiter: b.recruiter ? { name: b.recruiter.name, phone: b.recruiter.phone, email: b.recruiter.email } : null,
    candidateFirstName: firstName(b.candidate.full_name),
    consentRequired,
    consentText: consentText(b.job.company_name),
    consentVersion: CONSENT_VERSION,
    slots: ((iv.proposed_slots ?? []) as any[]).map((s) => ({ start: s.datetime, available: Date.parse(s.datetime) > now + 30 * 60000 })),
    allowAlternative: !!iv.allow_alternative,
    alternativeMode,
    alternatives,
    scheduled: state === 'scheduled' || state === 'completed' ? { start: iv.scheduled_at, joinUrl: iv.teams_join_url ?? iv.meeting_link ?? null, icsUrl: candidateIcsUrl(b) } : null,
    requested: state === 'alternative_requested' ? { start: (iv.counter_slots ?? [])[0]?.datetime ?? null, message: iv.candidate_message ?? null } : null,
    round: iv.round ?? 1,
  };
}

/** „Zum Kalender hinzufügen“: dieselbe UID wie die Mail-Einladung, damit kein doppelter Eintrag entsteht. */
function candidateIcsUrl(b: InterviewBundle): string | null {
  const iv = b.interview;
  if (!iv.scheduled_at || !b.candidate.email) return null;
  const ics = buildIcs({
    method: 'REQUEST', uid: inviteUid(iv.id, 'candidate'), sequence: 0, startIso: iv.scheduled_at, durationMinutes: iv.duration_minutes ?? 60,
    summary: `Interview: ${b.job.title} bei ${b.job.company_name}`,
    description: inviteDescription(iv.teams_join_url ?? null, ''), location: 'Microsoft Teams-Besprechung', url: iv.teams_join_url ?? undefined,
    organizerEmail: 'termine@matchunt.ai', organizerName: 'Matchunt Termine', attendeeEmail: b.candidate.email, attendeeName: b.candidate.full_name,
  });
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export async function loadCandidateView(ctx: ServiceCtx, token: unknown) {
  return candidateView(ctx, await byCandidateToken(ctx.db, token));
}

function requireConsent(b: InterviewBundle, body: any) {
  if (b.submission.identity_unlocked || b.interview.consent_given_at) return null;
  must(body.consentGiven === true, 'Bitte stimmen Sie der Freigabe Ihrer Daten zu.');
  return { source: 'interview_v2', text_version: String(body.consentTextVersion ?? CONSENT_VERSION), consented_at: new Date().toISOString() };
}

export async function candidateRespond(ctx: ServiceCtx, body: any) {
  const b = await byCandidateToken(ctx.db, body.token);
  const now = ctx.now();
  const state = stateOf(b, now);
  must(state === 'open', state === 'expired' ? 'Diese Einladung ist abgelaufen.' : 'Diese Einladung wurde bereits beantwortet.', 'conflict');
  const iv = b.interview;

  if (body.action === 'accept') {
    const slot = ((iv.proposed_slots ?? []) as any[]).find((s) => Date.parse(s.datetime) === Date.parse(String(body.slotStart)));
    must(slot, 'Bitte einen der vorgeschlagenen Termine wählen.');
    must(Date.parse(slot.datetime) > now + 30 * 60000, 'Dieser Termin liegt zu kurz vor dem Beginn. Bitte einen anderen wählen.');
    const consent = requireConsent(b, body);
    await finalizeBooking(ctx, b, slot.datetime, { by: 'candidate', consent });
  } else if (body.action === 'alternative') {
    must(iv.allow_alternative, 'Für diese Einladung ist keine andere Zeit vorgesehen.');
    const start = new Date(Date.parse(String(body.start))).toISOString();
    const alt = await alternativesFor(ctx, b);
    must(alt.slots.some((s) => s.start === start), 'Diese Zeit ist nicht mehr frei. Bitte eine andere wählen.', 'conflict');
    const consent = requireConsent(b, body);
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) || null : null;
    if (alt.connected) {
      await finalizeBooking(ctx, b, start, { by: 'candidate', consent, candidateMessage: message });
    } else {
      await requestAlternative(ctx, b, start, message, consent);
    }
  } else if (body.action === 'decline') {
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;
    await declineInterview(ctx, b, reason);
  } else {
    must(false, 'Unbekannte Aktion.');
  }
  return candidateView(ctx, (await loadInterview(ctx.db, { id: iv.id }))!);
}

async function requestAlternative(ctx: ServiceCtx, b: InterviewBundle, start: string, message: string | null, consent: Record<string, unknown> | null) {
  const iv = b.interview;
  const clientToken = generateToken();
  const { data: updated, error } = await ctx.db.from('interviews').update({
    status: 'counter_proposed',
    counter_slots: [{ datetime: start }],
    candidate_message: message,
    consent_given_at: consent ? consent.consented_at : iv.consent_given_at,
    client_token_hash: await hashToken(clientToken),
    client_token_expires_at: new Date(ctx.now() + 7 * 86400000).toISOString(),
  }).eq('id', iv.id).eq('status', 'pending_response').select('id').maybeSingle();
  dbFail(error, 'Die Anfrage');
  must(updated, 'Diese Einladung wurde bereits beantwortet.', 'conflict');
  if (consent) await ctx.db.from('submissions').update({ consent_confirmed: true, consent_confirmed_at: consent.consented_at }).eq('id', b.submission.id);
  await ctx.db.from('submissions').update({ stage: 'interview_counter_proposed' }).eq('id', b.submission.id);

  const duration = iv.duration_minutes ?? 60;
  const label = candidateLabel(b);
  const agendaUrl = `${ctx.appUrl()}/dashboard/interviews?interview=${iv.id}`;
  const confirmUrl = `${ctx.appUrl()}/interview/bestaetigen/${clientToken}`;
  for (const r of await clientRecipients(ctx.db, b)) {
    const content = mails.clientAlternative({ candidateLabel: label, jobTitle: b.job.title, startIso: start, durationMinutes: duration, message, confirmUrl, agendaUrl });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: r.email, ...content }, { template: 'interview_alternative_client', meta: { interview_id: iv.id } });
    await notify(ctx, r.user_id, 'interview_alternative', 'Der Kandidat fragt eine andere Zeit an', `${label}: ${formatBerlinDateShort(start)}`, iv.id);
  }
  const receipt = mails.candidateRequestReceived({ firstName: firstName(b.candidate.full_name), companyName: b.job.company_name, startIso: start, durationMinutes: duration, recruiterName: b.recruiter?.name ?? null });
  await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.candidate.email, ...receipt }, { template: 'interview_alternative_candidate', meta: { interview_id: iv.id } });
  if (b.recruiter?.email) {
    const content = mails.recruiterUpdate({ kind: 'alternative', candidateName: b.candidate.full_name, companyName: b.job.company_name, jobTitle: b.job.title, startIso: start, durationMinutes: duration, detailUrl: `${ctx.appUrl()}/recruiter/submissions/${b.submission.id}` });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'interview_alternative_recruiter', meta: { interview_id: iv.id } });
  }
  await notify(ctx, b.submission.recruiter_id, 'interview_alternative', `${b.candidate.full_name} fragt eine andere Zeit an`, b.job.title, iv.id);
}

async function declineInterview(ctx: ServiceCtx, b: InterviewBundle, reason: string | null) {
  const iv = b.interview;
  const { data: updated, error } = await ctx.db.from('interviews').update({ status: 'declined', decline_reason: reason })
    .eq('id', iv.id).in('status', ['pending_response', 'counter_proposed']).select('id').maybeSingle();
  dbFail(error, 'Die Absage');
  must(updated, 'Diese Einladung wurde bereits beantwortet.', 'conflict');
  await ctx.db.from('submissions').update({ stage: 'interview_declined' }).eq('id', b.submission.id);
  const label = candidateLabel(b);
  for (const r of await clientRecipients(ctx.db, b)) {
    const content = mails.clientDeclined({ candidateLabel: label, jobTitle: b.job.title, reason, recruiterName: b.recruiter?.name ?? null, agendaUrl: `${ctx.appUrl()}/dashboard/candidates` });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: r.email, ...content }, { template: 'interview_declined_client', meta: { interview_id: iv.id } });
    await notify(ctx, r.user_id, 'interview_declined', `${label} hat das Interview abgelehnt`, reason ?? b.job.title, iv.id);
  }
  if (b.recruiter?.email) {
    const content = mails.recruiterUpdate({ kind: 'declined', candidateName: b.candidate.full_name, companyName: b.job.company_name, jobTitle: b.job.title, reason, detailUrl: `${ctx.appUrl()}/recruiter/submissions/${b.submission.id}` });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'interview_declined_recruiter', meta: { interview_id: iv.id } });
  }
  await notify(ctx, b.submission.recruiter_id, 'interview_declined', `${b.candidate.full_name} hat das Interview abgelehnt`, reason ?? b.job.title, iv.id);
}

// ---------------------------------------------------------------------------
// Buchung abschließen: Status, Freigabe, Teams-Link, Einladungen, Mails
// ---------------------------------------------------------------------------

interface BookingOptions { by: 'candidate' | 'client'; consent?: Record<string, unknown> | null; candidateMessage?: string | null; clientUserId?: string }

export async function finalizeBooking(ctx: ServiceCtx, b: InterviewBundle, startIso: string, opts: BookingOptions) {
  const iv = b.interview;
  const nowIso = new Date(ctx.now()).toISOString();
  const duration = iv.duration_minutes ?? 60;
  const startMs = Date.parse(startIso);

  // Bei verbundenem Kalender kurz vor dem Buchen erneut prüfen
  const organizerId = iv.organizer_user_id ?? b.organizer?.user_id;
  if (opts.by === 'candidate' && organizerId) {
    const attendees: AttendeeDraft[] = b.attendees.filter((a: any) => !a.is_organizer).map((a: any) => ({ userId: a.user_id, email: a.email, name: a.name, title: a.title, required: a.required, kind: a.kind }));
    const { connected, participants } = await participantsFor(ctx, { organizerId, organizer: { email: b.organizer?.email ?? '', name: b.organizer?.name ?? '' }, attendees, fromMs: startMs - 3 * 3600000, toMs: startMs + 6 * 3600000, excludeInterviewId: iv.id });
    if (connected) {
      const free = isSlotStillFree({ rules: { weekly: { '1': [['00:00', '23:59']], '2': [['00:00', '23:59']], '3': [['00:00', '23:59']], '4': [['00:00', '23:59']], '5': [['00:00', '23:59']], '6': [['00:00', '23:59']], '7': [['00:00', '23:59']] }, bufferMinutes: 0, minNoticeHours: 0, horizonDays: 60, skipHolidays: false, absences: [] }, durationMinutes: duration, fromMs: 0, toMs: 0, nowMs: ctx.now(), participants, stepMinutes: 5 }, new Date(startMs).toISOString());
      must(free, 'Dieser Termin ist inzwischen belegt. Bitte einen anderen wählen.', 'conflict');
    }
  }

  const { data: updated, error } = await ctx.db.from('interviews').update({
    status: 'scheduled',
    scheduled_at: new Date(startMs).toISOString(),
    selected_slot_index: ((iv.proposed_slots ?? []) as any[]).findIndex((s) => Date.parse(s.datetime) === startMs),
    candidate_confirmed: true,
    candidate_confirmed_at: nowIso,
    client_confirmed: opts.by === 'client' ? true : iv.client_confirmed,
    client_confirmed_at: opts.by === 'client' ? nowIso : iv.client_confirmed_at,
    candidate_message: opts.candidateMessage ?? iv.candidate_message,
    consent_given_at: opts.consent ? opts.consent.consented_at : iv.consent_given_at,
    pending_opt_in: false,
    client_token_hash: null,
  }).eq('id', iv.id).in('status', ['pending_response', 'counter_proposed']).select('*').maybeSingle();
  dbFail(error, 'Der Termin');
  must(updated, 'Diese Einladung wurde bereits beantwortet.', 'conflict');
  b.interview = updated;

  // Freigabe der Identität: in Runde 1 mit der Einwilligung des Kandidaten
  const consentAt = (opts.consent?.consented_at as string | undefined) ?? updated.consent_given_at ?? null;
  const submissionPatch: Record<string, unknown> = { stage: 'interview_scheduled' };
  if (!b.submission.identity_unlocked && consentAt) {
    Object.assign(submissionPatch, {
      identity_unlocked: true, unlocked_at: nowIso,
      company_revealed: true, company_revealed_at: nowIso,
      full_access_granted: true, full_access_granted_at: nowIso,
      consent_confirmed: true, consent_confirmed_at: consentAt,
    });
  }
  const { error: subErr } = await ctx.db.from('submissions').update(submissionPatch).eq('id', b.submission.id);
  if (subErr) console.error('[interview] Freigabe nicht gespeichert', subErr.code, subErr.message);
  if (opts.consent) {
    // consent_meta ist nicht in allen Umgebungen vorhanden: getrennt und fehlertolerant schreiben
    const { error: metaErr } = await ctx.db.from('submissions').update({ consent_meta: { ...opts.consent, interview_id: iv.id } }).eq('id', b.submission.id);
    if (metaErr) console.warn('[interview] consent_meta nicht gespeichert', metaErr.code);
  }
  b.submission.identity_unlocked = b.submission.identity_unlocked || !!consentAt;

  // Teams-Link
  const subject = `Interview: ${b.candidate.full_name} · ${b.job.title}`;
  const appLink = `${ctx.appUrl()}/dashboard/interviews?interview=${iv.id}`;
  let provider: 'client_calendar' | 'matchunt_teams' | 'none' = 'none';
  let joinUrl: string | null = null;
  const patch: Record<string, unknown> = {};
  const token = await organizerToken(ctx, organizerId);
  if (token) {
    try {
      const ev = await createTeamsEvent(token, {
        subject,
        bodyHtml: `<p>Interview über Matchunt mit ${b.candidate.full_name} für ${b.job.title}.</p><p>Lebenslauf, Leitfaden und Umbuchen: <a href="${appLink}">${appLink}</a></p>`,
        startMs, endMs: startMs + duration * 60000,
        attendees: b.attendees.filter((a: any) => !a.is_organizer).map((a: any) => ({ email: a.email, name: a.name, required: a.required })),
        transactionId: `matchunt-${iv.id}`,
      });
      provider = 'client_calendar';
      joinUrl = ev.joinUrl;
      Object.assign(patch, { outlook_event_id: ev.eventId, calendar_event_id: ev.eventId, teams_join_url: ev.joinUrl });
    } catch (e) {
      console.warn('[interview] Termin im Outlook des Kunden nicht angelegt', e instanceof Error ? e.message : e);
    }
  }
  if (provider === 'none' && ctx.ms) {
    try {
      const meeting = await createMatchuntMeeting(ctx.ms, subject, startMs, startMs + duration * 60000);
      if (meeting) {
        provider = 'matchunt_teams';
        joinUrl = meeting.joinUrl;
        Object.assign(patch, { teams_meeting_id: meeting.meetingId, teams_join_url: meeting.joinUrl });
      }
    } catch (e) {
      console.warn('[interview] Matchunt-Teams-Besprechung nicht angelegt', e instanceof Error ? e.message : e);
    }
  }
  await ctx.db.from('interviews').update({ ...patch, meeting_provider: provider }).eq('id', iv.id);
  b.interview = { ...b.interview, ...patch, meeting_provider: provider };

  await sendBookingMails(ctx, b, startMs, joinUrl, provider);
}

function inviteDescription(joinUrl: string | null, extra: string) {
  return [joinUrl ? `Microsoft Teams: ${joinUrl}` : 'Den Teams-Link bekommen Sie rechtzeitig vor dem Termin.', 'Teilnahme mit Teams-App oder im Browser, kein Konto nötig.', extra].filter(Boolean).join('\n\n');
}

async function sendInvite(ctx: ServiceCtx, b: InterviewBundle, r: { key: string; email: string; name: string }, method: 'REQUEST' | 'CANCEL', content: mails.MailContent, ics: { summary: string; description: string; startMs: number }, template: string) {
  const iv = b.interview;
  const { data: existing } = await ctx.db.from('interview_invites').select('id, uid, sequence').eq('interview_id', iv.id).eq('recipient_key', r.key).maybeSingle();
  const uid = existing?.uid ?? inviteUid(iv.id, r.key);
  const sequence = existing ? existing.sequence + 1 : 0;
  const icsContent = buildIcs({
    method, uid, sequence, startIso: new Date(ics.startMs).toISOString(), durationMinutes: iv.duration_minutes ?? 60,
    summary: ics.summary, description: ics.description, location: 'Microsoft Teams-Besprechung', url: iv.teams_join_url ?? undefined,
    organizerEmail: ctx.fromEmail, organizerName: 'Matchunt Termine', attendeeEmail: r.email, attendeeName: r.name, nowMs: ctx.now(),
  });
  const result = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt Termine', to: r.email, ...content, ics: { content: icsContent, method } }, { template, meta: { interview_id: iv.id, recipient: r.key } });
  await ctx.db.from('interview_invites').upsert({
    interview_id: iv.id, recipient_key: r.key, email: r.email, uid, sequence,
    last_method: method, last_sent_at: new Date(ctx.now()).toISOString(), last_error: result.sent ? null : (result.error ?? 'nicht versendet'),
  }, { onConflict: 'interview_id,recipient_key' });
  return result;
}

async function sendBookingMails(ctx: ServiceCtx, b: InterviewBundle, startMs: number, joinUrl: string | null, provider: string) {
  const iv = b.interview;
  const duration = iv.duration_minutes ?? 60;
  const startIso = new Date(startMs).toISOString();
  const recruiterRef = b.recruiter ? { name: b.recruiter.name, phone: b.recruiter.phone } : null;
  const candidateName = b.candidate.full_name;
  const agendaUrl = `${ctx.appUrl()}/dashboard/interviews?interview=${iv.id}`;
  const interviewerNames = b.attendees.map((a: any) => a.name).join(', ');

  // Kandidat
  await sendInvite(ctx, b, { key: 'candidate', email: b.candidate.email, name: candidateName },
    'REQUEST',
    mails.candidateBooked({ firstName: firstName(candidateName), companyName: b.job.company_name, jobTitle: b.job.title, startIso, durationMinutes: duration, joinUrl, recruiter: recruiterRef, link: '' }),
    { summary: `Interview: ${b.job.title} bei ${b.job.company_name}`, description: inviteDescription(joinUrl, `Gesprächspartner: ${interviewerNames}${recruiterRef ? `\nFragen: ${recruiterRef.name}${recruiterRef.phone ? `, ${recruiterRef.phone}` : ''}` : ''}`), startMs },
    'interview_booked_candidate');

  // Headhunter
  if (b.recruiter?.email) {
    await sendInvite(ctx, b, { key: 'recruiter', email: b.recruiter.email, name: b.recruiter.name }, 'REQUEST',
      mails.recruiterUpdate({ kind: 'booked', candidateName, companyName: b.job.company_name, jobTitle: b.job.title, startIso, durationMinutes: duration, detailUrl: `${ctx.appUrl()}/recruiter/submissions/${b.submission.id}` }),
      { summary: `Interview ${candidateName} · ${b.job.company_name}`, description: inviteDescription(joinUrl, `Kandidat: ${candidateName}\nStelle: ${b.job.title}`), startMs },
      'interview_booked_recruiter');
  }

  // Kundenseite (alte Anfragen ohne Teilnehmerliste: Ersteller der Stelle als Organisator)
  const clientSide = b.attendees.length ? b.attendees : (await clientRecipients(ctx.db, b)).map((r, i) => ({ ...r, id: `legacy-${i}`, is_organizer: true }));
  for (const a of clientSide) {
    if (a.is_organizer) {
      const content = mails.clientBooked({ candidateName, jobTitle: b.job.title, startIso, durationMinutes: duration, inOutlook: provider === 'client_calendar', profileUrl: `${ctx.appUrl()}/dashboard/candidates/${b.submission.id}` });
      if (provider === 'client_calendar') {
        await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: a.email, ...content }, { template: 'interview_booked_client', meta: { interview_id: iv.id } });
      } else {
        await sendInvite(ctx, b, { key: `a-${a.id}`, email: a.email, name: a.name }, 'REQUEST', content,
          { summary: `Interview: ${candidateName} · ${b.job.title}`, description: inviteDescription(joinUrl, `Lebenslauf und Leitfaden: ${agendaUrl}`), startMs }, 'interview_booked_client');
      }
      await notify(ctx, a.user_id, 'interview_scheduled', `${candidateName} hat das Interview bestätigt`, formatBerlinDateShort(startIso), iv.id);
    } else if (provider !== 'client_calendar') {
      // Im Outlook-Fall verschickt Outlook die Einladung an die Kollegen selbst
      await sendInvite(ctx, b, { key: `a-${a.id}`, email: a.email, name: a.name }, 'REQUEST',
        mails.attendeeBooked({ name: a.name, organizerName: b.organizer?.name ?? 'Ihr Team', candidateName, jobTitle: b.job.title, startIso, durationMinutes: duration, joinUrl, agendaUrl }),
        { summary: `Interview: ${candidateName} · ${b.job.title}`, description: inviteDescription(joinUrl, `Lebenslauf und Leitfaden: ${agendaUrl}`), startMs }, 'interview_booked_attendee');
    }
  }
  await notify(ctx, b.submission.recruiter_id, 'interview_scheduled', `Interview steht: ${candidateName}`, `${b.job.title} · ${formatBerlinDateShort(startIso)}`, iv.id);
}

/** Gebuchten Termin absagen: Outlook-Termin bzw. Matchunt-Besprechung löschen und Absagen an alle Matchunt-Einladungen. */
async function cancelBookedMeeting(ctx: ServiceCtx, iv: any, comment: string) {
  const b = await loadInterview(ctx.db, { id: iv.id });
  if (!b) return;
  if (iv.meeting_provider === 'client_calendar' && iv.outlook_event_id) {
    const token = await organizerToken(ctx, iv.organizer_user_id);
    if (token) await cancelEvent(token, iv.outlook_event_id, comment).catch((e) => console.warn('[interview] Outlook-Absage gescheitert', e?.message));
  }
  if (iv.meeting_provider === 'matchunt_teams' && iv.teams_meeting_id && ctx.ms) {
    await deleteMatchuntMeeting(ctx.ms, iv.teams_meeting_id).catch((e) => console.warn('[interview] Besprechung nicht gelöscht', e?.message));
  }
  const { data: invites } = await ctx.db.from('interview_invites').select('recipient_key, email').eq('interview_id', iv.id).eq('last_method', 'REQUEST');
  const startMs = Date.parse(iv.scheduled_at);
  for (const inv of invites ?? []) {
    const content: mails.MailContent = {
      subject: `Abgesagt: Interview ${b.job.title}`,
      html: `<p>Der Termin am ${formatBerlinDateShort(iv.scheduled_at)} wurde abgesagt. ${comment}</p>`,
      text: `Der Termin am ${formatBerlinDateShort(iv.scheduled_at)} wurde abgesagt. ${comment}`,
    };
    await sendInvite(ctx, b, { key: inv.recipient_key, email: inv.email, name: inv.email }, 'CANCEL', content,
      { summary: `Interview ${b.job.title}`, description: comment, startMs }, 'interview_cancelled');
  }
}

// ---------------------------------------------------------------------------
// Kunde bestätigt die andere Zeit (eingeloggt oder per Link aus der Mail)
// ---------------------------------------------------------------------------

export async function confirmAlternative(ctx: ServiceCtx, user: User, interviewId: string) {
  must(typeof interviewId === 'string' && UUID.test(interviewId), 'Ungültiges Interview.');
  const b = await loadInterview(ctx.db, { id: interviewId });
  must(b, 'Interview nicht gefunden.', 'not_found');
  must(await canUserActOnJob(ctx.db, user.id, b.job.id), 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  must(b.interview.status === 'counter_proposed', 'Es liegt keine Anfrage für eine andere Zeit vor.', 'conflict');
  const start = (b.interview.counter_slots ?? [])[0]?.datetime;
  must(start && Date.parse(start) > ctx.now(), 'Die angefragte Zeit liegt in der Vergangenheit. Bitte neue Termine vorschlagen.', 'conflict');
  await finalizeBooking(ctx, b, start, { by: 'client', clientUserId: user.id });
  return { scheduledAt: new Date(Date.parse(start)).toISOString() };
}

async function byClientToken(db: SupabaseClient, token: unknown) {
  must(typeof token === 'string' && token.length >= 20 && token.length <= 100, 'Dieser Link ist ungültig.', 'not_found');
  return await loadInterview(db, { clientTokenHash: await hashToken(token) });
}

function clientLinkView(b: InterviewBundle | null, now: number) {
  if (!b) return { state: 'gone', jobTitle: '', candidateLabel: '', requestedStart: null, durationMinutes: 60, candidateMessage: null, scheduledAt: null };
  const iv = b.interview;
  const expired = iv.client_token_expires_at && Date.parse(iv.client_token_expires_at) < now;
  const state = iv.status === 'scheduled' ? 'confirmed' : iv.status !== 'counter_proposed' ? 'gone' : expired ? 'expired' : 'open';
  return {
    state,
    jobTitle: b.job.title,
    candidateLabel: candidateLabel(b),
    requestedStart: (iv.counter_slots ?? [])[0]?.datetime ?? null,
    durationMinutes: iv.duration_minutes ?? 60,
    candidateMessage: iv.candidate_message ?? null,
    scheduledAt: iv.scheduled_at ?? null,
  };
}

export async function clientLink(ctx: ServiceCtx, body: any) {
  const b = await byClientToken(ctx.db, body.token);
  const view = clientLinkView(b, ctx.now());
  if (body.action === 'peek' || !b) return view;
  must(body.action === 'confirm', 'Unbekannte Aktion.');
  must(view.state === 'open', view.state === 'expired' ? 'Dieser Link ist abgelaufen. Bitte in Matchunt bestätigen.' : 'Diese Anfrage ist nicht mehr offen.', 'conflict');
  const start = view.requestedStart!;
  must(Date.parse(start) > ctx.now(), 'Die angefragte Zeit liegt in der Vergangenheit.', 'conflict');
  await finalizeBooking(ctx, b, start, { by: 'client' });
  return clientLinkView(await loadInterview(ctx.db, { id: b.interview.id }), ctx.now());
}

// ---------------------------------------------------------------------------
// Kunde zieht zurück
// ---------------------------------------------------------------------------

export async function withdraw(ctx: ServiceCtx, user: User, interviewId: string, reason: string) {
  must(typeof interviewId === 'string' && UUID.test(interviewId), 'Ungültiges Interview.');
  const b = await loadInterview(ctx.db, { id: interviewId });
  must(b, 'Interview nicht gefunden.', 'not_found');
  must(await canUserActOnJob(ctx.db, user.id, b.job.id), 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  const iv = b.interview;
  must(['pending_response', 'counter_proposed', 'scheduled'].includes(iv.status), 'Dieses Interview ist nicht mehr offen.', 'conflict');
  const text = String(reason ?? '').trim().slice(0, 500) || 'Vom Unternehmen zurückgezogen';
  if (iv.status === 'scheduled') await cancelBookedMeeting(ctx, iv, text);
  await ctx.db.from('interviews').update({
    status: 'cancelled', cancelled_at: new Date(ctx.now()).toISOString(), cancelled_by: user.id, cancellation_reason: text,
    response_token_expires_at: new Date(ctx.now()).toISOString(), client_token_hash: null,
  }).eq('id', iv.id);
  if (iv.status !== 'scheduled') {
    const content = mails.candidateWithdrawn({ firstName: firstName(b.candidate.full_name), companyName: b.job.company_name, jobTitle: b.job.title, recruiterName: b.recruiter?.name ?? null });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.candidate.email, ...content }, { template: 'interview_withdrawn_candidate', meta: { interview_id: iv.id } });
  }
  await notify(ctx, b.submission.recruiter_id, 'interview_cancelled', `Interview-Anfrage zurückgezogen: ${b.candidate.full_name}`, text, iv.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Anmeldung für Kunden-Aktionen
// ---------------------------------------------------------------------------

export async function authUser(req: Request): Promise<User> {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  must(!error && data.user, 'Bitte melden Sie sich an.', 'not_allowed');
  return data.user!;
}
