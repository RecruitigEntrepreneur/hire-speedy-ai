// deno-lint-ignore-file no-explicit-any
// Kunden-Seite „Besetzungen“ (Etappe 1, 25.10.2026; Umbau Nachbesetzung 11.11.2026):
// alles nach dem Interview – Angebot, Zusage, Vertrag, Start, Nachbesetzung – in
// einer Abfrage, dazu die Meldungen des Kunden nach der Unterschrift:
//   Start verschoben       Rahmenvertrag § 10 Abs. 2 (vor dem Starttag)
//   Antritt (K7)           „Ja, hat angefangen“ / „Fängt später an“; hat der
//                          Headhunter zuerst gemeldet: „Stimmt“ / „Stimmt so nicht“
//   Besetzung endet (K5)   ein Weg für vor und nach dem Start (ersetzt „Tritt nicht
//                          an“ und „Ausgeschieden“); Fall und Folgen: nachbesetzung.ts
//   Nachbesetzung (K6)     Position bestätigen, beenden; Angebot bei Core (J2/J3)
//   Bestellnummer          steht auf der Rechnung; ist sie Pflicht, gibt Matchunt
//                          die Rechnung erst danach frei (ab Tag 7 „folgt“)
// Die alten Aktionen (report_departure, confirm_start not_started) bleiben für
// ältere Oberflächen bestehen, die Seite nutzt sie nicht mehr.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { canUserActOnJob, getAccessibleJobIds } from './team-access.ts';
import { dbFail, must } from './interview-service.ts';
import { billingScope } from './billing-access.ts';
import { DATE, PACKAGE_NAMES, UUID, adminIds, dateDe, notify, plusDays, profile, todayKey, type PlacementCtx } from './placement-service.ts';
import { START_OBJECTION_WORKDAYS, addWorkdays } from './konditionen.ts';
import {
  CLIENT_SPHERE_REASONS, END_REASONS_AFTER_START, END_REASONS_BEFORE_START, answerJoker, answerRecruiterStart, confirmResearchPosition,
  endResearch, fixStart, loadPlacementRow, reportEnd,
} from './nachbesetzung.ts';

export type BesetzungGroup = 'angebot' | 'start' | 'haus' | 'ab';

/** Gründe fürs Ausscheiden aus der Zeit vor dem Umbau (Altfälle im Verlauf). */
export const DEPARTURE_CATEGORIES: Record<string, string> = {
  candidate_resigned: 'Person hat selbst gekündigt',
  candidate_terminated_probation: 'Person hat in der Probezeit gekündigt',
  mutual_separation_probation: 'Aufhebung auf Wunsch der Person (Probezeit)',
  employer_performance: 'Kündigung durch uns: Leistung',
  employer_fit: 'Kündigung durch uns: passt nicht ins Team',
  employer_terminated_probation: 'Kündigung durch uns in der Probezeit',
  redundancy: 'Betriebsbedingte Kündigung',
  restructuring: 'Umstrukturierung',
  position_eliminated: 'Stelle fällt weg',
  role_materially_changed: 'Stelle wesentlich geändert',
  other: 'Anderer Grund',
};
/** Gründe der alten Meldung „Tritt nicht an“ (Altfälle). */
const LEGACY_NON_START: Record<string, string> = {
  not_started: 'ist nicht erschienen', counter_offer: 'hat ein Gegenangebot angenommen', other_job: 'hat eine andere Stelle angetreten',
  personal: 'hat aus persönlichen Gründen abgesagt',
};

/** Werktage, in denen Matchunt eine Meldung prüft („Matchunt prüft Ihre Meldung bis …“). */
export const CASE_REVIEW_WORKDAYS = 3;
const RESEARCH_ACTIVE = ['awaiting_position', 'awaiting_payment', 'running', 'paused'];
const OPEN_CLAIM = ['submitted', 'in_review'];
const OPEN_OFFER = ['with_recruiter', 'considering', 'countered', 'accept_reported', 'pending', 'sent'];
const DAY = 86_400_000;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);
const plusMonths = (iso: string, n: number) => { const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
/** Kalendertag (Berlin) eines Zeitstempels */
const dayOf = (iso: string | null | undefined) => (iso ? (iso.length <= 10 ? iso : todayKey(Date.parse(iso))) : null);
const daysBetween = (fromDay: string, toDay: string) => Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / DAY);

/** „Cem hat selbst gekündigt“, „Wir trennen uns …“, „Aufhebung auf Wunsch von Cem“ */
export function endReasonText(reason: string | null | undefined, firstName: string): string {
  const r = String(reason ?? '');
  if (r === 'mutual_on_request') return `Aufhebung auf Wunsch von ${firstName}`;
  const label = END_REASONS_BEFORE_START[r] ?? END_REASONS_AFTER_START[r] ?? LEGACY_NON_START[r] ?? DEPARTURE_CATEGORIES[r];
  if (!label) return 'Grund angegeben';
  return /^(hat|ist) /.test(label) ? `${firstName} ${label}` : label;
}

async function rowsIn(db: any, table: string, cols: string, col: string, ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  if (!list.length) return [] as any[];
  const { data, error } = await db.from(table).select(cols).in(col, list);
  if (error) throw error;
  return (data ?? []) as any[];
}

function snapshotOf(placement: any, job: any, mandate: any) {
  const s = placement?.pricing_snapshot ?? mandate?.pricing_snapshot ?? null;
  const key = placement?.package_key ?? s?.packageKey ?? 'core';
  const replacement = !!placement?.replaces_placement_id;
  const raw = Number(s?.clientFeePct ?? job?.fee_percentage ?? 20);
  const pct = replacement ? Number(s?.originalClientFeePct ?? 0) : (raw > 0 ? raw : 20);
  const continuityDays = !replacement && Number(s?.continuityDays) > 0 ? Number(s.continuityDays) : null;
  const noticeDays = Number(s?.claimNoticeDays) > 0 ? Number(s.claimNoticeDays) : 14;
  return {
    key, name: PACKAGE_NAMES[key] ?? s?.publicName ?? 'Matchunt Core', pct, continuityDays, noticeDays, replacement,
    differenceFeeCents: replacement ? Number(s?.differenceFeeCents ?? 0) : 0,
  };
}

// ---------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------

export async function clientOverview(ctx: PlacementCtx, user: User) {
  const jobIds = await getAccessibleJobIds(ctx.db as any, user.id);
  const today = todayKey(ctx.now());
  const empty = { items: [] as any[], counts: { angebot: 0, start: 0, haus: 0, ab: 0 }, kpis: { placedThisYear: 0, openInvoiceCents: 0, nextStart: null as null | { date: string; name: string } } };
  if (!jobIds.length) return empty;
  const db = ctx.db;
  const jobs = await rowsIn(db, 'jobs', 'id, title, status, client_id, organization_id, fee_percentage, mandate_id, research_for_placement_id, research_since, cooperation_paused_at', 'id', jobIds);
  const subs = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id, stage, identity_unlocked, identity_revealed, submitted_at', 'job_id', jobIds);
  const subIds = subs.map((s) => s.id);
  const [offers, contracts, placements, mandates] = await Promise.all([
    rowsIn(db, 'offers', 'id, submission_id, status, version, salary_offered, variable_salary, start_date, response_due, probation_months, candidate_response, created_at, sent_at, decision_at', 'submission_id', subIds),
    rowsIn(db, 'employment_contracts', 'id, submission_id, status, way, signing_mode, sent_at, company_signed_at, signed_on, final_at, created_at, start_date', 'submission_id', subIds),
    rowsIn(db, 'placements', '*', 'submission_id', subIds),
    rowsIn(db, 'commercial_mandates', 'id, pricing_snapshot', 'id', jobs.map((j) => j.mandate_id)).catch(() => []),
  ]);
  const placementIds = placements.map((p) => p.id);
  const researchJobIds = jobs.filter((j) => j.research_for_placement_id).map((j) => j.id);
  const [invoices, claims, researchOffers, candidates, people, activations] = await Promise.all([
    rowsIn(db, 'invoices', 'id, placement_id, invoice_type, invoice_number, status, total_amount_cents, paid_amount_cents, due_date, issued_at, paid_at, client_paid_reported_on, released_at', 'placement_id', placementIds),
    rowsIn(db, 'continuity_claims', 'id, placement_id, status, kind, deadline, reported_at, category, decided_at, client_sphere, rejection_reason, evidence', 'placement_id', placementIds).catch(() => []),
    rowsIn(db, 'research_offers', 'id, placement_id, decision, status, price_cents, valid_until, decided_at, answered_at, invoice_id', 'placement_id', placementIds).catch(() => []),
    rowsIn(db, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id)),
    rowsIn(db, 'profiles', 'user_id, full_name', 'user_id', [...subs.map((s) => s.recruiter_id), ...placements.map((p) => p.start_reported_by)]),
    rowsIn(db, 'recruiter_job_activations', 'job_id, recruiter_id, status', 'job_id', researchJobIds).catch(() => []),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const subById = new Map(subs.map((s) => [s.id, s]));
  const mandateById = new Map(mandates.map((m: any) => [m.id, m]));
  const candById = new Map(candidates.map((c) => [c.id, c]));
  const nameById = new Map(people.map((r) => [r.user_id, r.full_name as string]));
  const placementBySub = new Map(placements.map((p) => [p.submission_id, p]));
  const placementById = new Map(placements.map((p) => [p.id, p]));
  const latest = <T extends Record<string, any>>(rows: T[], key: (r: T) => number) => rows.slice().sort((a, b) => key(b) - key(a))[0] ?? null;
  const nameOfSub = (s: any) => {
    if (!s) return 'Kandidat';
    const cand = candById.get(s.candidate_id);
    return (s.identity_unlocked || s.identity_revealed) && cand?.full_name ? cand.full_name : `PR-${String(s.candidate_id ?? '').slice(0, 6).toUpperCase()}`;
  };
  const firstOf = (name: string) => (name.startsWith('PR-') ? name : name.split(' ')[0]);
  // Ersatz zu einer Besetzung (Nachbesetzung erfolgreich): neue Karte „Mira · Nachbesetzung für Cem“
  const replacementOf = new Map<string, { submissionId: string; name: string }>();
  for (const p of placements) if (p.replaces_placement_id) replacementOf.set(p.replaces_placement_id, { submissionId: p.submission_id, name: nameOfSub(subById.get(p.submission_id)) });

  const items: any[] = [];
  for (const s of subs) {
    const offer = latest(offers.filter((o) => o.submission_id === s.id && o.status !== 'superseded'), (o) => Number(o.version ?? 0) * 1e13 + t(o.created_at));
    const pl = placementBySub.get(s.id) ?? null;
    if (!offer && !pl) continue;
    const contract = latest(contracts.filter((c) => c.submission_id === s.id), (c) => t(c.created_at));
    const job = jobById.get(s.job_id);
    const pkg = snapshotOf(pl, job, mandateById.get(job?.mandate_id));
    const feeType = pkg.replacement ? 'salary_difference' : 'placement_fee';
    const inv = pl ? latest(invoices.filter((i) => i.placement_id === pl.id && i.invoice_type === feeType), (i) => t(i.issued_at ?? i.released_at)) : null;
    const researchInv = pl ? latest(invoices.filter((i) => i.placement_id === pl.id && i.invoice_type === 'research_option'), (i) => t(i.issued_at ?? i.released_at)) : null;
    const claim = pl ? latest(claims.filter((c: any) => c.placement_id === pl.id), (c: any) => t(c.reported_at)) : null;
    const offerRow = pl ? researchOffers.find((o: any) => o.placement_id === pl.id) ?? null : null;
    const startDate = String(pl?.first_working_day ?? pl?.start_date ?? contract?.start_date ?? offer?.start_date ?? '').slice(0, 10) || null;
    // Nachbesetzung nur, wenn das Paket sie enthält (ältere Einstellungen tragen teils ein Fristende ohne Paket)
    const continuityEnd = pkg.continuityDays && pl?.continuity_end_date ? String(pl.continuity_end_date).slice(0, 10) : null;
    const reportUntil = continuityEnd ? plusDays(continuityEnd, pkg.noticeDays) : null;
    const coreFrom = startDate ?? (pl?.created_at ? String(pl.created_at).slice(0, 10) : null);
    const coreUntil = coreFrom ? plusMonths(coreFrom, 6) : null;
    const name = nameOfSub(s);
    const firstName = firstOf(name);

    // Ende, Fall, Nachbesetzung, Angebot
    const endKind: 'non_start' | 'departure' | null = pl?.non_start_reported_at ? 'non_start' : pl?.departure_reported_at ? 'departure' : null;
    const endReason: string | null = endKind === 'non_start' ? pl.non_start_reason : endKind ? pl.departure_category : null;
    const openCase = !!claim && OPEN_CLAIM.includes(claim.status);
    const researchState: string = pl?.research_state ?? 'not_applicable';
    const researchActive = RESEARCH_ACTIVE.includes(researchState);
    const offerOpen = offerRow?.decision === 'offer' && offerRow.status === 'open' && (!offerRow.valid_until || String(offerRow.valid_until) >= today);
    const sphere = !!pl?.client_sphere_at || !!claim?.client_sphere || (!!endReason && CLIENT_SPHERE_REASONS.includes(endReason));
    // Core, nicht angefangen: Matchunt entscheidet über ein Angebot (J1)
    const corePending = endKind === 'non_start' && !pkg.continuityDays && !pkg.replacement && !offerRow && !sphere && pl?.placement_state !== 'cancelled';
    const caseActive = openCase || researchActive || offerOpen || corePending;
    const fixed = !!pl?.start_fixed_at || ['started', 'ended_early', 'completed'].includes(pl?.placement_state);

    // Gruppe
    let group: BesetzungGroup | null = null;
    if (pl) {
      const started = fixed || !!pl.start_confirmed_at;
      if (endKind) group = caseActive ? (endKind === 'non_start' ? 'start' : 'haus') : 'ab';
      else if (pl.placement_state === 'agreed' && !fixed) group = 'start';
      else if (started && (reportUntil ? today <= reportUntil : coreUntil ? today < coreUntil : false) && !['cancelled', 'completed'].includes(pl.placement_state)) group = 'haus';
      else group = 'ab';
    } else if (offer?.status === 'accepted') {
      if (contract?.status === 'dropped') continue;
      group = 'start';
    } else if (offer && OPEN_OFFER.includes(offer.status)) {
      group = 'angebot';
    }
    if (!group) continue;

    const gross = pl?.gross_annual_target_compensation_cents != null ? Number(pl.gross_annual_target_compensation_cents)
      : offer ? Math.round((Number(offer.salary_offered ?? 0) + Number(offer.variable_salary ?? 0)) * 100) : null;
    const feeCents = pkg.replacement ? pkg.differenceFeeCents
      : pl?.client_fee_cents != null ? Number(pl.client_fee_cents) : gross != null ? Math.round(gross * pkg.pct / 100) : null;
    const overdueOffer = !!offer && OPEN_OFFER.includes(offer.status) && !!offer.response_due && String(offer.response_due).slice(0, 10) < today;
    const dran = group === 'angebot' ? (offer?.status === 'countered' || overdueOffer ? 'client' : 'recruiter')
      : group === 'start' && !pl ? (contract && ['sent_self', 'sent_digital', 'company_signed'].includes(contract.status) ? (contract.status === 'sent_digital' ? 'client' : 'candidate') : 'client')
        : null;
    const hh = nameById.get(s.recruiter_id) ?? null;
    const reporter = pl?.start_reported_by ? (nameById.get(pl.start_reported_by) ?? hh) : hh;
    const reporterFirst = reporter ? reporter.split(' ')[0] : 'Ihr Headhunter';

    // Nachbesetzung: Stelle, suchende Headhunter, neue Vorstellungen
    const rjob = pl ? (pl.research_job_id ? jobById.get(pl.research_job_id) : job?.research_for_placement_id === pl.id ? job : null) : null;
    const since = pl?.research_started_at ? String(pl.research_started_at) : null;
    const newSubs = rjob && since ? subs.filter((x) => x.job_id === rjob.id && x.id !== s.id && t(x.submitted_at) >= t(since)) : [];
    const research = pl && researchState !== 'not_applicable' ? {
      state: researchState, kind: pl.research_kind ?? null, startedAt: pl.research_started_at ?? null, endedAt: pl.research_ended_at ?? null,
      endReason: pl.research_end_reason ?? null, jobId: rjob?.id ?? s.job_id,
      days: since ? Math.max(0, daysBetween(dayOf(since)!, today)) : null,
      recruiters: rjob ? activations.filter((a: any) => a.job_id === rjob.id && a.status === 'active').length : 0,
      submissions: newSubs.length,
      fresh: newSubs.filter((x) => ['submitted', 'in_review'].includes(String(x.stage ?? ''))).length,
      paused: researchState === 'paused' || !!rjob?.cooperation_paused_at,
      replacement: replacementOf.get(pl.id) ?? null,
    } : null;
    const reportedAt = endKind === 'non_start' ? pl.non_start_reported_at : endKind ? pl.departure_reported_at : null;
    const outcome = !endKind ? null : sphere ? 'client_sphere' : claim ? 'claim' : !pkg.continuityDays ? 'core'
      : (endKind === 'departure' && continuityEnd && String(pl.departure_event_on ?? pl.departure_known_on ?? '') > continuityEnd ? 'outside' : 'late');
    const orig = pl?.replaces_placement_id ? placementById.get(pl.replaces_placement_id) : null;
    const job2 = job ?? null;

    const events: { at: string; text: string }[] = [];
    if (offer?.created_at) events.push({ at: offer.created_at, text: `Angebot${Number(offer.version) > 1 ? ` Version ${offer.version}` : ''}` });
    if (offer?.status === 'accepted' && offer.decision_at) events.push({ at: offer.decision_at, text: 'Zusage' });
    if (contract?.sent_at) events.push({ at: contract.sent_at, text: contract.way === 'digital' ? 'Vertrag hochgeladen' : 'Vertrag selbst verschickt' });
    if (contract?.company_signed_at) events.push({ at: contract.company_signed_at, text: 'Firma hat unterschrieben' });
    if (pl?.created_at) events.push({ at: pl.created_at, text: 'Vertrag unterschrieben' });
    if (inv?.issued_at && inv.status !== 'draft') events.push({ at: inv.issued_at, text: `Rechnung ${inv.invoice_number}` });
    if (inv?.paid_at) events.push({ at: inv.paid_at, text: `Rechnung ${inv.invoice_number} bezahlt` });
    if (pl?.start_moved_at) events.push({ at: pl.start_moved_at, text: `Start verschoben auf ${dateDe(startDate)}` });
    if (pl?.start_reported_at && pl.start_report_kind === 'started') events.push({ at: pl.start_reported_at, text: `${reporterFirst} meldet: angefangen am ${dateDe(pl.start_reported_on)}` });
    if (pl?.start_reported_at && pl.start_report_kind === 'not_started') events.push({ at: pl.start_reported_at, text: `${reporterFirst} meldet: ${firstName} hat nicht angefangen` });
    if (pl?.start_contested_at) events.push({ at: pl.start_contested_at, text: 'Sie: „Stimmt so nicht“, Matchunt klärt' });
    if (pl?.start_fixed_at) {
      const by = pl.start_fixed_how === 'client' ? (pl.start_reported_by ? `, von ${reporterFirst} gemeldet und von Ihnen bestätigt` : ', von Ihnen bestätigt')
        : pl.start_fixed_how === 'recruiter_unopposed' ? `, von ${reporterFirst} gemeldet`
          : pl.start_fixed_how === 'admin' ? ', von Matchunt festgestellt' : '';
      events.push({ at: pl.start_fixed_at, text: `Angefangen ${dateDe(pl.first_working_day ?? startDate)}${by}` });
    } else if (pl?.start_confirmed_at) events.push({ at: pl.start_confirmed_at, text: 'Antritt bestätigt' });
    if (reportedAt) events.push({ at: reportedAt, text: `Gemeldet: ${endReasonText(endReason, firstName)}` });
    if (claim?.decided_at) events.push({ at: claim.decided_at, text: claim.status === 'accepted' ? 'Matchunt hat geprüft: Nachbesetzung' : 'Matchunt hat geprüft: keine Nachbesetzung' });
    if (offerRow?.decision === 'offer' && offerRow.decided_at) events.push({ at: offerRow.decided_at, text: 'Angebot von Matchunt: Nachbesetzung' });
    if (offerRow?.answered_at) events.push({ at: offerRow.answered_at, text: offerRow.status === 'accepted' ? 'Angebot angenommen' : 'Angebot abgelehnt' });
    if (researchInv?.issued_at && researchInv.status !== 'draft') events.push({ at: researchInv.issued_at, text: `Rechnung ${researchInv.invoice_number} (Nachbesetzung)` });
    if (researchInv?.paid_at) events.push({ at: researchInv.paid_at, text: `Rechnung ${researchInv.invoice_number} bezahlt` });
    if (pl?.research_started_at) events.push({ at: pl.research_started_at, text: 'Für alle Headhunter ausgeschrieben' });
    if (pl?.research_ended_at) events.push({ at: pl.research_ended_at, text: pl.research_end_reason === 'filled' ? `Ersatz gefunden${research?.replacement ? `: ${research.replacement.name}` : ''}` : pl.research_end_reason === 'client_ended' ? 'Nachbesetzung von Ihnen beendet' : 'Nachbesetzung beendet' });
    events.sort((a, b) => t(a.at) - t(b.at));

    const startDue = !!pl && pl.placement_state === 'agreed' && !fixed && !endKind && !!startDate && startDate <= today;
    const beforeStart = !!pl && pl.placement_state === 'agreed' && !fixed && !endKind;
    const released = !!inv && inv.status !== 'draft';
    const docs = (claim?.evidence ?? []).length + (pl?.non_start_document_path ? 1 : 0);

    items.push({
      submissionId: s.id, group, name, unlocked: !!(s.identity_unlocked || s.identity_revealed), jobId: s.job_id, jobTitle: job?.title ?? '',
      recruiterName: hh, dran,
      offer: offer ? {
        id: offer.id, version: Number(offer.version ?? 1), status: offer.status, salary: offer.salary_offered, variable: offer.variable_salary,
        startDate: offer.start_date, responseDue: offer.response_due, overdue: overdueOffer, probationMonths: offer.probation_months ?? null,
        wish: offer.status === 'countered' ? offer.candidate_response?.wish ?? null : null,
      } : null,
      contract: contract ? { id: contract.id, status: contract.status, way: contract.way, signingMode: contract.signing_mode ?? 'email', sentAt: contract.sent_at, companySignedAt: contract.company_signed_at, signedOn: contract.signed_on } : null,
      placement: pl ? {
        id: pl.id, state: pl.placement_state, startDate, startConfirmedAt: pl.start_confirmed_at ?? null, startMovedAt: pl.start_moved_at ?? null,
        startFixedAt: pl.start_fixed_at ?? null, startFixedHow: pl.start_fixed_how ?? null,
        startReport: pl.start_report_kind ? {
          kind: pl.start_report_kind, on: pl.start_reported_on ?? null, at: pl.start_reported_at ?? null, byName: reporter,
          contestedAt: pl.start_contested_at ?? null,
          fixesOn: pl.start_reported_at ? addWorkdays(dayOf(pl.start_reported_at)!, START_OBJECTION_WORKDAYS) : null,
        } : null,
        nonStartReportedAt: pl.non_start_reported_at ?? null, nonStartReason: pl.non_start_reason ?? null, nonStartDocument: !!pl.non_start_document_path,
        continuityEnd, reportUntil, coreUntil: pkg.continuityDays ? null : coreUntil,
        departure: pl.departure_reported_at ? { category: pl.departure_category, label: endReasonText(pl.departure_category, firstName), eventOn: pl.departure_event_on, lastDay: pl.departure_last_day, knownOn: pl.departure_known_on } : null,
        end: endKind ? {
          kind: endKind, reason: endReason, label: endReasonText(endReason, firstName), reportedAt, knownOn: pl.departure_known_on ?? null,
          lastDay: pl.departure_last_day ?? null, reviewUntil: reportedAt ? addWorkdays(dayOf(reportedAt)!, CASE_REVIEW_WORKDAYS) : null,
          outcome, documents: docs,
        } : null,
        claim: claim ? {
          status: claim.status, kind: claim.kind ?? 'departure', deadline: claim.deadline, reportedAt: claim.reported_at ?? null, decidedAt: claim.decided_at ?? null,
          reviewUntil: claim.reported_at ? addWorkdays(dayOf(claim.reported_at)!, CASE_REVIEW_WORKDAYS) : null, clientSphere: !!claim.client_sphere,
          rejectionReason: claim.status === 'rejected' && !claim.client_sphere ? claim.rejection_reason ?? null : null,
        } : null,
        research,
        offer: offerRow ? {
          status: offerRow.decision === 'none' ? 'none' : offerOpen ? 'open' : offerRow.status === 'open' ? 'expired' : offerRow.status,
          priceCents: offerRow.price_cents != null ? Number(offerRow.price_cents) : null, validUntil: offerRow.valid_until ?? null,
          decidedAt: offerRow.decided_at ?? null, answeredAt: offerRow.answered_at ?? null,
        } : null,
        researchInvoice: researchInv ? { id: researchInv.id, number: researchInv.status === 'draft' ? null : researchInv.invoice_number, status: researchInv.status, totalCents: researchInv.total_amount_cents, dueDate: researchInv.due_date, paidAt: researchInv.paid_at } : null,
        replaces: orig ? { submissionId: orig.submission_id, name: nameOfSub(subById.get(orig.submission_id)) } : null,
        jobStatus: job2?.status ?? null,
        jobPaused: !!job2?.cooperation_paused_at,
        purchaseOrder: pl.purchase_order ?? null, costCenter: pl.cost_center ?? null,
      } : null,
      package: { key: pkg.key, name: pkg.name, pct: pkg.pct, continuityDays: pkg.continuityDays, replacement: pkg.replacement },
      grossCents: gross, feeCents,
      invoice: inv ? {
        id: inv.id, number: inv.status === 'draft' ? null : inv.invoice_number, status: inv.status, totalCents: inv.total_amount_cents,
        openCents: Math.max(0, Number(inv.total_amount_cents ?? 0) - Number(inv.paid_amount_cents ?? 0)), dueDate: inv.due_date, paidAt: inv.paid_at,
        reportedPaidOn: inv.client_paid_reported_on ?? null, overdue: ['open', 'partially_paid'].includes(inv.status) && !!inv.due_date && String(inv.due_date) < today,
      } : null,
      can: pl ? {
        moveStart: beforeStart && !startDue,
        startCheck: startDue && pl.start_report_kind !== 'started' && pl.start_report_kind !== 'not_started',
        answerStart: beforeStart && pl.start_report_kind === 'started' && !!pl.start_reported_at && !pl.start_contested_at,
        confirmEnd: beforeStart && pl.start_report_kind === 'not_started',
        endReport: !endKind && ['agreed', 'started'].includes(pl.placement_state) && (group === 'start' || group === 'haus'),
        endDocument: !!endKind && caseActive,
        purchaseOrder: !released && !endKind,
        confirmPosition: researchState === 'awaiting_position',
        endResearch: researchActive,
        answerOffer: offerOpen,
        reopenJob: !!endKind && !caseActive && !['succeeded'].includes(researchState) && !!job2 && ['filled', 'closed'].includes(String(job2.status)) && !job2.research_for_placement_id,
      } : null,
      events,
    });
  }
  const order: Record<BesetzungGroup, number> = { angebot: 0, start: 1, haus: 2, ab: 3 };
  items.sort((a, b) => order[a.group as BesetzungGroup] - order[b.group as BesetzungGroup] || String(a.placement?.startDate ?? a.offer?.startDate ?? '').localeCompare(String(b.placement?.startDate ?? b.offer?.startDate ?? '')));
  const counts = { angebot: 0, start: 0, haus: 0, ab: 0 };
  for (const i of items) counts[i.group as BesetzungGroup] += 1;
  const year = today.slice(0, 4);
  const upcoming = items.filter((i) => i.group === 'start' && i.placement?.startDate && !i.placement?.end).map((i) => ({ date: String(i.placement?.startDate ?? i.offer?.startDate ?? ''), name: i.name })).filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return {
    items, counts,
    kpis: {
      placedThisYear: placements.filter((p) => String(p.created_at ?? '').slice(0, 4) === year && !p.non_start_reported_at).length,
      openInvoiceCents: invoices.filter((i) => ['open', 'partially_paid'].includes(i.status)).reduce((a, i) => a + Math.max(0, Number(i.total_amount_cents ?? 0) - Number(i.paid_amount_cents ?? 0)), 0),
      nextStart: upcoming[0] ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Meldungen
// ---------------------------------------------------------------------------

async function loadForClient(ctx: PlacementCtx, user: User, placementId: unknown, opts: { billing?: boolean } = {}) {
  must(typeof placementId === 'string' && UUID.test(placementId), 'Ungültige Einstellung.');
  const { data: p, error } = await ctx.db.from('placements').select('*').eq('id', placementId).maybeSingle();
  dbFail(error, 'Die Einstellung');
  must(p, 'Diese Einstellung gibt es nicht.', 'not_found');
  const { data: s } = await ctx.db.from('submissions').select('id, job_id, candidate_id, recruiter_id, identity_unlocked, identity_revealed').eq('id', (p as any).submission_id).maybeSingle();
  must(s, 'Bewerbung nicht gefunden.', 'not_found');
  const sub = s as any;
  let allowed = await canUserActOnJob(ctx.db as any, user.id, sub.job_id);
  if (!allowed && opts.billing) {
    const scope = await billingScope(ctx.db, user.id);
    allowed = scope.canManage && scope.jobIds.includes(sub.job_id);
  }
  must(allowed, 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  const [{ data: job }, { data: cand }] = await Promise.all([
    ctx.db.from('jobs').select('id, title').eq('id', sub.job_id).maybeSingle(),
    ctx.db.from('candidates').select('full_name').eq('id', sub.candidate_id).maybeSingle(),
  ]);
  const name = (sub.identity_unlocked || sub.identity_revealed) && (cand as any)?.full_name ? (cand as any).full_name : `PR-${String(sub.candidate_id).slice(0, 6).toUpperCase()}`;
  return { p: p as any, s: sub, jobTitle: (job as any)?.title ?? 'Stelle', name, firstName: name.startsWith('PR-') ? name : name.split(' ')[0] };
}

/** Erledigt-Protokoll der Kunden-Aufgaben (Liste „Erledigt · 7 Tage“). */
async function logTask(ctx: PlacementCtx, user: User, s: any, key: string, kind: string, label: string, answer: string | null = null) {
  const { error } = await ctx.db.from('client_task_log').insert({
    task_key: key, kind, submission_id: s.id, job_id: s.job_id, label, answer, done_by: user.id, done_at: new Date(ctx.now()).toISOString(),
  });
  if (error) console.warn('[besetzung] Protokoll nicht gespeichert', error.code, error.message);
}

/** Start verschoben (vor dem Starttag). */
export async function moveStart(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, jobTitle, name } = await loadForClient(ctx, user, body?.placementId);
  must(p.placement_state === 'agreed' && !p.start_confirmed_at && !p.start_fixed_at && !p.non_start_reported_at, 'Der Antritt ist schon gemeldet.', 'conflict');
  const today = todayKey(ctx.now());
  const planned = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
  const next = String(body?.startDate ?? '');
  must(DATE.test(next), 'Bitte den neuen ersten Arbeitstag angeben.');
  must(next >= today, 'Der Tag liegt in der Vergangenheit. Dann beantworten Sie bitte „Hat angefangen?“ mit dem tatsächlichen ersten Tag.');
  must(next !== planned, 'Das ist schon der geplante erste Arbeitstag.');
  const note = text(body?.note, 500) || null;
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('placements').update({ first_working_day: next, start_moved_at: nowIso, start_moved_by: user.id, start_moved_note: note }).eq('id', p.id).eq('placement_state', 'agreed');
  dbFail(error, 'Der neue Starttermin');
  const me = await profile(ctx.db, user.id);
  const msg = `${jobTitle} · neuer erster Arbeitstag ${dateDe(next)} (vorher ${dateDe(planned)})${note ? ` · ${note}` : ''} · gemeldet von ${me?.name ?? 'Kunde'}`;
  await notify(ctx, s.recruiter_id, 'placement_start_moved', `Start verschoben: ${name}`, msg, 'submission', s.id);
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_start_moved', `Start verschoben: ${name}`, msg, 'placement', p.id);
  return { ok: true, startDate: next };
}

/**
 * Antritt (K7). started = „Ja, hat angefangen“ (Antritt steht fest), later = „Fängt
 * später an“ (neuer erster Arbeitstag in der Zukunft), agree/disagree = Antwort auf die
 * Meldung des Headhunters („Stimmt“ / „Stimmt so nicht“). „Hat nicht angefangen“ geht
 * über reportEndForClient (K5 mit „Nein“).
 */
export async function startAnswer(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, jobTitle, name, firstName } = await loadForClient(ctx, user, body?.placementId);
  const way = String(body?.way ?? '');
  must(['started', 'later', 'agree', 'disagree'].includes(way), 'Bitte wählen: hat angefangen, fängt später an oder hat nicht angefangen.');
  const note = text(body?.note, 1000) || null;
  if (way === 'agree' || way === 'disagree') {
    must(way === 'agree' || note, 'Bitte kurz schreiben, was nicht stimmt.');
    const r = await answerRecruiterStart(ctx, user, p, way === 'agree', note);
    await logTask(ctx, user, s, `start-check:${p.id}`, 'start_check', `${name}: Start ${way === 'agree' ? 'bestätigt' : 'stimmt so nicht'}`, note);
    return r;
  }
  must(p.placement_state === 'agreed' && !p.start_fixed_at && !p.non_start_reported_at && !p.departure_reported_at, 'Der Antritt steht schon fest.', 'conflict');
  const today = todayKey(ctx.now());
  const planned = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
  const me = await profile(ctx.db, user.id);
  if (way === 'started') {
    const on = DATE.test(String(body?.startedOn ?? '')) ? String(body.startedOn) : planned || today;
    must(on <= today, 'Der Tag liegt in der Zukunft. Dann wählen Sie bitte „Fängt später an“.');
    await fixStart(ctx, p, 'client', on, user.id);
    await notify(ctx, s.recruiter_id, 'placement_started', `${firstName} hat angefangen`, `${jobTitle} · erster Arbeitstag ${dateDe(on)} (bestätigt von ${me?.name ?? 'Kunde'})`, 'submission', s.id);
    await logTask(ctx, user, s, `start:${p.id}`, 'confirm_start', `${name}: Antritt bestätigt`, dateDe(on));
    return { ok: true, state: 'started', firstWorkingDay: on };
  }
  const next = String(body?.startDate ?? '');
  must(DATE.test(next), 'Bitte den neuen ersten Arbeitstag angeben.');
  must(next > today, 'Liegt der erste Arbeitstag schon zurück, wählen Sie bitte „Ja, hat angefangen“.');
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('placements').update({ first_working_day: next, start_moved_at: nowIso, start_moved_by: user.id, start_moved_note: note }).eq('id', p.id).eq('placement_state', 'agreed');
  dbFail(error, 'Der neue Starttermin');
  const msg = `${jobTitle} · neuer erster Arbeitstag ${dateDe(next)} (vorher ${dateDe(planned)})${note ? ` · ${note}` : ''} · gemeldet von ${me?.name ?? 'Kunde'}`;
  await notify(ctx, s.recruiter_id, 'placement_start_moved', `Start verschoben: ${name}`, msg, 'submission', s.id);
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_start_moved', `Start verschoben: ${name}`, msg, 'placement', p.id);
  // Eigener Schlüssel: „Hat angefangen?“ erscheint am neuen Tag wieder
  await logTask(ctx, user, s, `start-moved:${p.id}:${next}`, 'confirm_start', `${name}: fängt später an`, dateDe(next));
  return { ok: true, state: 'moved', startDate: next };
}

/**
 * Besetzung endet (K5), vor oder nach dem Start. started: Antwort auf „Hat … schon
 * angefangen?“. „Ja“ bei offenem Antritt bestätigt ihn zugleich (Antritt steht fest).
 * Fall, Fristen und Folgen: reportEnd in nachbesetzung.ts.
 */
export async function reportEndForClient(ctx: PlacementCtx, user: User, body: any) {
  const loaded = await loadForClient(ctx, user, body?.placementId);
  const { s, name } = loaded;
  let p = loaded.p;
  must(['agreed', 'started'].includes(p.placement_state), 'Diese Besetzung ist schon abgeschlossen.', 'conflict');
  const today = todayKey(ctx.now());
  const fixed = !!p.start_fixed_at || p.placement_state === 'started';
  if (body?.started === true && !fixed) {
    const first = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
    must(first && first <= today, 'Der erste Arbeitstag liegt noch in der Zukunft. Dann wählen Sie bitte „Nein“.');
    await fixStart(ctx, p, 'client', first, user.id);
    p = await loadPlacementRow(ctx, p.id);
  }
  if (body?.started === false) must(!fixed, 'Der Antritt ist schon bestätigt. Bitte „Ja“ wählen.', 'conflict');
  const knownOn = DATE.test(String(body?.knownOn ?? '')) ? String(body.knownOn) : today;
  const lastDay = DATE.test(String(body?.lastDay ?? '')) ? String(body.lastDay) : null;
  const started = !!p.start_fixed_at || p.placement_state === 'started';
  if (started) {
    must(lastDay, 'Bitte den letzten Arbeitstag angeben.');
    const first = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
    must(!first || lastDay! >= first, 'Der letzte Arbeitstag liegt vor dem ersten.');
  }
  const r = await reportEnd(ctx, user, p, { reason: body?.reason, knownOn, eventOn: knownOn, lastDay, note: body?.note });
  const label = endReasonText(String(body?.reason ?? ''), loaded.firstName);
  if (p.start_report_kind === 'not_started') await logTask(ctx, user, s, `end-confirm:${p.id}`, 'end_confirm', `${name}: Absage bestätigt`, label);
  else if (!started) await logTask(ctx, user, s, `start:${p.id}`, 'confirm_start', `${name}: hat nicht angefangen`, label);
  const reviewed = r.outcome === 'claim' || (r.outcome === 'core' && r.kind === 'non_start');
  return { ...r, reviewUntil: reviewed ? addWorkdays(today, CASE_REVIEW_WORKDAYS) : null };
}

const DOC_TYPES: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', eml: 'message/rfc822', msg: 'application/vnd.ms-outlook' };
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/**
 * Unterlage zum Ende (K5 „Kündigung oder Nachricht von …“, freiwillig, auch später):
 * vor dem Start als Erklärung zum Nichtantritt, sonst am Fall.
 */
export async function endDocument(ctx: PlacementCtx, user: User, body: any) {
  const { p, name } = await loadForClient(ctx, user, body?.placementId);
  must(p.non_start_reported_at || p.departure_reported_at, 'Bitte zuerst melden, dass die Besetzung endet.', 'conflict');
  const fileName = text(body?.fileName, 200);
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  must(DOC_TYPES[ext], 'Bitte eine PDF, ein Bild (PNG, JPG) oder eine Mail (EML, MSG) hochladen.');
  must(typeof body?.fileBase64 === 'string' && body.fileBase64.length > 0, 'Die Datei fehlt.');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(body.fileBase64), (c) => c.charCodeAt(0)); } catch (_e) { bytes = new Uint8Array(); }
  must(bytes.length > 0, 'Die Datei ließ sich nicht lesen.');
  must(bytes.length <= MAX_DOC_BYTES, 'Die Datei ist größer als 5 MB.');
  must(ctx.placementFiles, 'Ablage nicht verfügbar.');
  const nowIso = new Date(ctx.now()).toISOString();
  const path = `${p.id}/ende-${nowIso.slice(0, 19).replace(/[^\d]/g, '')}.${ext}`;
  await ctx.placementFiles!.put(path, bytes, DOC_TYPES[ext]);
  if (p.non_start_reported_at) {
    const { error } = await ctx.db.from('placements').update({ non_start_document_path: path, non_start_document_at: nowIso }).eq('id', p.id);
    dbFail(error, 'Die Unterlage');
  }
  const { data: claim } = await ctx.db.from('continuity_claims').select('id, evidence').eq('placement_id', p.id).order('reported_at', { ascending: false }).limit(1).maybeSingle();
  if (claim) {
    const evidence = [...(((claim as any).evidence ?? []) as any[]), { path, fileName, at: nowIso, by: user.id }];
    const { error } = await ctx.db.from('continuity_claims').update({ evidence }).eq('id', (claim as any).id);
    if (error) console.warn('[besetzung] Unterlage nicht am Fall vermerkt', error.message);
  }
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_end_document', `Unterlage zum Ende: ${name}`, `${fileName} liegt jetzt vor.`, 'placement', p.id);
  return { ok: true };
}
/** Alter Name (Erklärung zum Nichtantritt). */
export const nonStartDocument = endDocument;

/**
 * Ausgeschieden (§ 9), alter Weg vor dem Umbau. Die Seite nutzt „Besetzung endet“
 * (reportEndForClient); bleibt für ältere Oberflächen bestehen.
 */
export async function reportDeparture(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, jobTitle, name } = await loadForClient(ctx, user, body?.placementId);
  must(p.placement_state === 'started' || p.start_confirmed_at, 'Bitte zuerst den Antritt bestätigen.', 'conflict');
  must(!p.departure_reported_at, 'Das Ausscheiden ist schon gemeldet.', 'conflict');
  const category = String(body?.category ?? '');
  must(DEPARTURE_CATEGORIES[category], 'Bitte den Grund wählen.');
  const eventOn = String(body?.eventOn ?? '');
  const lastDay = String(body?.lastDay ?? '');
  const knownOn = String(body?.knownOn ?? eventOn);
  const today = todayKey(ctx.now());
  const first = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
  must(DATE.test(eventOn), 'Bitte angeben, wann die Kündigung zuging oder die Aufhebung geschlossen wurde.');
  must(DATE.test(lastDay), 'Bitte den letzten Arbeitstag angeben.');
  must(DATE.test(knownOn), 'Bitte angeben, wann Sie davon erfahren haben.');
  must(!first || eventOn >= first, 'Das Datum liegt vor dem ersten Arbeitstag.');
  must(knownOn >= eventOn && knownOn <= today, 'Der Tag, an dem Sie davon erfahren haben, liegt zwischen Kündigung und heute.');
  must(lastDay >= eventOn, 'Der letzte Arbeitstag liegt vor der Kündigung.');
  const note = text(body?.note, 1000) || null;

  const { data: job } = await ctx.db.from('jobs').select('fee_percentage, mandate_id').eq('id', s.job_id).maybeSingle();
  const pkg = snapshotOf(p, job, null);
  let outcome: 'claim' | 'no_continuity' | 'excluded' | 'outside' | 'late' = 'no_continuity';
  let deadline: string | null = null;
  if (pkg.continuityDays && first) {
    const periodEnd = plusDays(first, pkg.continuityDays);
    deadline = plusDays(knownOn, pkg.noticeDays);
    outcome = eventOn > periodEnd ? 'outside' : today > deadline ? 'late' : 'claim';
  }
  const nowIso = new Date(ctx.now()).toISOString();
  if (outcome === 'claim') {
    const { error: cErr } = await ctx.db.from('continuity_claims').insert({
      placement_id: p.id, mandate_id: p.mandate_id ?? null, category, description: note,
      separation_date: eventOn, known_at: knownOn, deadline, reported_by: user.id, status: 'submitted', evidence: [],
    });
    if (cErr) { console.warn('[besetzung] Continuity-Fall abgelehnt', cErr.message); outcome = 'late'; }
  }
  const patch: Record<string, unknown> = {
    departure_reported_at: nowIso, departure_reported_by: user.id, departure_category: category,
    departure_event_on: eventOn, departure_last_day: lastDay, departure_known_on: knownOn, departure_note: note,
  };
  if (outcome === 'claim') patch.continuity_state = 'claim_open';
  else Object.assign(patch, { placement_state: 'ended_early', ended_at: lastDay, end_reason: category });
  const { error } = await ctx.db.from('placements').update(patch).eq('id', p.id);
  dbFail(error, 'Die Meldung');

  const me = await profile(ctx.db, user.id);
  const why = `${DEPARTURE_CATEGORIES[category]} · letzter Tag ${dateDe(lastDay)}${note ? ` · ${note}` : ''} · gemeldet von ${me?.name ?? 'Kunde'}`;
  const adminTitle = outcome === 'claim' ? `Fall prüfen: ${name}` : `Ausscheiden gemeldet: ${name}`;
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_departure', adminTitle, `${jobTitle} · ${why}`, 'placement', p.id);
  await notify(ctx, s.recruiter_id, 'placement_departure', `Ausgeschieden: ${name}`, `${jobTitle} · ${DEPARTURE_CATEGORIES[category]}. Matchunt meldet sich.`, 'submission', s.id);
  return { ok: true, outcome, deadline };
}

// ---------------------------------------------------------------------------
// Nachbesetzung (K6) und Angebot bei Core (J2/J3)
// ---------------------------------------------------------------------------

/** K6 Zustand 2: Stelle so bestätigen (changed=false) oder nach dem Anpassen bestätigen. */
export async function confirmPosition(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, name } = await loadForClient(ctx, user, body?.placementId);
  const changed = body?.changed === true;
  const r = await confirmResearchPosition(ctx, user, p, changed);
  await logTask(ctx, user, s, `research-pos:${p.id}`, 'research_position', `Position für die Nachbesetzung bestätigt (${name})`, changed ? 'angepasst' : 'unverändert');
  return r;
}

/** Kunde nimmt die Stelle heraus. Das Honorar bleibt, wie es ist. */
export async function endResearchForClient(ctx: PlacementCtx, user: User, body: any) {
  const { p, s } = await loadForClient(ctx, user, body?.placementId);
  const scope = await billingScope(ctx.db, user.id);
  must(scope.isAdmin || scope.jobIds.includes(s.job_id), 'Beenden dürfen Inhaber, Admins und HR.', 'not_allowed');
  return await endResearch(ctx, user.id, p, 'client_ended', text(body?.note, 500) || null);
}

/** J2/J3: Angebot annehmen (Rechnung, danach Suche) oder „Nein, danke“. */
export async function answerResearchOffer(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, name } = await loadForClient(ctx, user, body?.placementId);
  const accept = body?.accept === true;
  if (accept) {
    const scope = await billingScope(ctx.db, user.id);
    must(scope.isAdmin || scope.jobIds.includes(s.job_id), 'Annehmen dürfen Inhaber, Admins und HR.', 'not_allowed');
  }
  const { data: o } = await ctx.db.from('research_offers').select('id').eq('placement_id', p.id).maybeSingle();
  const r = await answerJoker(ctx, user, p, accept);
  if (o) await logTask(ctx, user, s, `research-offer:${(o as any).id}`, 'research_offer', `Angebot Nachbesetzung (${name})`, accept ? 'angenommen' : 'Nein, danke');
  return r;
}

/** Variante Core / Grund beim Kunden: „Stelle wieder öffnen“ = neue Suche mit normalem Honorar. */
export async function reopenJob(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, name } = await loadForClient(ctx, user, body?.placementId);
  must(p.non_start_reported_at || p.departure_reported_at, 'Bitte zuerst melden, dass die Besetzung endet.', 'conflict');
  must(!RESEARCH_ACTIVE.includes(p.research_state), 'Für diese Stelle läuft schon eine Nachbesetzung.', 'conflict');
  const { data: j } = await ctx.db.from('jobs').select('id, title, status, research_for_placement_id').eq('id', s.job_id).maybeSingle();
  const job = j as any;
  must(job, 'Stelle nicht gefunden.', 'not_found');
  must(!job.research_for_placement_id, 'Für diese Stelle läuft schon eine Nachbesetzung.', 'conflict');
  if (!['filled', 'closed'].includes(String(job.status))) return { ok: true, already: true, jobId: job.id };
  const { error } = await ctx.db.from('jobs').update({
    status: 'published', closed_reason: null, closed_at: null, closed_note: null,
    closed_hire_submission_id: null, closed_hire_start: null, closed_hire_salary: null,
  }).eq('id', job.id);
  dbFail(error, 'Die Stelle');
  const me = await profile(ctx.db, user.id);
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'job_reopened', `Stelle wieder geöffnet: ${job.title}`, `nach dem Ende der Besetzung von ${name} · von ${me?.name ?? 'Kunde'}`, 'job', job.id);
  return { ok: true, jobId: job.id };
}

/** Bestellnummer und Kostenstelle für die Rechnung (Kunden-Aufgabe oder Link „ergänzen“). */
export async function setPurchaseOrder(ctx: PlacementCtx, user: User, body: any) {
  const { p, name } = await loadForClient(ctx, user, body?.placementId, { billing: true });
  // Nur gesetzte Felder ändern: eine leere Kostenstelle lässt die hinterlegte stehen
  const patch: Record<string, string | null> = {};
  if (body?.purchaseOrder !== undefined) patch.purchase_order = text(body.purchaseOrder, 80) || null;
  if (body?.costCenter !== undefined && text(body.costCenter, 80)) patch.cost_center = text(body.costCenter, 80);
  must(patch.purchase_order || patch.cost_center, 'Bitte die Bestellnummer angeben.');
  const { error } = await ctx.db.from('placements').update(patch).eq('id', p.id);
  dbFail(error, 'Die Bestellnummer');
  // Noch nicht gestellte Rechnung gleich mitziehen
  const { data: drafts } = await ctx.db.from('invoices').select('id').eq('placement_id', p.id).eq('status', 'draft');
  for (const d of (drafts ?? []) as any[]) await ctx.db.from('invoices').update(patch).eq('id', d.id);
  if ((drafts ?? []).length && patch.purchase_order) {
    for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'invoice_purchase_order', `Bestellnummer da: ${name}`, `${patch.purchase_order}${patch.cost_center ? ` · Kostenstelle ${patch.cost_center}` : ''}. Die Rechnung kann freigegeben werden.`, 'placement', p.id);
  }
  return { ok: true };
}
