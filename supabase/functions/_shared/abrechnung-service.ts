// deno-lint-ignore-file no-explicit-any
// Headhunter: Verdienste, Gutschriften, Abrechnungsdaten, Antritt melden (H1–H13, F2, J5).
// Umbau 11.11.2026. Edge Function `abrechnung` dispatcht hierher; der tägliche
// Lauf (buchhaltung-taeglich) ruft runRecruiterTasks.
//
// Rechnen: konditionen.ts. Welche Fassung gilt: konditionen-db.ts. Antritt und
// Fälle: nachbesetzung.ts. Ansicht und Texte: abrechnung-view.ts (rein, auch im
// Frontend). Die Gutschriften selbst (Tabelle, PDF, SEPA) erzeugt der Admin-Strang;
// hier werden sie gezeigt, heruntergeladen und Einwände angenommen.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import {
  adminIds, bucketFiles, fallbackSnapshot, notify, profile, todayKey,
  type FilePort, type PlacementCtx,
} from './placement-service.ts';
import { loadPlacementRow, recruiterStatement, reportStartByRecruiter } from './nachbesetzung.ts';
import { conditionsSettings, recruiterConditionFacts } from './konditionen-db.ts';
import { ACCOUNT_CHANGE_HOURS, START_SILENCE_DAYS, addDays, conditionsVersionAt, isPackageKey, splitFor, type PackageKey } from './konditionen.ts';
import {
  OBJECTION_TOPICS, TAX_MODE_TEXT, bountyCentsOf, companyShort, conditionsTable, continuityDaysOf, creditNotesCsv, dmy, halfwayDay,
  halfwayTaskTitle, isTaxMode, objectionUntil, ownBountyCents, overviewTotals, placementRow, placementWindow, startTaskTitle,
  type BillingView, type ClaimLike, type CreditNoteRef, type JobTerms, type PlacementFacts, type TaxMode, type TrancheLike, type ViewCtx,
} from './abrechnung-view.ts';
import { bicValid, compactIban, ibanValid, maskIban } from './recruiter-billing.ts';
import { generateNumericCode, hashCode, timingSafeEqual } from './tokens.ts';
import { esc, layout } from './intake-mail.ts';
import { noticeRecipients } from './recruiter-signed-notice.ts';
import { intlLocale, normLang, tr, type Lang } from './i18n.ts';
import { m, tx } from './notify-i18n.ts';
import { recruiterLanguage } from './recipient-language.ts';

/** Bucket der Gutschrift-PDFs (legt der Admin-Strang an). */
export const CREDIT_NOTE_BUCKET = 'credit-notes';

export interface AbrechnungCtx extends PlacementCtx {
  creditFiles: FilePort;
}

export function abrechnungCtx(base: PlacementCtx): AbrechnungCtx {
  return { ...base, creditFiles: bucketFiles(base.db, CREDIT_NOTE_BUCKET) };
}

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const longText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const nowIsoOf = (ctx: PlacementCtx) => new Date(ctx.now()).toISOString();
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const maskEmail = (email: string | null | undefined) => {
  const e = String(email ?? '');
  const [name, domain] = e.split('@');
  if (!name || !domain) return e;
  return `${name.slice(0, Math.min(2, name.length))}…@${domain}`;
};

async function requireRecruiter(ctx: PlacementCtx, user: User) {
  const { data } = await ctx.db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'recruiter').maybeSingle();
  must(data, 'Verdienste gibt es nur für Headhunter.', 'not_allowed');
}

/** .in() in Häppchen, damit die URL nicht zu lang wird. */
async function rowsIn(db: SupabaseClient, table: string, columns: string, key: string, ids: string[], extra?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  const list = uniq(ids.filter(Boolean));
  for (let i = 0; i < list.length; i += 100) {
    let q: any = db.from(table).select(columns).in(key, list.slice(i, i + 100));
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) { console.warn(`[abrechnung] ${table} nicht geladen`, error.code, error.message); continue; }
    out.push(...((data ?? []) as any[]));
  }
  return out;
}

async function sendMail(ctx: PlacementCtx, to: string, subject: string, heading: string, bodyHtml: string, plain: string, template: string, meta: Record<string, unknown>, lang?: Lang | null) {
  try {
    const res = await ctx.mail({
      fromEmail: ctx.fromEmail, fromName: 'Matchunt', to, replyTo: 'info@bluewater-bridge.de',
      subject, html: layout({ ...(lang ? { lang } : {}), preheader: heading, heading, body: bodyHtml }), text: plain,
    }, { template, meta });
    return res.sent;
  } catch (e) {
    console.warn('[abrechnung] Mail nicht verschickt', template, e instanceof Error ? e.message : e);
    return false;
  }
}

async function notifyAdmins(ctx: PlacementCtx, type: string, title: string, message: string, relatedType: string, relatedId: string) {
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, type, title, message, relatedType, relatedId);
}

// ---------------------------------------------------------------------------
// Besetzungen des Headhunters laden
// ---------------------------------------------------------------------------

interface Loaded { facts: PlacementFacts[]; tranches: any[]; creditNotes: any[] }

async function loadFacts(ctx: PlacementCtx, userId: string, onlyPlacementId?: string): Promise<Loaded> {
  const db = ctx.db;
  const { data: trRows } = await db.from('recruiter_payout_tranches').select('*').eq('recruiter_id', userId);
  const tranches = (trRows ?? []) as any[];
  let placementRows: any[];
  if (onlyPlacementId) {
    const { data } = await db.from('placements').select('*').eq('id', onlyPlacementId);
    placementRows = (data ?? []) as any[];
  } else {
    const { data: subs } = await db.from('submissions').select('id').eq('recruiter_id', userId).in('stage', ['placed', 'hired']);
    const bySub = await rowsIn(db, 'placements', '*', 'submission_id', ((subs ?? []) as any[]).map((s) => s.id));
    const byTranche = await rowsIn(db, 'placements', '*', 'id', tranches.map((t) => t.placement_id));
    const map = new Map<string, any>();
    for (const p of [...bySub, ...byTranche]) map.set(p.id, p);
    placementRows = [...map.values()];
  }
  const subs = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id', 'id', placementRows.map((p) => p.submission_id));
  const subById = new Map(subs.map((s) => [s.id, s]));
  // Nur eigene Besetzungen: eigene Einreichung oder eigene Tranche
  const mine = placementRows.filter((p) => subById.get(p.submission_id)?.recruiter_id === userId || tranches.some((t) => t.placement_id === p.id));
  const ids = mine.map((p) => p.id);
  const [jobs, candidates, invoices, claims, offers, contracts, origs, replacements, creditNotes] = await Promise.all([
    rowsIn(db, 'jobs', 'id, title, company_name', 'id', subs.map((s) => s.job_id)),
    rowsIn(db, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id)),
    rowsIn(db, 'invoices', 'id, placement_id, invoice_type, status, issued_at, due_date, paid_at, created_at', 'placement_id', ids),
    rowsIn(db, 'continuity_claims', 'id, placement_id, kind, category, status, reported_at, decided_at, client_sphere, recruiter_statement, recruiter_statement_at', 'placement_id', ids),
    rowsIn(db, 'research_offers', 'placement_id, decision', 'placement_id', ids),
    rowsIn(db, 'employment_contracts', 'submission_id, signed_on, status, final_at', 'submission_id', mine.map((p) => p.submission_id)),
    rowsIn(db, 'placements', 'id, invoice_state', 'id', mine.map((p) => p.replaces_placement_id).filter(Boolean)),
    rowsIn(db, 'placements', 'id, submission_id, replaces_placement_id', 'replaces_placement_id', ids),
    db.from('recruiter_credit_notes').select('id, number, status, issued_on, pay_until, paid_on, net_cents').eq('recruiter_id', userId).then((r: any) => (r.data ?? []) as any[], () => [] as any[]),
  ]);
  const replSubs = await rowsIn(db, 'submissions', 'id, recruiter_id', 'id', replacements.map((r) => r.submission_id));
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const candById = new Map(candidates.map((c) => [c.id, c]));
  const origById = new Map(origs.map((o) => [o.id, o]));
  const cnMap: Record<string, CreditNoteRef> = {};
  for (const c of creditNotes) cnMap[c.id] = { id: c.id, number: c.number, issued_on: c.issued_on, pay_until: c.pay_until, paid_on: c.paid_on, status: c.status };
  const facts: PlacementFacts[] = mine.map((p) => {
    const s = subById.get(p.submission_id) ?? {};
    const job = jobById.get(s.job_id) ?? {};
    const inv = invoices.filter((i) => i.placement_id === p.id && i.status !== 'cancelled' && ['placement_fee', 'salary_difference'].includes(i.invoice_type))
      .sort((a, b) => (a.invoice_type === 'placement_fee' ? -1 : 1) - (b.invoice_type === 'placement_fee' ? -1 : 1) || String(b.created_at).localeCompare(String(a.created_at)))[0] ?? null;
    const claim = claims.filter((c) => c.placement_id === p.id).sort((a, b) => String(b.reported_at).localeCompare(String(a.reported_at)))[0] ?? null;
    const contract = contracts.filter((c) => c.submission_id === p.submission_id && c.status === 'final')[0] ?? null;
    const repl = replacements.find((r) => r.replaces_placement_id === p.id);
    return {
      p,
      tranches: tranches.filter((t) => t.placement_id === p.id) as TrancheLike[],
      candidateName: candById.get(s.candidate_id)?.full_name ?? null,
      jobTitle: job.title ?? null,
      jobId: s.job_id ?? null,
      companyName: job.company_name ?? null,
      invoice: inv ? { status: inv.status, issued_at: inv.issued_at, due_date: inv.due_date, paid_at: inv.paid_at } : null,
      claim: claim as ClaimLike | null,
      jokerDecided: offers.some((o) => o.placement_id === p.id),
      contractSignedOn: contract?.signed_on ?? null,
      origInvoicePaid: p.replaces_placement_id ? origById.get(p.replaces_placement_id)?.invoice_state === 'paid' : null,
      replacedByMe: repl ? replSubs.find((x) => x.id === repl.submission_id)?.recruiter_id === userId : null,
      creditNotes: cnMap,
    };
  });
  return { facts, tranches, creditNotes };
}

async function doneRunPeriods(db: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await db.from('credit_note_runs').select('period');
    return ((data ?? []) as any[]).map((r) => r.period);
  } catch (_e) {
    return [];
  }
}

/** Sprache der Anzeige aus dem Aufruf (Web-App schickt body.lang); ohne Angabe Deutsch. */
const viewLang = (body: any): Lang | null => normLang(body?.lang);

async function viewCtx(ctx: PlacementCtx, userId: string, lang?: Lang | null): Promise<ViewCtx & { billing: BillingView }> {
  const [settings, runs, billing] = await Promise.all([conditionsSettings(ctx.db), doneRunPeriods(ctx.db), loadBilling(ctx, userId)]);
  return { today: todayKey(ctx.now()), doneRuns: runs, v2Active: !!settings.activeFrom, taxMode: billing.view.tax.mode, billing: billing.view, lang };
}

/** Was fehlt, damit der Gutschriftlauf auszahlen kann (wie effectiveAccount/profileGaps im Admin-Strang). */
export function payoutGaps(b: BillingView, lang?: Lang | null): string[] {
  if (b.selfBilling.objectedAt) return [];
  const gaps: string[] = [];
  if (!b.exists) gaps.push(tr(lang, { de: 'Abrechnungsdaten einmal speichern', en: 'save your billing details once', sv: 'spara dina avräkningsuppgifter en gång', nb: 'lagre avregningsopplysningene dine én gang' }));
  if (!b.recipient.legalName || !b.recipient.street || !b.recipient.city) gaps.push(tr(lang, { de: 'Anschrift', en: 'address', sv: 'adress', nb: 'adresse' }));
  if (!b.tax.vatId && !b.tax.taxNumber) gaps.push(tr(lang, { de: 'USt-IdNr. oder Steuernummer', en: 'VAT ID or tax number', sv: 'momsregistreringsnummer eller skattenummer', nb: 'MVA-nummer eller skattenummer' }));
  if (!b.account) gaps.push(tr(lang, { de: 'Auszahlungskonto', en: 'payout account', sv: 'utbetalningskonto', nb: 'utbetalingskonto' }));
  else if (!b.account.confirmedAt && !b.pending?.confirmedAt) gaps.push(tr(lang, { de: 'Konto mit Code bestätigen', en: 'confirm your account with a code', sv: 'bekräfta kontot med en kod', nb: 'bekreft kontoen med en kode' }));
  return gaps;
}

// ---------------------------------------------------------------------------
// H8: Übersicht
// ---------------------------------------------------------------------------

export async function overview(ctx: PlacementCtx, user: User, body: any = {}) {
  await requireRecruiter(ctx, user);
  const vctx = await viewCtx(ctx, user.id, viewLang(body));
  const { facts, tranches, creditNotes } = await loadFacts(ctx, user.id);
  const rows = facts.map((f) => placementRow(f, vctx))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt.localeCompare(a.createdAt));
  const legacyPaid = tranches.filter((t) => t.status === 'paid' && !t.credit_note_id);
  const totals = overviewTotals(facts, creditNotes, legacyPaid, vctx);
  return {
    today: vctx.today,
    year: vctx.today.slice(0, 4),
    taxMode: vctx.taxMode,
    rows,
    totals: {
      receivedYearCents: totals.receivedYearCents,
      waitingStartCents: totals.waitingStartCents,
      waitingPaymentCents: totals.waitingPaymentCents,
      waitingGuaranteeCents: totals.waitingGuaranteeCents,
    },
    next: totals.upcoming[0] ?? null,
    upcoming: totals.upcoming,
    creditNoteCount: creditNotes.filter((c) => c.status !== 'cancelled').length,
    payoutGaps: payoutGaps(vctx.billing, vctx.lang as Lang | null),
  };
}

// ---------------------------------------------------------------------------
// H9 / H10 / J5: Besetzungs-Fenster
// ---------------------------------------------------------------------------

async function placementIdFrom(ctx: PlacementCtx, user: User, body: any): Promise<string> {
  if (typeof body?.placementId === 'string' && UUID.test(body.placementId)) return body.placementId;
  if (typeof body?.taskId === 'string' && UUID.test(body.taskId)) {
    const { data: task } = await ctx.db.from('recruiter_tasks').select('submission_id, recruiter_id').eq('id', body.taskId).maybeSingle();
    must(task && (task as any).recruiter_id === user.id, 'Diese Aufgabe gibt es nicht.', 'not_found');
    body = { submissionId: (task as any).submission_id };
  }
  must(typeof body?.submissionId === 'string' && UUID.test(body.submissionId), 'Ungültige Besetzung.');
  const { data } = await ctx.db.from('placements').select('id').eq('submission_id', body.submissionId).maybeSingle();
  must(data, 'Zu dieser Einreichung gibt es keine Besetzung.', 'not_found');
  return (data as any).id;
}

export async function placementView(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const id = await placementIdFrom(ctx, user, body);
  const { facts } = await loadFacts(ctx, user.id, id);
  must(facts.length === 1, 'Das ist nicht deine Besetzung.', 'not_allowed');
  const vctx = await viewCtx(ctx, user.id, viewLang(body));
  return { view: placementWindow(facts[0], vctx), taxMode: vctx.taxMode };
}

/** Offene Start- bzw. Halbzeit-Aufgaben zu einer Einreichung schließen. */
async function closeSystemTasks(ctx: PlacementCtx, recruiterId: string, submissionId: string, kind: 'start' | 'halfway', status: 'completed' | 'cancelled' = 'completed') {
  const nowIso = nowIsoOf(ctx);
  const q = ctx.db.from('recruiter_tasks').update({ status, completed_at: nowIso, updated_at: nowIso })
    .eq('recruiter_id', recruiterId).eq('submission_id', submissionId).eq('source', 'system').eq('status', 'pending')
    .eq('task_type', kind === 'start' ? 'call' : 'follow_up')
    .like('title', kind === 'start' ? 'Hat % angefangen?' : 'Wie läuft es bei %?');
  const { error } = await q;
  if (error) console.warn('[abrechnung] Aufgabe nicht geschlossen', error.message);
}

/** H7: Antritt melden (hat angefangen / später / nicht angefangen). */
export async function reportStart(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const placementId = await placementIdFrom(ctx, user, body);
  const p = await loadPlacementRow(ctx, placementId);
  const result = await reportStartByRecruiter(ctx, user, { ...body, placementId });
  if (p.submission_id) await closeSystemTasks(ctx, user.id, p.submission_id, 'start');
  return { ...result, ...(await placementView(ctx, user, { placementId, lang: body?.lang })) };
}

/** H7 rechts: Halbzeit der Garantie. „Es wackelt“ geht als Hinweis an Matchunt, der Kunde sieht nichts. */
export async function halfway(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const placementId = await placementIdFrom(ctx, user, body);
  const { facts } = await loadFacts(ctx, user.id, placementId);
  must(facts.length === 1, 'Das ist nicht deine Besetzung.', 'not_allowed');
  const f = facts[0];
  const p = f.p;
  must(continuityDaysOf(p) && !p.replaces_placement_id, 'Diese Besetzung hat keine Garantie.', 'conflict');
  must(p.placement_state === 'started', 'Die Garantie läuft gerade nicht.', 'conflict');
  const status = body?.status === 'shaky' ? 'shaky' : body?.status === 'ok' ? 'ok' : null;
  must(status, 'Bitte wählen: läuft gut oder es wackelt.');
  const note = longText(body?.note, 1000) || null;
  const nowIso = nowIsoOf(ctx);
  const { error } = await ctx.db.from('placements').update({ halfway_status: status, halfway_note: note, halfway_at: nowIso }).eq('id', p.id);
  dbFail(error, 'Deine Antwort');
  if (status === 'shaky') {
    const me = await profile(ctx.db, user.id);
    await notifyAdmins(ctx, 'placement_halfway_shaky', `Es wackelt: ${f.candidateName ?? 'Kandidat'}`,
      `${me?.name ?? 'Headhunter'} · ${f.companyName ?? ''} · ${f.jobTitle ?? ''}${note ? ` · ${note.slice(0, 300)}` : ''} · Garantie bis ${dmy(p.continuity_end_date)}`, 'placement', p.id);
  }
  if (p.submission_id) await closeSystemTasks(ctx, user.id, p.submission_id, 'halfway');
  return { ok: true, status, ...(await placementView(ctx, user, { placementId, lang: body?.lang })) };
}

/** H10: Stellungnahme zum offenen Fall. */
export async function statement(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  await recruiterStatement(ctx, user, body);
  return { ok: true, ...(await placementView(ctx, user, { placementId: body?.placementId, lang: body?.lang })) };
}

// ---------------------------------------------------------------------------
// H3–H6: Konditionen je Stelle
// ---------------------------------------------------------------------------

export async function jobTerms(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const raw: unknown[] = Array.isArray(body?.jobIds) ? body.jobIds : [];
  const ids: string[] = uniq(raw.filter((x): x is string => typeof x === 'string' && UUID.test(x))).slice(0, 100);
  if (!ids.length) return { terms: [] };
  const db = ctx.db;
  const nowIso = nowIsoOf(ctx);
  const jobs = await rowsIn(db, 'jobs', 'id, status, mandate_id, fee_percentage, employment_type, research_for_placement_id, research_since', 'id', ids);
  const [mandates, acts, reports, settings] = await Promise.all([
    rowsIn(db, 'commercial_mandates', 'id, pricing_snapshot, package_key', 'id', jobs.map((j) => j.mandate_id).filter(Boolean)),
    rowsIn(db, 'recruiter_job_activations', 'job_id, activated_at', 'job_id', ids, (q) => q.eq('recruiter_id', user.id)),
    rowsIn(db, 'recruiter_client_reports', 'job_id, created_at', 'job_id', ids, (q) => q.eq('recruiter_id', user.id)),
    conditionsSettings(db),
  ]);
  const facts = settings.activeFrom ? await recruiterConditionFacts(db, user.id) : { consentedAt: null, contractSignedAt: null };
  const origs = await rowsIn(db, 'placements', '*', 'id', jobs.map((j) => j.research_for_placement_id).filter(Boolean));
  const origSubs = await rowsIn(db, 'submissions', 'id, recruiter_id', 'id', origs.map((o) => o.submission_id));
  const origTranches = await rowsIn(db, 'recruiter_payout_tranches', 'placement_id, tranche_type, amount_cents, status', 'placement_id', origs.map((o) => o.id));
  const firstAct = (jobId: string) => acts.filter((a) => a.job_id === jobId).map((a) => String(a.activated_at)).sort()[0] ?? null;
  const lastReport = (jobId: string) => reports.filter((r) => r.job_id === jobId).map((r) => String(r.created_at)).sort().pop() ?? null;
  const out: JobTerms[] = [];
  for (const j of jobs) {
    if (j.employment_type === 'freelance') continue;
    const activatedAt = firstAct(j.id);
    if (['draft', 'pending_approval'].includes(String(j.status)) && !activatedAt) continue;
    const mandate = mandates.find((m) => m.id === j.mandate_id);
    const base: any = mandate?.pricing_snapshot ?? fallbackSnapshot(j);
    const pkg: PackageKey = isPackageKey(base.packageKey) ? base.packageKey : isPackageKey(mandate?.package_key) ? mandate.package_key : 'core';
    const version = settings.activeFrom
      ? conditionsVersionAt({ at: activatedAt ?? nowIso, activeFrom: settings.activeFrom, forcedFrom: settings.forcedFrom, ...facts })
      : 1;
    const standard = !!j.mandate_id;
    const split = splitFor(pkg, version);
    let research: JobTerms['research'] = null;
    const orig = j.research_for_placement_id ? origs.find((o) => o.id === j.research_for_placement_id) : null;
    if (orig) {
      const bounty = bountyCentsOf(orig);
      const own = origSubs.find((s) => s.id === orig.submission_id)?.recruiter_id === user.id;
      const kept = origTranches.filter((t) => t.placement_id === orig.id && t.tranche_type === 'initial' && t.status !== 'forfeited' && t.status !== 'cancelled')
        .reduce((a, t) => a + Number(t.amount_cents ?? 0), 0);
      const ownCents = own ? ownBountyCents(orig, kept, bounty) : null;
      research = {
        reason: orig.non_start_reported_at && !orig.start_fixed_at ? 'non_start' : 'departure',
        since: j.research_since ?? orig.research_started_at ?? null,
        bountyCents: bounty,
        ownCents,
        ownIsRetention: ownCents != null && ownCents > 0 && ownCents === Number(orig.recruiter_retention_cents ?? 0),
      };
    }
    out.push({
      jobId: j.id, packageKey: pkg, version, standard,
      initialPct: standard ? split.initialPct : Number(base.recruiterInitialPct ?? split.initialPct),
      retentionPct: standard ? split.retentionPct : Number(base.recruiterRetentionPct ?? 0),
      continuityDays: standard ? split.continuityDays : (Number(base.continuityDays) > 0 ? Number(base.continuityDays) : null),
      v2Active: !!settings.activeFrom,
      activatedAt,
      research,
      reportedAt: lastReport(j.id),
    });
  }
  return { terms: out };
}

// ---------------------------------------------------------------------------
// H1 / H2: neue Konditionen
// ---------------------------------------------------------------------------

export async function conditions(ctx: PlacementCtx, user: User, body: any = {}) {
  await requireRecruiter(ctx, user);
  const lang = viewLang(body);
  const s = await conditionsSettings(ctx.db);
  const today = todayKey(ctx.now());
  if (!s.activeFrom) return { show: false, activeFrom: null, forcedFrom: null, consentedAt: null, version: 1, table: conditionsTable(lang) };
  const facts = await recruiterConditionFacts(ctx.db, user.id);
  const version = conditionsVersionAt({ at: today, activeFrom: s.activeFrom, forcedFrom: s.forcedFrom, ...facts });
  const newContract = !!facts.contractSignedAt && facts.contractSignedAt.slice(0, 10) >= s.activeFrom.slice(0, 10);
  const forced = !!s.forcedFrom && today >= s.forcedFrom.slice(0, 10);
  return {
    show: !facts.consentedAt && !newContract && !forced,
    activeFrom: s.activeFrom.slice(0, 10),
    forcedFrom: s.forcedFrom ? s.forcedFrom.slice(0, 10) : null,
    consentedAt: facts.consentedAt,
    version,
    table: conditionsTable(lang),
  };
}

export async function consent(ctx: PlacementCtx, user: User, body: any = {}) {
  await requireRecruiter(ctx, user);
  const s = await conditionsSettings(ctx.db);
  must(s.activeFrom, 'Es gibt gerade keine neuen Konditionen zum Zustimmen.', 'conflict');
  const { error } = await ctx.db.from('recruiter_condition_consents')
    .upsert({ recruiter_id: user.id, version: 2, consented_at: nowIsoOf(ctx) }, { onConflict: 'recruiter_id,version', ignoreDuplicates: true });
  dbFail(error, 'Deine Zustimmung');
  const me = await profile(ctx.db, user.id);
  await notifyAdmins(ctx, 'recruiter_conditions_consent', `Neuen Konditionen zugestimmt: ${me?.name ?? 'Headhunter'}`, 'Fassung 2 gilt für Stellen, die ab dem Stichtag aktiviert werden.', 'recruiter', user.id);
  return await conditions(ctx, user, body);
}

// ---------------------------------------------------------------------------
// H11: Gutschriften und Einwand
// ---------------------------------------------------------------------------

function cleanLines(lines: unknown): { title: string; detail: string | null; amountCents: number | null }[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((l: any) => ({
    title: String(l?.title ?? l?.label ?? ''),
    detail: Array.isArray(l?.details) ? l.details.join(' · ') : (typeof l?.detail === 'string' ? l.detail : null),
    amountCents: Number.isFinite(Number(l?.amountCents ?? l?.netCents ?? l?.amount_cents)) ? Number(l?.amountCents ?? l?.netCents ?? l?.amount_cents) : null,
  })).filter((l) => l.title);
}

export async function creditNotes(ctx: PlacementCtx, user: User, body: any = {}) {
  await requireRecruiter(ctx, user);
  const today = todayKey(ctx.now());
  const [{ data: notes, error }, { data: objections }] = await Promise.all([
    ctx.db.from('recruiter_credit_notes').select('*').eq('recruiter_id', user.id).order('issued_on', { ascending: false }),
    ctx.db.from('credit_note_objections').select('*').eq('recruiter_id', user.id).order('created_at', { ascending: false }),
  ]);
  dbFail(error, 'Die Gutschriften');
  const list = ((notes ?? []) as any[]).map((n) => {
    const obj = ((objections ?? []) as any[]).find((o) => o.credit_note_id === n.id) ?? null;
    const until = objectionUntil(String(n.issued_on));
    return {
      id: n.id, number: n.number, status: n.status, issuedOn: n.issued_on, period: n.period, payUntil: n.pay_until, paidOn: n.paid_on,
      netCents: Number(n.net_cents ?? 0), vatCents: Number(n.vat_cents ?? 0), totalCents: Number(n.total_cents ?? 0), vatRate: Number(n.vat_rate ?? 0),
      taxMode: n.tax_mode, lines: cleanLines(n.lines), hasPdf: !!n.pdf_path, ibanMasked: n.iban_masked ?? null,
      objectionUntil: until,
      canObject: n.status !== 'cancelled' && today <= until && !(obj && obj.status === 'open'),
      objection: obj ? { status: obj.status, topic: obj.topic, note: obj.note, createdAt: obj.created_at, resolution: obj.resolution, resolvedAt: obj.resolved_at } : null,
    };
  });
  // Was in den nächsten Lauf kommt (H11 „Dezember-Lauf · in Vorbereitung“)
  const vctx = await viewCtx(ctx, user.id, viewLang(body));
  const { facts, tranches, creditNotes: cn } = await loadFacts(ctx, user.id);
  const totals = overviewTotals(facts, cn, tranches.filter((t) => t.status === 'paid' && !t.credit_note_id), vctx);
  const years = uniq(list.map((n) => String(n.issuedOn).slice(0, 4))).sort().reverse();
  return { notes: list, upcoming: totals.upcoming, taxMode: vctx.taxMode, years };
}

async function ownCreditNote(ctx: PlacementCtx, user: User, id: unknown) {
  must(typeof id === 'string' && UUID.test(id), 'Ungültige Gutschrift.');
  const { data, error } = await ctx.db.from('recruiter_credit_notes').select('*').eq('id', id).maybeSingle();
  dbFail(error, 'Die Gutschrift');
  must(data && (data as any).recruiter_id === user.id, 'Diese Gutschrift gibt es nicht.', 'not_found');
  return data as any;
}

export async function creditNoteFile(ctx: AbrechnungCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const n = await ownCreditNote(ctx, user, body?.creditNoteId);
  must(n.pdf_path, 'Zu dieser Gutschrift liegt noch kein PDF vor.', 'not_found');
  const url = await ctx.creditFiles.url(n.pdf_path, 120);
  must(url, 'Das PDF ist gerade nicht abrufbar.', 'not_found');
  return { url, number: n.number };
}

/** CSV des Jahres und Links zu allen PDFs; das ZIP baut der Browser (zipStore). */
export async function creditNotesExport(ctx: AbrechnungCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const year = /^\d{4}$/.test(String(body?.year ?? '')) ? String(body.year) : todayKey(ctx.now()).slice(0, 4);
  const { data, error } = await ctx.db.from('recruiter_credit_notes').select('*').eq('recruiter_id', user.id)
    .gte('issued_on', `${year}-01-01`).lte('issued_on', `${year}-12-31`).order('issued_on', { ascending: true });
  dbFail(error, 'Die Gutschriften');
  const rows = (data ?? []) as any[];
  const files: { number: string; url: string }[] = [];
  for (const n of rows) {
    if (!n.pdf_path) continue;
    const url = await ctx.creditFiles.url(n.pdf_path, 300);
    if (url) files.push({ number: n.number, url });
  }
  return { year, count: rows.length, csv: creditNotesCsv(rows), files };
}

export async function objection(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const n = await ownCreditNote(ctx, user, body?.creditNoteId);
  const topic = String(body?.topic ?? '');
  must(OBJECTION_TOPICS[topic], 'Bitte wählen, was nicht stimmt.');
  const note = longText(body?.note, 2000);
  must(note, 'Bitte kurz beschreiben, was nicht stimmt.');
  must(n.status !== 'cancelled', 'Diese Gutschrift ist storniert.', 'conflict');
  const until = objectionUntil(String(n.issued_on));
  must(todayKey(ctx.now()) <= until, `Die Frist für Einwände ist am ${dmy(until)} abgelaufen.`, 'conflict');
  const { data: open } = await ctx.db.from('credit_note_objections').select('id').eq('credit_note_id', n.id).eq('status', 'open').limit(1);
  must(!(open ?? []).length, 'Zu dieser Gutschrift liegt schon ein offener Einwand vor.', 'conflict');
  const { error } = await ctx.db.from('credit_note_objections').insert({ credit_note_id: n.id, recruiter_id: user.id, topic, note });
  dbFail(error, 'Dein Einwand');
  const me = await profile(ctx.db, user.id);
  await notifyAdmins(ctx, 'credit_note_objection', `Einwand zur Gutschrift ${n.number}`, `${me?.name ?? 'Headhunter'} · ${OBJECTION_TOPICS[topic]} · ${note.slice(0, 300)}`, 'credit_note', n.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// H13: Abrechnungsdaten, Konto ändern mit Code, Gutschriftverfahren
// ---------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  deutschland: 'DE', germany: 'DE', österreich: 'AT', oesterreich: 'AT', austria: 'AT', schweiz: 'CH', switzerland: 'CH',
  niederlande: 'NL', netherlands: 'NL', frankreich: 'FR', france: 'FR', italien: 'IT', italy: 'IT', spanien: 'ES', spain: 'ES', polen: 'PL', poland: 'PL',
  'vereinigtes königreich': 'GB', 'united kingdom': 'GB', luxemburg: 'LU', belgien: 'BE', dänemark: 'DK', schweden: 'SE',
};
export const COUNTRY_LABEL: Record<string, string> = {
  DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', NL: 'Niederlande', FR: 'Frankreich', IT: 'Italien', ES: 'Spanien', PL: 'Polen', GB: 'Vereinigtes Königreich',
  LU: 'Luxemburg', BE: 'Belgien', DK: 'Dänemark', SE: 'Schweden',
};
const countryCode = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return COUNTRY_NAMES[s.toLowerCase()] ?? null;
};
const VAT_ID = /^[A-Z]{2}[0-9A-Z+*.]{2,13}$/;
const TAX_STATUS_TO_MODE: Record<string, TaxMode> = { regular: 'standard', small_business: 'small_business', foreign: 'foreign' };

/** „Musterweg 4, 80331 München“ → Straße, PLZ, Ort */
function splitAddress(v: unknown) {
  const s = String(v ?? '').trim();
  if (!s) return { street: null, postalCode: null, city: null };
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  const tail = parts.length > 1 ? parts[1] : '';
  const m = tail.match(/^(\d{4,5})\s+(.+)$/);
  return { street: parts[0] || null, postalCode: m ? m[1] : null, city: m ? m[2] : (tail || null) };
}

async function onboardingProfile(db: SupabaseClient, userId: string): Promise<any | null> {
  try {
    const { data } = await db.from('recruiter_onboarding_cases').select('profile, created_at').eq('claimed_by', userId).order('created_at', { ascending: false }).limit(1);
    return ((data ?? []) as any[])[0]?.profile ?? null;
  } catch (_e) {
    return null;
  }
}

/** Übernimmt ein bestätigtes neues Konto, sobald die 48 Stunden um sind. */
async function applyPendingAccount(ctx: PlacementCtx, row: any): Promise<boolean> {
  if (!row?.pending_iban || !row.pending_confirmed_at || !row.pending_effective_at) return false;
  if (Date.parse(row.pending_effective_at) > ctx.now()) return false;
  const nowIso = nowIsoOf(ctx);
  const { data, error } = await ctx.db.from('recruiter_billing_profiles').update({
    account_holder: row.pending_account_holder, iban: row.pending_iban, bic: row.pending_bic, iban_confirmed_at: row.pending_confirmed_at,
    pending_account_holder: null, pending_iban: null, pending_bic: null, pending_requested_at: null, pending_confirmed_at: null, pending_effective_at: null,
    updated_at: nowIso,
  }).eq('recruiter_id', row.recruiter_id).eq('pending_effective_at', row.pending_effective_at).select('recruiter_id').maybeSingle();
  if (error || !data) return false;
  await ctx.db.from('profiles').update({ bank_account_holder: row.pending_account_holder, bank_iban: row.pending_iban, bank_bic: row.pending_bic }).eq('user_id', row.recruiter_id);
  await notify(ctx, row.recruiter_id, 'payout_account_active', (l) => tx(l, 'Neues Auszahlungskonto gilt', 'New payout account is active', 'Nytt utbetalningskonto gäller', 'Ny utbetalingskonto gjelder'),
    (l) => tx(l, m`Ab jetzt überweisen wir auf ${maskIban(row.pending_iban)}.`, m`From now on we pay to ${maskIban(row.pending_iban)}.`, m`Från och med nu betalar vi till ${maskIban(row.pending_iban)}.`, m`Fra nå av betaler vi til ${maskIban(row.pending_iban)}.`), 'recruiter', row.recruiter_id);
  return true;
}

interface BillingLoaded { row: any | null; profileRow: any; view: BillingView }

async function loadBilling(ctx: PlacementCtx, userId: string, email?: string | null): Promise<BillingLoaded> {
  let row: any = null;
  try {
    const { data } = await ctx.db.from('recruiter_billing_profiles').select('*').eq('recruiter_id', userId).maybeSingle();
    row = data ?? null;
  } catch (_e) { row = null; }
  if (row && await applyPendingAccount(ctx, row)) {
    const { data } = await ctx.db.from('recruiter_billing_profiles').select('*').eq('recruiter_id', userId).maybeSingle();
    row = data ?? row;
  }
  const { data: prof } = await ctx.db.from('profiles').select('full_name, email, company_name, company_address, tax_id, bank_account_holder, bank_iban, bank_bic').eq('user_id', userId).maybeSingle();
  const p = (prof ?? {}) as any;
  const ob = row ? null : await onboardingProfile(ctx.db, userId);
  const addr = splitAddress(p.company_address || ob?.address);
  const legacyTax = String(p.tax_id ?? '').replace(/\s+/g, '').toUpperCase();
  const legacyVat = VAT_ID.test(legacyTax) ? legacyTax : '';
  const mode: TaxMode = isTaxMode(row?.tax_mode) ? row.tax_mode : (TAX_STATUS_TO_MODE[String(ob?.taxStatus ?? '')] ?? 'standard');
  const country = row?.country ?? countryCode(ob?.country) ?? 'DE';
  const iban = row?.iban ?? (p.bank_iban || null);
  const consentFlag = (await (async () => {
    const o = ob ?? await onboardingProfile(ctx.db, userId);
    const d = o?.contractDetails;
    return d && typeof d.creditNoteConsent === 'boolean' ? d.creditNoteConsent as boolean : null;
  })());
  const view: BillingView = {
    exists: !!row,
    recipient: {
      legalName: row?.legal_name ?? (p.company_name || ob?.company || p.full_name || ''),
      legalForm: row?.legal_form ?? (ob?.legalForm || ''),
      street: row?.street ?? (addr.street ?? ''),
      postalCode: row?.postal_code ?? (addr.postalCode ?? ''),
      city: row?.city ?? (addr.city ?? ''),
      country,
      countryLabel: COUNTRY_LABEL[country] ?? country,
    },
    tax: {
      mode,
      vatId: row ? (row.vat_id ?? '') : legacyVat,
      taxNumber: row ? (row.tax_number ?? '') : (legacyVat ? (ob?.contractDetails?.taxNumber ?? '') : (String(p.tax_id ?? '') || ob?.contractDetails?.taxNumber || '')),
      text: TAX_MODE_TEXT[mode],
    },
    account: iban ? {
      holder: row?.account_holder ?? (p.bank_account_holder || ''),
      ibanMasked: maskIban(iban),
      bic: row?.bic ?? (p.bank_bic || ''),
      confirmedAt: row?.iban_confirmed_at ?? null,
      fromProfile: !row?.iban,
    } : null,
    pending: row?.pending_iban ? {
      holder: row.pending_account_holder ?? '', ibanMasked: maskIban(row.pending_iban), requestedAt: row.pending_requested_at,
      confirmedAt: row.pending_confirmed_at, effectiveAt: row.pending_effective_at,
    } : null,
    selfBilling: { consented: consentFlag, objectedAt: row?.self_billing_objected_at ?? null },
    loginEmailMasked: maskEmail(email ?? p.email),
    complete: false,
  };
  view.complete = !!(view.recipient.legalName && view.recipient.street && view.recipient.city && (view.tax.vatId || view.tax.taxNumber) && view.account);
  return { row, profileRow: p, view };
}

/** Legt die Zeile an (aus dem Profil vorbelegt), falls es sie noch nicht gibt. */
async function ensureBillingRow(ctx: PlacementCtx, userId: string, loaded: BillingLoaded) {
  if (loaded.row) return loaded.row;
  const v = loaded.view;
  const p = loaded.profileRow;
  const insert = {
    recruiter_id: userId,
    legal_name: v.recipient.legalName || null, legal_form: v.recipient.legalForm || null,
    street: v.recipient.street || null, postal_code: v.recipient.postalCode || null, city: v.recipient.city || null, country: v.recipient.country || 'DE',
    tax_mode: v.tax.mode, vat_id: v.tax.vatId || null, tax_number: v.tax.taxNumber || null,
    account_holder: p.bank_account_holder || null, iban: p.bank_iban ? compactIban(p.bank_iban) : null, bic: p.bank_bic || null,
  };
  const { data, error } = await ctx.db.from('recruiter_billing_profiles').upsert(insert, { onConflict: 'recruiter_id', ignoreDuplicates: true }).select('*').maybeSingle();
  dbFail(error, 'Deine Abrechnungsdaten');
  if (data) return data;
  const { data: again } = await ctx.db.from('recruiter_billing_profiles').select('*').eq('recruiter_id', userId).maybeSingle();
  return again;
}

export async function billingProfile(ctx: PlacementCtx, user: User) {
  await requireRecruiter(ctx, user);
  return { billing: (await loadBilling(ctx, user.id, user.email)).view };
}

export async function saveBillingProfile(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const b = body?.billing ?? body ?? {};
  const legalName = text(b.legalName, 200);
  must(legalName, 'Bitte gib an, an wen die Gutschrift geht (Name oder Firma).');
  const street = text(b.street, 200), postalCode = text(b.postalCode, 20), city = text(b.city, 120);
  must(street && city, 'Bitte die vollständige Anschrift angeben.');
  const country = countryCode(b.country) ?? 'DE';
  const mode = isTaxMode(b.taxMode) ? b.taxMode : null;
  must(mode, 'Bitte wählen: regelbesteuert, Kleinunternehmer oder Ausland.');
  const vatId = text(b.vatId, 20).replace(/\s+/g, '').toUpperCase();
  const taxNumber = text(b.taxNumber, 40);
  must(!vatId || VAT_ID.test(vatId), 'Die USt-IdNr. beginnt mit dem Länderkürzel, etwa DE123456789.');
  if (mode === 'foreign') {
    must(country !== 'DE', 'Bei „Ausland“ bitte das Land deines Unternehmens angeben.');
    must(vatId, 'Für die Steuerschuldnerschaft (Reverse Charge) brauchen wir deine USt-IdNr.');
  } else {
    must(country === 'DE', mode === 'small_business' ? 'Die Kleinunternehmerregelung gilt für Unternehmen in Deutschland. Sitzt du im Ausland, wähle „Ausland“.' : 'Regelbesteuert mit 19 % gilt für Unternehmen in Deutschland. Sitzt du im Ausland, wähle „Ausland“.');
    must(vatId || taxNumber, 'Bitte USt-IdNr. oder Steuernummer angeben.');
  }
  const loaded = await loadBilling(ctx, user.id, user.email);
  await ensureBillingRow(ctx, user.id, loaded);
  const before = loaded.view;
  const patch = {
    legal_name: legalName, legal_form: text(b.legalForm, 80) || null, street, postal_code: postalCode || null, city, country,
    tax_mode: mode, vat_id: vatId || null, tax_number: taxNumber || null, updated_at: nowIsoOf(ctx),
  };
  const { error } = await ctx.db.from('recruiter_billing_profiles').update(patch).eq('recruiter_id', user.id);
  dbFail(error, 'Deine Abrechnungsdaten');
  // Altes Profil mitführen (Startschritte „Firmendaten“, Admin-Ansichten)
  await ctx.db.from('profiles').update({ company_name: legalName, company_address: [street, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', '), tax_id: vatId || taxNumber || null }).eq('user_id', user.id);
  const changed: string[] = [];
  if (before.recipient.legalName !== legalName || before.recipient.street !== street || before.recipient.city !== city || before.recipient.country !== country) changed.push('Empfänger/Anschrift');
  if (before.tax.mode !== mode || before.tax.vatId !== vatId || before.tax.taxNumber !== taxNumber) changed.push(`Steuer (${mode === 'standard' ? 'regelbesteuert' : mode === 'small_business' ? 'Kleinunternehmer' : 'Ausland'})`);
  if (changed.length && loaded.row) {
    const me = await profile(ctx.db, user.id);
    await notifyAdmins(ctx, 'recruiter_billing_changed', `Abrechnungsdaten geändert: ${me?.name ?? legalName}`, changed.join(', '), 'recruiter', user.id);
  }
  return { ok: true, billing: (await loadBilling(ctx, user.id, user.email)).view };
}

const CODE_TTL_MIN = 15;
const CODE_MAX_ATTEMPTS = 5;
const codeScope = (userId: string) => `account:${userId}`;

export async function accountChangeRequest(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  must(user.email, 'Deinem Konto fehlt eine E-Mail-Adresse.', 'conflict');
  const holder = text(body?.holder, 200);
  const iban = compactIban(body?.iban).slice(0, 34);
  const bic = String(body?.bic ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 11);
  must(holder.length >= 2, 'Bitte den Kontoinhaber angeben.');
  must(iban && ibanValid(iban), 'Die IBAN stimmt nicht. Bitte prüf sie noch einmal.');
  must(bicValid(bic), 'Der BIC stimmt nicht. Er hat 8 oder 11 Zeichen.');
  const nowMs = ctx.now();
  const { data: recent } = await ctx.db.from('recruiter_account_codes').select('id').eq('recruiter_id', user.id).gte('created_at', new Date(nowMs - 3_600_000).toISOString());
  must(((recent ?? []) as any[]).length < 5, 'Zu viele Codes in kurzer Zeit. Bitte versuch es in einer Stunde noch einmal.', 'rate_limited');
  const loaded = await loadBilling(ctx, user.id, user.email);
  const row = await ensureBillingRow(ctx, user.id, loaded);
  // Ein noch nicht bestätigtes Konto (aus dem alten Profil) darf mit demselben Code bestätigt werden
  must(!(row?.iban && row.iban_confirmed_at && compactIban(row.iban) === iban && (row.account_holder ?? '') === holder), 'Das ist schon dein Auszahlungskonto.', 'conflict');
  const nowIso = new Date(nowMs).toISOString();
  // Ältere, noch offene Codes gelten nicht mehr
  await ctx.db.from('recruiter_account_codes').update({ used_at: nowIso }).eq('recruiter_id', user.id).is('used_at', null);
  const code = generateNumericCode(6);
  const expiresAt = new Date(nowMs + CODE_TTL_MIN * 60_000).toISOString();
  const { error: cErr } = await ctx.db.from('recruiter_account_codes').insert({ recruiter_id: user.id, code_hash: await hashCode(codeScope(user.id), code), expires_at: expiresAt });
  dbFail(cErr, 'Der Code');
  const { error } = await ctx.db.from('recruiter_billing_profiles').update({
    pending_account_holder: holder, pending_iban: iban, pending_bic: bic || null, pending_requested_at: nowIso, pending_confirmed_at: null, pending_effective_at: null, updated_at: nowIso,
  }).eq('recruiter_id', user.id);
  dbFail(error, 'Das neue Konto');
  // Erste Einrichtung oder Bestätigung des alten Profil-Kontos: gilt sofort nach dem Code
  const firstSetup = !row?.iban || !row.iban_confirmed_at;
  // Sprache: Oberfläche (body.lang), sonst Profil des Headhunters, sonst Deutsch
  const l = viewLang(body) ?? await recruiterLanguage(ctx.db, user.id);
  const heading = firstSetup ? tx(l, 'Dein Code für das Auszahlungskonto', 'Your code for the payout account', 'Din kod för utbetalningskontot', 'Koden din for utbetalingskontoen')
    : tx(l, 'Dein Code zum Ändern des Auszahlungskontos', 'Your code for changing the payout account', 'Din kod för att ändra utbetalningskontot', 'Koden din for å endre utbetalingskontoen');
  const notYou = tx(l, 'Warst du das nicht? Dann antworte sofort auf diese Mail.', 'Wasn’t you? Then reply to this email right away.', 'Var det inte du? Svara då direkt på det här mejlet.', 'Var det ikke deg? Svar da på denne e-posten med en gang.');
  const html = [
    `<p style="margin:0 0 12px 0;">${tx(l, 'Hallo,', 'Hi,', 'Hej,', 'Hei,')}</p>`,
    `<p style="margin:0 0 12px 0;">${firstSetup ? tx(l, 'du richtest dein Auszahlungskonto ein', 'you are setting up your payout account', 'du lägger upp ditt utbetalningskonto', 'du setter opp utbetalingskontoen din') : tx(l, 'du änderst dein Auszahlungskonto', 'you are changing your payout account', 'du ändrar ditt utbetalningskonto', 'du endrer utbetalingskontoen din')}: ${esc(holder)} · ${esc(maskIban(iban))}.</p>`,
    `<p style="margin:0 0 12px 0;font-size:28px;letter-spacing:6px;font-weight:600;">${esc(code)}</p>`,
    `<p style="margin:0 0 12px 0;">${tx(l, `Der Code gilt ${CODE_TTL_MIN} Minuten.`, `The code is valid for ${CODE_TTL_MIN} minutes.`, `Koden gäller i ${CODE_TTL_MIN} minuter.`, `Koden gjelder i ${CODE_TTL_MIN} minutter.`)}${firstSetup ? '' : tx(l, ' Das neue Konto gilt 48 Stunden nach der Bestätigung.', ' The new account applies 48 hours after confirmation.', ' Det nya kontot gäller 48 timmar efter bekräftelsen.', ' Den nye kontoen gjelder 48 timer etter bekreftelsen.')}</p>`,
    `<p style="margin:0 0 12px 0;">${notYou}</p>`,
  ].join('');
  const plain = tx(l, `${heading}: ${code} (gilt ${CODE_TTL_MIN} Minuten). Warst du das nicht? Antworte sofort auf diese Mail.`, `${heading}: ${code} (valid for ${CODE_TTL_MIN} minutes). ${notYou}`, `${heading}: ${code} (gäller i ${CODE_TTL_MIN} minuter). ${notYou}`, `${heading}: ${code} (gjelder i ${CODE_TTL_MIN} minutter). ${notYou}`);
  const sent = await sendMail(ctx, user.email, heading, heading, html, plain, 'recruiter_account_code', { user_id: user.id }, l);
  return { ok: true, sent, sentTo: maskEmail(user.email), expiresAt, firstSetup };
}

export async function accountChangeConfirm(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const code = String(body?.code ?? '').replace(/\D/g, '');
  must(code.length === 6, 'Bitte den 6-stelligen Code aus der Mail eingeben.');
  const { data: rows } = await ctx.db.from('recruiter_account_codes').select('*').eq('recruiter_id', user.id).is('used_at', null).order('created_at', { ascending: false }).limit(1);
  const c = ((rows ?? []) as any[])[0];
  must(c, 'Bitte fordere zuerst einen Code an.', 'conflict');
  must(Date.parse(c.expires_at) > ctx.now(), 'Der Code ist abgelaufen. Fordere einen neuen an.', 'expired');
  must(Number(c.attempts ?? 0) < CODE_MAX_ATTEMPTS, 'Zu viele Versuche. Fordere einen neuen Code an.', 'exhausted');
  const ok = timingSafeEqual(await hashCode(codeScope(user.id), code), c.code_hash);
  if (!ok) {
    const attempts = Number(c.attempts ?? 0) + 1;
    await ctx.db.from('recruiter_account_codes').update({ attempts }).eq('id', c.id);
    const left = CODE_MAX_ATTEMPTS - attempts;
    must(false, left > 0 ? `Der Code stimmt nicht. Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.` : 'Der Code stimmt nicht. Fordere einen neuen an.', left > 0 ? 'invalid_request' : 'exhausted');
  }
  const nowIso = nowIsoOf(ctx);
  const { data: used } = await ctx.db.from('recruiter_account_codes').update({ used_at: nowIso }).eq('id', c.id).is('used_at', null).select('id').maybeSingle();
  must(used, 'Der Code wurde gerade schon benutzt.', 'conflict');
  const { data: row } = await ctx.db.from('recruiter_billing_profiles').select('*').eq('recruiter_id', user.id).maybeSingle();
  const r = row as any;
  must(r?.pending_iban, 'Es gibt keine Kontoänderung zu bestätigen.', 'conflict');
  const me = await profile(ctx.db, user.id);
  if (!r.iban || !r.iban_confirmed_at) {
    // Erste Einrichtung bzw. erstes Bestätigen: sofort gültig
    const { error } = await ctx.db.from('recruiter_billing_profiles').update({
      account_holder: r.pending_account_holder, iban: r.pending_iban, bic: r.pending_bic, iban_confirmed_at: nowIso,
      pending_account_holder: null, pending_iban: null, pending_bic: null, pending_requested_at: null, pending_confirmed_at: null, pending_effective_at: null, updated_at: nowIso,
    }).eq('recruiter_id', user.id);
    dbFail(error, 'Dein Konto');
    await ctx.db.from('profiles').update({ bank_account_holder: r.pending_account_holder, bank_iban: r.pending_iban, bank_bic: r.pending_bic }).eq('user_id', user.id);
    await notifyAdmins(ctx, 'recruiter_account_set', `Auszahlungskonto eingerichtet: ${me?.name ?? 'Headhunter'}`, `${r.pending_account_holder} · ${maskIban(r.pending_iban)} · per Code bestätigt`, 'recruiter', user.id);
    return { ok: true, immediate: true, effectiveAt: nowIso, billing: (await loadBilling(ctx, user.id, user.email)).view };
  }
  const effectiveAt = new Date(ctx.now() + ACCOUNT_CHANGE_HOURS * 3_600_000).toISOString();
  const { error } = await ctx.db.from('recruiter_billing_profiles').update({ pending_confirmed_at: nowIso, pending_effective_at: effectiveAt, updated_at: nowIso }).eq('recruiter_id', user.id);
  dbFail(error, 'Das neue Konto');
  const when = new Date(effectiveAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const oldMasked = maskIban(r.iban), newMasked = maskIban(r.pending_iban);
  // Mail an die Login-Adresse (bisheriges Konto) und an Matchunt
  // Mail an den Headhunter in seiner Sprache (Oberfläche, sonst Profil); Mail an Matchunt bleibt deutsch
  const l = viewLang(body) ?? await recruiterLanguage(ctx.db, user.id);
  const lde = l === 'de' || l === 'de-AT' || l === 'de-CH';
  const whenL = lde ? `${when} Uhr` : new Date(effectiveAt).toLocaleString(intlLocale(l), { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const heading = tx(l, 'Dein Auszahlungskonto wird geändert', 'Your payout account is being changed', 'Ditt utbetalningskonto ändras', 'Utbetalingskontoen din endres');
  const notYou = tx(l, 'Warst du das nicht? Dann antworte sofort auf diese Mail.', 'Wasn’t you? Then reply to this email right away.', 'Var det inte du? Svara då direkt på det här mejlet.', 'Var det ikke deg? Svar da på denne e-posten med en gang.');
  const holderName = esc(r.pending_account_holder ?? '');
  await sendMail(ctx, user.email!, heading, heading,
    [`<p style="margin:0 0 12px 0;">${tx(l, 'Hallo,', 'Hi,', 'Hej,', 'Hei,')}</p>`,
      `<p style="margin:0 0 12px 0;">${tx(l, m`dein Auszahlungskonto wird von ${esc(oldMasked)} auf ${esc(newMasked)} (${holderName}) geändert. Das neue Konto gilt ab ${esc(whenL)}. Bis dahin überweisen wir nichts.`, m`your payout account is being changed from ${esc(oldMasked)} to ${esc(newMasked)} (${holderName}). The new account applies from ${esc(whenL)} (Berlin time). Until then we will not pay anything.`, m`ditt utbetalningskonto ändras från ${esc(oldMasked)} till ${esc(newMasked)} (${holderName}). Det nya kontot gäller från ${esc(whenL)} (Berlintid). Fram till dess betalar vi inte ut något.`, m`utbetalingskontoen din endres fra ${esc(oldMasked)} til ${esc(newMasked)} (${holderName}). Den nye kontoen gjelder fra ${esc(whenL)} (Berlin-tid). Frem til da utbetaler vi ingenting.`)}</p>`,
      `<p style="margin:0 0 12px 0;">${notYou}</p>`].join(''),
    tx(l, `${heading}: ${oldMasked} → ${newMasked}, gilt ab ${whenL}. Warst du das nicht? Antworte sofort auf diese Mail.`, `${heading}: ${oldMasked} → ${newMasked}, applies from ${whenL}. ${notYou}`, `${heading}: ${oldMasked} → ${newMasked}, gäller från ${whenL}. ${notYou}`, `${heading}: ${oldMasked} → ${newMasked}, gjelder fra ${whenL}. ${notYou}`), 'recruiter_account_change', { user_id: user.id }, l);
  for (const to of noticeRecipients()) {
    await sendMail(ctx, to, `Kontowechsel: ${me?.name ?? user.email}`, 'Auszahlungskonto wird geändert',
      `<p style="margin:0 0 12px 0;">${esc(me?.name ?? '')} (${esc(user.email ?? '')}) ändert das Auszahlungskonto: ${esc(oldMasked)} → ${esc(newMasked)} (${esc(r.pending_account_holder ?? '')}). Per Code bestätigt, gilt ab ${esc(when)} Uhr.</p>`,
      `Kontowechsel ${me?.name ?? ''}: ${oldMasked} → ${newMasked}, gilt ab ${when} Uhr.`, 'recruiter_account_change_admin', { user_id: user.id });
  }
  await notifyAdmins(ctx, 'recruiter_account_change', `Kontowechsel: ${me?.name ?? 'Headhunter'}`, `${oldMasked} → ${newMasked} · gilt ab ${when} Uhr`, 'recruiter', user.id);
  return { ok: true, immediate: false, effectiveAt, billing: (await loadBilling(ctx, user.id, user.email)).view };
}

export async function accountChangeCancel(ctx: PlacementCtx, user: User) {
  await requireRecruiter(ctx, user);
  const nowIso = nowIsoOf(ctx);
  const { data: row } = await ctx.db.from('recruiter_billing_profiles').select('pending_iban, pending_confirmed_at').eq('recruiter_id', user.id).maybeSingle();
  must((row as any)?.pending_iban, 'Es gibt keine offene Kontoänderung.', 'conflict');
  await ctx.db.from('recruiter_billing_profiles').update({
    pending_account_holder: null, pending_iban: null, pending_bic: null, pending_requested_at: null, pending_confirmed_at: null, pending_effective_at: null, updated_at: nowIso,
  }).eq('recruiter_id', user.id);
  await ctx.db.from('recruiter_account_codes').update({ used_at: nowIso }).eq('recruiter_id', user.id).is('used_at', null);
  if ((row as any).pending_confirmed_at) {
    const me = await profile(ctx.db, user.id);
    await notifyAdmins(ctx, 'recruiter_account_change', `Kontowechsel abgebrochen: ${me?.name ?? 'Headhunter'}`, 'Das bisherige Konto bleibt.', 'recruiter', user.id);
  }
  return { ok: true, billing: (await loadBilling(ctx, user.id, user.email)).view };
}

export async function selfBillingObjection(ctx: PlacementCtx, user: User) {
  await requireRecruiter(ctx, user);
  const loaded = await loadBilling(ctx, user.id, user.email);
  await ensureBillingRow(ctx, user.id, loaded);
  must(!loaded.view.selfBilling.objectedAt, 'Du hast schon widersprochen.', 'conflict');
  const nowIso = nowIsoOf(ctx);
  const { error } = await ctx.db.from('recruiter_billing_profiles').update({ self_billing_objected_at: nowIso, updated_at: nowIso }).eq('recruiter_id', user.id);
  dbFail(error, 'Dein Widerspruch');
  const me = await profile(ctx.db, user.id);
  await notifyAdmins(ctx, 'recruiter_self_billing_objection', `Widerspruch Gutschriftverfahren: ${me?.name ?? 'Headhunter'}`, 'Ab jetzt lädt der Headhunter jeden Monat seine eigene Rechnung hoch.', 'recruiter', user.id);
  return { ok: true, billing: (await loadBilling(ctx, user.id, user.email)).view };
}

/**
 * Auszahlungskonto für den Gutschriftlauf und SEPA (Admin-Strang): bestätigtes
 * Konto, sonst das alte aus dem Profil. `blocked` = Kontowechsel läuft (48 h), bis
 * dahin wird nichts überwiesen (H13).
 */
export async function payoutAccountOf(db: SupabaseClient, recruiterId: string, nowMs = Date.now()) {
  const { data: row } = await db.from('recruiter_billing_profiles').select('*').eq('recruiter_id', recruiterId).maybeSingle();
  const r = row as any;
  const { data: prof } = await db.from('profiles').select('bank_account_holder, bank_iban, bank_bic').eq('user_id', recruiterId).maybeSingle();
  const p = (prof ?? {}) as any;
  const pendingDue = !!r?.pending_iban && !!r?.pending_effective_at && Date.parse(r.pending_effective_at) <= nowMs;
  const iban = pendingDue ? r.pending_iban : (r?.iban ?? (p.bank_iban || null));
  return {
    holder: pendingDue ? r.pending_account_holder : (r?.account_holder ?? (p.bank_account_holder || null)),
    iban: iban ? compactIban(iban) : null,
    bic: pendingDue ? r.pending_bic : (r?.bic ?? (p.bank_bic || null)),
    confirmed: pendingDue || !!r?.iban_confirmed_at,
    blocked: !!r?.pending_iban && !!r?.pending_confirmed_at && !pendingDue,
    selfBillingObjected: !!r?.self_billing_objected_at,
  };
}

// ---------------------------------------------------------------------------
// F2: Kunde melden (anonym gegenüber dem Kunden)
// ---------------------------------------------------------------------------

export const CLIENT_REPORT_TOPICS: Record<string, string> = {
  no_response: 'Reagiert nicht', unfair: 'Unfairer Umgang', circumvention: 'Verdacht auf Umgehung', wrong_info: 'Angaben stimmen nicht', other: 'Etwas anderes',
};

export async function clientReport(ctx: PlacementCtx, user: User, body: any) {
  await requireRecruiter(ctx, user);
  const jobId = String(body?.jobId ?? '');
  must(UUID.test(jobId), 'Ungültige Stelle.');
  const topic = String(body?.topic ?? '');
  must(CLIENT_REPORT_TOPICS[topic], 'Bitte wählen, was los ist.');
  const note = longText(body?.note, 2000);
  must(note, 'Bitte kurz beschreiben, was los ist.');
  const [{ data: act }, { data: sub }] = await Promise.all([
    ctx.db.from('recruiter_job_activations').select('id').eq('job_id', jobId).eq('recruiter_id', user.id).limit(1),
    ctx.db.from('submissions').select('id').eq('job_id', jobId).eq('recruiter_id', user.id).limit(1),
  ]);
  must(((act ?? []) as any[]).length || ((sub ?? []) as any[]).length, 'Melden kannst du nur Stellen, an denen du suchst.', 'not_allowed');
  const since = new Date(ctx.now() - 86_400_000).toISOString();
  const { data: recent } = await ctx.db.from('recruiter_client_reports').select('id').eq('job_id', jobId).eq('recruiter_id', user.id).gte('created_at', since).limit(1);
  must(!((recent ?? []) as any[]).length, 'Du hast diese Stelle heute schon gemeldet. Matchunt kümmert sich.', 'conflict');
  const { data: row, error } = await ctx.db.from('recruiter_client_reports').insert({ job_id: jobId, recruiter_id: user.id, topic, note }).select('id, created_at').maybeSingle();
  dbFail(error, 'Deine Meldung');
  const { data: job } = await ctx.db.from('jobs').select('title, company_name').eq('id', jobId).maybeSingle();
  const me = await profile(ctx.db, user.id);
  await notifyAdmins(ctx, 'recruiter_client_report', `Headhunter meldet Kunden: ${(job as any)?.company_name ?? 'Kunde'}`,
    `${(job as any)?.title ?? 'Stelle'} · ${CLIENT_REPORT_TOPICS[topic]} · ${note.slice(0, 300)} · von ${me?.name ?? 'Headhunter'}`, 'job', jobId);
  return { ok: true, reportedAt: (row as any)?.created_at ?? nowIsoOf(ctx) };
}

// ---------------------------------------------------------------------------
// Täglicher Lauf: Aufgaben am ersten Arbeitstag und zur Halbzeit, Kontowechsel
// ---------------------------------------------------------------------------

/** Täglich: Aufgaben am ersten Arbeitstag („Hat X angefangen?“) und zur Halbzeit der Garantie. */
export async function runRecruiterTasks(ctx: PlacementCtx): Promise<{ created: number; closed: number; accountsSwitched: number }> {
  const db = ctx.db;
  const today = todayKey(ctx.now());
  const nowIso = nowIsoOf(ctx);
  let created = 0, closed = 0, accountsSwitched = 0;

  // 1) Erster Arbeitstag: nur wenn noch niemand gemeldet und der Kunde nicht schon bestätigt hat
  const { data: starting } = await db.from('placements')
    .select('id, submission_id, first_working_day, start_date, placement_state, start_fixed_at, start_reported_at, non_start_reported_at')
    .eq('placement_state', 'agreed').is('start_fixed_at', null).is('start_reported_at', null).is('non_start_reported_at', null)
    .lte('first_working_day', today).gte('first_working_day', addDays(today, -START_SILENCE_DAYS)).limit(500);
  const startRows = (starting ?? []) as any[];
  const subs = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id', 'id', startRows.map((p) => p.submission_id));
  const jobs = await rowsIn(db, 'jobs', 'id, company_name', 'id', subs.map((s) => s.job_id));
  const cands = await rowsIn(db, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id));
  for (const p of startRows) {
    const s = subs.find((x) => x.id === p.submission_id);
    if (!s?.recruiter_id) continue;
    const first = String(cands.find((c) => c.id === s.candidate_id)?.full_name ?? 'Kandidat').trim().split(/\s+/)[0];
    const company = companyShort(String(jobs.find((j) => j.id === s.job_id)?.company_name ?? 'Kunde'));
    const dueAt = `${p.first_working_day}T07:00:00.000Z`;
    const { data: existing } = await db.from('recruiter_tasks').select('id').eq('submission_id', s.id).eq('source', 'system').eq('task_type', 'call').eq('due_at', dueAt).limit(1);
    if (((existing ?? []) as any[]).length) continue;
    const { error } = await db.from('recruiter_tasks').insert({
      recruiter_id: s.recruiter_id, title: startTaskTitle(first),
      description: `${company} · erster Arbeitstag laut Vertrag ${dmy(p.first_working_day)} · kurz anrufen, dann melden`,
      task_type: 'call', source: 'system', priority: 'high', status: 'pending',
      candidate_id: s.candidate_id, submission_id: s.id, job_id: s.job_id, due_at: dueAt,
    });
    if (error) console.warn('[abrechnung] Startaufgabe nicht angelegt', error.message);
    else created += 1;
  }

  // 2) Halbzeit der Garantie (optional): Kunde sieht davon nichts
  const { data: running } = await db.from('placements')
    .select('id, submission_id, first_working_day, continuity_end_date, pricing_snapshot, placement_state, continuity_state, halfway_status, replaces_placement_id, start_fixed_at')
    .eq('placement_state', 'started').is('halfway_status', null).is('replaces_placement_id', null)
    .gt('continuity_end_date', today).limit(500);
  const halfRows = ((running ?? []) as any[]).filter((p) => {
    const days = continuityDaysOf(p);
    return days && p.first_working_day && ['running', 'not_applicable'].includes(String(p.continuity_state ?? 'running')) && today >= halfwayDay(p.first_working_day, days);
  });
  const hSubs = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id', 'id', halfRows.map((p) => p.submission_id));
  const hCands = await rowsIn(db, 'candidates', 'id, full_name', 'id', hSubs.map((s) => s.candidate_id));
  for (const p of halfRows) {
    const s = hSubs.find((x) => x.id === p.submission_id);
    if (!s?.recruiter_id) continue;
    const first = String(hCands.find((c) => c.id === s.candidate_id)?.full_name ?? 'Kandidat').trim().split(/\s+/)[0];
    const { data: existing } = await db.from('recruiter_tasks').select('id').eq('submission_id', s.id).eq('source', 'system').eq('task_type', 'follow_up').like('title', 'Wie läuft es bei %?').limit(1);
    if (((existing ?? []) as any[]).length) continue;
    const { error } = await db.from('recruiter_tasks').insert({
      recruiter_id: s.recruiter_id, title: halfwayTaskTitle(first),
      description: `Garantie bis ${dmy(p.continuity_end_date)} · der Kunde sieht davon nichts`,
      task_type: 'follow_up', source: 'system', priority: 'low', status: 'pending',
      candidate_id: s.candidate_id, submission_id: s.id, job_id: s.job_id, due_at: `${today}T07:00:00.000Z`,
    });
    if (error) console.warn('[abrechnung] Halbzeit-Aufgabe nicht angelegt', error.message);
    else created += 1;
  }

  // 3) Erledigte Lage: offene Aufgaben schließen (Kunde hat zuerst bestätigt, Fall gemeldet …)
  const { data: openTasks } = await db.from('recruiter_tasks').select('id, submission_id, title, task_type')
    .eq('source', 'system').eq('status', 'pending').in('task_type', ['call', 'follow_up']).limit(1000);
  const sysTasks = ((openTasks ?? []) as any[]).filter((t) => /^Hat .+ angefangen\?$/.test(t.title) || /^Wie läuft es bei .+\?$/.test(t.title));
  const tPlacements = await rowsIn(db, 'placements', 'id, submission_id, start_fixed_at, start_fixed_how, start_reported_at, non_start_reported_at, placement_state, halfway_status, continuity_state', 'submission_id', sysTasks.map((t) => t.submission_id));
  for (const t of sysTasks) {
    const p = tPlacements.find((x) => x.submission_id === t.submission_id);
    if (!p) continue;
    const isStart = /angefangen\?$/.test(t.title);
    const done = isStart
      ? !!(p.start_fixed_at || p.start_reported_at || p.non_start_reported_at || p.placement_state !== 'agreed')
      : !!(p.halfway_status || p.placement_state !== 'started' || !['running', 'not_applicable'].includes(String(p.continuity_state ?? 'running')));
    if (!done) continue;
    const status = isStart && p.start_fixed_at && !p.start_reported_at ? 'cancelled' : 'completed';
    const { error } = await db.from('recruiter_tasks').update({ status, completed_at: nowIso, updated_at: nowIso }).eq('id', t.id).eq('status', 'pending');
    if (!error) closed += 1;
  }

  // 4) Kontowechsel nach 48 Stunden übernehmen
  const { data: pending } = await db.from('recruiter_billing_profiles').select('*').not('pending_confirmed_at', 'is', null).lte('pending_effective_at', nowIso).limit(200);
  for (const row of (pending ?? []) as any[]) if (await applyPendingAccount(ctx, row)) accountsSwitched += 1;

  return { created, closed, accountsSwitched };
}
