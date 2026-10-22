// deno-lint-ignore-file no-explicit-any
// Angebot über den Headhunter (22.10.2026). Die Function offer dispatcht nur hierher.
//
// Ablauf: Der Headhunter kann vorher eine Empfehlung schicken (was der Kandidat
// für eine Zusage braucht). Der Kunde macht das Angebot im Bewerberprofil; es geht
// an den Headhunter, der es mit dem Kandidaten bespricht und die Antwort einträgt:
// Zusage, überlegt noch, Gegenwunsch, Absage. Beim Gegenwunsch passt der Kunde an
// (neues Angebot, das alte gilt als ersetzt), bleibt bei seinem Angebot oder zieht
// zurück. Der Kandidat bekommt von Matchunt keine Mail.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { canUserActOnJob } from './team-access.ts';
import { dbFail, must, type ServiceCtx } from './interview-service.ts';
import * as mails from './offer-mails.ts';

export const OPEN_STATUSES = ['with_recruiter', 'considering', 'countered'];
const CLOSED_STAGES = ['placed', 'hired', 'rejected', 'client_rejected', 'withdrawn'];
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Bundle { submission: any; job: any; candidate: any; recruiter: { name: string; email: string | null } | null }

const firstName = (full: string | null | undefined) => (full ? full.trim().split(/\s+/)[0] : null);
const euro = (n: number) => `${new Intl.NumberFormat('de-DE').format(n)} €`;

async function profile(db: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return data ? { name: (data as any).full_name ?? '', email: (data as any).email ?? null } : null;
}

async function loadBundle(db: SupabaseClient, submissionId: string): Promise<Bundle> {
  must(typeof submissionId === 'string' && UUID.test(submissionId), 'Ungültige Bewerbung.');
  const { data: submission, error } = await db.from('submissions')
    .select('id, job_id, candidate_id, recruiter_id, identity_unlocked, company_revealed, stage, status').eq('id', submissionId).maybeSingle();
  dbFail(error, 'Die Bewerbung');
  must(submission, 'Bewerbung nicht gefunden.', 'not_found');
  const { data: job } = await db.from('jobs')
    .select('id, title, company_name, industry, client_id, salary_min, salary_max, location, remote_type, onsite_days_required, benefits, fee_percentage, mandate_id')
    .eq('id', (submission as any).job_id).maybeSingle();
  must(job, 'Stelle nicht gefunden.', 'not_found');
  const { data: candidate } = await db.from('candidates').select('id, full_name, email').eq('id', (submission as any).candidate_id).maybeSingle();
  return { submission, job, candidate: candidate ?? { id: (submission as any).candidate_id, full_name: 'Kandidat', email: null }, recruiter: await profile(db, (submission as any).recruiter_id) };
}

/** Firma für den Headhunter: erst nach der Freigabe mit Namen. */
const companyFor = (b: Bundle) => (b.submission.company_revealed ? b.job.company_name : (b.job.industry ? `${b.job.industry}-Unternehmen` : 'Unternehmen'));

async function requireClient(ctx: ServiceCtx, user: User, submissionId: string) {
  const b = await loadBundle(ctx.db, submissionId);
  must(await canUserActOnJob(ctx.db, user.id, b.job.id), 'Für diese Stelle dürfen Sie kein Angebot machen.', 'not_allowed');
  return b;
}

async function isAdmin(db: SupabaseClient, userId: string) {
  const { data } = await db.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  return !!data;
}

async function loadOffer(db: SupabaseClient, offerId: unknown) {
  must(typeof offerId === 'string' && UUID.test(offerId), 'Ungültiges Angebot.');
  const { data, error } = await db.from('offers').select('*').eq('id', offerId).maybeSingle();
  dbFail(error, 'Das Angebot');
  must(data, 'Angebot nicht gefunden.', 'not_found');
  return data as any;
}

async function event(ctx: ServiceCtx, offerId: string, type: string, actorType: string, actorId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await ctx.db.from('offer_events').insert({ offer_id: offerId, event_type: type, actor_type: actorType, actor_id: actorId, details });
  if (error) console.warn('[offer] Verlauf nicht gespeichert', error.code, error.message);
}

async function notify(ctx: ServiceCtx, userId: string | null | undefined, type: string, title: string, message: string, relatedType: string, relatedId: string) {
  if (!userId) return;
  const { error } = await ctx.db.from('notifications').insert({ user_id: userId, type, title, message, related_type: relatedType, related_id: relatedId });
  if (error) console.warn('[offer] Benachrichtigung nicht gespeichert', error.code, error.message);
}

/** Ort und Modell aus der Stelle: „München · 3 Tage Büro“. */
export function workModelOf(job: any): string {
  const model = job.remote_type === 'remote' ? 'remote'
    : job.remote_type === 'hybrid' ? `${job.onsite_days_required && job.onsite_days_required < 5 ? job.onsite_days_required : 3} Tage Büro`
      : job.remote_type === 'onsite' ? 'vor Ort' : '';
  return [job.location, model].filter(Boolean).join(' · ');
}

/** Honorarsatz laut Rahmenvertrag (Mandat), sonst der Satz der Stelle. */
async function feePercent(db: SupabaseClient, job: any): Promise<number | null> {
  if (job.mandate_id) {
    const { data } = await db.from('commercial_mandates').select('pricing_snapshot').eq('id', job.mandate_id).maybeSingle();
    const pct = Number((data as any)?.pricing_snapshot?.clientFeePct);
    if (Number.isFinite(pct) && pct > 0) return pct;
  }
  const fallback = Number(job.fee_percentage);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

export function offerView(o: any) {
  if (!o) return null;
  return {
    id: o.id, status: o.status, version: o.version ?? 1,
    salary: o.salary_offered, variable: o.variable_salary ?? null, startDate: o.start_date ?? null, responseDue: o.response_due ?? null,
    contractType: o.contract_type ?? 'permanent', probationMonths: o.probation_months ?? null, workModel: o.work_model ?? null,
    extras: o.extras ?? [], message: o.message_to_recruiter ?? null, sentAt: o.sent_at ?? null,
    response: o.candidate_response ?? null, respondedAt: o.responded_at ?? null,
  };
}

const factsOf = (o: any): mails.OfferFacts => ({
  salary: o.salary_offered, variable: o.variable_salary ?? null, startDate: o.start_date ?? null, responseDue: o.response_due ?? null,
  contractType: o.contract_type ?? null, probationMonths: o.probation_months ?? null, workModel: o.work_model ?? null, extras: o.extras ?? [],
});

// ---------------------------------------------------------------------------
// Kunde: Kontext für das Angebotsfenster
// ---------------------------------------------------------------------------

export async function offerContext(ctx: ServiceCtx, user: User, body: any) {
  const b = await requireClient(ctx, user, body?.submissionId);
  const [{ data: offers }, { data: recs }, { data: others }, pct] = await Promise.all([
    ctx.db.from('offers').select('*').eq('submission_id', b.submission.id).order('created_at', { ascending: false }).limit(1),
    ctx.db.from('offer_recommendations').select('intro, items, created_at').eq('submission_id', b.submission.id).order('created_at', { ascending: false }).limit(1),
    ctx.db.from('offers').select('id, submission_id, status').eq('job_id', b.job.id).in('status', OPEN_STATUSES),
    feePercent(ctx.db, b.job),
  ]);
  const rec = (recs ?? [])[0] as any;
  return {
    submissionId: b.submission.id,
    candidateName: b.submission.identity_unlocked ? b.candidate.full_name : null,
    identityUnlocked: !!b.submission.identity_unlocked,
    recruiterName: b.recruiter?.name ?? null,
    jobTitle: b.job.title,
    companyName: b.job.company_name,
    salaryMin: b.job.salary_min ?? null,
    salaryMax: b.job.salary_max ?? null,
    feePercent: pct,
    defaults: { workModel: workModelOf(b.job), extras: (b.job.benefits ?? []) as string[], probationMonths: 6, contractType: 'permanent' },
    recommendation: rec ? { intro: rec.intro ?? null, items: rec.items ?? [], createdAt: rec.created_at } : null,
    currentOffer: offerView((offers ?? [])[0]),
    otherOpenOffers: ((others ?? []) as any[]).filter((o) => o.submission_id !== b.submission.id).length,
  };
}

// ---------------------------------------------------------------------------
// Headhunter: Kontext für „Angebot überbringen“ und „Empfehlung an den Kunden“
// ---------------------------------------------------------------------------

/**
 * Alle Nachgespräche einer Einreichung zu einem Stand: je Feld der Wert aus dem
 * spätesten Interview, das ihn hat (Runde 2 vor Runde 1).
 */
async function mergeNachgespraeche(db: SupabaseClient, rows: any[]) {
  if (!rows.length) return null;
  const { data: ivs } = await db.from('interviews').select('id, scheduled_at').in('id', rows.map((r) => r.interview_id));
  const at = new Map(((ivs ?? []) as any[]).map((i) => [i.id, i.scheduled_at ?? '']));
  const sorted = [...rows].sort((x, y) => String(at.get(y.interview_id) ?? y.created_at).localeCompare(String(at.get(x.interview_id) ?? x.created_at)));
  const merged: Record<string, unknown> = { ...sorted[0] };
  const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  for (const row of sorted.slice(1)) {
    for (const [k, v] of Object.entries(row)) if (empty(merged[k]) && !empty(v)) merged[k] = v;
  }
  return merged;
}

export async function recruiterContext(ctx: ServiceCtx, user: User, body: any) {
  const b = await loadBundle(ctx.db, body?.submissionId);
  must(b.submission.recruiter_id === user.id || await isAdmin(ctx.db, user.id), 'Nur der Headhunter dieses Kandidaten sieht das Angebot.', 'not_allowed');
  const [{ data: offers }, { data: recs }, { data: nach }, { data: akte }] = await Promise.all([
    ctx.db.from('offers').select('*').eq('submission_id', b.submission.id).order('created_at', { ascending: false }).limit(1),
    ctx.db.from('offer_recommendations').select('intro, items, created_at').eq('submission_id', b.submission.id).order('created_at', { ascending: false }).limit(1),
    ctx.db.from('interview_nachgespraeche').select('*').eq('submission_id', b.submission.id),
    ctx.db.from('candidates').select('phone, expected_salary, notice_period, availability_date').eq('id', b.submission.candidate_id).maybeSingle(),
  ]);
  const rec = (recs ?? [])[0] as any;
  return {
    submissionId: b.submission.id,
    candidateId: b.candidate.id,
    candidateName: b.candidate.full_name,
    candidatePhone: (akte as any)?.phone ?? null,
    companyName: companyFor(b),
    jobTitle: b.job.title,
    salaryMin: b.job.salary_min ?? null,
    salaryMax: b.job.salary_max ?? null,
    akte: { expectedSalary: (akte as any)?.expected_salary ?? null, noticePeriod: (akte as any)?.notice_period ?? null, availabilityDate: (akte as any)?.availability_date ?? null },
    nachgespraech: await mergeNachgespraeche(ctx.db, (nach ?? []) as any[]),
    recommendation: rec ? { intro: rec.intro ?? null, items: rec.items ?? [], createdAt: rec.created_at } : null,
    currentOffer: offerView((offers ?? [])[0]),
  };
}

// ---------------------------------------------------------------------------
// Kunde: Angebot machen (auch: anpassen = neues Angebot, das alte ist ersetzt)
// ---------------------------------------------------------------------------

function validDate(v: unknown, what: string): string {
  must(typeof v === 'string' && DATE.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`)), `Bitte ${what} angeben.`);
  return v as string;
}
const todayKey = (now: number) => new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

export async function createOffer(ctx: ServiceCtx, user: User, body: any) {
  const b = await requireClient(ctx, user, body?.submissionId);
  must(b.submission.identity_unlocked, 'Ein Angebot geht erst, wenn der Kandidat sein Profil freigegeben hat.', 'conflict');
  must(!CLOSED_STAGES.includes(String(b.submission.stage ?? '')) && !CLOSED_STAGES.includes(String(b.submission.status ?? '')), 'Diese Bewerbung ist abgeschlossen.', 'conflict');
  const int = (v: unknown, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const salary = int(body.salary, 10000, 2000000);
  must(salary, 'Bitte das Fixgehalt pro Jahr angeben.');
  const variable = body.variable == null || body.variable === '' ? null : int(body.variable, 0, 2000000);
  must(body.variable == null || body.variable === '' || variable !== null, 'Bitte einen gültigen variablen Anteil angeben.');
  const today = todayKey(ctx.now());
  const startDate = validDate(body.startDate, 'den ersten Arbeitstag');
  must(startDate >= today, 'Der erste Arbeitstag liegt in der Vergangenheit.');
  const responseDue = validDate(body.responseDue, 'eine Antwortfrist');
  must(responseDue >= today, 'Die Antwortfrist liegt in der Vergangenheit.');
  must(Date.parse(`${responseDue}T12:00:00Z`) - ctx.now() <= 61 * 86400000, 'Die Antwortfrist darf höchstens zwei Monate betragen.');
  const contractType = body.contractType === 'fixed_term' ? 'fixed_term' : 'permanent';
  const probation = body.probationMonths == null ? null : int(body.probationMonths, 0, 6);
  const workModel = typeof body.workModel === 'string' ? body.workModel.trim().slice(0, 200) || null : null;
  const extras = (Array.isArray(body.extras) ? body.extras : []).map((x: unknown) => String(x ?? '').trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) || null : null;

  // Offenes Angebot dieser Bewerbung wird ersetzt
  const { data: openRows } = await ctx.db.from('offers').select('*').eq('submission_id', b.submission.id).in('status', OPEN_STATUSES);
  const previous = ((openRows ?? []) as any[]).sort((x, y) => (y.version ?? 1) - (x.version ?? 1))[0] ?? null;
  for (const o of (openRows ?? []) as any[]) {
    await ctx.db.from('offers').update({ status: 'superseded', updated_at: new Date(ctx.now()).toISOString() }).eq('id', o.id);
    await event(ctx, o.id, 'superseded', 'client', user.id);
  }
  const nowIso = new Date(ctx.now()).toISOString();
  const { data: offer, error } = await ctx.db.from('offers').insert({
    submission_id: b.submission.id, job_id: b.job.id, candidate_id: b.submission.candidate_id, client_id: b.job.client_id, recruiter_id: b.submission.recruiter_id,
    position_title: b.job.title, salary_offered: salary, variable_salary: variable, start_date: startDate, response_due: responseDue,
    expires_at: `${responseDue}T23:59:59+01:00`, contract_type: contractType, probation_months: probation, work_model: workModel,
    location: b.job.location ?? null, extras, benefits: extras, message_to_recruiter: message,
    status: 'with_recruiter', sent_at: nowIso, created_by: user.id,
    version: previous ? (previous.version ?? 1) + 1 : 1, previous_offer_id: previous?.id ?? null,
    original_salary: previous?.original_salary ?? previous?.salary_offered ?? salary,
  }).select('*').single();
  dbFail(error, 'Das Angebot');
  await event(ctx, (offer as any).id, previous ? 'adjusted' : 'sent', 'client', user.id, { salary, variable, startDate, responseDue });
  await ctx.db.from('submissions').update({ stage: 'offer' }).eq('id', b.submission.id);

  const company = companyFor(b);
  await notify(ctx, b.submission.recruiter_id, 'offer_received',
    `${previous ? 'Angepasstes Angebot' : 'Angebot'} für ${b.candidate.full_name}`,
    `${euro(salary)}${variable ? ` + ${euro(variable)}` : ''} · Start ${new Date(`${startDate}T12:00:00Z`).toLocaleDateString('de-DE')} · Antwort bis ${new Date(`${responseDue}T12:00:00Z`).toLocaleDateString('de-DE')}`,
    'candidate', b.candidate.id);
  if (b.recruiter?.email) {
    const content = mails.recruiterOfferReceived({
      recruiterFirstName: firstName(b.recruiter.name), candidateName: b.candidate.full_name, companyName: company, jobTitle: b.job.title,
      offer: factsOf(offer), message, adjusted: !!previous, akteUrl: `${ctx.appUrl()}/recruiter/candidates/${b.candidate.id}`,
    });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'offer_received_recruiter', meta: { offer_id: (offer as any).id } });
  }
  return { offerId: (offer as any).id, offer: offerView(offer) };
}

// ---------------------------------------------------------------------------
// Headhunter: Antwort des Kandidaten eintragen
// ---------------------------------------------------------------------------

const DECLINE_REASONS: Record<string, string> = {
  salary: 'Gehalt', counter_offer: 'Gegenangebot des Arbeitgebers', other_job: 'andere Stelle', personal: 'persönliche Gründe', other: 'anderer Grund',
};

export async function respondOffer(ctx: ServiceCtx, user: User, body: any) {
  const offer = await loadOffer(ctx.db, body?.offerId);
  const b = await loadBundle(ctx.db, offer.submission_id);
  must(b.submission.recruiter_id === user.id || await isAdmin(ctx.db, user.id), 'Nur der Headhunter dieses Kandidaten trägt die Antwort ein.', 'not_allowed');
  must(['with_recruiter', 'considering'].includes(offer.status), 'Für dieses Angebot ist keine Antwort mehr offen.', 'conflict');
  const way = body?.way as mails.AnswerWay;
  must(['accepted', 'considering', 'countered', 'declined'].includes(way), 'Bitte die Antwort wählen.');
  const text = (v: unknown, max = 1000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const note = text(body.note) || null;
  const nowIso = new Date(ctx.now()).toISOString();
  const response: Record<string, unknown> = { way, note, at: nowIso, by: user.id };
  const patch: Record<string, unknown> = { responded_at: nowIso, responded_by: user.id, updated_at: nowIso };

  if (way === 'considering') {
    const until = validDate(body.until, 'das Datum, bis wann er antwortet');
    must(until >= todayKey(ctx.now()), 'Das Datum liegt in der Vergangenheit.');
    response.until = until;
    patch.status = 'considering';
  } else if (way === 'countered') {
    const num = (v: unknown) => (v == null || v === '' ? null : Math.round(Number(v)));
    const wish = { salary: num(body.wishSalary), variable: num(body.wishVariable), startDate: typeof body.wishStart === 'string' && DATE.test(body.wishStart) ? body.wishStart : null, other: text(body.wishOther, 300) || null };
    must(wish.salary || wish.variable || wish.startDate || wish.other, 'Bitte eintragen, was sich der Kandidat wünscht.');
    must(!wish.salary || (wish.salary >= 10000 && wish.salary <= 2000000), 'Bitte ein gültiges Wunschgehalt angeben.');
    response.wish = wish;
    response.reason = text(body.reason) || null;
    Object.assign(patch, { status: 'countered', counter_offer_salary: wish.salary, counter_offer_at: nowIso, counter_offer_notes: response.reason, negotiation_rounds: (offer.negotiation_rounds ?? 0) + 1 });
  } else if (way === 'declined') {
    const category = DECLINE_REASONS[body.reasonCategory] ? body.reasonCategory : 'other';
    response.reason_category = category;
    response.reason = text(body.reason) || null;
    Object.assign(patch, { status: 'declined', decision_at: nowIso, rejection_reason: [DECLINE_REASONS[category], response.reason].filter(Boolean).join(': ') });
  } else {
    if (typeof body.startConfirmed === 'string' && DATE.test(body.startConfirmed)) {
      response.start_confirmed = body.startConfirmed;
      patch.start_date = body.startConfirmed;
    }
    Object.assign(patch, { status: 'accepted', decision_at: nowIso });
  }
  patch.candidate_response = response;
  const { data: updated, error } = await ctx.db.from('offers').update(patch).eq('id', offer.id).in('status', ['with_recruiter', 'considering']).select('*').maybeSingle();
  dbFail(error, 'Die Antwort');
  must(updated, 'Für dieses Angebot ist keine Antwort mehr offen.', 'conflict');
  await event(ctx, offer.id, `answer_${way}`, 'recruiter', user.id, response);

  // Kundenseite: wer das Angebot gemacht hat, dazu der Ersteller der Stelle
  const recipients = [...new Set([offer.created_by, b.job.client_id].filter(Boolean))] as string[];
  const recruiterName = b.recruiter?.name || 'Ihr Headhunter';
  const first = firstName(b.candidate.full_name) ?? 'Der Kandidat';
  const title = way === 'accepted' ? `${b.candidate.full_name} hat zugesagt`
    : way === 'considering' ? `${first} überlegt noch` : way === 'countered' ? `${first} hat einen Gegenwunsch` : `${b.candidate.full_name} hat abgesagt`;
  const wish = response.wish as any;
  const message = way === 'countered' && wish?.salary ? `wünscht ${euro(wish.salary)} statt ${euro(offer.salary_offered)}` : way === 'declined' ? String((updated as any).rejection_reason ?? '') : note ?? b.job.title;
  for (const uid of recipients) {
    await notify(ctx, uid, 'offer_answer', title, message, 'submission', b.submission.id);
    const prof = await profile(ctx.db, uid);
    if (!prof?.email) continue;
    const content = mails.clientOfferAnswer({
      name: prof.name, candidateName: b.candidate.full_name, recruiterName, jobTitle: b.job.title, way,
      until: (response.until as string) ?? null, note, wish: wish ?? null, reason: way === 'declined' ? String((updated as any).rejection_reason ?? '') : (response.reason as string) ?? null,
      profileUrl: `${ctx.appUrl()}/dashboard/candidates/${b.submission.id}`,
    });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: `offer_answer_${way}`, meta: { offer_id: offer.id } });
  }
  return { ok: true, offer: offerView(updated) };
}

// ---------------------------------------------------------------------------
// Kunde: beim Angebot bleiben, zurückziehen, Frist verlängern
// ---------------------------------------------------------------------------

async function clientOffer(ctx: ServiceCtx, user: User, offerId: unknown) {
  const offer = await loadOffer(ctx.db, offerId);
  const b = await requireClient(ctx, user, offer.submission_id);
  return { offer, b };
}

async function tellRecruiter(ctx: ServiceCtx, b: Bundle, offerId: string, text: string) {
  await notify(ctx, b.submission.recruiter_id, 'offer_update', `${companyFor(b)}: ${text}`, b.candidate.full_name, 'candidate', b.candidate.id);
  if (b.recruiter?.email) {
    const content = mails.recruiterOfferUpdate({ recruiterFirstName: firstName(b.recruiter.name), candidateName: b.candidate.full_name, companyName: companyFor(b), text, akteUrl: `${ctx.appUrl()}/recruiter/candidates/${b.candidate.id}` });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'offer_update_recruiter', meta: { offer_id: offerId } });
  }
}

export async function keepOffer(ctx: ServiceCtx, user: User, body: any) {
  const { offer, b } = await clientOffer(ctx, user, body?.offerId);
  must(offer.status === 'countered', 'Es liegt kein Gegenwunsch vor.', 'conflict');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;
  const response = { ...(offer.candidate_response ?? {}), client_keep: { at: new Date(ctx.now()).toISOString(), by: user.id, note } };
  await ctx.db.from('offers').update({ status: 'with_recruiter', candidate_response: response, updated_at: new Date(ctx.now()).toISOString() }).eq('id', offer.id);
  await event(ctx, offer.id, 'client_keeps', 'client', user.id, { note });
  await tellRecruiter(ctx, b, offer.id, `bleibt bei ${euro(offer.salary_offered)}${note ? ` („${note}“)` : ''}. Bitte noch einmal mit ${firstName(b.candidate.full_name)} sprechen.`);
  return { ok: true };
}

export async function withdrawOffer(ctx: ServiceCtx, user: User, body: any) {
  const { offer, b } = await clientOffer(ctx, user, body?.offerId);
  must(OPEN_STATUSES.includes(offer.status), 'Dieses Angebot ist nicht mehr offen.', 'conflict');
  await ctx.db.from('offers').update({ status: 'withdrawn', decision_at: new Date(ctx.now()).toISOString(), updated_at: new Date(ctx.now()).toISOString() }).eq('id', offer.id);
  await event(ctx, offer.id, 'withdrawn', 'client', user.id);
  await tellRecruiter(ctx, b, offer.id, 'hat das Angebot zurückgezogen');
  return { ok: true };
}

export async function extendOffer(ctx: ServiceCtx, user: User, body: any) {
  const { offer, b } = await clientOffer(ctx, user, body?.offerId);
  must(['with_recruiter', 'considering'].includes(offer.status), 'Dieses Angebot ist nicht mehr offen.', 'conflict');
  const due = validDate(body.responseDue, 'eine neue Frist');
  must(due >= todayKey(ctx.now()), 'Die neue Frist liegt in der Vergangenheit.');
  await ctx.db.from('offers').update({ response_due: due, expires_at: `${due}T23:59:59+01:00`, updated_at: new Date(ctx.now()).toISOString() }).eq('id', offer.id);
  await event(ctx, offer.id, 'extended', 'client', user.id, { responseDue: due });
  await tellRecruiter(ctx, b, offer.id, `hat die Antwortfrist bis ${new Date(`${due}T12:00:00Z`).toLocaleDateString('de-DE')} verlängert`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Headhunter: Empfehlung vor dem Angebot
// ---------------------------------------------------------------------------

export async function recommend(ctx: ServiceCtx, user: User, body: any) {
  const b = await loadBundle(ctx.db, body?.submissionId);
  must(b.submission.recruiter_id === user.id, 'Nur der Headhunter dieses Kandidaten schickt eine Empfehlung.', 'not_allowed');
  const raw = Array.isArray(body.items) ? body.items : [];
  const items = raw.map((i: any) => ({ key: String(i?.key ?? '').slice(0, 40), label: String(i?.label ?? '').trim().slice(0, 60), value: String(i?.value ?? '').trim().slice(0, 300) }))
    .filter((i: any) => i.label && i.value).slice(0, 10);
  must(items.length > 0, 'Bitte mindestens einen Punkt für die Empfehlung auswählen.');
  const intro = typeof body.intro === 'string' ? body.intro.trim().slice(0, 600) || null : null;
  const { error } = await ctx.db.from('offer_recommendations').insert({ submission_id: b.submission.id, recruiter_id: user.id, intro, items });
  dbFail(error, 'Die Empfehlung');

  // Kundenseite: Ersteller der Stelle und wer zuletzt ein Interview angefragt hat
  const { data: lastIv } = await ctx.db.from('interviews').select('requested_by').eq('submission_id', b.submission.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const recipients = [...new Set([b.job.client_id, (lastIv as any)?.requested_by].filter(Boolean))] as string[];
  const recruiterName = b.recruiter?.name || 'Ihr Headhunter';
  for (const uid of recipients) {
    await notify(ctx, uid, 'offer_recommendation', `Empfehlung von ${recruiterName} zu ${b.candidate.full_name}`, intro ?? items.map((i: any) => `${i.label}: ${i.value}`).join(' · ').slice(0, 200), 'submission', b.submission.id);
    const prof = await profile(ctx.db, uid);
    if (!prof?.email) continue;
    const content = mails.clientRecommendation({ name: prof.name, candidateName: b.candidate.full_name, recruiterName, jobTitle: b.job.title, intro, items, profileUrl: `${ctx.appUrl()}/dashboard/candidates/${b.submission.id}` });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'offer_recommendation_client', meta: { submission_id: b.submission.id } });
  }
  return { ok: true };
}
