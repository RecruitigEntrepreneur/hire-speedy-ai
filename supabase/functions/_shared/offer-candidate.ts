// deno-lint-ignore-file no-explicit-any
// Angebot schriftlich an den Kandidaten, Zusage nur vom Kandidaten (G + H, 25.10.2026).
//
//   Mail      „<Headhunter> über Matchunt“ (Antworten an den Headhunter) mit den Eckdaten
//             und einem persönlichen Link auf /angebot/:token. Sie geht sofort, wenn der
//             Headhunter „Gespräch geführt“ klickt, sonst nach 2 Stunden; zwischen 20 und
//             8 Uhr erst um 8 Uhr. Zeitversetzt verschickt Resend (scheduled_at); die
//             Kennungen stehen am Angebot und lassen sich abbrechen.
//   Seite     Zusage · Mit dem Headhunter sprechen · Absage (Grund Pflicht). Meldet der
//             Headhunter eine Zusage, bestätigt der Kandidat sie auf derselben Seite
//             (Zweck „confirm“): erst dann gilt sie und der Arbeitsvertrag beginnt.
//   Erinnern  einmal nach 24 Stunden (gleich mit eingeplant), danach gilt nur noch die
//             Antwortfrist; die Aufgabe „anrufen“ für den Headhunter entsteht beim Laden.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must, type ServiceCtx } from './interview-service.ts';
import { berlinLocalToUtc, berlinParts, formatBerlinTime } from './interview-time.ts';
import { generateToken, hashToken } from './tokens.ts';
import * as mails from './offer-mails.ts';

export const DELIVERY_DELAY_MS = 2 * 3600_000;
export const REMINDER_DELAY_MS = 24 * 3600_000;
export const CALLBACK_DELAY_MS = 2 * 3600_000;
const LINK_DAYS = 30;
/** Angebote, auf die der Kandidat noch antworten kann */
const ANSWERABLE = ['with_recruiter'];

export const DECLINE_REASONS: Record<string, string> = {
  salary: 'Gehalt', counter_offer: 'Gegenangebot des Arbeitgebers', other_job: 'andere Stelle', personal: 'persönliche Gründe', other: 'anderer Grund',
};

const LOCAL_SUPABASE = /^http:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?\/?$/;
const localDev = () => { try { return LOCAL_SUPABASE.test(Deno.env.get('SUPABASE_URL') ?? ''); } catch { return false; } };
const firstName = (full: string | null | undefined) => (full ? full.trim().split(/\s+/)[0] : null);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Ruhezeit: zwischen 20 und 8 Uhr (deutsche Zeit) wird auf 8 Uhr verschoben. */
export function outsideQuietHours(ms: number): number {
  const p = berlinParts(ms);
  if (p.hour >= 8 && p.hour < 20) return ms;
  if (p.hour < 8) return berlinLocalToUtc(p.year, p.month, p.day, 8, 0);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return berlinLocalToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 8, 0);
}
/** Spätester Versand der Mail an den Kandidaten */
export const deliveryTime = (nowMs: number) => outsideQuietHours(nowMs + DELIVERY_DELAY_MS);

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

export interface CandidateBundle {
  offer: any; submission: any; job: any; candidate: any;
  recruiter: { id: string; name: string; email: string | null; phone: string | null } | null;
}

export async function loadCandidateBundle(db: SupabaseClient, offerId: string): Promise<CandidateBundle> {
  const { data: offer, error } = await db.from('offers').select('*').eq('id', offerId).maybeSingle();
  dbFail(error, 'Das Angebot');
  must(offer, 'Angebot nicht gefunden.', 'not_found');
  const o = offer as any;
  const [{ data: submission }, { data: job }] = await Promise.all([
    db.from('submissions').select('id, job_id, candidate_id, recruiter_id, identity_unlocked, company_revealed, stage, status').eq('id', o.submission_id).maybeSingle(),
    db.from('jobs').select('id, title, company_name, client_id').eq('id', o.job_id).maybeSingle(),
  ]);
  must(submission && job, 'Bewerbung nicht gefunden.', 'not_found');
  const [{ data: candidate }, { data: rec }] = await Promise.all([
    db.from('candidates').select('id, full_name, email').eq('id', (submission as any).candidate_id).maybeSingle(),
    db.from('profiles').select('user_id, full_name, email, phone').eq('user_id', (submission as any).recruiter_id).maybeSingle(),
  ]);
  return {
    offer: o, submission, job,
    candidate: candidate ?? { id: (submission as any).candidate_id, full_name: 'Kandidat', email: null },
    recruiter: rec ? { id: (rec as any).user_id, name: (rec as any).full_name ?? 'Ihr Headhunter', email: (rec as any).email ?? null, phone: (rec as any).phone ?? null } : null,
  };
}

async function event(ctx: ServiceCtx, offerId: string, type: string, actorType: string, actorId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await ctx.db.from('offer_events').insert({ offer_id: offerId, event_type: type, actor_type: actorType, actor_id: actorId, details });
  if (error) console.warn('[offer-candidate] Verlauf nicht gespeichert', error.code, error.message);
}
async function notify(ctx: ServiceCtx, userId: string | null | undefined, type: string, title: string, message: string, relatedType: string, relatedId: string) {
  if (!userId) return;
  const { error } = await ctx.db.from('notifications').insert({ user_id: userId, type, title, message, related_type: relatedType, related_id: relatedId });
  if (error) console.warn('[offer-candidate] Benachrichtigung nicht gespeichert', error.code, error.message);
}
async function adminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('user_roles').select('user_id').eq('role', 'admin');
  return ((data ?? []) as any[]).map((r) => r.user_id);
}
async function profile(db: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return data ? { name: (data as any).full_name ?? '', email: (data as any).email ?? null } : null;
}

const factsOf = (o: any): mails.OfferFacts => ({
  salary: o.salary_offered, variable: o.variable_salary ?? null, startDate: o.start_date ?? null, responseDue: o.response_due ?? null,
  contractType: o.contract_type ?? null, probationMonths: o.probation_months ?? null, workModel: o.work_model ?? null, extras: o.extras ?? [],
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

async function createLink(ctx: ServiceCtx, offerId: string, purpose: 'answer' | 'confirm'): Promise<string> {
  const nowIso = new Date(ctx.now()).toISOString();
  await ctx.db.from('offer_candidate_links').update({ revoked_at: nowIso }).eq('offer_id', offerId).eq('purpose', purpose).is('revoked_at', null);
  const token = generateToken();
  const { error } = await ctx.db.from('offer_candidate_links').insert({
    offer_id: offerId, purpose, token_hash: await hashToken(token), created_at: nowIso,
    expires_at: new Date(ctx.now() + LINK_DAYS * 86400_000).toISOString(),
  });
  dbFail(error, 'Der Link für den Kandidaten');
  return token;
}

export async function revokeCandidateLinks(ctx: ServiceCtx, offerId: string) {
  await ctx.db.from('offer_candidate_links').update({ revoked_at: new Date(ctx.now()).toISOString() }).eq('offer_id', offerId).is('revoked_at', null);
}

const pageUrl = (ctx: ServiceCtx, token: string) => `${ctx.appUrl()}/angebot/${token}`;

// ---------------------------------------------------------------------------
// Mails planen, abbrechen, sofort schicken
// ---------------------------------------------------------------------------

async function sendCandidateMail(ctx: ServiceCtx, b: CandidateBundle, kind: mails.CandidateMailKind, token: string, atMs: number | null) {
  if (!b.candidate.email) return { sent: false, id: null as string | null };
  const recruiterName = b.recruiter?.name || 'Ihr Headhunter';
  const content = mails.candidateOffer({
    kind, candidateName: b.candidate.full_name, recruiterName, companyName: b.job.company_name, jobTitle: b.job.title,
    offer: factsOf(b.offer), version: b.offer.version ?? 1, message: b.offer.candidate_message ?? null, url: pageUrl(ctx, token),
    reportedAt: b.offer.accept_reported_at ?? null,
  });
  const result = await ctx.mail({
    fromEmail: ctx.fromEmail, fromName: `${recruiterName} über Matchunt`, to: b.candidate.email, replyTo: b.recruiter?.email ?? undefined,
    ...content, ...(atMs && atMs > ctx.now() + 60_000 ? { scheduledAt: new Date(atMs).toISOString() } : {}),
  }, { template: `offer_candidate_${kind}`, meta: { offer_id: b.offer.id, submission_id: b.submission.id } });
  // Nur lokaler Testmodus (ohne Mailversand): Link ins Protokoll
  if (!result.sent && localDev()) console.log(`[offer] Testmodus: Link für ${b.candidate.full_name} (${kind}) ${pageUrl(ctx, token)}`);
  return { sent: result.sent, id: result.id ?? null };
}

async function cancelMail(ctx: ServiceCtx, id: string | null | undefined) {
  if (id && ctx.mailCancel) await ctx.mailCancel(id);
}

/** Geplante Mails an den Kandidaten abbrechen (Antwort da, Angebot ersetzt, zurückgezogen …) */
export async function cancelCandidateMails(ctx: ServiceCtx, offer: any, opts: { keepMain?: boolean } = {}) {
  const now = ctx.now();
  if (!opts.keepMain && offer.candidate_mail_id && !offer.candidate_mail_sent_at && offer.candidate_mail_due_at && Date.parse(offer.candidate_mail_due_at) > now) {
    await cancelMail(ctx, offer.candidate_mail_id);
  }
  if (offer.candidate_reminder_mail_id && offer.candidate_reminder_due_at && Date.parse(offer.candidate_reminder_due_at) > now) {
    await cancelMail(ctx, offer.candidate_reminder_mail_id);
  }
}

/**
 * Mail mit dem Angebot an den Kandidaten: sofort (Version 2 nach angenommenem Wunsch,
 * „Gespräch geführt“) oder nach 2 Stunden, dazu die Erinnerung nach 24 Stunden.
 */
export async function scheduleCandidateMail(ctx: ServiceCtx, offerId: string, opts: { immediate?: boolean } = {}) {
  const b = await loadCandidateBundle(ctx.db, offerId);
  const now = ctx.now();
  const dueMs = opts.immediate ? now : deliveryTime(now);
  const reminderMs = outsideQuietHours(dueMs + REMINDER_DELAY_MS);
  const token = await createLink(ctx, offerId, 'answer');
  const main = await sendCandidateMail(ctx, b, 'offer', token, opts.immediate ? null : dueMs);
  const reminder = await sendCandidateMail(ctx, b, 'reminder', token, reminderMs);
  const patch = {
    candidate_mail_due_at: new Date(dueMs).toISOString(), candidate_mail_sent_at: opts.immediate && main.sent ? new Date(now).toISOString() : null,
    candidate_mail_id: main.id, candidate_reminder_due_at: new Date(reminderMs).toISOString(), candidate_reminder_mail_id: reminder.id,
  };
  await ctx.db.from('offers').update(patch).eq('id', offerId);
  await event(ctx, offerId, opts.immediate ? 'candidate_mailed' : 'candidate_mail_planned', 'system', null, { due: patch.candidate_mail_due_at });
  return { dueAt: patch.candidate_mail_due_at, sentNow: !!opts.immediate };
}

// ---------------------------------------------------------------------------
// Headhunter
// ---------------------------------------------------------------------------

async function requireRecruiter(ctx: ServiceCtx, user: User, offerId: unknown) {
  must(typeof offerId === 'string' && /^[0-9a-f-]{36}$/i.test(offerId), 'Ungültiges Angebot.');
  const b = await loadCandidateBundle(ctx.db, offerId as string);
  const { data: admin } = await ctx.db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  must(b.submission.recruiter_id === user.id || admin, 'Nur der Headhunter dieses Kandidaten.', 'not_allowed');
  return b;
}

/** „Gespräch geführt“: die geplante Mail geht jetzt raus, die Erinnerung rückt nach. */
export async function recruiterTalked(ctx: ServiceCtx, user: User, body: any) {
  const b = await requireRecruiter(ctx, user, body?.offerId);
  const o = b.offer;
  must(ANSWERABLE.includes(o.status), 'Dieses Angebot ist nicht mehr offen.', 'conflict');
  const now = ctx.now();
  const nowIso = new Date(now).toISOString();
  await ctx.db.from('offers').update({ recruiter_talked_at: nowIso }).eq('id', o.id);
  const alreadySent = !!o.candidate_mail_sent_at || (o.candidate_mail_due_at && Date.parse(o.candidate_mail_due_at) <= now);
  if (alreadySent) return { ok: true, alreadySent: true };
  await cancelCandidateMails(ctx, o);
  await event(ctx, o.id, 'recruiter_talked', 'recruiter', user.id);
  const r = await scheduleCandidateMail(ctx, o.id, { immediate: true });
  return { ok: true, alreadySent: false, sentAt: r.dueAt };
}

/** Headhunter meldet eine Zusage (z. B. am Telefon): der Kandidat bestätigt sie per Mail. */
export async function reportAccept(ctx: ServiceCtx, user: User, offer: any, note: string | null, startConfirmed: string | null) {
  const nowIso = new Date(ctx.now()).toISOString();
  const response = { way: 'accepted', by: 'recruiter', note, at: nowIso, ...(startConfirmed ? { start_confirmed: startConfirmed } : {}) };
  const { data: updated, error } = await ctx.db.from('offers').update({
    status: 'accept_reported', accept_reported_at: nowIso, accept_reported_by: user.id, candidate_response: response,
    responded_at: nowIso, responded_by: user.id, updated_at: nowIso, ...(startConfirmed ? { start_date: startConfirmed } : {}),
  }).eq('id', offer.id).in('status', [...ANSWERABLE, 'considering']).select('*').maybeSingle();
  dbFail(error, 'Die Meldung');
  must(updated, 'Für dieses Angebot ist keine Antwort mehr offen.', 'conflict');
  await cancelCandidateMails(ctx, offer);
  const b = await loadCandidateBundle(ctx.db, offer.id);
  const token = await createLink(ctx, offer.id, 'confirm');
  await sendCandidateMail(ctx, b, 'confirm', token, null);
  const reminderMs = outsideQuietHours(ctx.now() + REMINDER_DELAY_MS);
  const reminder = await sendCandidateMail(ctx, b, 'confirm_reminder', token, reminderMs);
  await ctx.db.from('offers').update({ candidate_reminder_due_at: new Date(reminderMs).toISOString(), candidate_reminder_mail_id: reminder.id }).eq('id', offer.id);
  await event(ctx, offer.id, 'accept_reported', 'recruiter', user.id, { note });
  const first = firstName(b.candidate.full_name) ?? 'Der Kandidat';
  for (const uid of [...new Set([offer.created_by, b.job.client_id].filter(Boolean))] as string[]) {
    await notify(ctx, uid, 'offer_accept_reported', `${b.recruiter?.name ?? 'Der Headhunter'} meldet eine Zusage`, `${first} bestätigt sie noch per Mail. Danach schicken Sie den Arbeitsvertrag.`, 'submission', b.submission.id);
  }
  return updated;
}

/**
 * Rückruf erledigt: „bleibt beim Angebot“ (der Kandidat antwortet danach selbst auf seiner
 * Seite) schließt die Rückruf-Aufgabe; „nicht erreicht“ wird nur notiert, die Aufgabe bleibt.
 * Ein Gegenwunsch schließt den Rückruf über respondOffer.
 */
export async function recruiterCallbackDone(ctx: ServiceCtx, user: User, body: any) {
  const b = await requireRecruiter(ctx, user, body?.offerId);
  const o = b.offer;
  must(o.callback_requested_at && !o.callback_done_at, 'Es liegt kein offener Rückrufwunsch vor.', 'conflict');
  const outcome = body?.outcome === 'unreachable' ? 'unreachable' : 'stays';
  const nowIso = new Date(ctx.now()).toISOString();
  if (outcome === 'stays') await ctx.db.from('offers').update({ callback_done_at: nowIso, updated_at: nowIso }).eq('id', o.id);
  await event(ctx, o.id, outcome === 'stays' ? 'callback_done' : 'callback_unreachable', 'recruiter', user.id);
  return { ok: true, outcome };
}

// ---------------------------------------------------------------------------
// Zusage gilt: Arbeitsvertrag beginnt (Paket 3)
// ---------------------------------------------------------------------------

export async function startContract(ctx: ServiceCtx, offer: any, actorId: string | null) {
  const { error } = await ctx.db.from('employment_contracts').insert({
    submission_id: offer.submission_id, offer_id: offer.id, job_id: offer.job_id, way: 'self', status: 'preparing',
    salary: offer.salary_offered, variable_salary: offer.variable_salary ?? null, start_date: offer.start_date ?? null, created_by: actorId ?? offer.created_by ?? null,
  });
  if (error && error.code !== '23505') console.warn('[offer] Vertrag nicht angelegt', error.code, error.message);
}

async function tellClientAnswer(ctx: ServiceCtx, b: CandidateBundle, way: mails.AnswerWay, reason: string | null) {
  const recipients = [...new Set([b.offer.created_by, b.job.client_id].filter(Boolean))] as string[];
  const title = way === 'accepted' ? `${b.candidate.full_name} hat zugesagt` : `${b.candidate.full_name} hat abgesagt`;
  for (const uid of recipients) {
    await notify(ctx, uid, 'offer_answer', title, way === 'accepted' ? `${b.job.title} · selbst bestätigt` : reason ?? b.job.title, 'submission', b.submission.id);
    const prof = await profile(ctx.db, uid);
    if (!prof?.email) continue;
    const content = mails.clientOfferAnswer({
      name: prof.name, candidateName: b.candidate.full_name, recruiterName: b.recruiter?.name ?? 'Ihr Headhunter', jobTitle: b.job.title, way,
      reason, profileUrl: `${ctx.appUrl()}/dashboard/candidates/${b.submission.id}`, byCandidate: true,
    });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: `offer_answer_${way}`, meta: { offer_id: b.offer.id } });
  }
}

// ---------------------------------------------------------------------------
// Antwortseite (öffentlich, Function offer-answer)
// ---------------------------------------------------------------------------

async function linkByToken(ctx: ServiceCtx, token: unknown) {
  must(typeof token === 'string' && token.length >= 20 && token.length <= 200, 'Dieser Link ist ungültig.', 'not_found');
  const { data } = await ctx.db.from('offer_candidate_links').select('*').eq('token_hash', await hashToken(token)).maybeSingle();
  must(data, 'Dieser Link ist ungültig.', 'not_found');
  return data as any;
}

export type PageState = 'open' | 'confirm' | 'answered' | 'expired' | 'closed';

export async function candidatePeek(ctx: ServiceCtx, body: any) {
  const link = await linkByToken(ctx, body?.token);
  const b = await loadCandidateBundle(ctx.db, link.offer_id);
  const o = b.offer;
  const now = ctx.now();
  const nowIso = new Date(now).toISOString();
  const today = new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  if (!link.revoked_at) await ctx.db.from('offer_candidate_links').update({ opened_at: link.opened_at ?? nowIso, last_opened_at: nowIso }).eq('id', link.id);
  let state: PageState;
  if (o.candidate_confirmed_at || ['accepted', 'declined'].includes(o.status)) state = 'answered';
  else if (['superseded', 'withdrawn'].includes(o.status) || link.revoked_at) state = 'closed';
  else if (Date.parse(link.expires_at) < now || (o.response_due && String(o.response_due).slice(0, 10) < today)) state = 'expired';
  else if (link.purpose === 'confirm' && o.status === 'accept_reported') state = 'confirm';
  else if (link.purpose === 'answer' && ANSWERABLE.includes(o.status)) state = 'open';
  else state = 'closed';
  return {
    state, purpose: link.purpose,
    candidateName: b.candidate.full_name, companyName: b.job.company_name, jobTitle: b.job.title,
    offer: { version: o.version ?? 1, salary: o.salary_offered, variable: o.variable_salary ?? null, startDate: o.start_date ?? null, responseDue: o.response_due ?? null,
      contractType: o.contract_type ?? 'permanent', probationMonths: o.probation_months ?? null, workModel: o.work_model ?? null, extras: o.extras ?? [] },
    message: o.candidate_message ?? null,
    recruiter: b.recruiter ? { name: b.recruiter.name, email: b.recruiter.email, phone: b.recruiter.phone } : null,
    reportedAt: o.accept_reported_at ?? null,
    callbackRequestedAt: o.callback_requested_at && !o.callback_done_at ? o.callback_requested_at : null,
    answer: o.status === 'accepted' ? 'accepted' : o.status === 'declined' ? 'declined' : null,
    withdrawn: o.status === 'withdrawn', superseded: o.status === 'superseded',
  };
}

/**
 * Antwort des Kandidaten. answer-Link: accepted · declined (Grund Pflicht) · callback.
 * confirm-Link: confirmed · not_confirmed · callback.
 */
export async function candidateAnswer(ctx: ServiceCtx, body: any) {
  const link = await linkByToken(ctx, body?.token);
  const view = await candidatePeek(ctx, { token: body.token });
  const way = String(body?.way ?? '');
  const b = await loadCandidateBundle(ctx.db, link.offer_id);
  const o = b.offer;
  const now = ctx.now();
  const nowIso = new Date(now).toISOString();
  const first = firstName(b.candidate.full_name) ?? 'Der Kandidat';
  const akteUrl = `${ctx.appUrl()}/recruiter/candidates/${b.candidate.id}`;

  if (way === 'callback') {
    must(view.state === 'open' || view.state === 'confirm', 'Auf dieses Angebot lässt sich nicht mehr antworten.', 'conflict');
    const topic = text(body?.topic, 500) || null;
    // Rückruf binnen 2 Std., nachts erst ab 8 Uhr (wie die Mail an den Kandidaten)
    const until = new Date(outsideQuietHours(now + CALLBACK_DELAY_MS)).toISOString();
    await ctx.db.from('offers').update({ callback_requested_at: nowIso, callback_topic: topic, callback_done_at: null, updated_at: nowIso }).eq('id', o.id);
    await cancelCandidateMails(ctx, o, { keepMain: true });
    await event(ctx, o.id, 'callback_requested', 'candidate', null, { topic });
    await notify(ctx, b.submission.recruiter_id, 'offer_callback', `${b.candidate.full_name} möchte sprechen`, `Bitte bis ${formatBerlinTime(until)} Uhr zurückrufen${topic ? ` · „${topic}“` : ''}`, 'candidate', b.candidate.id);
    if (b.recruiter?.email) {
      const content = mails.recruiterCallback({ recruiterFirstName: firstName(b.recruiter.name), candidateName: b.candidate.full_name, companyName: b.job.company_name, topic, until: `${formatBerlinTime(until)} Uhr`, akteUrl });
      await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'offer_callback_recruiter', meta: { offer_id: o.id } });
    }
    return { ok: true, state: 'callback', recruiterName: b.recruiter?.name ?? null };
  }

  if (link.purpose === 'confirm') {
    must(view.state === 'confirm', view.state === 'answered' ? 'Sie haben schon geantwortet.' : 'Diese Zusage lässt sich nicht mehr bestätigen.', 'conflict');
    must(['confirmed', 'not_confirmed'].includes(way), 'Bitte wählen: bestätigen oder „stimmt so nicht“.');
    if (way === 'confirmed') {
      const { data: updated, error } = await ctx.db.from('offers').update({
        status: 'accepted', decision_at: nowIso, candidate_confirmed_at: nowIso, candidate_answered_at: nowIso, updated_at: nowIso,
        candidate_response: { ...(o.candidate_response ?? {}), confirmed_at: nowIso },
      }).eq('id', o.id).eq('status', 'accept_reported').select('*').maybeSingle();
      dbFail(error, 'Die Bestätigung');
      must(updated, 'Diese Zusage lässt sich nicht mehr bestätigen.', 'conflict');
      await ctx.db.from('offer_candidate_links').update({ answered_at: nowIso }).eq('id', link.id);
      await cancelCandidateMails(ctx, o);
      await event(ctx, o.id, 'candidate_confirmed', 'candidate', null);
      await startContract(ctx, updated, o.accept_reported_by ?? null);
      await tellClientAnswer(ctx, { ...b, offer: updated }, 'accepted', null);
      await notify(ctx, b.submission.recruiter_id, 'offer_confirmed', `${b.candidate.full_name} hat die Zusage bestätigt`, `${b.job.company_name} schickt jetzt den Arbeitsvertrag.`, 'candidate', b.candidate.id);
      return { ok: true, state: 'answered', answer: 'accepted' };
    }
    // Stimmt so nicht: Angebot wieder offen, Headhunter und Matchunt erfahren es
    const { error } = await ctx.db.from('offers').update({
      status: 'with_recruiter', accept_reported_at: null, accept_reported_by: null, updated_at: nowIso,
      candidate_response: { way: 'not_confirmed', by: 'candidate', at: nowIso, reported: o.candidate_response ?? null },
    }).eq('id', o.id).eq('status', 'accept_reported');
    dbFail(error, 'Die Antwort');
    await ctx.db.from('offer_candidate_links').update({ answered_at: nowIso, revoked_at: nowIso }).eq('id', link.id);
    await cancelCandidateMails(ctx, o);
    await event(ctx, o.id, 'candidate_not_confirmed', 'candidate', null);
    const msg = `${b.candidate.full_name} hat die gemeldete Zusage nicht bestätigt (${b.job.company_name} · ${b.job.title}).`;
    await notify(ctx, b.submission.recruiter_id, 'offer_not_confirmed', `${first} hat die Zusage nicht bestätigt`, 'Bitte sprechen Sie noch einmal mit ihr bzw. ihm. Das Angebot ist wieder offen.', 'candidate', b.candidate.id);
    for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'offer_not_confirmed', 'Zusage nicht bestätigt', `${msg} Gemeldet hatte ${b.recruiter?.name ?? 'der Headhunter'}.`, 'submission', b.submission.id);
    for (const uid of [...new Set([o.created_by, b.job.client_id].filter(Boolean))] as string[]) {
      await notify(ctx, uid, 'offer_not_confirmed', `Zusage von ${first} nicht bestätigt`, `${b.recruiter?.name ?? 'Ihr Headhunter'} klärt das. Das Angebot ist wieder offen.`, 'submission', b.submission.id);
    }
    return { ok: true, state: 'not_confirmed' };
  }

  must(view.state === 'open', view.state === 'answered' ? 'Sie haben schon geantwortet.' : 'Auf dieses Angebot lässt sich nicht mehr antworten.', 'conflict');
  must(['accepted', 'declined'].includes(way), 'Bitte wählen: Zusage, Absage oder mit dem Headhunter sprechen.');
  if (way === 'accepted') {
    const { data: updated, error } = await ctx.db.from('offers').update({
      status: 'accepted', decision_at: nowIso, candidate_answered_at: nowIso, candidate_confirmed_at: nowIso, responded_at: nowIso, updated_at: nowIso,
      candidate_response: { way: 'accepted', by: 'candidate', at: nowIso },
    }).eq('id', o.id).in('status', ANSWERABLE).select('*').maybeSingle();
    dbFail(error, 'Die Zusage');
    must(updated, 'Auf dieses Angebot lässt sich nicht mehr antworten.', 'conflict');
    await ctx.db.from('offer_candidate_links').update({ answered_at: nowIso }).eq('id', link.id);
    await cancelCandidateMails(ctx, o, { keepMain: true });
    await event(ctx, o.id, 'answer_accepted', 'candidate', null);
    await startContract(ctx, updated, null);
    await tellClientAnswer(ctx, { ...b, offer: updated }, 'accepted', null);
    await notify(ctx, b.submission.recruiter_id, 'offer_answer', `${b.candidate.full_name} hat zugesagt`, `${b.job.company_name} · selbst auf der Angebotsseite`, 'candidate', b.candidate.id);
    return { ok: true, state: 'answered', answer: 'accepted' };
  }
  const category = String(body?.reasonCategory ?? '');
  must(DECLINE_REASONS[category], 'Bitte einen Grund wählen.');
  const note = text(body?.note, 1000) || null;
  const reason = [DECLINE_REASONS[category], note].filter(Boolean).join(': ');
  const { data: updated, error } = await ctx.db.from('offers').update({
    status: 'declined', decision_at: nowIso, candidate_answered_at: nowIso, responded_at: nowIso, updated_at: nowIso, rejection_reason: reason,
    candidate_response: { way: 'declined', by: 'candidate', at: nowIso, reason_category: category, reason: note },
  }).eq('id', o.id).in('status', ANSWERABLE).select('*').maybeSingle();
  dbFail(error, 'Die Absage');
  must(updated, 'Auf dieses Angebot lässt sich nicht mehr antworten.', 'conflict');
  await ctx.db.from('offer_candidate_links').update({ answered_at: nowIso }).eq('id', link.id);
  await cancelCandidateMails(ctx, o, { keepMain: true });
  await event(ctx, o.id, 'answer_declined', 'candidate', null, { category, note });
  await tellClientAnswer(ctx, { ...b, offer: updated }, 'declined', reason);
  await notify(ctx, b.submission.recruiter_id, 'offer_answer', `${b.candidate.full_name} hat abgesagt`, reason, 'candidate', b.candidate.id);
  return { ok: true, state: 'answered', answer: 'declined' };
}

/** Stand für Kunde und Headhunter (Angebots-Fenster, Zeitleiste) */
export function candidateState(o: any, now: number) {
  const due = o.candidate_mail_due_at ? Date.parse(o.candidate_mail_due_at) : null;
  return {
    mailDueAt: o.candidate_mail_due_at ?? null,
    mailSent: !!o.candidate_mail_sent_at || (due !== null && due <= now),
    mailSentAt: o.candidate_mail_sent_at ?? (due !== null && due <= now ? o.candidate_mail_due_at : null),
    talkedAt: o.recruiter_talked_at ?? null,
    callbackAt: o.callback_requested_at && !o.callback_done_at ? o.callback_requested_at : null,
    callbackTopic: o.callback_requested_at && !o.callback_done_at ? o.callback_topic ?? null : null,
    callbackDueAt: o.callback_requested_at && !o.callback_done_at ? new Date(outsideQuietHours(Date.parse(o.callback_requested_at) + CALLBACK_DELAY_MS)).toISOString() : null,
    reminderDueAt: o.candidate_reminder_due_at ?? null,
    acceptReportedAt: o.accept_reported_at ?? null,
    confirmedAt: o.candidate_confirmed_at ?? null,
    answeredByCandidate: o.candidate_response?.by === 'candidate',
  };
}
