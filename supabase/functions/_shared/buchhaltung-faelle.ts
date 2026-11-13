// deno-lint-ignore-file no-explicit-any
// Fälle (A8) und Joker-Entscheidung (J1). Umbau 11.11.2026.
//
// Die App prüft Fristen und Zahlung, den Grund beurteilt ein Mensch. Rechnen
// nur mit konditionen.ts, Abläufe nur über nachbesetzung.ts.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import { notify, todayKey, type PlacementCtx } from './placement-service.ts';
import {
  END_REASON_LABEL, acceptCase, applyClientSphere, bountyOf, decideJoker, endResearch, fixStart, jokerDefaults, loadPlacementRow, packageOf,
  reportEnd, rejectCase,
} from './nachbesetzung.ts';
import { JOKER_DEFAULT_PCT, JOKER_VALID_DAYS, euro, matchuntOnClaimPct, matchuntOnNonStartPct, splitFor, versionOfSnapshot } from './konditionen.ts';
import { eur } from './invoice-pdf.ts';
import { UUID, DATE, namesFor, nowIso, requireAdminUser, rowsIn, text } from './buchhaltung-kern.ts';
import { dateDe, dateDeShort, dayDiff } from './buchhaltung-rechnen.ts';
import { dateKeyIn, m, tx } from './notify-i18n.ts';

const PKG: Record<string, string> = { core: 'Core', continuity_90: 'Continuity 90', continuity_180: 'Continuity 180' };
const pctDe = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const REPORT_TOPIC: Record<string, string> = { no_response: 'reagiert nicht', unfair: 'unfairer Umgang', circumvention: 'Verdacht auf Umgehung', wrong_info: 'Angaben stimmen nicht', other: 'etwas anderes' };

function reasonText(reason: string | null | undefined, firstName: string) {
  const l = END_REASON_LABEL[String(reason ?? '')] ?? reason ?? 'ohne Angabe';
  return /^(Wir|Stelle|Etwas|Aufhebung)/.test(l) ? l : `${firstName} ${l}`;
}

// ---------------------------------------------------------------------------
// Liste (Reiter „Fälle“)
// ---------------------------------------------------------------------------

export async function casesList(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const [{ data: claims }, { data: coreNs }, { data: research }, { data: contested }, { data: shaky }, { data: reports }, { data: offers }] = await Promise.all([
    ctx.db.from('continuity_claims').select('*').in('status', ['submitted', 'in_review']).order('reported_at', { ascending: true }).limit(200),
    ctx.db.from('placements').select('*').eq('package_key', 'core').not('non_start_reported_at', 'is', null).is('client_sphere_at', null).limit(200),
    ctx.db.from('placements').select('*').in('research_state', ['awaiting_position', 'awaiting_payment', 'running', 'paused']).limit(200),
    ctx.db.from('placements').select('*').not('start_contested_at', 'is', null).is('start_fixed_at', null).is('non_start_reported_at', null).limit(200),
    ctx.db.from('placements').select('*').eq('halfway_status', 'shaky').eq('continuity_state', 'running').limit(200),
    ctx.db.from('recruiter_client_reports').select('*').eq('status', 'open').order('created_at', { ascending: true }).limit(200),
    ctx.db.from('research_offers').select('*').limit(1000),
  ]);
  const offerBy = new Map(((offers ?? []) as any[]).map((o) => [o.placement_id, o]));
  const claimPl = await rowsIn(ctx, 'placements', '*', 'id', ((claims ?? []) as any[]).map((c) => c.placement_id));
  const coreOpen = ((coreNs ?? []) as any[]).filter((p) => !offerBy.has(p.id) && !p.replaces_placement_id);
  const all = [...claimPl, ...coreOpen, ...((research ?? []) as any[]), ...((contested ?? []) as any[]), ...((shaky ?? []) as any[])];
  const names = await namesFor(ctx, all);
  const items: any[] = [];

  for (const c of (claims ?? []) as any[]) {
    const p = claimPl.find((x) => x.id === c.placement_id);
    const n = p ? names.get(p.id) : null;
    items.push({
      kind: 'claim', group: 'Prüfen', id: c.id, placementId: c.placement_id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
      detail: `„${reasonText(c.category, '').trim()}“ · gemeldet ${dateDeShort(c.reported_at)}${c.recruiter_statement ? ` · ${n?.recruiterFirst ?? 'Headhunter'} angehört` : ` · ${n?.recruiterFirst ?? 'Headhunter'} noch nicht angehört`}`,
      action: 'Prüfen', since: c.reported_at,
    });
  }
  for (const p of coreOpen) {
    const n = names.get(p.id);
    items.push({
      kind: 'joker', group: 'Prüfen', id: p.id, placementId: p.id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
      detail: `Core · nicht angefangen · gemeldet ${dateDeShort(p.non_start_reported_at)}${p.non_start_reason ? ` · ${reasonText(p.non_start_reason, n?.firstName ?? '')}` : ''}`,
      action: 'Prüfen', since: p.non_start_reported_at,
    });
  }
  // Laufende und wartende Nachbesetzungen
  const rs = (research ?? []) as any[];
  const jobIds = rs.map((p) => p.research_job_id).filter(Boolean);
  const [acts, subsOnJobs] = await Promise.all([
    rowsIn(ctx, 'recruiter_job_activations', 'job_id, recruiter_id, ended_at', 'job_id', jobIds),
    rowsIn(ctx, 'submissions', 'job_id, recruiter_id, submitted_at', 'job_id', jobIds),
  ]);
  const decided = await rowsIn(ctx, 'continuity_claims', 'placement_id, decided_at, status', 'placement_id', rs.map((p) => p.id));
  for (const p of rs) {
    const n = names.get(p.id);
    const offer = offerBy.get(p.id);
    if (p.research_state === 'running' || p.research_state === 'paused') {
      const since = p.research_started_at ?? null;
      const days = since ? Math.max(0, dayDiff(since, today)) : null;
      const hh = new Set([...acts.filter((a) => a.job_id === p.research_job_id && !a.ended_at).map((a) => a.recruiter_id), ...subsOnJobs.filter((s) => s.job_id === p.research_job_id && (!since || s.submitted_at >= since)).map((s) => s.recruiter_id)]);
      items.push({
        kind: 'research', group: 'Nachbesetzung', id: p.id, placementId: p.id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
        detail: `${p.research_state === 'paused' ? 'ruht' : (days === 0 ? 'läuft seit heute' : `läuft seit ${days ?? '?'} ${days === 1 ? 'Tag' : 'Tagen'}`)} · ${hh.size} ${hh.size === 1 ? 'Headhunter sucht' : 'Headhunter suchen'} · Auslobung ${eur(Number(p.research_bounty_cents ?? 0) || bountyOf(p, p.research_kind === 'joker' ? 'joker' : 'continuity'))}`,
        action: 'Öffnen', since, jobId: p.research_job_id,
      });
    } else {
      const ref = decided.filter((d) => d.placement_id === p.id && d.status === 'accepted').map((d) => d.decided_at)[0] ?? offer?.answered_at ?? null;
      const days = ref ? Math.max(0, dayDiff(ref, today)) : null;
      items.push({
        kind: 'waiting', group: 'wartet auf Kunde', id: p.id, placementId: p.id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
        detail: p.research_state === 'awaiting_position'
          ? `Position noch nicht bestätigt${days != null ? `, seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}` : ''}`
          : `Rechnung noch nicht bezahlt, dann startet die Suche${days != null ? ` · seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}` : ''}`,
        action: 'Öffnen', since: ref, warn: p.research_state === 'awaiting_position' && (days ?? 0) > 7,
      });
    }
  }
  for (const o of ((offers ?? []) as any[]).filter((x) => x.status === 'open')) {
    const p = all.find((x) => x.id === o.placement_id) ?? (await rowsIn(ctx, 'placements', '*', 'id', [o.placement_id]))[0];
    if (!p) continue;
    const n = names.get(p.id) ?? (await namesFor(ctx, [p])).get(p.id);
    items.push({
      kind: 'offer', group: 'wartet auf Kunde', id: o.id, placementId: p.id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
      detail: `Angebot Nachbesetzung ${eur(Number(o.price_cents ?? 0))} netto · gültig bis ${dateDeShort(o.valid_until)}`, action: null, since: o.decided_at,
    });
  }
  for (const p of (contested ?? []) as any[]) {
    const n = names.get(p.id);
    items.push({
      kind: 'start', group: 'Antritt unklar', id: p.id, placementId: p.id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
      detail: `${n?.recruiterFirst ?? 'Headhunter'} sagt „angefangen${p.start_reported_on ? ` am ${dateDeShort(p.start_reported_on)}` : ''}“, der Kunde sagt „Stimmt so nicht“ · 1. Teil gesperrt`,
      action: 'Klären', since: p.start_contested_at,
    });
  }
  for (const p of (shaky ?? []) as any[]) {
    const n = names.get(p.id);
    items.push({
      kind: 'shaky', group: 'Hinweise', id: p.id, placementId: p.id, title: `${n?.candidateName ?? 'Kandidat'} · ${n?.companyName ?? ''}`,
      detail: `„Es wackelt“ von ${n?.recruiterFirst ?? 'Headhunter'} · ${dateDeShort(p.halfway_at)}${p.halfway_note ? ` · „${String(p.halfway_note).slice(0, 140)}“` : ''} · Garantie bis ${dateDeShort(p.continuity_end_date)}`,
      action: null, since: p.halfway_at,
    });
  }
  // Meldungen von Headhuntern (F2)
  const rep = (reports ?? []) as any[];
  const repJobs = await rowsIn(ctx, 'jobs', 'id, title, company_name, client_id, organization_id', 'id', rep.map((r) => r.job_id));
  const repProfs = await rowsIn(ctx, 'profiles', 'user_id, full_name', 'user_id', rep.map((r) => r.recruiter_id));
  const owners = await ownersOf(ctx, repJobs);
  for (const r of rep) {
    const j = repJobs.find((x) => x.id === r.job_id);
    items.push({
      kind: 'report', group: 'Hinweise', id: r.id, placementId: null, title: `${j?.company_name ?? 'Kunde'} · ${j?.title ?? ''}`,
      detail: `Meldung von ${String(repProfs.find((x) => x.user_id === r.recruiter_id)?.full_name ?? 'Headhunter').split(' ')[0]}: ${REPORT_TOPIC[r.topic] ?? r.topic} · „${String(r.note).slice(0, 140)}“ · ${dateDeShort(r.created_at)}`,
      action: 'Erledigt', since: r.created_at, ownerId: j ? owners.get(j.id) ?? j.client_id : null,
    });
  }
  const order = ['Prüfen', 'Antritt unklar', 'Nachbesetzung', 'wartet auf Kunde', 'Hinweise'];
  items.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || String(a.since ?? '').localeCompare(String(b.since ?? '')));
  return { items, count: items.filter((i) => ['claim', 'joker', 'start'].includes(i.kind)).length };
}

async function ownersOf(ctx: PlacementCtx, jobs: any[]) {
  const orgs = await rowsIn(ctx, 'organizations', 'id, owner_id', 'id', jobs.map((j) => j.organization_id));
  return new Map(jobs.map((j) => [j.id, orgs.find((o) => o.id === j.organization_id)?.owner_id ?? j.client_id]));
}

// ---------------------------------------------------------------------------
// Fall prüfen (A8)
// ---------------------------------------------------------------------------

function consequences(p: any, kind: 'departure' | 'non_start', firstOfRecruiter: string) {
  const pkg = packageOf(p).key;
  const split = splitFor(pkg, versionOfSnapshot(p.pricing_snapshot));
  const client = Number(p.client_fee_cents ?? 0);
  const initial = Number(p.recruiter_initial_cents ?? 0);
  const retention = Number(p.recruiter_retention_cents ?? 0);
  const matchunt = Number(p.matchunt_cents ?? 0);
  const bounty = bountyOf(p, 'continuity');
  if (kind === 'departure') {
    const fromMatchunt = Math.max(0, bounty - retention);
    return {
      client: { title: 'Nachbesetzung', lines: ['für alle Headhunter, bis die Stelle besetzt ist'] },
      recruiter: { title: `${euro(initial)} bleiben`, lines: [`2. Teil nur, wenn ${firstOfRecruiter} selbst besetzt`] },
      bounty: { title: euro(bounty), lines: [`${euro(retention)} 2. Teil + ${euro(fromMatchunt)} Matchunt`] },
      matchunt: { title: euro(client - initial - bounty), lines: [`${pctDe(matchuntOnClaimPct(split))} % statt ${euro(matchunt)}`] },
    };
  }
  return {
    client: { title: 'Nachbesetzung', lines: ['für alle Headhunter, bis die Stelle besetzt ist'] },
    recruiter: { title: 'kein Anteil', lines: ['Geld gibt es nur mit Antritt', `Auslobung, wenn ${firstOfRecruiter} selbst besetzt`] },
    bounty: { title: euro(bounty), lines: [`aus ${euro(initial + retention)} Anteil des Headhunters${bounty > initial + retention ? ` + ${euro(bounty - initial - retention)} Matchunt` : ''}`] },
    matchunt: { title: euro(client - bounty), lines: [`${pctDe(matchuntOnNonStartPct(split))} % statt ${euro(matchunt)}`] },
  };
}

export async function caseDetail(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  must(typeof body?.claimId === 'string' && UUID.test(body.claimId), 'Ungültiger Fall.');
  const { data: c } = await ctx.db.from('continuity_claims').select('*').eq('id', body.claimId).maybeSingle();
  must(c, 'Fall nicht gefunden.', 'not_found');
  const claim = c as any;
  const p = await loadPlacementRow(ctx, claim.placement_id);
  const n = (await namesFor(ctx, [p])).get(p.id)!;
  const kind = claim.kind === 'non_start' ? 'non_start' : 'departure';
  const pkg = packageOf(p);
  const version = Number(p.conditions_version) || versionOfSnapshot(p.pricing_snapshot);
  const reported = String(claim.reported_at).slice(0, 10);
  const inTime = !claim.deadline || reported <= String(claim.deadline).slice(0, 10);
  const inPeriod = kind === 'non_start' ? true : !p.continuity_end_date || String(claim.separation_date) <= String(p.continuity_end_date);
  const paid = p.invoice_state === 'paid';
  const docs: { label: string; path: string }[] = [];
  if (p.non_start_document_path) docs.push({ label: kind === 'non_start' ? 'Erklärung ansehen' : 'Kündigung ansehen', path: p.non_start_document_path });
  for (const e of (Array.isArray(claim.evidence) ? claim.evidence : []) as any[]) {
    const path = typeof e === 'string' ? e : e?.path;
    if (path) docs.push({ label: typeof e === 'object' && e?.label ? e.label : 'Kündigung ansehen', path });
  }
  const rf = n.recruiterFirst ?? 'der Headhunter';
  const cs = {
    client: { title: 'keine Nachbesetzung', lines: ['der Grund liegt auf Kundenseite (§ 9 Abs. 4)'] },
    recruiter: { title: euro(Number(p.recruiter_initial_cents ?? 0) + Number(p.recruiter_retention_cents ?? 0)), lines: ['alles, der 2. Teil wird sofort frei'] },
    bounty: { title: '–', lines: ['keine Nachbesetzung'] },
    matchunt: { title: euro(Number(p.matchunt_cents ?? 0)), lines: ['unverändert'] },
  };
  return {
    claim: {
      id: claim.id, kind, status: claim.status, reason: claim.category, reasonText: reasonText(claim.category, n.firstName), note: claim.description,
      separationDate: claim.separation_date, knownAt: claim.known_at, reportedAt: claim.reported_at, deadline: claim.deadline,
      statement: claim.recruiter_statement, statementAt: claim.recruiter_statement_at, clientSphereSuggested: ['offer_withdrawn', 'position_changed'].includes(claim.category),
    },
    placement: {
      id: p.id, candidateName: n.candidateName, firstName: n.firstName, companyName: n.companyName, jobTitle: n.jobTitle, recruiterName: n.recruiterName, recruiterFirst: n.recruiterFirst,
      packageLabel: PKG[pkg.key] ?? pkg.key, conditionsVersion: version, continuityEnd: p.continuity_end_date, firstWorkingDay: p.first_working_day,
      clientFeeCents: Number(p.client_fee_cents ?? 0),
    },
    checks: [
      { state: inTime ? 'ok' : 'fail', label: inTime ? `Gemeldet binnen ${pkg.noticeDays} Tagen` : `Meldefrist am ${dateDe(claim.deadline)} abgelaufen` },
      { state: inPeriod ? 'ok' : 'fail', label: kind === 'non_start' ? 'zwischen Unterschrift und Start' : inPeriod ? 'endet im Zeitraum' : 'endet nach dem Zeitraum' },
      { state: paid ? 'ok' : 'fail', label: paid ? 'Rechnung bezahlt' : 'Rechnung noch nicht bezahlt: die Suche startet erst nach Zahlung' },
    ],
    documents: docs,
    consequences: consequences(p, kind, rf),
    clientSphere: cs,
  };
}

export async function decideCase(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const claimId = String(body?.claimId ?? '');
  const decision = String(body?.decision ?? '');
  const note = text(body?.note, 1000) || null;
  if (decision === 'accept') return await acceptCase(ctx, user.id, claimId, note);
  if (decision === 'reject') {
    const reason = text(body?.reason, 500);
    must(reason, 'Bitte den Grund der Ablehnung angeben.');
    return await rejectCase(ctx, user.id, claimId, reason, false);
  }
  if (decision === 'client_sphere') return await rejectCase(ctx, user.id, claimId, text(body?.reason, 500), true);
  must(false, 'Bitte entscheiden: anerkennen, ablehnen oder Grund liegt beim Kunden.');
}

export async function caseDocument(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const path = String(body?.path ?? '');
  must(path && !path.includes('..'), 'Ungültige Datei.');
  must(ctx.placementFiles, 'Unterlagen sind nicht verfügbar.', 'not_found');
  const url = await ctx.placementFiles!.url(path, 300);
  must(url, 'Die Datei ist gerade nicht abrufbar.', 'not_found');
  return { url };
}

// ---------------------------------------------------------------------------
// J1: Nicht angefangen bei Core
// ---------------------------------------------------------------------------

export async function jokerDetail(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const p = await loadPlacementRow(ctx, body?.placementId);
  const n = (await namesFor(ctx, [p])).get(p.id)!;
  const today = todayKey(ctx.now());
  const d = jokerDefaults(p, today);
  const { data: inv } = await ctx.db.from('invoices').select('invoice_number, total_amount_cents, status, paid_at').eq('placement_id', p.id).eq('invoice_type', 'placement_fee').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: offer } = await ctx.db.from('research_offers').select('*').eq('placement_id', p.id).maybeSingle();
  const share = Number(p.recruiter_initial_cents ?? 0) + Number(p.recruiter_retention_cents ?? 0);
  return {
    placement: {
      id: p.id, candidateName: n.candidateName, firstName: n.firstName, companyName: n.companyName, jobTitle: n.jobTitle, recruiterName: n.recruiterName, recruiterFirst: n.recruiterFirst,
      plannedStart: p.first_working_day ?? p.start_date, reason: p.non_start_reason, reasonText: reasonText(p.non_start_reason, n.firstName), note: p.non_start_note,
      hasDocument: !!p.non_start_document_path, documentPath: p.non_start_document_path ?? null, grossCents: Number(p.gross_annual_target_compensation_cents ?? 0),
    },
    invoice: inv ? { number: (inv as any).status === 'draft' ? null : (inv as any).invoice_number, totalCents: Number((inv as any).total_amount_cents ?? 0), status: (inv as any).status, paidAt: (inv as any).paid_at } : null,
    recruiterShareCents: share,
    defaults: { pct: JOKER_DEFAULT_PCT, validDays: JOKER_VALID_DAYS, priceCents: d.priceCents, validUntil: d.validUntil, bountyCents: d.bountyCents },
    decided: offer ? { decision: (offer as any).decision, status: (offer as any).status, priceCents: (offer as any).price_cents, validUntil: (offer as any).valid_until } : null,
    clientSphereSuggested: p.non_start_reason === 'offer_withdrawn',
  };
}

export async function decideJokerAction(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const choice = String(body?.choice ?? '');
  if (choice === 'client_sphere') {
    const p = await loadPlacementRow(ctx, body?.placementId);
    must(!p.client_sphere_at, 'Das ist schon entschieden.', 'conflict');
    const { data: existing } = await ctx.db.from('research_offers').select('id').eq('placement_id', p.id).maybeSingle();
    must(!existing, 'Für diese Besetzung ist schon entschieden.', 'conflict');
    await applyClientSphere(ctx, p, user.id);
    const n = (await namesFor(ctx, [p])).get(p.id)!;
    await notify(ctx, n.recruiterId, 'claim_rejected', (l) => tx(l, m`Entschieden: ${n.firstName}`, m`Decided: ${n.firstName}`, m`Avgjort: ${n.firstName}`, m`Avgjort: ${n.firstName}`),
      (l) => tx(l, 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil.', 'The reason lies with the client. You get your full share.', 'Skälet ligger hos kunden. Du får hela din andel.', 'Grunnen ligger hos kunden. Du får hele andelen din.'), 'placement', p.id);
    await notify(ctx, n.clientId, 'claim_rejected', (l) => tx(l, m`Ihre Meldung zu ${n.firstName}`, m`Your report on ${n.firstName}`, m`Din anmälan om ${n.firstName}`, m`Meldingen din om ${n.firstName}`),
      (l) => tx(l, 'Gemeldet, danke. Eine Nachbesetzung ist hier nicht vorgesehen, weil der Grund auf Ihrer Seite liegt.', 'Reported, thank you. A replacement is not provided for here because the reason lies on your side.', 'Anmält, tack. En ersättning ingår inte här eftersom skälet ligger på er sida.', 'Meldt, takk. En erstatning er ikke aktuell her fordi grunnen ligger hos dere.'), 'submission', p.submission_id);
    return { ok: true, decision: 'client_sphere' };
  }
  must(choice === 'offer' || choice === 'none', 'Bitte wählen: anbieten, nichts anbieten oder Grund liegt beim Kunden.');
  const payload: any = { placementId: body?.placementId, offer: choice === 'offer', note: text(body?.note, 1000) || null };
  if (choice === 'offer') {
    const price = Math.round(Number(body?.priceCents));
    must(Number.isFinite(price) && price >= 0, 'Bitte den Preis angeben (0 € ist als Kulanz möglich).');
    payload.priceCents = price;
    if (typeof body?.validUntil === 'string' && DATE.test(body.validUntil)) {
      must(body.validUntil >= todayKey(ctx.now()), 'Das Angebot muss mindestens bis heute gelten.');
      payload.validUntil = body.validUntil;
    }
  }
  return await decideJoker(ctx, user.id, payload);
}

// ---------------------------------------------------------------------------
// Antritt unklar klären
// ---------------------------------------------------------------------------

export async function startDetail(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const p = await loadPlacementRow(ctx, body?.placementId);
  const n = (await namesFor(ctx, [p])).get(p.id)!;
  return {
    placement: {
      id: p.id, candidateName: n.candidateName, firstName: n.firstName, companyName: n.companyName, jobTitle: n.jobTitle, recruiterName: n.recruiterName,
      plannedStart: p.first_working_day ?? p.start_date, reportedOn: p.start_reported_on, reportedAt: p.start_reported_at,
      contestedAt: p.start_contested_at, contestNote: p.start_contest_note, packageKey: packageOf(p).key,
    },
    reasons: [
      { key: 'declined_before_start', label: `${n.firstName} hat vor dem Start abgesagt` },
      { key: 'no_show', label: `${n.firstName} ist nicht erschienen` },
      { key: 'offer_withdrawn', label: 'Der Kunde hat das Angebot zurückgezogen' },
    ],
  };
}

export async function resolveStart(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const p = await loadPlacementRow(ctx, body?.placementId);
  must(!p.start_fixed_at, 'Der Antritt steht schon fest.', 'conflict');
  const n = (await namesFor(ctx, [p])).get(p.id)!;
  const note = text(body?.note, 1000) || null;
  if (body?.way === 'started') {
    const on = typeof body?.startedOn === 'string' && DATE.test(body.startedOn) ? body.startedOn : (p.start_reported_on ?? p.first_working_day);
    must(on && on <= todayKey(ctx.now()), 'Bitte den ersten Arbeitstag angeben (nicht in der Zukunft).');
    await fixStart(ctx, p, 'admin', on, user.id);
    await notify(ctx, n.recruiterId, 'placement_started', (l) => tx(l, m`${n.firstName} hat angefangen`, m`${n.firstName} has started`, m`${n.firstName} har börjat`, m`${n.firstName} har begynt`),
      (l) => `${tx(l, `Matchunt hat den Antritt am ${dateKeyIn(on, l)} festgestellt.`, `Matchunt has established the start on ${dateKeyIn(on, l)}.`, `Matchunt har fastställt starten ${dateKeyIn(on, l)}.`, `Matchunt har fastslått oppstarten ${dateKeyIn(on, l)}.`)}${note ? ` ${note}` : ''}`, 'placement', p.id);
    await notify(ctx, n.clientId, 'placement_started', (l) => tx(l, m`Antritt von ${n.firstName}`, m`Start of ${n.firstName}`, m`Start för ${n.firstName}`, m`Oppstart for ${n.firstName}`),
      (l) => `${tx(l, `Matchunt hat geklärt: angefangen am ${dateKeyIn(on, l)}.`, `Matchunt has clarified: started on ${dateKeyIn(on, l)}.`, `Matchunt har utrett: började ${dateKeyIn(on, l)}.`, `Matchunt har avklart: begynte ${dateKeyIn(on, l)}.`)}${note ? ` ${note}` : ''}`, 'submission', p.submission_id);
    return { ok: true, state: 'started', firstWorkingDay: on };
  }
  must(body?.way === 'not_started', 'Bitte wählen: hat angefangen oder hat nicht angefangen.');
  const reason = String(body?.reason ?? 'no_show');
  must(['declined_before_start', 'no_show', 'offer_withdrawn'].includes(reason), 'Bitte den Grund wählen.');
  // Wie eine Meldung „nicht angefangen“: bei Continuity entsteht ein Fall, bei Core prüft Matchunt (J1)
  const r = await reportEnd(ctx, user, { ...p, start_fixed_at: null, placement_state: 'agreed' }, { reason, knownOn: todayKey(ctx.now()), eventOn: todayKey(ctx.now()), note: note ?? 'Von Matchunt nach Klärung des Antritts erfasst' });
  return { ok: true, state: 'not_started', outcome: (r as any).outcome, claimId: (r as any).claimId };
}

// ---------------------------------------------------------------------------
// Nachbesetzung öffnen/beenden, Meldungen erledigen
// ---------------------------------------------------------------------------

export async function researchDetail(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const p = await loadPlacementRow(ctx, body?.placementId);
  const n = (await namesFor(ctx, [p])).get(p.id)!;
  const jobId = p.research_job_id ?? n.jobId;
  const subs = jobId ? await rowsIn(ctx, 'submissions', 'id, recruiter_id, stage, submitted_at', 'job_id', [jobId]) : [];
  const since = p.research_started_at ?? null;
  const fresh = subs.filter((s) => !since || String(s.submitted_at) >= String(since));
  return {
    placement: { id: p.id, candidateName: n.candidateName, companyName: n.companyName, jobTitle: n.jobTitle, researchState: p.research_state, researchKind: p.research_kind, since, jobId },
    bountyCents: Number(p.research_bounty_cents ?? 0) || bountyOf(p, p.research_kind === 'joker' ? 'joker' : 'continuity'),
    submissions: fresh.length,
    recruiters: new Set(fresh.map((s) => s.recruiter_id)).size,
  };
}

export async function endResearchAction(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const p = await loadPlacementRow(ctx, body?.placementId);
  const note = text(body?.note, 1000);
  must(note, 'Bitte kurz den Grund angeben.');
  return await endResearch(ctx, user.id, p, 'matchunt_ended', note);
}

export async function handleReport(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  must(typeof body?.reportId === 'string' && UUID.test(body.reportId), 'Ungültige Meldung.');
  const { data, error } = await ctx.db.from('recruiter_client_reports').update({ status: 'handled', handled_at: nowIso(ctx), handled_by: user.id }).eq('id', body.reportId).eq('status', 'open').select('recruiter_id, job_id').maybeSingle();
  dbFail(error, 'Die Meldung');
  must(data, 'Die Meldung ist schon erledigt.', 'conflict');
  return { ok: true };
}
