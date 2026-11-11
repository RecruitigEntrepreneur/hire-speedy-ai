// deno-lint-ignore-file no-explicit-any
// Antritt, Fälle und Nachbesetzung (Umbau 11.11.2026). Gemeinsamer Kern für
// Kunde (placement/client-tasks), Headhunter (abrechnung) und Admin (buchhaltung).
//
//   Antritt steht fest   Kunde bestätigt · Headhunter meldet und der Kunde
//                        widerspricht 3 Werktage nicht · 14 Tage nach dem
//                        ersten Arbeitstag ohne abweichende Meldung (R2).
//   Fall                 continuity_claims (kind departure | non_start). Den Grund
//                        beurteilt Matchunt: anerkennen, ablehnen, „Grund liegt
//                        beim Kunden“ (Headhunter bekommt alles, R5).
//   Nachbesetzung        anerkannt → Kunde bestätigt oder ändert die Stelle →
//                        nach Zahlung der Rechnung wird die Stelle wieder für alle
//                        geöffnet (jobs.research_for_placement_id) und läuft, bis
//                        sie über Matchunt besetzt ist oder der Kunde sie beendet.
//   Joker                Core + Nichtantritt: Matchunt bietet je Fall eine
//                        Nachbesetzung gegen Preis an (research_offers).
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import {
  adminIds, createInvoiceDraft, dateDe, loadSubmission, notify, plusDays, profile, releaseInvoiceCore, todayKey,
  type PlacementCtx,
} from './placement-service.ts';
import { releaseBlockers } from './billing-config.ts';
import { eur } from './invoice-pdf.ts';
import { esc, layout } from './intake-mail.ts';
import {
  JOKER_DEFAULT_PCT, JOKER_VALID_DAYS, START_OBJECTION_WORKDAYS, START_SILENCE_DAYS, addWorkdays, isPackageKey,
  splitFor, versionOfSnapshot, type PackageKey,
} from './konditionen.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// ---------------------------------------------------------------------------
// Gründe (K5). Gründe auf Seiten des Kunden lösen keine Nachbesetzung aus; der
// Headhunter bekommt dann seinen vollen Anteil (nach Feststellung durch Matchunt).
// ---------------------------------------------------------------------------

export const END_REASONS_BEFORE_START: Record<string, string> = {
  declined_before_start: 'hat vor dem Start abgesagt',
  no_show: 'ist nicht erschienen',
  offer_withdrawn: 'Wir haben das Angebot zurückgezogen',
};
export const END_REASONS_AFTER_START: Record<string, string> = {
  candidate_resigned: 'hat selbst gekündigt',
  performance_conduct: 'Wir trennen uns wegen Leistung oder Verhalten',
  mutual_on_request: 'Aufhebung auf Wunsch der Person',
  position_changed: 'Stelle fällt weg oder wird umgebaut',
  other: 'Etwas anderes',
};
/** Gründe, die in der Sphäre des Kunden liegen (§ 9 Abs. 4, R5). */
export const CLIENT_SPHERE_REASONS = ['offer_withdrawn', 'position_changed'];
export const END_REASON_LABEL: Record<string, string> = { ...END_REASONS_BEFORE_START, ...END_REASONS_AFTER_START };

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

export async function loadPlacementRow(ctx: PlacementCtx, placementId: unknown) {
  must(typeof placementId === 'string' && UUID.test(placementId), 'Ungültige Besetzung.');
  const { data, error } = await ctx.db.from('placements').select('*').eq('id', placementId).maybeSingle();
  dbFail(error, 'Die Besetzung');
  must(data, 'Diese Besetzung gibt es nicht.', 'not_found');
  return data as any;
}

/** Name, Stelle, Firma, Headhunter und Kunde einer Besetzung. */
export async function placementPeople(ctx: PlacementCtx, p: any) {
  const b = await loadSubmission(ctx.db, p.submission_id);
  const unlocked = !!(b.submission.identity_unlocked);
  const fullName = b.candidate.full_name ?? 'Kandidat';
  return {
    ...b,
    fullName,
    firstName: String(fullName).split(' ')[0],
    clientName: unlocked ? fullName : fullName,
    recruiterId: b.submission.recruiter_id as string | null,
  };
}

export function packageOf(p: any): { key: PackageKey; continuityDays: number | null; noticeDays: number } {
  const s = p.pricing_snapshot ?? {};
  const key: PackageKey = isPackageKey(p.package_key) ? p.package_key : 'core';
  const continuityDays = Number(s.continuityDays) > 0 ? Number(s.continuityDays) : null;
  const noticeDays = Number(s.claimNoticeDays) > 0 ? Number(s.claimNoticeDays) : 14;
  return { key, continuityDays, noticeDays };
}

/** Auslobung einer Besetzung in Cent (15 % in Fassung 2, Core-Joker: 15 %). */
export function bountyOf(p: any, kind: 'continuity' | 'joker' = 'continuity') {
  const gross = Number(p.gross_annual_target_compensation_cents ?? 0);
  const pkg = packageOf(p).key;
  const split = splitFor(pkg, versionOfSnapshot(p.pricing_snapshot));
  const pct = kind === 'joker' ? split.initialPct + split.retentionPct : (Number(p.pricing_snapshot?.researchBountyPct) || split.bountyPct);
  return Math.round(gross * pct / 100);
}

async function recruitersOfJob(ctx: PlacementCtx, jobId: string): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const { data } = await ctx.db.from('recruiter_job_activations').select('recruiter_id').eq('job_id', jobId);
    for (const r of (data ?? []) as any[]) if (r.recruiter_id) ids.add(r.recruiter_id);
  } catch (_e) { /* ohne Aktivierungen */ }
  const { data: subs } = await ctx.db.from('submissions').select('recruiter_id').eq('job_id', jobId);
  for (const s of (subs ?? []) as any[]) if (s.recruiter_id) ids.add(s.recruiter_id);
  return [...ids];
}

// ---------------------------------------------------------------------------
// Antritt
// ---------------------------------------------------------------------------

/** Antritt steht fest: Besetzung läuft, 1. Teil wird mit bezahlter Rechnung fällig (Trigger). */
export async function fixStart(ctx: PlacementCtx, p: any, how: 'client' | 'recruiter_unopposed' | 'no_report_14d' | 'admin' | 'client_sphere', startedOn: string | null, actorId: string | null) {
  if (p.start_fixed_at) return { ok: true, already: true };
  const nowIso = new Date(ctx.now()).toISOString();
  const first = startedOn && DATE.test(startedOn) ? startedOn : String(p.start_reported_on ?? p.first_working_day ?? p.start_date ?? '').slice(0, 10) || todayKey(ctx.now());
  const patch: Record<string, unknown> = {
    start_fixed_at: nowIso, start_fixed_how: how, first_working_day: first,
    placement_state: p.placement_state === 'agreed' || p.placement_state === 'cancelled' ? 'started' : p.placement_state,
  };
  if (how === 'client' && !p.start_confirmed_at) Object.assign(patch, { start_confirmed_at: nowIso, start_confirmed_by: actorId });
  const { error } = await ctx.db.from('placements').update(patch).eq('id', p.id);
  dbFail(error, 'Der Antritt');
  return { ok: true, already: false, firstWorkingDay: first };
}

/**
 * Headhunter meldet am ersten Arbeitstag (H7, R1).
 * started     → Kunde bekommt „Start bestätigen“; ohne Widerspruch nach 3 Werktagen fest.
 * later       → neuer erster Arbeitstag; Kunde wird informiert.
 * not_started → Kunde bekommt „bitte bestätigen“ und öffnet „Besetzung endet“.
 */
export async function reportStartByRecruiter(ctx: PlacementCtx, user: User, body: any) {
  const p = await loadPlacementRow(ctx, body?.placementId);
  const who = await placementPeople(ctx, p);
  must(who.recruiterId === user.id, 'Das ist nicht deine Besetzung.', 'not_allowed');
  must(!p.start_fixed_at && !p.non_start_reported_at && p.placement_state === 'agreed', 'Der Antritt steht schon fest.', 'conflict');
  const way = String(body?.way ?? '');
  must(['started', 'later', 'not_started'].includes(way), 'Bitte wählen: hat angefangen, fängt später an oder hat nicht angefangen.');
  const today = todayKey(ctx.now());
  const planned = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
  const nowIso = new Date(ctx.now()).toISOString();
  const note = text(body?.note, 500) || null;
  const clientId = who.job.client_id as string;
  if (way === 'started') {
    const on = DATE.test(String(body?.startedOn ?? '')) ? String(body.startedOn) : planned || today;
    must(on <= today, 'Der Tag liegt in der Zukunft.');
    const { error } = await ctx.db.from('placements').update({ start_reported_at: nowIso, start_reported_by: user.id, start_reported_on: on, start_report_kind: 'started' }).eq('id', p.id);
    dbFail(error, 'Die Meldung');
    await notify(ctx, clientId, 'placement_start_reported', `${who.firstName}s Start bestätigen`, `${(await profile(ctx.db, user.id))?.name ?? 'Ihr Headhunter'} meldet: angefangen am ${dateDe(on)}. Ohne Antwort gilt es am ${dateDe(addWorkdays(today, START_OBJECTION_WORKDAYS))} als bestätigt.`, 'submission', p.submission_id);
    return { ok: true, state: 'reported', fixesOn: addWorkdays(today, START_OBJECTION_WORKDAYS) };
  }
  if (way === 'later') {
    const next = String(body?.startDate ?? '');
    must(DATE.test(next) && next > today, 'Bitte den neuen ersten Arbeitstag angeben.');
    const { error } = await ctx.db.from('placements').update({ first_working_day: next, start_moved_at: nowIso, start_moved_by: user.id, start_moved_note: note, start_report_kind: 'later' }).eq('id', p.id);
    dbFail(error, 'Der neue Starttermin');
    await notify(ctx, clientId, 'placement_start_moved', `Start verschoben: ${who.firstName}`, `${who.job.title} · neuer erster Arbeitstag ${dateDe(next)} (vorher ${dateDe(planned)})${note ? ` · ${note}` : ''}`, 'submission', p.submission_id);
    return { ok: true, state: 'moved', startDate: next };
  }
  const { error } = await ctx.db.from('placements').update({ start_reported_at: nowIso, start_reported_by: user.id, start_reported_on: null, start_report_kind: 'not_started', start_contest_note: note }).eq('id', p.id);
  dbFail(error, 'Die Meldung');
  await notify(ctx, clientId, 'placement_start_reported', `${(await profile(ctx.db, user.id))?.name ?? 'Ihr Headhunter'} meldet: ${who.firstName} hat nicht angefangen`, 'Bitte bestätigen, dann prüft Matchunt den Fall.', 'submission', p.submission_id);
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_non_start', `Headhunter meldet Nichtantritt: ${who.fullName}`, `${who.job.company_name} · ${who.job.title}${note ? ` · ${note}` : ''}`, 'placement', p.id);
  return { ok: true, state: 'not_started_reported' };
}

/** Kunde antwortet auf die Meldung des Headhunters (K7 „Stimmt“ / „Stimmt so nicht“). */
export async function answerRecruiterStart(ctx: PlacementCtx, user: User, p: any, agree: boolean, note: string | null) {
  must(p.start_report_kind === 'started' && p.start_reported_at && !p.start_fixed_at, 'Dazu liegt keine offene Meldung vor.', 'conflict');
  const who = await placementPeople(ctx, p);
  if (agree) {
    await fixStart(ctx, p, 'client', p.start_reported_on, user.id);
    await notify(ctx, who.recruiterId, 'placement_started', `${who.firstName} hat angefangen`, `${who.job.company_name} hat den Start bestätigt.`, 'placement', p.id);
    return { ok: true, state: 'started' };
  }
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('placements').update({ start_contested_at: nowIso, start_contest_note: note }).eq('id', p.id);
  dbFail(error, 'Die Antwort');
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_start_contested', `Antritt unklar: ${who.fullName}`, `Headhunter meldet „angefangen“, der Kunde sagt „Stimmt so nicht“${note ? `: ${note}` : ''}.`, 'placement', p.id);
  await notify(ctx, who.recruiterId, 'placement_start_contested', `Antritt unklar: ${who.firstName}`, 'Der Kunde sieht es anders. Matchunt klärt das und meldet sich.', 'placement', p.id);
  return { ok: true, state: 'contested' };
}

// ---------------------------------------------------------------------------
// Fall melden (K5) und entscheiden (A8)
// ---------------------------------------------------------------------------

/**
 * Kunde meldet „Besetzung endet“. Mit Continuity entsteht ein Fall, den
 * Matchunt prüft; bei Core ist es eine Meldung (Nichtantritt → Matchunt
 * entscheidet über ein Angebot, J1). Gründe beim Kunden: kein Fall für die
 * Nachbesetzung, Matchunt stellt fest (Headhunter bekommt alles).
 */
export async function reportEnd(ctx: PlacementCtx, user: User, p: any, body: any) {
  const who = await placementPeople(ctx, p);
  const started = !!p.start_fixed_at || p.placement_state === 'started';
  const kind: 'departure' | 'non_start' = started ? 'departure' : 'non_start';
  const reasons = started ? END_REASONS_AFTER_START : END_REASONS_BEFORE_START;
  const reason = String(body?.reason ?? '');
  must(reasons[reason], 'Bitte wählen, was passiert ist.');
  must(!p.departure_reported_at && !p.non_start_reported_at, 'Das Ende ist schon gemeldet.', 'conflict');
  const today = todayKey(ctx.now());
  const knownOn = DATE.test(String(body?.knownOn ?? '')) ? String(body.knownOn) : today;
  const eventOn = DATE.test(String(body?.eventOn ?? '')) ? String(body.eventOn) : knownOn;
  const lastDay = DATE.test(String(body?.lastDay ?? '')) ? String(body.lastDay) : null;
  must(knownOn <= today, 'Der Tag, an dem Sie davon erfahren haben, liegt in der Zukunft.');
  must(eventOn <= knownOn, 'Das Datum liegt nach dem Tag, an dem Sie davon erfahren haben.');
  const note = text(body?.note, 1000) || null;
  must(note || reason !== 'other', 'Bitte kurz in eigenen Worten beschreiben, was passiert ist.');
  const nowIso = new Date(ctx.now()).toISOString();
  const pkg = packageOf(p);
  const clientSphere = CLIENT_SPHERE_REASONS.includes(reason);

  const patch: Record<string, unknown> = kind === 'non_start'
    ? { non_start_reported_at: nowIso, non_start_reported_by: user.id, non_start_reason: reason, non_start_note: note }
    : { departure_reported_at: nowIso, departure_reported_by: user.id, departure_category: reason, departure_event_on: eventOn, departure_last_day: lastDay ?? eventOn, departure_known_on: knownOn, departure_note: note };

  let outcome: 'claim' | 'core' | 'client_sphere' | 'outside' | 'late' = 'core';
  let claimId: string | null = null;
  if (pkg.continuityDays) {
    const { data: claim, error: cErr } = await ctx.db.from('continuity_claims').insert({
      placement_id: p.id, mandate_id: p.mandate_id ?? null, kind, category: reason, description: note,
      separation_date: eventOn, known_at: knownOn, reported_by: user.id, status: 'submitted', evidence: [],
    }).select('id').maybeSingle();
    if (cErr) {
      outcome = /Zeitraums/.test(cErr.message) ? 'outside' : 'late';
      console.warn('[nachbesetzung] Fall nicht angelegt', cErr.message);
    } else {
      claimId = (claim as any)?.id ?? null;
      outcome = clientSphere ? 'client_sphere' : 'claim';
      patch.continuity_state = 'claim_open';
    }
  } else if (kind === 'departure') {
    Object.assign(patch, { placement_state: 'ended_early', ended_at: lastDay ?? eventOn, end_reason: reason });
  }
  const { error } = await ctx.db.from('placements').update(patch).eq('id', p.id);
  dbFail(error, 'Die Meldung');

  const me = await profile(ctx.db, user.id);
  const label = `${reasons[reason].startsWith('Wir') || reasons[reason].startsWith('Stelle') || reasons[reason].startsWith('Etwas') || reasons[reason].startsWith('Aufhebung') ? reasons[reason] : `${who.firstName} ${reasons[reason]}`}`;
  const adminTitle = outcome === 'claim' ? `Fall prüfen: ${who.fullName}` : kind === 'non_start' && !pkg.continuityDays ? `Nicht angefangen (Core): ${who.fullName}` : `Besetzung endet: ${who.fullName}`;
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_end_reported', adminTitle, `${who.job.company_name} · ${who.job.title} · ${label}${note ? ` · ${note}` : ''} · gemeldet von ${me?.name ?? 'Kunde'}`, 'placement', p.id);
  await notify(ctx, who.recruiterId, 'placement_end_reported', `${kind === 'non_start' ? 'Nicht angefangen' : 'Besetzung endet'}: ${who.firstName}`,
    `${who.job.company_name} meldet: ${label}. ${pkg.continuityDays ? 'Matchunt prüft den Fall und fragt dich nach deiner Sicht.' : 'Matchunt meldet sich.'}`, 'placement', p.id);
  return { ok: true, outcome, claimId, kind };
}

/** Stellungnahme des Headhunters zum Fall (A8 „angehört“, H10). */
export async function recruiterStatement(ctx: PlacementCtx, user: User, body: any) {
  const p = await loadPlacementRow(ctx, body?.placementId);
  const who = await placementPeople(ctx, p);
  must(who.recruiterId === user.id, 'Das ist nicht deine Besetzung.', 'not_allowed');
  const statement = text(body?.statement, 2000);
  must(statement, 'Bitte kurz schreiben, was du weißt.');
  const { data: claim } = await ctx.db.from('continuity_claims').select('id, status').eq('placement_id', p.id).in('status', ['submitted', 'in_review']).order('reported_at', { ascending: false }).limit(1).maybeSingle();
  must(claim, 'Zu dieser Besetzung ist gerade kein Fall offen.', 'conflict');
  const { error } = await ctx.db.from('continuity_claims').update({ recruiter_statement: statement, recruiter_statement_at: new Date(ctx.now()).toISOString() }).eq('id', (claim as any).id);
  dbFail(error, 'Deine Stellungnahme');
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'claim_statement', `Stellungnahme zu ${who.fullName}`, statement.slice(0, 200), 'placement', p.id);
  return { ok: true };
}

/** Matchunt erkennt den Fall an: Nachbesetzung wartet auf die Position (K6 Zustand 2). */
export async function acceptCase(ctx: PlacementCtx, adminId: string, claimId: string, note: string | null) {
  must(UUID.test(claimId), 'Ungültiger Fall.');
  const { data: claim } = await ctx.db.from('continuity_claims').select('*').eq('id', claimId).maybeSingle();
  must(claim, 'Fall nicht gefunden.', 'not_found');
  must(['submitted', 'in_review'].includes((claim as any).status), 'Der Fall ist schon entschieden.', 'conflict');
  const p = await loadPlacementRow(ctx, (claim as any).placement_id);
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('continuity_claims').update({ status: 'accepted', decided_at: nowIso, decided_by: adminId, decision_note: note }).eq('id', claimId);
  dbFail(error, 'Der Fall');
  const bounty = bountyOf(p, 'continuity');
  await ctx.db.from('placements').update({ research_bounty_cents: bounty }).eq('id', p.id);
  const who = await placementPeople(ctx, p);
  await notify(ctx, who.job.client_id, 'research_position_confirm', `Nachbesetzung für ${who.firstName}: Position bestätigen`,
    `Matchunt hat Ihre Meldung geprüft. Bestätigen Sie die Stelle oder passen Sie sie an, dann schreiben wir sie für alle Headhunter neu aus.`, 'submission', p.submission_id);
  const kept = (claim as any).kind === 'non_start' ? 0 : Number(p.recruiter_initial_cents ?? 0);
  await notify(ctx, who.recruiterId, 'research_accepted', `Nachbesetzung: ${who.job.title}`,
    `${(claim as any).kind === 'non_start' ? `${who.firstName} hat nicht angefangen.` : `Die Besetzung von ${who.firstName} endet.`} ${kept ? `Dein 1. Teil (${eur(kept)}) bleibt deiner. ` : ''}Die Stelle wird neu für alle ausgeschrieben, sobald der Kunde sie bestätigt hat.`, 'placement', p.id);
  return { ok: true, bountyCents: bounty };
}

/**
 * Matchunt lehnt den Fall ab. clientSphere = der Grund liegt beim Kunden:
 * keine Nachbesetzung, der Headhunter bekommt alles (R5): Antritt gilt als
 * erfolgt, der Einbehalt wird sofort frei.
 */
export async function rejectCase(ctx: PlacementCtx, adminId: string, claimId: string, reason: string, clientSphere: boolean) {
  must(UUID.test(claimId), 'Ungültiger Fall.');
  const why = text(reason, 500) || (clientSphere ? 'Der Grund liegt beim Kunden (§ 9 Abs. 4).' : '');
  must(why, 'Bitte den Grund der Ablehnung angeben.');
  const { data: claim } = await ctx.db.from('continuity_claims').select('*').eq('id', claimId).maybeSingle();
  must(claim, 'Fall nicht gefunden.', 'not_found');
  must(['submitted', 'in_review'].includes((claim as any).status), 'Der Fall ist schon entschieden.', 'conflict');
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('continuity_claims').update({ status: 'rejected', rejection_reason: why, client_sphere: clientSphere, decided_at: nowIso, decided_by: adminId }).eq('id', claimId);
  dbFail(error, 'Der Fall');
  let p = await loadPlacementRow(ctx, (claim as any).placement_id);
  const who = await placementPeople(ctx, p);
  if (clientSphere) await applyClientSphere(ctx, p, adminId);
  else await ctx.db.from('placements').update({ continuity_state: p.start_fixed_at ? 'running' : 'not_applicable' }).eq('id', p.id);
  p = await loadPlacementRow(ctx, p.id);
  await notify(ctx, who.job.client_id, 'claim_rejected', `Ihre Meldung zu ${who.firstName}`, clientSphere ? 'Eine Nachbesetzung ist hier nicht vorgesehen, weil der Grund auf Ihrer Seite liegt (Rahmenvertrag § 9 Abs. 4).' : `Matchunt kann die Meldung nicht als Nachbesetzung anerkennen: ${why}`, 'submission', p.submission_id);
  await notify(ctx, who.recruiterId, 'claim_rejected', `Fall entschieden: ${who.firstName}`, clientSphere ? 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil, der 2. Teil wird sofort frei.' : 'Matchunt hat den Fall nicht anerkannt. Für dich ändert sich nichts.', 'placement', p.id);
  return { ok: true };
}

/** Grund beim Kunden (auch bei Core ohne Fall): Antritt gilt als erfolgt, Einbehalt frei. */
export async function applyClientSphere(ctx: PlacementCtx, p: any, adminId: string) {
  const nowIso = new Date(ctx.now()).toISOString();
  await ctx.db.from('placements').update({ client_sphere_at: nowIso }).eq('id', p.id);
  if (!p.start_fixed_at) {
    await fixStart(ctx, { ...p, client_sphere_at: nowIso }, 'client_sphere', p.first_working_day ?? p.start_date, adminId);
  }
  if (p.retention_state === 'withheld' || Number(p.recruiter_retention_cents ?? 0) > 0) {
    const { error } = await ctx.db.from('placements').update({ retention_state: 'released' }).eq('id', p.id).in('retention_state', ['withheld', 'not_applicable']);
    if (error) console.warn('[nachbesetzung] Einbehalt nicht freigegeben', error.message);
  }
  // Wieder verfallene Tranchen öffnen (Fall war zunächst als Nachbesetzung gebucht)
  await ctx.db.from('recruiter_payout_tranches').update({ status: 'pending', forfeited_at: null, forfeit_reason: null }).eq('placement_id', p.id).eq('status', 'forfeited');
}

/** Core: Nichtantritt ohne Angebot entschieden → 1. Teil verfällt (Geld nur mit Antritt). */
export async function forfeitWithoutStart(ctx: PlacementCtx, p: any, why: string) {
  await ctx.db.from('placements').update({ placement_state: 'cancelled', ended_at: p.ended_at ?? todayKey(ctx.now()), end_reason: p.end_reason ?? p.non_start_reason ?? 'no_start' }).eq('id', p.id);
  await ctx.db.from('recruiter_payout_tranches').update({ status: 'forfeited', forfeited_at: new Date(ctx.now()).toISOString(), forfeit_reason: why })
    .eq('placement_id', p.id).in('status', ['pending', 'due']);
}

// ---------------------------------------------------------------------------
// Nachbesetzung starten und beenden (K6)
// ---------------------------------------------------------------------------

/** Kunde bestätigt die Position (oder hat sie angepasst). Startet nach Zahlung der Rechnung. */
export async function confirmResearchPosition(ctx: PlacementCtx, user: User, p: any, changed: boolean) {
  must(p.research_state === 'awaiting_position', 'Die Nachbesetzung wartet gerade nicht auf Ihre Bestätigung.', 'conflict');
  const nowIso = new Date(ctx.now()).toISOString();
  const paid = p.invoice_state === 'paid' || p.research_kind === 'joker';
  if (!paid) {
    await ctx.db.from('placements').update({ research_state: 'awaiting_payment' }).eq('id', p.id);
    return { ok: true, state: 'awaiting_payment' };
  }
  await openResearchJob(ctx, p, nowIso, changed);
  return { ok: true, state: 'running' };
}

/** Stelle wieder öffnen, für alle Headhunter (H6). */
export async function openResearchJob(ctx: PlacementCtx, p: any, nowIso: string, changed = false) {
  const who = await placementPeople(ctx, p);
  const jobId = who.job.id as string;
  const { error } = await ctx.db.from('jobs').update({
    status: 'published', research_for_placement_id: p.id, research_since: nowIso,
    closed_reason: null, closed_at: null, paused_at: null, pause_until: null, pause_reason: null,
  }).eq('id', jobId);
  dbFail(error, 'Die Stelle');
  await ctx.db.from('placements').update({ research_state: 'running', research_started_at: nowIso, research_job_id: jobId }).eq('id', p.id);
  const bounty = Number(p.research_bounty_cents ?? 0) || bountyOf(p, p.research_kind === 'joker' ? 'joker' : 'continuity');
  const why = p.non_start_reported_at ? `${who.firstName} hat nicht angefangen.` : `Die erste Besetzung hat in der Garantiezeit geendet.`;
  for (const r of await recruitersOfJob(ctx, jobId)) {
    const own = r === who.recruiterId;
    await notify(ctx, r, 'research_open', `Nachbesetzung: ${who.job.title}`,
      own ? `${why} Die Stelle ist neu für alle ausgeschrieben, auch für dich.` : `${why} Die Stelle ist neu ausgeschrieben · Auslobung ${eur(bounty)} in einem Teil nach Antritt.${changed ? ' Der Kunde hat die Stelle angepasst.' : ''}`, 'job', jobId);
  }
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'research_open', `Nachbesetzung läuft: ${who.job.title}`, `${who.job.company_name} · Auslobung ${eur(bounty)}`, 'placement', p.id);
}

/** Kunde nimmt die Stelle heraus (oder Matchunt beendet, § 4 Abs. 6). Geld bleibt bei Matchunt. */
export async function endResearch(ctx: PlacementCtx, actorId: string, p: any, reason: 'client_ended' | 'matchunt_ended', note: string | null) {
  must(['awaiting_position', 'awaiting_payment', 'running', 'paused'].includes(p.research_state), 'Es läuft keine Nachbesetzung.', 'conflict');
  const nowIso = new Date(ctx.now()).toISOString();
  await ctx.db.from('placements').update({ research_state: 'cancelled', research_ended_at: nowIso, research_end_reason: reason }).eq('id', p.id);
  const who = await placementPeople(ctx, p);
  if (p.research_state === 'running' || p.research_state === 'paused') {
    await ctx.db.from('jobs').update({ status: 'closed', closed_reason: 'research_ended', closed_at: nowIso, closed_note: note, research_for_placement_id: null }).eq('id', who.job.id).eq('research_for_placement_id', p.id);
    for (const r of await recruitersOfJob(ctx, who.job.id)) await notify(ctx, r, 'research_ended', `Nachbesetzung beendet: ${who.job.title}`, 'Die Stelle ist nicht mehr offen. Deine Einreichungen dafür sind abgeschlossen.', 'job', who.job.id);
  }
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'research_ended', `Nachbesetzung beendet: ${who.job.title}`, `${reason === 'client_ended' ? 'vom Kunden beendet' : 'von Matchunt beendet'}${note ? ` · ${note}` : ''}`, 'placement', p.id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Joker: Nachbesetzung als Angebot bei Core-Nichtantritt (J1–J4)
// ---------------------------------------------------------------------------

export function jokerDefaults(p: any, todayIso: string) {
  const gross = Number(p.gross_annual_target_compensation_cents ?? 0);
  return { priceCents: Math.round(gross * JOKER_DEFAULT_PCT / 100), validUntil: plusDays(todayIso, JOKER_VALID_DAYS), pct: JOKER_DEFAULT_PCT, bountyCents: bountyOf(p, 'joker') };
}

/** J1: Matchunt entscheidet je Fall. offer=false → „Gemeldet, danke“, 1. Teil verfällt. */
export async function decideJoker(ctx: PlacementCtx, adminId: string, body: any) {
  const p = await loadPlacementRow(ctx, body?.placementId);
  must(packageOf(p).key === 'core' && p.non_start_reported_at, 'Das Angebot gibt es nur bei Core, wenn die Person nicht angefangen hat.', 'conflict');
  const { data: existing } = await ctx.db.from('research_offers').select('id').eq('placement_id', p.id).maybeSingle();
  must(!existing, 'Für diese Besetzung ist schon entschieden (höchstens einmal je Besetzung).', 'conflict');
  const today = todayKey(ctx.now());
  const offer = body?.offer === true;
  const note = text(body?.note, 1000) || null;
  const who = await placementPeople(ctx, p);
  if (!offer) {
    const { error } = await ctx.db.from('research_offers').insert({ placement_id: p.id, decision: 'none', status: 'none', decided_by: adminId, note });
    dbFail(error, 'Die Entscheidung');
    await forfeitWithoutStart(ctx, p, 'Kein Antritt (Core)');
    await notify(ctx, who.recruiterId, 'non_start_decided', `${who.firstName} hat nicht angefangen`, 'Bei Core gibt es den Anteil erst mit dem Antritt, deshalb diesmal keinen.', 'placement', p.id);
    return { ok: true, decision: 'none' };
  }
  const defaults = jokerDefaults(p, today);
  const price = Number.isFinite(Number(body?.priceCents)) && Number(body.priceCents) >= 0 ? Math.round(Number(body.priceCents)) : defaults.priceCents;
  const validUntil = DATE.test(String(body?.validUntil ?? '')) && String(body.validUntil) >= today ? String(body.validUntil) : defaults.validUntil;
  const { error } = await ctx.db.from('research_offers').insert({ placement_id: p.id, decision: 'offer', price_cents: price, valid_until: validUntil, status: 'open', decided_by: adminId, note });
  dbFail(error, 'Das Angebot');
  await forfeitWithoutStart(ctx, p, 'Kein Antritt (Core)');
  await ctx.db.from('placements').update({ research_bounty_cents: defaults.bountyCents }).eq('id', p.id);
  await notify(ctx, who.job.client_id, 'research_offer', `${who.firstName} hat nicht angefangen: unser Angebot`, `Für einmalig ${eur(price)} netto schreiben wir die Stelle neu für alle Headhunter aus, bis sie besetzt ist. Gültig bis ${dateDe(validUntil)}.`, 'submission', p.submission_id);
  await sendJokerMail(ctx, p, who, price, validUntil);
  await notify(ctx, who.recruiterId, 'non_start_decided', `${who.firstName} hat nicht angefangen`, 'Bei Core gibt es den Anteil erst mit dem Antritt, deshalb diesmal keinen.', 'placement', p.id);
  return { ok: true, decision: 'offer', priceCents: price, validUntil };
}

async function sendJokerMail(ctx: PlacementCtx, p: any, who: any, priceCents: number, validUntil: string) {
  try {
    const { data: cp } = await ctx.db.from('company_profiles').select('billing_email').eq('user_id', who.job.client_id).maybeSingle();
    const owner = await profile(ctx.db, who.job.client_id);
    const to = owner?.email ?? (cp as any)?.billing_email;
    if (!to) return;
    const heading = `${who.firstName} hat nicht angefangen: unser Angebot`;
    const url = `${ctx.appUrl()}/dashboard/besetzungen?besetzung=${p.submission_id}`;
    const body = [
      '<p style="margin:0 0 12px 0;">Guten Tag,</p>',
      `<p style="margin:0 0 12px 0;">Ihr Paket Core enthält keine Nachbesetzung. Weil ${esc(who.firstName)} die Stelle nicht angetreten hat, möchten wir Ihnen trotzdem helfen: Für einmalig <strong>${esc(eur(priceCents))} netto</strong> schreiben wir die Stelle neu für alle Headhunter aus, bis sie besetzt ist. Das Angebot gilt bis ${esc(dateDe(validUntil))}.</p>`,
    ].join('');
    await ctx.mail({
      fromEmail: ctx.fromEmail, fromName: 'Matchunt', to, replyTo: 'info@bluewater-bridge.de',
      subject: heading, html: layout({ preheader: heading, heading, body, cta: { label: 'Angebot ansehen', url } } as any),
      text: `${heading}\nFür einmalig ${eur(priceCents)} netto schreiben wir die Stelle neu aus. Gültig bis ${dateDe(validUntil)}.\n${url}`,
    } as any, { template: 'research_offer', meta: { placement_id: p.id } });
  } catch (e) {
    console.warn('[nachbesetzung] Angebotsmail nicht verschickt', e instanceof Error ? e.message : e);
  }
}

/** J2/J3: Kunde nimmt an oder lehnt ab. Annahme → Rechnung; nach Zahlung startet die Suche. */
export async function answerJoker(ctx: PlacementCtx, user: User, p: any, accept: boolean) {
  const { data: o } = await ctx.db.from('research_offers').select('*').eq('placement_id', p.id).maybeSingle();
  const offer = o as any;
  must(offer && offer.decision === 'offer' && offer.status === 'open', 'Dazu liegt kein offenes Angebot vor.', 'conflict');
  const today = todayKey(ctx.now());
  must(!offer.valid_until || offer.valid_until >= today, 'Das Angebot ist abgelaufen.', 'conflict');
  const nowIso = new Date(ctx.now()).toISOString();
  if (!accept) {
    await ctx.db.from('research_offers').update({ status: 'declined', answered_by: user.id, answered_at: nowIso }).eq('id', offer.id);
    for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'research_offer_declined', 'Angebot Nachbesetzung abgelehnt', `Besetzung ${p.id.slice(0, 8)}`, 'placement', p.id);
    return { ok: true, state: 'declined' };
  }
  const b = await loadSubmission(ctx.db, p.submission_id);
  const invoiceId = Number(offer.price_cents) > 0
    ? await createInvoiceDraft(ctx, { ...p, client_fee_cents: Number(offer.price_cents) }, b, { start_date: p.first_working_day ?? p.start_date, signed_on: today }, {
      type: 'research_option', researchOfferId: offer.id,
      title: `Nachbesetzung: ${b.job.title}`,
      details: [`Erneute Ausschreibung für alle Headhunter, bis die Stelle besetzt ist`, `Angebot angenommen am ${dateDe(today)}`],
    })
    : null;
  await ctx.db.from('research_offers').update({ status: 'accepted', answered_by: user.id, answered_at: nowIso, invoice_id: invoiceId }).eq('id', offer.id);
  await ctx.db.from('placements').update({ research_kind: 'joker', research_state: invoiceId ? 'awaiting_payment' : 'awaiting_position' }).eq('id', p.id);
  let released = false;
  if (invoiceId && releaseBlockers('invoice').length === 0) {
    try {
      const { data: inv } = await ctx.db.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
      await releaseInvoiceCore(ctx, inv, null);
      released = true;
    } catch (e) {
      console.warn('[nachbesetzung] Rechnung zur Nachbesetzung nicht gestellt', e instanceof Error ? e.message : e);
    }
  }
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'research_offer_accepted', `Angebot angenommen: ${b.job.title}`, `${b.job.company_name} · ${eur(Number(offer.price_cents ?? 0))} netto${released ? ' · Rechnung gestellt' : ' · Rechnung zur Freigabe'}`, 'placement', p.id);
  if (!invoiceId) {
    // Kulanz 0 €: sofort starten
    const fresh = await loadPlacementRow(ctx, p.id);
    await openResearchJob(ctx, { ...fresh, research_kind: 'joker' }, nowIso);
  }
  return { ok: true, state: invoiceId ? 'awaiting_payment' : 'running', invoiceId, released };
}

// ---------------------------------------------------------------------------
// Zahlung eingegangen: wartende Nachbesetzung starten (von der Zahlungsbuchung aufrufen)
// ---------------------------------------------------------------------------

export async function onInvoicePaid(ctx: PlacementCtx, invoiceId: string) {
  const { data: inv } = await ctx.db.from('invoices').select('id, placement_id, invoice_type, status').eq('id', invoiceId).maybeSingle();
  if (!inv || (inv as any).status !== 'paid' || !(inv as any).placement_id) return { started: false };
  const p = await loadPlacementRow(ctx, (inv as any).placement_id);
  const nowIso = new Date(ctx.now()).toISOString();
  if ((inv as any).invoice_type === 'research_option' && p.research_state === 'awaiting_payment') {
    await openResearchJob(ctx, p, nowIso);
    return { started: true };
  }
  if ((inv as any).invoice_type === 'placement_fee' && p.research_state === 'awaiting_payment') {
    await openResearchJob(ctx, p, nowIso);
    return { started: true };
  }
  return { started: false };
}

// ---------------------------------------------------------------------------
// Täglicher Lauf: Antritt feststellen, Einbehalt freigeben, Angebote ablaufen lassen
// ---------------------------------------------------------------------------

export async function runStartChecks(ctx: PlacementCtx) {
  const today = todayKey(ctx.now());
  const out = { fixedUnopposed: 0, fixedSilent: 0, retentionReleased: 0, offersExpired: 0 };
  const { data: open } = await ctx.db.from('placements').select('*').eq('placement_state', 'agreed').is('start_fixed_at', null).is('non_start_reported_at', null).limit(500);
  for (const p of (open ?? []) as any[]) {
    // Headhunter hat gemeldet, Kunde hat nicht widersprochen
    if (p.start_report_kind === 'started' && p.start_reported_at && !p.start_contested_at) {
      const until = addWorkdays(String(p.start_reported_at).slice(0, 10), START_OBJECTION_WORKDAYS);
      if (today > until) {
        await fixStart(ctx, p, 'recruiter_unopposed', p.start_reported_on, null);
        out.fixedUnopposed += 1;
        continue;
      }
    }
    // 14 Tage nach dem ersten Arbeitstag ohne abweichende Meldung
    const first = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
    if (first && !p.start_contested_at && p.start_report_kind !== 'not_started' && p.start_report_kind !== 'later' && today > plusDays(first, START_SILENCE_DAYS)) {
      await fixStart(ctx, p, 'no_report_14d', first, null);
      out.fixedSilent += 1;
    }
  }
  // Einbehalt: Zeitraum plus Meldefrist vorbei, kein offener Fall
  const { data: held } = await ctx.db.from('placements').select('id, retention_release_date').eq('retention_state', 'withheld').lte('retention_release_date', today).limit(500);
  for (const p of (held ?? []) as any[]) {
    const { data: openClaim } = await ctx.db.from('continuity_claims').select('id').eq('placement_id', p.id).in('status', ['submitted', 'in_review']).limit(1);
    if ((openClaim ?? []).length) continue;
    const { error } = await ctx.db.from('placements').update({ retention_state: 'released', continuity_state: 'passed' }).eq('id', p.id).eq('retention_state', 'withheld');
    if (!error) out.retentionReleased += 1;
  }
  // Angebote ablaufen lassen
  const { data: offers } = await ctx.db.from('research_offers').select('id').eq('status', 'open').lt('valid_until', today);
  for (const o of (offers ?? []) as any[]) {
    await ctx.db.from('research_offers').update({ status: 'expired' }).eq('id', o.id);
    out.offersExpired += 1;
  }
  return out;
}
