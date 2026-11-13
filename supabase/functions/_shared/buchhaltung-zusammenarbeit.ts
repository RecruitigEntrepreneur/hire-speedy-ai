// deno-lint-ignore-file no-explicit-any
// Faire Zusammenarbeit je Kunde (F1). Umbau 11.11.2026.
//
// Stufen: 1 Erinnerung (automatisch) · 2 Gespräch · 3 Hinweis mit Frist (Mail,
// als Nachweis gespeichert) · 4 Stelle ruht · 5 Bearbeitung beenden / Vertrag
// kündigen (nur Vermerk). Ab Stufe 2 nur per Klick. Signale: Vorstellungen ohne
// Rückmeldung > 5 Werktage, Position einer Nachbesetzung > 7 Tage nicht
// bestätigt, Meldungen von Headhuntern, Nachbesetzungen in 12 Monaten,
// Zahlungen pünktlich. Kunde = Inhaber der Organisation bzw. jobs.client_id.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import { adminIds, notify, profile, todayKey, type PlacementCtx } from './placement-service.ts';
import { endResearch, loadPlacementRow } from './nachbesetzung.ts';
import { eur } from './invoice-pdf.ts';
import { esc, layout } from './intake-mail.ts';
import { CUSTOMER_TYPES, DATE, EMAIL, OPEN_STATUSES, UUID, nowIso, openCentsOf, requireAdminUser, rowsIn, text } from './buchhaltung-kern.ts';
import { addDays } from './konditionen.ts';
import { dateDe, dateDeShort, dayDiff, workdaysUntil } from './buchhaltung-rechnen.ts';
import { dateKeyIn, m, tx } from './notify-i18n.ts';

export const FEEDBACK_WORKDAYS = 5;
export const POSITION_DAYS = 7;
export const STAGES = ['Erinnerung', 'Gespräch', 'Hinweis mit Frist', 'Ruht', 'Beenden'];
const KIND_LABEL: Record<string, string> = {
  auto_reminder: 'Automatische Erinnerung', call: 'Gespräch', hint: 'Hinweis mit Frist', pause: 'Stelle ruht', resume: 'Stelle läuft wieder',
  end: 'Bearbeitung beendet', terminate: 'Vertrag kündigen (Vermerk)', note: 'Notiz',
};
const KIND_STAGE: Record<string, number | null> = { auto_reminder: 1, call: 2, hint: 3, pause: 4, resume: null, end: 5, terminate: 5, note: null };
const REPORT_TOPIC: Record<string, string> = { no_response: 'reagiert nicht', unfair: 'unfairer Umgang', circumvention: 'Kandidat direkt angesprochen?', wrong_info: 'Angaben stimmen nicht', other: 'etwas anderes' };
const WAITING = ['submitted', 'in_review'];
const ACTIVE_JOB = ['published', 'paused', 'pending_approval', 'pending_client_approval', 'pending_client_terms'];

interface Signal { key: string; level: 'warn' | 'info' | 'ok'; text: string; link?: string | null }

async function ownerJobs(ctx: PlacementCtx, ownerId?: string) {
  // Alle Stellen, die nicht Entwurf sind; Kunde = Inhaber der Organisation, sonst client_id
  let q = ctx.db.from('jobs').select('id, title, company_name, client_id, organization_id, status, created_at, cooperation_paused_at, research_for_placement_id, paused_at').neq('status', 'draft').limit(3000);
  if (ownerId) {
    const { data: orgs } = await ctx.db.from('organizations').select('id').eq('owner_id', ownerId);
    const orgIds = ((orgs ?? []) as any[]).map((o) => o.id);
    q = orgIds.length ? q.or(`client_id.eq.${ownerId},organization_id.in.(${orgIds.join(',')})`) : q.eq('client_id', ownerId);
  }
  const { data, error } = await q;
  dbFail(error, 'Die Stellen');
  const jobs = (data ?? []) as any[];
  const orgs = await rowsIn(ctx, 'organizations', 'id, owner_id', 'id', jobs.map((j) => j.organization_id));
  const ownerOf = (j: any) => orgs.find((o) => o.id === j.organization_id)?.owner_id ?? j.client_id;
  return jobs.map((j) => ({ ...j, owner_id: ownerOf(j) })).filter((j) => !ownerId || j.owner_id === ownerId);
}

async function signalsFor(ctx: PlacementCtx, jobs: any[], today: string) {
  const jobIds = jobs.map((j) => j.id);
  const subs = await rowsIn(ctx, 'submissions', 'id, job_id, stage, submitted_at, recruiter_id', 'job_id', jobIds);
  const placements = await rowsIn(ctx, 'placements', 'id, submission_id, created_at, research_state, research_started_at', 'submission_id', subs.map((s) => s.id));
  const [claims, invoices, reports] = await Promise.all([
    rowsIn(ctx, 'continuity_claims', 'placement_id, status, decided_at, created_at', 'placement_id', placements.map((p) => p.id)),
    rowsIn(ctx, 'invoices', 'id, job_id, status, invoice_type, due_date, total_amount_cents, total_amount, paid_amount_cents, invoice_number', 'job_id', jobIds),
    rowsIn(ctx, 'recruiter_client_reports', 'id, job_id, recruiter_id, topic, note, status, created_at', 'job_id', jobIds),
  ]);
  const recNames = await rowsIn(ctx, 'profiles', 'user_id, full_name', 'user_id', reports.map((r) => r.recruiter_id));
  const subJob = new Map(subs.map((s) => [s.id, s.job_id]));
  return { subs, placements, claims, invoices, reports, recNames, subJob, today };
}

function evaluate(jobs: any[], d: Awaited<ReturnType<typeof signalsFor>>): { signals: Signal[]; warn: number; openReports: number } {
  const ids = new Set(jobs.map((j) => j.id));
  const signals: Signal[] = [];
  // 1 Vorstellungen ohne Rückmeldung
  const waiting = d.subs.filter((s) => ids.has(s.job_id) && WAITING.includes(s.stage) && s.submitted_at);
  const ages = waiting.map((s) => workdaysUntil(String(s.submitted_at).slice(0, 10), d.today));
  const over = ages.filter((a) => a > FEEDBACK_WORKDAYS);
  if (over.length) signals.push({ key: 'feedback', level: 'warn', text: `${over.length} ${over.length === 1 ? 'Vorstellung' : 'Vorstellungen'} ohne Rückmeldung · älteste seit ${Math.max(...ages)} Werktagen (Vertrag: ${FEEDBACK_WORKDAYS})` });
  else if (waiting.length) signals.push({ key: 'feedback', level: 'info', text: `${waiting.length} ${waiting.length === 1 ? 'Vorstellung wartet' : 'Vorstellungen warten'} auf Rückmeldung, älteste seit ${Math.max(...ages)} Werktagen` });
  // 2 Nachbesetzung: Position nicht bestätigt
  const pls = d.placements.filter((p) => ids.has(d.subJob.get(p.submission_id)));
  for (const p of pls.filter((x) => x.research_state === 'awaiting_position')) {
    const since = d.claims.filter((c) => c.placement_id === p.id && c.status === 'accepted').map((c) => c.decided_at)[0] ?? null;
    const days = since ? dayDiff(since, d.today) : null;
    if (days != null && days > POSITION_DAYS) signals.push({ key: 'position', level: 'warn', text: `Nachbesetzung: Position seit ${days >= 14 ? `${Math.floor(days / 7)} Wochen` : `${days} Tagen`} nicht bestätigt`, link: '/admin/besetzungen?reiter=faelle' });
    else signals.push({ key: 'position', level: 'info', text: `Nachbesetzung: Position noch nicht bestätigt${days != null ? `, seit ${days} Tagen` : ''}`, link: '/admin/besetzungen?reiter=faelle' });
  }
  // 3 Meldungen von Headhuntern
  const reps = d.reports.filter((r) => ids.has(r.job_id));
  const openReps = reps.filter((r) => r.status === 'open');
  if (reps.length) {
    const sample = reps.slice(-3).map((r) => `„${REPORT_TOPIC[r.topic] ?? r.topic}“ (${String(d.recNames.find((x) => x.user_id === r.recruiter_id)?.full_name ?? 'Headhunter').split(' ')[0]})`).join(', ');
    signals.push({ key: 'reports', level: 'info', text: `${reps.length} ${reps.length === 1 ? 'Meldung' : 'Meldungen'} von Headhuntern${openReps.length ? ` (${openReps.length} offen)` : ''} · ${sample}`, link: '/admin/besetzungen?reiter=faelle' });
  }
  // 4 Nachbesetzungen in 12 Monaten
  const yearAgo = addDays(d.today, -365);
  const recent = pls.filter((p) => String(p.created_at).slice(0, 10) >= yearAgo);
  const claimed = new Set(d.claims.filter((c) => c.status === 'accepted' && String(c.decided_at ?? c.created_at).slice(0, 10) >= yearAgo).map((c) => c.placement_id));
  if (recent.length) signals.push({ key: 'research', level: 'info', text: `Nachbesetzungen in 12 Monaten: ${claimed.size} von ${recent.length} ${recent.length === 1 ? 'Besetzung' : 'Besetzungen'}` });
  // 5 Zahlungen
  const overdue = d.invoices.filter((i) => ids.has(i.job_id) && CUSTOMER_TYPES.includes(i.invoice_type ?? 'placement_fee') && OPEN_STATUSES.includes(i.status) && i.due_date && i.due_date < d.today);
  if (overdue.length) signals.push({ key: 'payments', level: 'warn', text: `${overdue.length} ${overdue.length === 1 ? 'Rechnung' : 'Rechnungen'} überfällig (${eur(overdue.reduce((a, i) => a + openCentsOf(i), 0))})`, link: '/admin/besetzungen?reiter=rechnungen' });
  else if (d.invoices.some((i) => ids.has(i.job_id))) signals.push({ key: 'payments', level: 'ok', text: 'Zahlungen pünktlich' });
  return { signals, warn: signals.filter((s) => s.level === 'warn').length, openReports: openReps.length };
}

function stageOf(events: any[], jobs: any[]) {
  const sorted = [...events].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const ended = sorted.filter((e) => e.kind === 'end' || e.kind === 'terminate').pop();
  if (ended) return { stage: 5, since: ended.created_at };
  const paused = jobs.filter((j) => j.cooperation_paused_at);
  if (paused.length) return { stage: 4, since: paused.map((j) => j.cooperation_paused_at).sort()[0] };
  const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const last = sorted.filter((e) => ['auto_reminder', 'call', 'hint'].includes(e.kind) && String(e.created_at) >= cutoff).sort((a, b) => (KIND_STAGE[b.kind] ?? 0) - (KIND_STAGE[a.kind] ?? 0) || String(b.created_at).localeCompare(String(a.created_at)))[0];
  return last ? { stage: KIND_STAGE[last.kind] ?? 0, since: last.created_at } : { stage: 0, since: null };
}

async function companyNames(ctx: PlacementCtx, ownerIds: string[], jobs: any[]) {
  const cps = await rowsIn(ctx, 'company_profiles', 'user_id, company_name, legal_name', 'user_id', ownerIds);
  return (id: string) => cps.find((c) => c.user_id === id)?.company_name || cps.find((c) => c.user_id === id)?.legal_name || jobs.find((j) => j.owner_id === id)?.company_name || 'Kunde';
}

// ---------------------------------------------------------------------------
// Liste (Einstieg)
// ---------------------------------------------------------------------------

export async function cooperationList(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const jobs = await ownerJobs(ctx);
  const d = await signalsFor(ctx, jobs, today);
  const owners = [...new Set(jobs.map((j) => j.owner_id))];
  const events = await rowsIn(ctx, 'client_cooperation_events', 'owner_id, kind, stage, created_at', 'owner_id', owners);
  const name = await companyNames(ctx, owners, jobs);
  const rows = owners.map((id) => {
    const own = jobs.filter((j) => j.owner_id === id);
    const e = evaluate(own, d);
    const st = stageOf(events.filter((x) => x.owner_id === id), own);
    return {
      ownerId: id, company: name(id), jobs: own.filter((j) => ACTIVE_JOB.includes(j.status)).length, stage: st.stage, stageLabel: st.stage ? STAGES[st.stage - 1] : null, stageSince: st.since,
      warn: e.warn, openReports: e.openReports, signals: e.signals.filter((s) => s.level !== 'ok'),
    };
  });
  const all = body?.all === true;
  const list = rows.filter((r) => all || r.warn > 0 || r.openReports > 0 || (r.stage >= 2 && r.stage <= 4))
    .sort((a, b) => b.warn - a.warn || b.stage - a.stage || a.company.localeCompare(b.company, 'de'));
  return { clients: list, total: rows.length };
}

// ---------------------------------------------------------------------------
// Detail je Kunde
// ---------------------------------------------------------------------------

function hintTemplate(company: string, signals: Signal[], deadline: string) {
  const points = signals.filter((s) => s.level === 'warn').map((s) => `· ${s.text.replace(/ \(Vertrag: \d+\)/, '')}`);
  return [
    'Guten Tag,',
    '',
    `wir möchten Ihre Stellen weiter gut besetzen. Dafür brauchen wir Ihre Mitwirkung${points.length ? ':' : '.'}`,
    ...points,
    '',
    `Bitte kümmern Sie sich bis zum ${dateDe(deadline)} darum. Sonst müssen wir die Suche für Ihre Stelle anhalten (Rahmenvertrag § 4 Abs. 6 und Anlage 7).`,
    '',
    'Wenn etwas dazwischengekommen ist, antworten Sie einfach auf diese Mail. Wir finden gemeinsam einen Weg.',
    '',
    'Freundliche Grüße',
    'Ihr Matchunt-Team',
  ].join('\n').replace('{company}', company);
}

export async function cooperationDetail(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const ownerId = String(body?.ownerId ?? '');
  must(UUID.test(ownerId), 'Ungültiger Kunde.');
  const today = todayKey(ctx.now());
  const jobs = await ownerJobs(ctx, ownerId);
  must(jobs.length, 'Zu diesem Kunden gibt es keine Stellen.', 'not_found');
  const d = await signalsFor(ctx, jobs, today);
  const e = evaluate(jobs, d);
  const { data: evs } = await ctx.db.from('client_cooperation_events').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(200);
  const events = (evs ?? []) as any[];
  const st = stageOf(events, jobs);
  const name = (await companyNames(ctx, [ownerId], jobs))(ownerId);
  const byNames = await rowsIn(ctx, 'profiles', 'user_id, full_name', 'user_id', events.map((x) => x.created_by));
  // Automatische Erinnerungen der Headhunter (client_nudge) als Stufe 1 im Verlauf
  let nudges: any[] = [];
  try {
    const subIds = d.subs.map((s) => s.id);
    for (let i = 0; i < subIds.length; i += 150) {
      const { data } = await ctx.db.from('candidate_activity_log').select('related_submission_id, created_at').contains('metadata', { kind: 'client_nudge' }).in('related_submission_id', subIds.slice(i, i + 150)).gte('created_at', addDays(today, -180)).limit(500);
      nudges.push(...((data ?? []) as any[]));
    }
  } catch (_e) { nudges = []; }
  const nudgeDays = new Map<string, number>();
  for (const n of nudges) { const k = String(n.created_at).slice(0, 10); nudgeDays.set(k, (nudgeDays.get(k) ?? 0) + 1); }
  const history = [
    ...events.map((x) => ({
      id: x.id, at: x.created_at, kind: x.kind, label: KIND_LABEL[x.kind] ?? x.kind, stage: x.stage, note: x.note, deadline: x.deadline,
      jobTitle: x.job_id ? jobs.find((j) => j.id === x.job_id)?.title ?? null : null,
      by: x.created_by ? (byNames.find((p) => p.user_id === x.created_by)?.full_name ?? 'Matchunt') : 'automatisch',
    })),
    ...[...nudgeDays.entries()].map(([day, n]) => ({ id: `nudge-${day}`, at: `${day}T08:00:00Z`, kind: 'auto_reminder', label: 'Automatische Erinnerung', stage: 1, note: `zu ${n} ${n === 1 ? 'Vorstellung' : 'Vorstellungen'}`, deadline: null, jobTitle: null, by: 'automatisch' })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const effectiveStage = st.stage || (e.warn && nudges.length ? 1 : 0);
  const deadline = addDays(today, 7);
  const owner = await profile(ctx.db, ownerId);
  const firstJob = [...jobs].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
  return {
    ownerId, company: name, ownerEmail: owner?.email ?? null, ownerName: owner?.name ?? null,
    since: firstJob?.created_at ?? null, activeJobs: jobs.filter((j) => ACTIVE_JOB.includes(j.status)).length,
    stage: effectiveStage, stageLabel: effectiveStage ? STAGES[effectiveStage - 1] : null, stageSince: st.since ?? (effectiveStage === 1 ? [...nudgeDays.keys()].sort().pop() ?? null : null),
    signals: e.signals,
    history,
    jobs: jobs.filter((j) => ACTIVE_JOB.includes(j.status) || j.cooperation_paused_at).map((j) => ({
      id: j.id, title: j.title, status: j.status, cooperationPaused: !!j.cooperation_paused_at, pausedAt: j.cooperation_paused_at, research: !!j.research_for_placement_id,
    })),
    hint: { deadline, text: hintTemplate(name, e.signals, deadline) },
    stages: STAGES,
  };
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

async function recruitersOf(ctx: PlacementCtx, jobId: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const a of await rowsIn(ctx, 'recruiter_job_activations', 'recruiter_id, ended_at', 'job_id', [jobId])) if (a.recruiter_id && !a.ended_at) ids.add(a.recruiter_id);
  for (const s of await rowsIn(ctx, 'submissions', 'recruiter_id, stage', 'job_id', [jobId])) if (s.recruiter_id && !['rejected', 'client_rejected', 'withdrawn', 'placed'].includes(s.stage)) ids.add(s.recruiter_id);
  return [...ids];
}

async function addEvent(ctx: PlacementCtx, row: Record<string, unknown>) {
  const { error } = await ctx.db.from('client_cooperation_events').insert(row);
  dbFail(error, 'Der Verlauf');
}

export async function cooperationAction(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const ownerId = String(body?.ownerId ?? '');
  must(UUID.test(ownerId), 'Ungültiger Kunde.');
  const action = String(body?.action ?? '');
  const note = text(body?.note, 2000) || null;
  const jobs = await ownerJobs(ctx, ownerId);
  must(jobs.length, 'Zu diesem Kunden gibt es keine Stellen.', 'not_found');
  const pick = () => {
    const ids = Array.isArray(body?.jobIds) ? (body.jobIds as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)) : [];
    const chosen = jobs.filter((j) => ids.includes(j.id));
    must(chosen.length, 'Bitte mindestens eine Stelle wählen.');
    return chosen;
  };
  const at = nowIso(ctx);

  if (action === 'call') {
    must(note, 'Bitte kurz notieren, was besprochen wurde.');
    await addEvent(ctx, { owner_id: ownerId, stage: 2, kind: 'call', note, created_by: user.id });
    return { ok: true };
  }
  if (action === 'note') {
    must(note, 'Bitte eine Notiz schreiben.');
    await addEvent(ctx, { owner_id: ownerId, stage: null, kind: 'note', note, created_by: user.id });
    return { ok: true };
  }
  if (action === 'hint') {
    const mailText = text(body?.mailText, 2000);
    must(mailText.length >= 20, 'Bitte den Text des Hinweises prüfen.');
    const deadline = String(body?.deadline ?? '');
    must(DATE.test(deadline) && deadline > todayKey(ctx.now()), 'Bitte eine Frist in der Zukunft angeben.');
    const owner = await profile(ctx.db, ownerId);
    const to = typeof body?.email === 'string' && EMAIL.test(body.email.trim()) ? body.email.trim() : owner?.email;
    must(to && EMAIL.test(to), 'Die E-Mail des Kunden fehlt.', 'conflict');
    const subject = `Ihre Stellen bei Matchunt: bitte bis ${dateDe(deadline)}`;
    const html = layout({ preheader: subject, heading: 'Ein Hinweis zu Ihren Stellen', body: mailText.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px 0;">${esc(p).replace(/\n/g, '<br>')}</p>`).join('') });
    const r = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to, replyTo: 'info@bluewater-bridge.de', subject, html, text: mailText }, { template: 'cooperation_hint', meta: { owner_id: ownerId, deadline } });
    must(r.sent, `Die Mail ging nicht raus${r.error ? `: ${r.error}` : ''}.`, 'upstream_error');
    await addEvent(ctx, { owner_id: ownerId, stage: 3, kind: 'hint', note: `An ${to} · ${subject}\n\n${mailText}`.slice(0, 2000), deadline, created_by: user.id });
    // Die Mail schreibt Matchunt selbst (Freitext, deutsch); die Glocke folgt der Sprache des Kunden
    await notify(ctx, ownerId, 'cooperation_hint', (l) => tx(l, subject, `Your roles at Matchunt: please by ${dateKeyIn(deadline, l)}`, `Dina tjänster hos Matchunt: senast ${dateKeyIn(deadline, l)}`, `Stillingene dine hos Matchunt: innen ${dateKeyIn(deadline, l)}`),
      (l) => tx(l, 'Wir haben Ihnen einen Hinweis mit Frist geschickt. Details in Ihrer Mail.', 'We have sent you a notice with a deadline. Details in your email.', 'Vi har skickat dig ett meddelande med en tidsfrist. Detaljer i ditt mejl.', 'Vi har sendt deg en melding med frist. Detaljer i e-posten din.'), 'cooperation', ownerId);
    return { ok: true, sentTo: to };
  }
  if (action === 'pause') {
    const chosen = pick().filter((j) => j.status === 'published' && !j.cooperation_paused_at);
    must(chosen.length, 'Die gewählten Stellen sind nicht offen.', 'conflict');
    for (const j of chosen) {
      const { error } = await ctx.db.from('jobs').update({ status: 'paused', paused_at: at, cooperation_paused_at: at }).eq('id', j.id);
      dbFail(error, 'Die Stelle');
      if (j.research_for_placement_id) await ctx.db.from('placements').update({ research_state: 'paused' }).eq('id', j.research_for_placement_id).eq('research_state', 'running');
      for (const r of await recruitersOf(ctx, j.id)) {
        await notify(ctx, r, 'job_paused', (l) => tx(l, m`Stelle ruht: ${j.title}`, m`Role paused: ${j.title}`, m`Tjänsten vilar: ${j.title}`, m`Stillingen står på pause: ${j.title}`),
          (l) => tx(l, 'Matchunt hat die Suche angehalten, bis der Kunde offene Rückmeldungen gegeben hat. Du musst gerade nicht weitersuchen.', 'Matchunt has paused the search until the client has given the open feedback. You don’t need to keep searching for now.', 'Matchunt har pausat sökningen tills kunden har gett den återkoppling som saknas. Du behöver inte söka vidare just nu.', 'Matchunt har satt søket på pause til kunden har gitt tilbakemeldingene som mangler. Du trenger ikke søke videre nå.'), 'job', j.id);
      }
      await notify(ctx, j.client_id, 'job_paused', (l) => tx(l, m`Ihre Stelle ${j.title} ruht`, m`Your role ${j.title} is paused`, m`Din tjänst ${j.title} vilar`, m`Stillingen din ${j.title} står på pause`),
        (l) => tx(l, 'Wir haben die Suche angehalten, bis Sie die offenen Rückmeldungen gegeben haben. Danach geht es sofort weiter.', 'We have paused the search until you have given the open feedback. Then it continues right away.', 'Vi har pausat sökningen tills du har gett den återkoppling som saknas. Sedan fortsätter den direkt.', 'Vi har satt søket på pause til du har gitt tilbakemeldingene som mangler. Deretter fortsetter det med en gang.'), 'job', j.id);
      await addEvent(ctx, { owner_id: ownerId, stage: 4, kind: 'pause', job_id: j.id, note, created_by: user.id });
    }
    return { ok: true, paused: chosen.length };
  }
  if (action === 'resume') {
    const chosen = pick().filter((j) => j.cooperation_paused_at);
    must(chosen.length, 'Die gewählten Stellen ruhen nicht.', 'conflict');
    for (const j of chosen) {
      const { error } = await ctx.db.from('jobs').update({ status: 'published', paused_at: null, cooperation_paused_at: null }).eq('id', j.id);
      dbFail(error, 'Die Stelle');
      if (j.research_for_placement_id) await ctx.db.from('placements').update({ research_state: 'running' }).eq('id', j.research_for_placement_id).eq('research_state', 'paused');
      for (const r of await recruitersOf(ctx, j.id)) {
        await notify(ctx, r, 'job_resumed', (l) => tx(l, m`Stelle läuft wieder: ${j.title}`, m`Role active again: ${j.title}`, m`Tjänsten är aktiv igen: ${j.title}`, m`Stillingen er aktiv igjen: ${j.title}`),
          (l) => tx(l, 'Der Kunde ist wieder dabei. Du kannst weitersuchen.', 'The client is back on board. You can keep searching.', 'Kunden är med igen. Du kan söka vidare.', 'Kunden er med igjen. Du kan søke videre.'), 'job', j.id);
      }
      await notify(ctx, j.client_id, 'job_resumed', (l) => tx(l, m`Ihre Stelle ${j.title} läuft wieder`, m`Your role ${j.title} is active again`, m`Din tjänst ${j.title} är aktiv igen`, m`Stillingen din ${j.title} er aktiv igjen`),
        (l) => tx(l, 'Danke für Ihre Rückmeldungen. Die Headhunter suchen weiter.', 'Thank you for your feedback. The headhunters are searching again.', 'Tack för din återkoppling. Headhuntrarna söker vidare.', 'Takk for tilbakemeldingene. Headhunterne søker videre.'), 'job', j.id);
      await addEvent(ctx, { owner_id: ownerId, stage: null, kind: 'resume', job_id: j.id, note, created_by: user.id });
    }
    return { ok: true, resumed: chosen.length };
  }
  if (action === 'end') {
    must(note, 'Bitte den Grund angeben. Er steht im Verlauf.');
    const chosen = pick().filter((j) => !['closed', 'filled'].includes(j.status));
    must(chosen.length, 'Die gewählten Stellen sind schon geschlossen.', 'conflict');
    for (const j of chosen) {
      if (j.research_for_placement_id) {
        const p = await loadPlacementRow(ctx, j.research_for_placement_id);
        await endResearch(ctx, user.id, p, 'matchunt_ended', note);
        await ctx.db.from('jobs').update({ cooperation_paused_at: null }).eq('id', j.id);
      } else {
        const { error } = await ctx.db.from('jobs').update({ status: 'closed', closed_reason: 'matchunt_ended', closed_at: at, closed_note: note, cooperation_paused_at: null }).eq('id', j.id);
        dbFail(error, 'Die Stelle');
        for (const r of await recruitersOf(ctx, j.id)) {
          await notify(ctx, r, 'job_closed', (l) => tx(l, m`Stelle beendet: ${j.title}`, m`Role ended: ${j.title}`, m`Tjänsten avslutad: ${j.title}`, m`Stillingen avsluttet: ${j.title}`),
            (l) => tx(l, 'Matchunt hat die Bearbeitung beendet. Deine Einreichungen dafür sind abgeschlossen.', 'Matchunt has ended work on this role. Your submissions for it are closed.', 'Matchunt har avslutat arbetet med tjänsten. Dina kandidater för den är avslutade.', 'Matchunt har avsluttet arbeidet med stillingen. Kandidatene dine til den er avsluttet.'), 'job', j.id);
        }
      }
      await notify(ctx, j.client_id, 'job_closed', (l) => tx(l, m`Bearbeitung beendet: ${j.title}`, m`Work ended: ${j.title}`, m`Arbetet avslutat: ${j.title}`, m`Arbeidet avsluttet: ${j.title}`),
        (l) => tx(l, 'Matchunt hat die Bearbeitung dieser Stelle beendet. Bei Fragen melden Sie sich gern.', 'Matchunt has ended work on this role. If you have any questions, just get in touch.', 'Matchunt har avslutat arbetet med den här tjänsten. Hör gärna av dig om du har frågor.', 'Matchunt har avsluttet arbeidet med denne stillingen. Ta gjerne kontakt hvis du har spørsmål.'), 'job', j.id);
      await addEvent(ctx, { owner_id: ownerId, stage: 5, kind: 'end', job_id: j.id, note, created_by: user.id });
    }
    return { ok: true, ended: chosen.length };
  }
  if (action === 'terminate') {
    must(note, 'Bitte den Grund notieren.');
    await addEvent(ctx, { owner_id: ownerId, stage: 5, kind: 'terminate', note, created_by: user.id });
    for (const a of await adminIds(ctx.db)) if (a !== user.id) await notify(ctx, a, 'cooperation_terminate', 'Vertrag kündigen (Vermerk)', note.slice(0, 200), 'cooperation', ownerId);
    return { ok: true, hint: 'Vermerkt. Die App kündigt nicht selbst: Die Kündigung geht in Textform an den Kunden (Rahmenvertrag § 20 Abs. 1), am besten nach Rücksprache mit dem Anwalt.' };
  }
  must(false, 'Unbekannte Aktion.');
}

export { dateDeShort };
