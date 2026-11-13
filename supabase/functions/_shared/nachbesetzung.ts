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
import { dateKeyIn, eurCentsIn, m, tx, type Lang } from './notify-i18n.ts';
import { clientLanguage } from './recipient-language.ts';
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
// Sprache des Lesers (Mehrsprachigkeit 13.11.2026): Glocken an Kunde und Headhunter in
// dessen Profilsprache. Deutsch bleibt wortgleich.
// ---------------------------------------------------------------------------
const isDeLang = (l: Lang) => l === 'de' || l === 'de-AT' || l === 'de-CH';
/** Betrag wie bisher (eur) auf Deutsch, sonst nach Region */
const eurIn = (cents: number, l: Lang) => (isDeLang(l) ? eur(cents) : eurCentsIn(cents, l));
const END_REASON_OTHER: Record<string, [string, string, string]> = {
  declined_before_start: ['withdrew before starting', 'tackade nej före start', 'trakk seg før oppstart'],
  no_show: ['did not show up', 'dök inte upp', 'møtte ikke opp'],
  offer_withdrawn: ['We withdrew the offer', 'Vi drog tillbaka erbjudandet', 'Vi trakk tilbake tilbudet'],
  candidate_resigned: ['resigned', 'sa upp sig själv', 'sa opp selv'],
  performance_conduct: ['We are parting ways due to performance or conduct', 'Vi skiljs åt på grund av prestation eller uppförande', 'Vi skilles på grunn av prestasjon eller oppførsel'],
  mutual_on_request: ['Mutual termination at the person’s request', 'Avslut på personens begäran', 'Avslutning etter personens ønske'],
  position_changed: ['Position eliminated or restructured', 'Tjänsten försvinner eller görs om', 'Stillingen faller bort eller endres'],
  other: ['Something else', 'Något annat', 'Noe annet'],
};
/** Grund wie in der Meldung: „Cem hat selbst gekündigt“, „Wir trennen uns …“ – in der Sprache des Lesers */
function endLabelIn(reason: string, firstName: string, l: Lang): string {
  const de = END_REASON_LABEL[reason] ?? reason;
  const o = END_REASON_OTHER[reason];
  const sentence = /^(Wir|Stelle|Etwas|Aufhebung)/.test(de);
  if (isDeLang(l) || !o) return sentence ? de : `${firstName} ${de}`;
  const text = tx(l, de, o[0], o[1], o[2]);
  return sentence ? text : `${firstName} ${text}`;
}

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
    const reporter = (await profile(ctx.db, user.id))?.name ?? null;
    const fixesOn = addWorkdays(today, START_OBJECTION_WORKDAYS);
    await notify(ctx, clientId, 'placement_start_reported',
      (l) => tx(l, m`${who.firstName}s Start bestätigen`, m`Confirm ${who.firstName}’s start`, m`Bekräfta starten för ${who.firstName}`, m`Bekreft oppstarten til ${who.firstName}`),
      (l) => {
        const by = reporter ?? tx(l, 'Ihr Headhunter', 'Your headhunter', 'Din headhunter', 'Din headhunter');
        return tx(l, m`${by} meldet: angefangen am ${dateKeyIn(on, l)}. Ohne Antwort gilt es am ${dateKeyIn(fixesOn, l)} als bestätigt.`, m`${by} reports: started on ${dateKeyIn(on, l)}. Without a reply, it counts as confirmed on ${dateKeyIn(fixesOn, l)}.`, m`${by} meddelar: började ${dateKeyIn(on, l)}. Utan svar räknas det som bekräftat ${dateKeyIn(fixesOn, l)}.`, m`${by} melder: begynte ${dateKeyIn(on, l)}. Uten svar regnes det som bekreftet ${dateKeyIn(fixesOn, l)}.`);
      }, 'submission', p.submission_id);
    return { ok: true, state: 'reported', fixesOn: addWorkdays(today, START_OBJECTION_WORKDAYS) };
  }
  if (way === 'later') {
    const next = String(body?.startDate ?? '');
    must(DATE.test(next) && next > today, 'Bitte den neuen ersten Arbeitstag angeben.');
    const { error } = await ctx.db.from('placements').update({ first_working_day: next, start_moved_at: nowIso, start_moved_by: user.id, start_moved_note: note, start_report_kind: 'later' }).eq('id', p.id);
    dbFail(error, 'Der neue Starttermin');
    await notify(ctx, clientId, 'placement_start_moved',
      (l) => tx(l, m`Start verschoben: ${who.firstName}`, m`Start moved: ${who.firstName}`, m`Start flyttad: ${who.firstName}`, m`Oppstart flyttet: ${who.firstName}`),
      (l) => `${who.job.title} · ${tx(l, `neuer erster Arbeitstag ${dateKeyIn(next, l)} (vorher ${dateKeyIn(planned, l)})`, `new first working day ${dateKeyIn(next, l)} (previously ${dateKeyIn(planned, l)})`, `ny första arbetsdag ${dateKeyIn(next, l)} (tidigare ${dateKeyIn(planned, l)})`, `ny første arbeidsdag ${dateKeyIn(next, l)} (tidligere ${dateKeyIn(planned, l)})`)}${note ? ` · ${note}` : ''}`, 'submission', p.submission_id);
    return { ok: true, state: 'moved', startDate: next };
  }
  const { error } = await ctx.db.from('placements').update({ start_reported_at: nowIso, start_reported_by: user.id, start_reported_on: null, start_report_kind: 'not_started', start_contest_note: note }).eq('id', p.id);
  dbFail(error, 'Die Meldung');
  const reporterName = (await profile(ctx.db, user.id))?.name ?? null;
  await notify(ctx, clientId, 'placement_start_reported',
    (l) => {
      const by = reporterName ?? tx(l, 'Ihr Headhunter', 'Your headhunter', 'Din headhunter', 'Din headhunter');
      return tx(l, m`${by} meldet: ${who.firstName} hat nicht angefangen`, m`${by} reports: ${who.firstName} did not start`, m`${by} meddelar: ${who.firstName} började inte`, m`${by} melder: ${who.firstName} begynte ikke`);
    },
    (l) => tx(l, 'Bitte bestätigen, dann prüft Matchunt den Fall.', 'Please confirm, then Matchunt will review the case.', 'Bekräfta, så granskar Matchunt ärendet.', 'Bekreft, så vurderer Matchunt saken.'), 'submission', p.submission_id);
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_non_start', `Headhunter meldet Nichtantritt: ${who.fullName}`, `${who.job.company_name} · ${who.job.title}${note ? ` · ${note}` : ''}`, 'placement', p.id);
  return { ok: true, state: 'not_started_reported' };
}

/** Kunde antwortet auf die Meldung des Headhunters (K7 „Stimmt“ / „Stimmt so nicht“). */
export async function answerRecruiterStart(ctx: PlacementCtx, user: User, p: any, agree: boolean, note: string | null) {
  must(p.start_report_kind === 'started' && p.start_reported_at && !p.start_fixed_at, 'Dazu liegt keine offene Meldung vor.', 'conflict');
  const who = await placementPeople(ctx, p);
  if (agree) {
    await fixStart(ctx, p, 'client', p.start_reported_on, user.id);
    await notify(ctx, who.recruiterId, 'placement_started', (l) => tx(l, m`${who.firstName} hat angefangen`, m`${who.firstName} has started`, m`${who.firstName} har börjat`, m`${who.firstName} har begynt`),
      (l) => tx(l, m`${who.job.company_name} hat den Start bestätigt.`, m`${who.job.company_name} has confirmed the start.`, m`${who.job.company_name} har bekräftat starten.`, m`${who.job.company_name} har bekreftet oppstarten.`), 'placement', p.id);
    return { ok: true, state: 'started' };
  }
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('placements').update({ start_contested_at: nowIso, start_contest_note: note }).eq('id', p.id);
  dbFail(error, 'Die Antwort');
  for (const a of await adminIds(ctx.db)) await notify(ctx, a, 'placement_start_contested', `Antritt unklar: ${who.fullName}`, `Headhunter meldet „angefangen“, der Kunde sagt „Stimmt so nicht“${note ? `: ${note}` : ''}.`, 'placement', p.id);
  await notify(ctx, who.recruiterId, 'placement_start_contested', (l) => tx(l, m`Antritt unklar: ${who.firstName}`, m`Start unclear: ${who.firstName}`, m`Oklar start: ${who.firstName}`, m`Uklar oppstart: ${who.firstName}`),
    (l) => tx(l, 'Der Kunde sieht es anders. Matchunt klärt das und meldet sich.', 'The client sees it differently. Matchunt will clarify and get back to you.', 'Kunden ser det annorlunda. Matchunt reder ut det och hör av sig.', 'Kunden ser det annerledes. Matchunt avklarer og tar kontakt.'), 'placement', p.id);
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
  await notify(ctx, who.recruiterId, 'placement_end_reported',
    (l) => `${kind === 'non_start' ? tx(l, 'Nicht angefangen', 'Did not start', 'Började inte', 'Begynte ikke') : tx(l, 'Besetzung endet', 'Placement ends', 'Placeringen upphör', 'Ansettelsen avsluttes')}: ${who.firstName}`,
    (l) => {
      const lab = isDeLang(l) ? label : endLabelIn(reason, who.firstName, l);
      const next = pkg.continuityDays ? tx(l, 'Matchunt prüft den Fall und fragt dich nach deiner Sicht.', 'Matchunt is reviewing the case and will ask for your view.', 'Matchunt granskar ärendet och frågar efter din syn.', 'Matchunt vurderer saken og spør om ditt syn.') : tx(l, 'Matchunt meldet sich.', 'Matchunt will be in touch.', 'Matchunt hör av sig.', 'Matchunt tar kontakt.');
      return `${tx(l, m`${who.job.company_name} meldet: ${lab}.`, m`${who.job.company_name} reports: ${lab}.`, m`${who.job.company_name} meddelar: ${lab}.`, m`${who.job.company_name} melder: ${lab}.`)} ${next}`;
    }, 'placement', p.id);
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
  await notify(ctx, who.job.client_id, 'research_position_confirm',
    (l) => tx(l, m`Nachbesetzung für ${who.firstName}: Position bestätigen`, m`Replacement for ${who.firstName}: confirm the role`, m`Ersättning för ${who.firstName}: bekräfta tjänsten`, m`Erstatning for ${who.firstName}: bekreft stillingen`),
    (l) => tx(l, `Matchunt hat Ihre Meldung geprüft. Bestätigen Sie die Stelle oder passen Sie sie an, dann schreiben wir sie für alle Headhunter neu aus.`, 'Matchunt has reviewed your report. Confirm the role or adjust it, then we will re-advertise it to all headhunters.', 'Matchunt har granskat din anmälan. Bekräfta tjänsten eller justera den, så annonserar vi ut den på nytt till alla headhunters.', 'Matchunt har vurdert meldingen din. Bekreft stillingen eller juster den, så lyser vi den ut på nytt for alle headhuntere.'), 'submission', p.submission_id);
  const kept = (claim as any).kind === 'non_start' ? 0 : Number(p.recruiter_initial_cents ?? 0);
  const nonStartClaim = (claim as any).kind === 'non_start';
  await notify(ctx, who.recruiterId, 'research_accepted', (l) => tx(l, m`Nachbesetzung: ${who.job.title}`, m`Replacement: ${who.job.title}`, m`Ersättning: ${who.job.title}`, m`Erstatning: ${who.job.title}`),
    (l) => `${nonStartClaim ? tx(l, m`${who.firstName} hat nicht angefangen.`, m`${who.firstName} did not start.`, m`${who.firstName} började inte.`, m`${who.firstName} begynte ikke.`) : tx(l, m`Die Besetzung von ${who.firstName} endet.`, m`The placement of ${who.firstName} ends.`, m`Placeringen av ${who.firstName} upphör.`, m`Ansettelsen av ${who.firstName} avsluttes.`)} ${kept ? tx(l, `Dein 1. Teil (${eurIn(kept, l)}) bleibt deiner. `, `Your 1st part (${eurIn(kept, l)}) stays yours. `, `Din första del (${eurIn(kept, l)}) får du behålla. `, `Din første del (${eurIn(kept, l)}) beholder du. `) : ''}${tx(l, 'Die Stelle wird neu für alle ausgeschrieben, sobald der Kunde sie bestätigt hat.', 'The role will be re-advertised to everyone as soon as the client has confirmed it.', 'Tjänsten annonseras ut på nytt till alla så snart kunden har bekräftat den.', 'Stillingen lyses ut på nytt for alle så snart kunden har bekreftet den.')}`, 'placement', p.id);
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
  // Begründung schreibt Matchunt (Freitext) und bleibt, wie sie ist
  await notify(ctx, who.job.client_id, 'claim_rejected', (l) => tx(l, m`Ihre Meldung zu ${who.firstName}`, m`Your report on ${who.firstName}`, m`Din anmälan om ${who.firstName}`, m`Meldingen din om ${who.firstName}`),
    (l) => clientSphere ? tx(l, 'Eine Nachbesetzung ist hier nicht vorgesehen, weil der Grund auf Ihrer Seite liegt (Rahmenvertrag § 9 Abs. 4).', 'A replacement is not provided for here because the reason lies on your side (framework agreement § 9 (4)).', 'En ersättning ingår inte här eftersom skälet ligger på er sida (ramavtal § 9 st. 4).', 'En erstatning er ikke aktuell her fordi grunnen ligger hos dere (rammeavtale § 9 nr. 4).')
      : tx(l, m`Matchunt kann die Meldung nicht als Nachbesetzung anerkennen: ${why}`, m`Matchunt cannot accept the report as a replacement case: ${why}`, m`Matchunt kan inte godkänna anmälan som ersättningsärende: ${why}`, m`Matchunt kan ikke godkjenne meldingen som erstatningssak: ${why}`), 'submission', p.submission_id);
  await notify(ctx, who.recruiterId, 'claim_rejected', (l) => tx(l, m`Fall entschieden: ${who.firstName}`, m`Case decided: ${who.firstName}`, m`Ärendet avgjort: ${who.firstName}`, m`Saken avgjort: ${who.firstName}`),
    (l) => clientSphere ? tx(l, 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil, der 2. Teil wird sofort frei.', 'The reason lies with the client. You get your full share; the 2nd part is released immediately.', 'Skälet ligger hos kunden. Du får hela din andel, den andra delen frigörs direkt.', 'Grunnen ligger hos kunden. Du får hele andelen din, den andre delen frigis med en gang.')
      : tx(l, 'Matchunt hat den Fall nicht anerkannt. Für dich ändert sich nichts.', 'Matchunt did not accept the case. Nothing changes for you.', 'Matchunt godkände inte ärendet. För dig ändras ingenting.', 'Matchunt godkjente ikke saken. For deg endres ingenting.'), 'placement', p.id);
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
  const whyIn = (l: Lang) => p.non_start_reported_at ? tx(l, m`${who.firstName} hat nicht angefangen.`, m`${who.firstName} did not start.`, m`${who.firstName} började inte.`, m`${who.firstName} begynte ikke.`)
    : tx(l, 'Die erste Besetzung hat in der Garantiezeit geendet.', 'The first placement ended within the guarantee period.', 'Den första placeringen upphörde under garantitiden.', 'Den første ansettelsen ble avsluttet i garantiperioden.');
  for (const r of await recruitersOfJob(ctx, jobId)) {
    const own = r === who.recruiterId;
    await notify(ctx, r, 'research_open', (l) => tx(l, m`Nachbesetzung: ${who.job.title}`, m`Replacement: ${who.job.title}`, m`Ersättning: ${who.job.title}`, m`Erstatning: ${who.job.title}`),
      (l) => own ? `${whyIn(l)} ${tx(l, 'Die Stelle ist neu für alle ausgeschrieben, auch für dich.', 'The role has been re-advertised to everyone, including you.', 'Tjänsten är utannonserad på nytt till alla, även till dig.', 'Stillingen er lyst ut på nytt for alle, også for deg.')}`
        : `${whyIn(l)} ${tx(l, `Die Stelle ist neu ausgeschrieben · Auslobung ${eurIn(bounty, l)} in einem Teil nach Antritt.`, `The role has been re-advertised · bounty ${eurIn(bounty, l)} in one part after the start.`, `Tjänsten är utannonserad på nytt · ersättning ${eurIn(bounty, l)} i en del efter start.`, `Stillingen er lyst ut på nytt · dusør ${eurIn(bounty, l)} i én del etter oppstart.`)}${changed ? tx(l, ' Der Kunde hat die Stelle angepasst.', ' The client has adjusted the role.', ' Kunden har justerat tjänsten.', ' Kunden har justert stillingen.') : ''}`, 'job', jobId);
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
    for (const r of await recruitersOfJob(ctx, who.job.id)) {
      await notify(ctx, r, 'research_ended', (l) => tx(l, m`Nachbesetzung beendet: ${who.job.title}`, m`Replacement ended: ${who.job.title}`, m`Ersättningen avslutad: ${who.job.title}`, m`Erstatningen avsluttet: ${who.job.title}`),
        (l) => tx(l, 'Die Stelle ist nicht mehr offen. Deine Einreichungen dafür sind abgeschlossen.', 'The role is no longer open. Your submissions for it are closed.', 'Tjänsten är inte längre öppen. Dina kandidater för den är avslutade.', 'Stillingen er ikke lenger åpen. Kandidatene dine til den er avsluttet.'), 'job', who.job.id);
    }
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
    await notify(ctx, who.recruiterId, 'non_start_decided', nonStartTitle(who.firstName), nonStartCoreText, 'placement', p.id);
    return { ok: true, decision: 'none' };
  }
  const defaults = jokerDefaults(p, today);
  const price = Number.isFinite(Number(body?.priceCents)) && Number(body.priceCents) >= 0 ? Math.round(Number(body.priceCents)) : defaults.priceCents;
  const validUntil = DATE.test(String(body?.validUntil ?? '')) && String(body.validUntil) >= today ? String(body.validUntil) : defaults.validUntil;
  const { error } = await ctx.db.from('research_offers').insert({ placement_id: p.id, decision: 'offer', price_cents: price, valid_until: validUntil, status: 'open', decided_by: adminId, note });
  dbFail(error, 'Das Angebot');
  await forfeitWithoutStart(ctx, p, 'Kein Antritt (Core)');
  await ctx.db.from('placements').update({ research_bounty_cents: defaults.bountyCents }).eq('id', p.id);
  await notify(ctx, who.job.client_id, 'research_offer', (l) => tx(l, m`${who.firstName} hat nicht angefangen: unser Angebot`, m`${who.firstName} did not start: our offer`, m`${who.firstName} började inte: vårt erbjudande`, m`${who.firstName} begynte ikke: vårt tilbud`),
    (l) => tx(l, `Für einmalig ${eurIn(price, l)} netto schreiben wir die Stelle neu für alle Headhunter aus, bis sie besetzt ist. Gültig bis ${dateKeyIn(validUntil, l)}.`, `For a one-off ${eurIn(price, l)} net, we re-advertise the role to all headhunters until it is filled. Valid until ${dateKeyIn(validUntil, l)}.`, `För ett engångsbelopp på ${eurIn(price, l)} netto annonserar vi ut tjänsten på nytt till alla headhunters tills den är tillsatt. Giltigt till ${dateKeyIn(validUntil, l)}.`, `For et engangsbeløp på ${eurIn(price, l)} netto lyser vi ut stillingen på nytt for alle headhuntere til den er besatt. Gyldig til ${dateKeyIn(validUntil, l)}.`), 'submission', p.submission_id);
  await sendJokerMail(ctx, p, who, price, validUntil);
  await notify(ctx, who.recruiterId, 'non_start_decided', nonStartTitle(who.firstName), nonStartCoreText, 'placement', p.id);
  return { ok: true, decision: 'offer', priceCents: price, validUntil };
}

const nonStartTitle = (firstName: string) => (l: Lang) => tx(l, m`${firstName} hat nicht angefangen`, m`${firstName} did not start`, m`${firstName} började inte`, m`${firstName} begynte ikke`);
const nonStartCoreText = (l: Lang) => tx(l, 'Bei Core gibt es den Anteil erst mit dem Antritt, deshalb diesmal keinen.', 'With Core, the share is only paid once the person starts, so there is none this time.', 'Med Core betalas andelen först vid tillträdet, därför ingen den här gången.', 'Med Core utbetales andelen først ved oppstart, derfor ingen denne gangen.');

async function sendJokerMail(ctx: PlacementCtx, p: any, who: any, priceCents: number, validUntil: string) {
  try {
    const { data: cp } = await ctx.db.from('company_profiles').select('billing_email').eq('user_id', who.job.client_id).maybeSingle();
    const owner = await profile(ctx.db, who.job.client_id);
    const to = owner?.email ?? (cp as any)?.billing_email;
    if (!to) return;
    // Sprache des Kunden: Profil, sonst Land der Firma, sonst Deutsch (Dashboard-Link, keine öffentliche Seite)
    const { data: comp } = await ctx.db.from('company_profiles').select('billing_country').eq('user_id', who.job.client_id).maybeSingle();
    const l = await clientLanguage(ctx.db, { userId: who.job.client_id, email: to, country: (comp as any)?.billing_country ?? null });
    const price = eurIn(priceCents, l), until = dateKeyIn(validUntil, l), fn = esc(who.firstName);
    const heading = tx(l, m`${who.firstName} hat nicht angefangen: unser Angebot`, m`${who.firstName} did not start: our offer`, m`${who.firstName} började inte: vårt erbjudande`, m`${who.firstName} begynte ikke: vårt tilbud`);
    const url = `${ctx.appUrl()}/dashboard/besetzungen?besetzung=${p.submission_id}`;
    const body = [
      `<p style="margin:0 0 12px 0;">${tx(l, 'Guten Tag,', 'Hello,', 'Hej,', 'Hei,')}</p>`,
      `<p style="margin:0 0 12px 0;">${tx(l,
        m`Ihr Paket Core enthält keine Nachbesetzung. Weil ${fn} die Stelle nicht angetreten hat, möchten wir Ihnen trotzdem helfen: Für einmalig <strong>${esc(price)} netto</strong> schreiben wir die Stelle neu für alle Headhunter aus, bis sie besetzt ist. Das Angebot gilt bis ${esc(until)}.`,
        m`Your Core package does not include a replacement. Because ${fn} did not take up the role, we would still like to help: for a one-off <strong>${esc(price)} net</strong>, we re-advertise the role to all headhunters until it is filled. The offer is valid until ${esc(until)}.`,
        m`Ditt Core-paket innehåller ingen ersättning. Eftersom ${fn} inte tillträdde tjänsten vill vi ändå hjälpa till: för ett engångsbelopp på <strong>${esc(price)} netto</strong> annonserar vi ut tjänsten på nytt till alla headhunters tills den är tillsatt. Erbjudandet gäller till ${esc(until)}.`,
        m`Core-pakken din inneholder ingen erstatning. Fordi ${fn} ikke tiltrådte stillingen, vil vi likevel hjelpe: for et engangsbeløp på <strong>${esc(price)} netto</strong> lyser vi ut stillingen på nytt for alle headhuntere til den er besatt. Tilbudet gjelder til ${esc(until)}.`)}</p>`,
    ].join('');
    await ctx.mail({
      fromEmail: ctx.fromEmail, fromName: 'Matchunt', to, replyTo: 'info@bluewater-bridge.de',
      subject: heading, html: layout({ lang: l, preheader: heading, heading, body, cta: { label: tx(l, 'Angebot ansehen', 'View offer', 'Visa erbjudandet', 'Se tilbudet'), url } } as any),
      text: `${heading}\n${tx(l, `Für einmalig ${price} netto schreiben wir die Stelle neu aus. Gültig bis ${until}.`, `For a one-off ${price} net, we re-advertise the role. Valid until ${until}.`, `För ett engångsbelopp på ${price} netto annonserar vi ut tjänsten på nytt. Giltigt till ${until}.`, `For et engangsbeløp på ${price} netto lyser vi ut stillingen på nytt. Gyldig til ${until}.`)}\n${url}`,
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
