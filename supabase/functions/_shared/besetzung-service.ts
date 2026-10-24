// deno-lint-ignore-file no-explicit-any
// Kunden-Seite „Besetzungen“ (Etappe 1, 25.10.2026): alles nach dem Interview –
// Angebot, Zusage, Vertrag, Start, Continuity – in einer Abfrage, dazu die
// Meldungen nach der Unterschrift:
//   Start verschoben       Rahmenvertrag § 10 Abs. 2 (vor dem Starttag; danach
//                          beantwortet der Kunde „Hat angefangen?“)
//   Erklärung Nichtantritt § 8 Abs. 8 (Meldung selbst: Aufgabe 14, confirm_start)
//   Ausgeschieden          § 9; mit Continuity-Paket und zugelassenem Grund
//                          entsteht ein Fall in continuity_claims (Fristen prüft
//                          der Datenbank-Trigger wie hier vorab)
//   Bestellnummer          steht auf der Rechnung; ist sie Pflicht, gibt Matchunt
//                          die Rechnung erst danach frei
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { canUserActOnJob, getAccessibleJobIds } from './team-access.ts';
import { dbFail, must } from './interview-service.ts';
import { billingScope } from './billing-access.ts';
import { DATE, PACKAGE_NAMES, UUID, adminIds, dateDe, notify, plusDays, profile, todayKey, type PlacementCtx } from './placement-service.ts';

export type BesetzungGroup = 'angebot' | 'start' | 'haus' | 'ab';

/** Gründe fürs Ausscheiden, wie im Paket (commercial_packages) geführt. */
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

const OPEN_OFFER = ['with_recruiter', 'considering', 'countered', 'pending', 'sent'];
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);
const plusMonths = (iso: string, n: number) => { const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

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
  const pct = Number(s?.clientFeePct ?? job?.fee_percentage ?? 20) || 20;
  const continuityDays = Number(s?.continuityDays) > 0 ? Number(s.continuityDays) : null;
  const noticeDays = Number(s?.claimNoticeDays) > 0 ? Number(s.claimNoticeDays) : 14;
  return {
    key, name: PACKAGE_NAMES[key] ?? s?.publicName ?? 'Matchunt Core', pct, continuityDays, noticeDays,
    eligible: (s?.eligibleClaimCategories ?? []) as string[], excluded: (s?.excludedClaimCategories ?? []) as string[],
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
  const jobs = await rowsIn(db, 'jobs', 'id, title, client_id, organization_id, fee_percentage, mandate_id', 'id', jobIds);
  const subs = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id, stage, identity_unlocked, identity_revealed', 'job_id', jobIds);
  const subIds = subs.map((s) => s.id);
  const [offers, contracts, placements, mandates] = await Promise.all([
    rowsIn(db, 'offers', 'id, submission_id, status, version, salary_offered, variable_salary, start_date, response_due, probation_months, candidate_response, created_at, sent_at, decision_at', 'submission_id', subIds),
    rowsIn(db, 'employment_contracts', 'id, submission_id, status, way, signing_mode, sent_at, company_signed_at, signed_on, final_at, created_at, start_date', 'submission_id', subIds),
    rowsIn(db, 'placements', '*', 'submission_id', subIds),
    rowsIn(db, 'commercial_mandates', 'id, pricing_snapshot', 'id', jobs.map((j) => j.mandate_id)).catch(() => []),
  ]);
  const placementIds = placements.map((p) => p.id);
  const [invoices, claims, candidates, recruiters] = await Promise.all([
    rowsIn(db, 'invoices', 'id, placement_id, invoice_type, invoice_number, status, total_amount_cents, due_date, issued_at, paid_at, client_paid_reported_on, released_at', 'placement_id', placementIds),
    rowsIn(db, 'continuity_claims', 'id, placement_id, status, deadline, reported_at, category', 'placement_id', placementIds).catch(() => []),
    rowsIn(db, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id)),
    rowsIn(db, 'profiles', 'user_id, full_name', 'user_id', subs.map((s) => s.recruiter_id)),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const mandateById = new Map(mandates.map((m: any) => [m.id, m]));
  const candById = new Map(candidates.map((c) => [c.id, c]));
  const recById = new Map(recruiters.map((r) => [r.user_id, r]));
  const placementBySub = new Map(placements.map((p) => [p.submission_id, p]));
  const latest = <T extends Record<string, any>>(rows: T[], key: (r: T) => number) => rows.slice().sort((a, b) => key(b) - key(a))[0] ?? null;

  const items: any[] = [];
  for (const s of subs) {
    const offer = latest(offers.filter((o) => o.submission_id === s.id && o.status !== 'superseded'), (o) => Number(o.version ?? 0) * 1e13 + t(o.created_at));
    const pl = placementBySub.get(s.id) ?? null;
    if (!offer && !pl) continue;
    const contract = latest(contracts.filter((c) => c.submission_id === s.id), (c) => t(c.created_at));
    const job = jobById.get(s.job_id);
    const pkg = snapshotOf(pl, job, mandateById.get(job?.mandate_id));
    const inv = pl ? latest(invoices.filter((i) => i.placement_id === pl.id && i.invoice_type === 'placement_fee'), (i) => t(i.issued_at ?? i.released_at)) : null;
    const claim = pl ? latest(claims.filter((c: any) => c.placement_id === pl.id), (c: any) => t(c.reported_at)) : null;
    const startDate = String(pl?.first_working_day ?? pl?.start_date ?? contract?.start_date ?? offer?.start_date ?? '').slice(0, 10) || null;
    // Continuity nur, wenn das Paket sie enthält (ältere Einstellungen tragen teils ein Fristende ohne Paket)
    const continuityEnd = pkg.continuityDays && pl?.continuity_end_date ? String(pl.continuity_end_date).slice(0, 10) : null;
    const reportUntil = continuityEnd ? plusDays(continuityEnd, pkg.noticeDays) : null;
    const coreFrom = startDate ?? (pl?.created_at ? String(pl.created_at).slice(0, 10) : null);
    const coreUntil = coreFrom ? plusMonths(coreFrom, 6) : null;

    // Gruppe
    let group: BesetzungGroup | null = null;
    if (pl) {
      const started = pl.placement_state === 'started' || !!pl.start_confirmed_at;
      const openCase = claim && ['submitted', 'in_review'].includes(claim.status);
      if (pl.non_start_reported_at) group = 'ab';
      else if (pl.placement_state === 'agreed' && !pl.start_confirmed_at) group = 'start';
      else if (openCase) group = 'haus';
      else if (started && !pl.departure_reported_at && (reportUntil ? today <= reportUntil : coreUntil ? today < coreUntil : false)) group = 'haus';
      else group = 'ab';
    } else if (offer?.status === 'accepted') {
      if (contract?.status === 'dropped') continue;
      group = 'start';
    } else if (offer && OPEN_OFFER.includes(offer.status)) {
      group = 'angebot';
    }
    if (!group) continue;

    const unlocked = !!(s.identity_unlocked || s.identity_revealed);
    const cand = candById.get(s.candidate_id);
    const name = unlocked && cand?.full_name ? cand.full_name : `PR-${String(s.candidate_id ?? '').slice(0, 6).toUpperCase()}`;
    const gross = pl?.gross_annual_target_compensation_cents != null ? Number(pl.gross_annual_target_compensation_cents)
      : offer ? Math.round((Number(offer.salary_offered ?? 0) + Number(offer.variable_salary ?? 0)) * 100) : null;
    const feeCents = pl?.client_fee_cents != null ? Number(pl.client_fee_cents) : gross != null ? Math.round(gross * pkg.pct / 100) : null;
    const overdueOffer = !!offer && OPEN_OFFER.includes(offer.status) && !!offer.response_due && String(offer.response_due).slice(0, 10) < today;
    const dran = group === 'angebot' ? (offer?.status === 'countered' || overdueOffer ? 'client' : 'recruiter')
      : group === 'start' && !pl ? (contract && ['sent_self', 'sent_digital', 'company_signed'].includes(contract.status) ? (contract.status === 'sent_digital' ? 'client' : 'candidate') : 'client')
        : null;

    const events: { at: string; text: string }[] = [];
    if (offer?.created_at) events.push({ at: offer.created_at, text: `Angebot${Number(offer.version) > 1 ? ` Version ${offer.version}` : ''}` });
    if (offer?.status === 'accepted' && offer.decision_at) events.push({ at: offer.decision_at, text: 'Zusage' });
    if (contract?.sent_at) events.push({ at: contract.sent_at, text: contract.way === 'digital' ? 'Vertrag hochgeladen' : 'Vertrag selbst verschickt' });
    if (contract?.company_signed_at) events.push({ at: contract.company_signed_at, text: 'Firma hat unterschrieben' });
    if (pl?.created_at) events.push({ at: pl.created_at, text: 'Unterschrieben, Einstellung verbindlich' });
    if (inv?.issued_at && inv.status !== 'draft') events.push({ at: inv.issued_at, text: `Rechnung ${inv.invoice_number} gestellt` });
    if (inv?.paid_at) events.push({ at: inv.paid_at, text: `Zahlung zu ${inv.invoice_number} eingegangen` });
    if (pl?.start_moved_at) events.push({ at: pl.start_moved_at, text: `Start verschoben auf ${dateDe(startDate)}` });
    if (pl?.start_confirmed_at) events.push({ at: pl.start_confirmed_at, text: 'Antritt bestätigt' });
    if (pl?.non_start_reported_at) events.push({ at: pl.non_start_reported_at, text: 'Nichtantritt gemeldet' });
    if (pl?.departure_reported_at) events.push({ at: pl.departure_reported_at, text: `Ausscheiden gemeldet: ${DEPARTURE_CATEGORIES[pl.departure_category] ?? 'Grund angegeben'}` });
    events.sort((a, b) => t(a.at) - t(b.at));

    items.push({
      submissionId: s.id, group, name, unlocked, jobId: s.job_id, jobTitle: job?.title ?? '',
      recruiterName: recById.get(s.recruiter_id)?.full_name ?? null, dran,
      offer: offer ? {
        id: offer.id, version: Number(offer.version ?? 1), status: offer.status, salary: offer.salary_offered, variable: offer.variable_salary,
        startDate: offer.start_date, responseDue: offer.response_due, overdue: overdueOffer, probationMonths: offer.probation_months ?? null,
        wish: offer.status === 'countered' ? offer.candidate_response?.wish ?? null : null,
      } : null,
      contract: contract ? { id: contract.id, status: contract.status, way: contract.way, signingMode: contract.signing_mode ?? 'email', sentAt: contract.sent_at, companySignedAt: contract.company_signed_at, signedOn: contract.signed_on } : null,
      placement: pl ? {
        id: pl.id, state: pl.placement_state, startDate, startConfirmedAt: pl.start_confirmed_at ?? null, startMovedAt: pl.start_moved_at ?? null,
        nonStartReportedAt: pl.non_start_reported_at ?? null, nonStartReason: pl.non_start_reason ?? null, nonStartDocument: !!pl.non_start_document_path,
        continuityEnd, reportUntil, coreUntil: pkg.continuityDays ? null : coreUntil,
        departure: pl.departure_reported_at ? { category: pl.departure_category, label: DEPARTURE_CATEGORIES[pl.departure_category] ?? null, eventOn: pl.departure_event_on, lastDay: pl.departure_last_day, knownOn: pl.departure_known_on } : null,
        claim: claim ? { status: claim.status, deadline: claim.deadline } : null,
        purchaseOrder: pl.purchase_order ?? null, costCenter: pl.cost_center ?? null,
      } : null,
      package: { key: pkg.key, name: pkg.name, pct: pkg.pct, continuityDays: pkg.continuityDays },
      grossCents: gross, feeCents,
      invoice: inv ? { id: inv.id, number: inv.status === 'draft' ? null : inv.invoice_number, status: inv.status, totalCents: inv.total_amount_cents, dueDate: inv.due_date, paidAt: inv.paid_at, reportedPaidOn: inv.client_paid_reported_on ?? null, overdue: ['open', 'partially_paid'].includes(inv.status) && !!inv.due_date && String(inv.due_date) < today } : null,
      can: pl ? {
        moveStart: pl.placement_state === 'agreed' && !pl.start_confirmed_at && !pl.non_start_reported_at,
        nonStart: pl.placement_state === 'agreed' && !pl.start_confirmed_at && !pl.non_start_reported_at,
        nonStartDocument: !!pl.non_start_reported_at && !pl.non_start_document_path,
        departure: (pl.placement_state === 'started' || !!pl.start_confirmed_at) && !pl.departure_reported_at,
        purchaseOrder: true,
      } : null,
      events,
    });
  }
  const order: Record<BesetzungGroup, number> = { angebot: 0, start: 1, haus: 2, ab: 3 };
  items.sort((a, b) => order[a.group as BesetzungGroup] - order[b.group as BesetzungGroup] || String(a.placement?.startDate ?? a.offer?.startDate ?? '').localeCompare(String(b.placement?.startDate ?? b.offer?.startDate ?? '')));
  const counts = { angebot: 0, start: 0, haus: 0, ab: 0 };
  for (const i of items) counts[i.group as BesetzungGroup] += 1;
  const year = today.slice(0, 4);
  const upcoming = items.filter((i) => i.group === 'start' && i.placement?.startDate !== null).map((i) => ({ date: String(i.placement?.startDate ?? i.offer?.startDate ?? ''), name: i.name })).filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return {
    items, counts,
    kpis: {
      placedThisYear: placements.filter((p) => String(p.created_at ?? '').slice(0, 4) === year && !p.non_start_reported_at).length,
      openInvoiceCents: invoices.filter((i) => ['open', 'partially_paid'].includes(i.status)).reduce((a, i) => a + Number(i.total_amount_cents ?? 0), 0),
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
  return { p: p as any, s: sub, jobTitle: (job as any)?.title ?? 'Stelle', name };
}

/** Start verschoben (vor dem Starttag). Danach gilt „Hat angefangen?“ mit „später angefangen“. */
export async function moveStart(ctx: PlacementCtx, user: User, body: any) {
  const { p, s, jobTitle, name } = await loadForClient(ctx, user, body?.placementId);
  must(p.placement_state === 'agreed' && !p.start_confirmed_at && !p.non_start_reported_at, 'Der Antritt ist schon gemeldet.', 'conflict');
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

const DOC_TYPES: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', eml: 'message/rfc822', msg: 'application/vnd.ms-outlook' };
const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** Erklärung der Person zum Nichtantritt (§ 8 Abs. 8), auch nachgereicht. */
export async function nonStartDocument(ctx: PlacementCtx, user: User, body: any) {
  const { p, name } = await loadForClient(ctx, user, body?.placementId);
  must(p.non_start_reported_at, 'Bitte zuerst den Nichtantritt melden.', 'conflict');
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
  const path = `${p.id}/nichtantritt-${nowIso.slice(0, 19).replace(/[^\d]/g, '')}.${ext}`;
  await ctx.placementFiles!.put(path, bytes, DOC_TYPES[ext]);
  const { error } = await ctx.db.from('placements').update({ non_start_document_path: path, non_start_document_at: nowIso }).eq('id', p.id);
  dbFail(error, 'Die Erklärung');
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_non_start_document', `Erklärung zum Nichtantritt: ${name}`, 'Die Erklärung der Person liegt jetzt vor.', 'placement', p.id);
  return { ok: true };
}

/**
 * Ausgeschieden (§ 9). eventOn = Tag, an dem die Kündigung zuging oder die
 * Aufhebung geschlossen wurde; lastDay = letzter Arbeitstag; knownOn = Tag der Kenntnis.
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
  // Was folgt: Continuity-Fall oder nur Meldung
  let outcome: 'claim' | 'no_continuity' | 'excluded' | 'outside' | 'late' = 'no_continuity';
  let deadline: string | null = null;
  if (pkg.continuityDays && first) {
    const periodEnd = plusDays(first, pkg.continuityDays);
    deadline = plusDays(knownOn, pkg.noticeDays);
    const eligible = pkg.eligible.includes(category) && !pkg.excluded.includes(category);
    outcome = !eligible ? 'excluded' : eventOn > periodEnd ? 'outside' : today > deadline ? 'late' : 'claim';
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
  const adminTitle = outcome === 'claim' ? `Continuity-Fall prüfen: ${name}` : `Ausscheiden gemeldet: ${name}`;
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_departure', adminTitle, `${jobTitle} · ${why}`, 'placement', p.id);
  await notify(ctx, s.recruiter_id, 'placement_departure', `Ausgeschieden: ${name}`, `${jobTitle} · ${DEPARTURE_CATEGORIES[category]}. Matchunt meldet sich.`, 'submission', s.id);
  return { ok: true, outcome, deadline };
}

/** Bestellnummer und Kostenstelle für die Rechnung (Kunden-Aufgabe oder Seite Besetzungen). */
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
