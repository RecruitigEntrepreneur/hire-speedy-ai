// Ablauftests der Interview-Terminierung v2 gegen eine In-Memory-Datenbank.
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fakeDb } from './fixtures/fake-db.ts';
import {
  availability, candidateRespond, clientLink, confirmAlternative, inviteColleague, loadCandidateView, requestContext, send, withdraw, type ServiceCtx,
} from '../functions/_shared/interview-service.ts';
import { withStatus, safeReturnPath } from '../functions/_shared/calendar-connect-service.ts';
import { encryptToken } from '../functions/_shared/encryption.ts';
import { berlinLocalToUtc } from '../functions/_shared/interview-time.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };

// Freitag, 2. Oktober 2026, 14:05 in Berlin
const NOW = berlinLocalToUtc(2026, 10, 2, 14, 5);
const at = (d: number, h: number, m = 0) => new Date(berlinLocalToUtc(2026, 10, d, h, m)).toISOString();
const KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const CLIENT = 'u-client-0000-0000-0000-000000000001';
const JULIA = 'u-julia-00000-0000-0000-000000000002';
const RECRUITER = 'u-recr-000000-0000-0000-000000000003';
const SUB = '11111111-1111-1111-1111-111111111111';

function seed() {
  return fakeDb({
    submissions: [{ id: SUB, stage: 'submitted', status: 'submitted', identity_unlocked: false, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j1' }],
    jobs: [{ id: 'j1', title: 'Data Scientist', company_name: 'Bluewater & Bridge GmbH', client_id: CLIENT, organization_id: 'org1', industry: 'Tech' }],
    candidates: [{ id: 'c1aaaa99', full_name: 'Katharina Brenner', email: 'kandidat@example.test', phone: '0170 111', job_title: 'Senior Data Scientist' }],
    organizations: [{ id: 'org1', owner_id: CLIENT, name: 'Bluewater & Bridge GmbH' }],
    organization_members: [{ organization_id: 'org1', user_id: JULIA, role: 'hiring_manager', status: 'active' }],
    profiles: [
      { user_id: CLIENT, full_name: 'Marko Benko', email: 'marko@example.test', role_title: 'HR-Leitung', phone: null },
      { user_id: JULIA, full_name: 'Julia Sommer', email: 'julia@example.test', role_title: 'Fachbereichsleitung', phone: null },
      { user_id: RECRUITER, full_name: 'Tim Weber', email: 'tim@example.test', role_title: null, phone: '0151 2345678' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }],
    job_collaborators: [],
  });
}

function ctxFor(db: any, mailsOut: (InterviewMail & { template: string })[], ms: ServiceCtx['ms'] = null): ServiceCtx {
  return {
    db, ms, now: () => NOW, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail, log) => { mailsOut.push({ ...mail, template: log.template }); return { sent: true, via: mail.ics ? 'smtp' : 'api' }; },
  };
}
const user = (id: string, email: string) => ({ id, email, user_metadata: {} }) as unknown as User;

// Kandidat c1aaaa99 statt c1: Submissions-Seed korrigieren
function fixCandidate(tables: any) { tables.submissions[0].candidate_id = 'c1aaaa99'; }

function linkToken(mails: { html: string; template: string }[]) {
  const html = mails.find((m) => m.template === 'interview_invitation_v2')!.html;
  return decodeURIComponent(html.match(/interview\/respond\/([A-Za-z0-9_-]{20,})/)![1]);
}

Deno.test({ name: 'Ablauf ohne Outlook: Anfrage → Kandidat bestätigt → Freigabe, Einladungen an alle', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');

  const context = await requestContext(ctx, me, SUB);
  eq(context.round, 1);
  eq(context.team.map((p: any) => p.name), ['Julia Sommer']);
  eq(context.calendar.state, 'not_configured');
  assert(context.candidateLabel.includes('PR-C1AAAA'), 'anonymes Label');

  const week = await availability(ctx, me, { submissionId: SUB, durationMinutes: 60, weekStart: '2026-10-05', attendees: [{ userId: JULIA, email: 'julia@example.test', name: 'Julia', required: true }] });
  eq(week.connected, false);
  eq(week.days.map((d: any) => d.label), ['Mo 5.10.', 'Di 6.10.', 'Mi 7.10.', 'Do 8.10.', 'Fr 9.10.']);
  assert(week.days[0].slots[0].start === at(5, 9));

  const result = await send(ctx, me, {
    submissionId: SUB, durationMinutes: 60, slots: [at(6, 10), at(8, 14), at(9, 9)], round: 1,
    attendees: [{ userId: JULIA, email: 'julia@example.test', name: 'Julia', required: true }],
    allowAlternative: true, alternativeRules: context.hours, message: 'Wir freuen uns.',
  });
  assert(result.candidateMailSent && result.recruiterMailSent);
  const invitation = sent.find((m) => m.template === 'interview_invitation_v2');
  assert(invitation.to === 'kandidat@example.test');
  assert(invitation.fromName === 'Tim Weber über Matchunt');
  assert(invitation.html.includes('Di, 6. Okt · 10:00–11:00'), 'deutsche Zeit in der Mail');
  assert(!invitation.html.includes('08:00'), 'keine UTC-Uhrzeit');
  assert(sent.some((m) => m.template === 'interview_requested_recruiter' && m.to === 'tim@example.test'));
  eq(tables.submissions[0].stage, 'interview_requested');
  eq(tables.interview_attendees.length, 2);
  assert(tables.interviews[0].response_token_hash && !tables.interviews[0].response_token, 'nur Hash gespeichert');
  assert(tables.notifications.some((n: any) => n.user_id === RECRUITER && n.related_type === 'interview'));

  const token = linkToken(sent);
  const view = await loadCandidateView(ctx, token);
  eq(view.state, 'open');
  eq(view.consentRequired, true);
  eq(view.interviewers.map((i: any) => i.name), ['Marko Benko', 'Julia Sommer']);
  eq(view.alternativeMode, 'request');
  assert(view.alternatives.length > 0 && !view.alternatives.some((d: any) => d.times.includes(at(6, 10))), 'Vorschläge nicht doppelt als Alternative');
  assert(!JSON.stringify(view).includes('julia@example.test'), 'keine Mailadressen der Kundenseite');

  let failed = false;
  try { await candidateRespond(ctx, { action: 'accept', token, slotStart: at(6, 10) }); } catch { failed = true; }
  assert(failed, 'ohne Einwilligung keine Buchung');

  sent.length = 0;
  const booked = await candidateRespond(ctx, { action: 'accept', token, slotStart: at(6, 10), consentGiven: true });
  eq(booked.state, 'scheduled');
  const iv = tables.interviews[0];
  eq(iv.status, 'scheduled');
  eq(iv.scheduled_at, at(6, 10));
  eq(iv.meeting_provider, 'none');
  const sub = tables.submissions[0];
  eq([sub.stage, sub.identity_unlocked, sub.consent_confirmed], ['interview_scheduled', true, true]);
  assert(sub.unlocked_at, 'Freigabe mit unlocked_at (nicht identity_unlocked_at)');
  const icsMails = sent.filter((m) => m.ics);
  eq(icsMails.map((m) => m.to).sort(), ['julia@example.test', 'kandidat@example.test', 'marko@example.test', 'tim@example.test'], 'jede Seite eigene Einladung');
  assert(icsMails.every((m) => (m.ics.content.match(/ATTENDEE/g) ?? []).length === 1), 'nur der eigene Teilnehmer');
  assert(icsMails[0].ics.content.includes('DTSTART:20261006T080000Z'));
  eq(tables.interview_invites.length, 4);

  failed = false;
  try { await candidateRespond(ctx, { action: 'decline', token }); } catch { failed = true; }
  assert(failed, 'zweite Antwort wird abgewiesen');
}});

Deno.test({ name: 'Andere Zeit ohne Outlook: Anfrage beim Kunden, Bestätigung per Mail-Link', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');
  await send(ctx, me, { submissionId: SUB, durationMinutes: 60, slots: [at(6, 10)], attendees: [], allowAlternative: true, alternativeRules: {}, round: 1 });
  const token = linkToken(sent);
  const view = await loadCandidateView(ctx, token);
  const pick = view.alternatives[1].times[0];
  sent.length = 0;
  const after = await candidateRespond(ctx, { action: 'alternative', token, start: pick, message: 'Nachmittags besser', consentGiven: true });
  eq(after.state, 'alternative_requested');
  eq(tables.interviews[0].status, 'counter_proposed');
  eq(tables.submissions[0].stage, 'interview_counter_proposed');
  const clientMail = sent.find((m) => m.template === 'interview_alternative_client');
  assert(clientMail && clientMail.to === 'marko@example.test', 'Kunde bekommt die Anfrage');
  assert(sent.some((m) => m.template === 'interview_alternative_candidate'), 'Kandidat bekommt Eingangsbestätigung');
  const clientToken = decodeURIComponent(clientMail.html.match(/interview\/bestaetigen\/([A-Za-z0-9_-]{20,})/)[1]);
  const peek = await clientLink(ctx, { action: 'peek', token: clientToken });
  eq(peek.state, 'open');
  eq(peek.requestedStart, pick);
  const confirmed = await clientLink(ctx, { action: 'confirm', token: clientToken });
  eq(confirmed.state, 'confirmed');
  eq(tables.interviews[0].scheduled_at, pick);
  eq(tables.submissions[0].identity_unlocked, true, 'Einwilligung aus der Anfrage greift bei der Bestätigung');
  const again = await clientLink(ctx, { action: 'peek', token: clientToken });
  eq(again.state, 'gone', 'Link nur einmal verwendbar');
}});

Deno.test({ name: 'Ablehnen und Zurückziehen', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');
  await send(ctx, me, { submissionId: SUB, durationMinutes: 45, slots: [at(6, 10)], attendees: [], allowAlternative: false, alternativeRules: {}, round: 1 });
  const token = linkToken(sent);
  const declined = await candidateRespond(ctx, { action: 'decline', token, reason: 'Anderes Angebot' });
  eq(declined.state, 'declined');
  eq(tables.submissions[0].stage, 'interview_declined');
  assert(sent.some((m) => m.template === 'interview_declined_client' && m.html.includes('Anderes Angebot')));
  assert(!sent.find((m) => m.template === 'interview_declined_client').html.includes('Katharina'), 'Identität bleibt geschützt');

  const second = seed(); fixCandidate(second.tables);
  const sent2: any[] = [];
  const ctx2 = ctxFor(second.db, sent2);
  const r = await send(ctx2, me, { submissionId: SUB, durationMinutes: 60, slots: [at(6, 10)], attendees: [], allowAlternative: true, alternativeRules: {}, round: 1 });
  await withdraw(ctx2, me, r.interviewId, 'Stelle intern besetzt');
  eq(second.tables.interviews[0].status, 'cancelled');
  assert(sent2.some((m) => m.template === 'interview_withdrawn_candidate'));
  const view = await loadCandidateView(ctx2, linkToken(sent2));
  eq(view.state, 'cancelled');
}});

Deno.test({ name: 'Neue Termine ersetzen die offene Anfrage, alter Link ist danach tot', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');
  await send(ctx, me, { submissionId: SUB, durationMinutes: 60, slots: [at(6, 10)], attendees: [], allowAlternative: true, alternativeRules: {}, round: 1 });
  const oldToken = linkToken(sent);
  sent.length = 0;
  const ctxContext = await requestContext(ctx, me, SUB);
  assert(ctxContext.openRequest, 'offene Anfrage wird erkannt');
  await send(ctx, me, { submissionId: SUB, durationMinutes: 60, slots: [at(7, 15)], attendees: [], allowAlternative: true, alternativeRules: {}, round: 1, replacesInterviewId: ctxContext.openRequest!.interviewId });
  eq(tables.interviews[0].status, 'cancelled');
  eq(tables.interviews[0].superseded_by, tables.interviews[1].id);
  eq((await loadCandidateView(ctx, oldToken)).state, 'cancelled');
  eq((await loadCandidateView(ctx, linkToken(sent))).state, 'open');
}});

Deno.test({ name: 'Ohne Berechtigung (fremder Nutzer) keine Anfrage', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const ctx = ctxFor(db, []);
  let reason = '';
  try { await requestContext(ctx, user('u-fremd-0000', 'x@y.de'), SUB); } catch (e: any) { reason = e.reason; }
  eq(reason, 'not_allowed');
}});

Deno.test({ name: 'Mit Outlook: Kollegen-Belegung, sofort gebuchte andere Zeit, Termin im Kundenkalender', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const ms = { clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://x/cb', encryptionKey: KEY };
  tables.calendar_connections = [{
    id: 'conn1', user_id: CLIENT, provider: 'microsoft', status: 'connected', account_email: 'marko@example.test',
    access_token_encrypted: await encryptToken('ACCESS', KEY), refresh_token_encrypted: await encryptToken('REFRESH', KEY),
    // Ablauf gegen die echte Uhr (userAccessToken nutzt Date.now)
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
  }];
  const graphCalls: { url: string; body: any }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(init.body) : null;
    graphCalls.push({ url, body });
    if (url.endsWith('/me/calendar/getSchedule')) {
      return new Response(JSON.stringify({ value: [
        { scheduleId: 'marko@example.test', scheduleItems: [{ status: 'busy', start: { dateTime: at(5, 9).replace('Z', '') }, end: { dateTime: at(5, 10).replace('Z', '') } }] },
        { scheduleId: 'julia@example.test', scheduleItems: [{ status: 'busy', start: { dateTime: at(5, 14).replace('Z', '') }, end: { dateTime: at(5, 15).replace('Z', '') } }] },
      ] }), { status: 200 });
    }
    if (url.endsWith('/me/events')) {
      return new Response(JSON.stringify({ id: 'evt-1', onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' } }), { status: 201 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  try {
    const sent: any[] = [];
    const ctx = ctxFor(db, sent, ms);
    const me = user(CLIENT, 'marko@example.test');
    const context = await requestContext(ctx, me, SUB);
    eq(context.calendar.state, 'connected');
    const week = await availability(ctx, me, { submissionId: SUB, durationMinutes: 60, weekStart: '2026-10-05', attendees: [{ userId: JULIA, email: 'julia@example.test', name: 'Julia', required: false }] });
    eq(week.connected, true);
    const mon = week.days[0].slots;
    eq(mon.find((s: any) => s.start === at(5, 9))!.status, 'busy', 'eigener Termin aus Outlook');
    eq(mon.find((s: any) => s.start === at(5, 14))!.status, 'required', 'optionale Kollegin belegt → gelb');
    eq(mon.find((s: any) => s.start === at(5, 14))!.missing, ['Julia Sommer']);

    await send(ctx, me, { submissionId: SUB, durationMinutes: 60, slots: [at(6, 10)], attendees: [{ userId: JULIA, email: 'julia@example.test', required: true }], allowAlternative: true, alternativeRules: {}, round: 1 });
    const token = linkToken(sent);
    const view = await loadCandidateView(ctx, token);
    eq(view.alternativeMode, 'book');
    sent.length = 0;
    const pick = view.alternatives.find((d: any) => d.date === '2026-10-07')!.times[0];
    const booked = await candidateRespond(ctx, { action: 'alternative', token, start: pick, consentGiven: true });
    eq(booked.state, 'scheduled', 'sofort gebucht');
    const iv = tables.interviews[0];
    eq([iv.meeting_provider, iv.outlook_event_id, iv.teams_join_url], ['client_calendar', 'evt-1', 'https://teams.microsoft.com/l/meetup-join/abc']);
    const event = graphCalls.find((c) => c.url.endsWith('/me/events'))!.body;
    eq(event.attendees.map((a: any) => a.emailAddress.address), ['julia@example.test'], 'nur Kollegen im Outlook-Termin, kein Kandidat');
    eq(event.isOnlineMeeting, true);
    assert(!sent.some((m) => m.ics && m.to === 'julia@example.test'), 'Kollegin bekommt die Einladung aus Outlook, nicht von Matchunt');
    assert(sent.some((m) => m.ics && m.to === 'kandidat@example.test' && m.ics.content.includes('teams.microsoft.com')), 'Kandidat bekommt Einladung mit Teams-Link');
    assert(sent.some((m) => m.template === 'interview_booked_client' && !m.ics && m.to === 'marko@example.test'), 'Organisator: Info-Mail, Termin steht schon in Outlook');
  } finally {
    globalThis.fetch = realFetch;
  }
}});

Deno.test('Rücksprung-Pfade bleiben intern und behalten den Anker', () => {
  eq(safeReturnPath('https://evil.test'), '/dashboard/settings#kalender');
  eq(safeReturnPath('//evil.test'), '/dashboard/settings#kalender');
  eq(safeReturnPath('/dashboard'), '/dashboard');
  eq(withStatus('https://matchunt.ai', '/dashboard/settings#kalender', 'verbunden'), 'https://matchunt.ai/dashboard/settings?kalender=verbunden#kalender');
});

void confirmAlternative;

Deno.test({ name: 'Telefon: Nummer wird beim Bestätigen verlangt, Einladung ohne Teams-Link mit Rückruf-Hinweis', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  tables.candidates[0].phone = null;
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');
  await send(ctx, me, { submissionId: SUB, meetingFormat: 'phone', durationMinutes: 30, slots: [at(6, 10)], attendees: [], allowAlternative: false, alternativeRules: {}, round: 1 });
  assert(sent[0].html.includes('am Telefon, Bluewater &amp; Bridge GmbH ruft Sie an'), 'Einladung nennt Telefon');
  const token = linkToken(sent);
  const view = await loadCandidateView(ctx, token);
  eq(view.format, 'phone');
  eq(view.phoneOnFile, null);
  let message = '';
  try { await candidateRespond(ctx, { action: 'accept', token, slotStart: at(6, 10), consentGiven: true }); } catch (e: any) { message = e.message; }
  assert(message.includes('Nummer'), 'ohne Nummer keine Buchung');
  sent.length = 0;
  await candidateRespond(ctx, { action: 'accept', token, slotStart: at(6, 10), consentGiven: true, phone: '+49 170 1234567' });
  eq(tables.interviews[0].call_phone, '+49 170 1234567');
  eq(tables.interviews[0].meeting_provider, 'none');
  const clientMail = sent.find((m) => m.template === 'interview_booked_client');
  assert(clientMail.html.includes('Bitte rufen Sie Katharina Brenner an') && clientMail.html.includes('+49 170 1234567'), 'Kunde bekommt die Nummer');
  assert(clientMail.ics.content.includes('LOCATION:Telefon: Bluewater & Bridge GmbH ruft an'), 'Ort in der Einladung');
  assert(!sent.some((m) => m.ics?.content.includes('teams.microsoft.com')), 'kein Teams-Link');
}});

Deno.test({ name: 'Vor Ort: Adresse ist Pflicht und steht in Einladung, Mail und Kalender', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');
  let message = '';
  try { await send(ctx, me, { submissionId: SUB, meetingFormat: 'onsite', durationMinutes: 60, slots: [at(6, 10)], attendees: [], allowAlternative: false, alternativeRules: {}, round: 1 }); } catch (e: any) { message = e.message; }
  assert(message.includes('Adresse'), 'ohne Adresse kein Senden');
  await send(ctx, me, { submissionId: SUB, meetingFormat: 'onsite', onsiteAddress: 'Bluewater & Bridge GmbH\nAdlzreiterstraße 2\n80337 München', locationNote: 'Bitte am Empfang melden', durationMinutes: 60, slots: [at(6, 10)], attendees: [], allowAlternative: false, alternativeRules: {}, round: 1 });
  assert(sent[0].html.includes('Adlzreiterstraße 2') && sent[0].html.includes('Karte öffnen'), 'Adresse in der Einladung');
  const token = linkToken(sent);
  const view = await loadCandidateView(ctx, token);
  eq(view.format, 'onsite');
  assert(view.onsite?.mapsUrl.includes('google.com/maps'));
  sent.length = 0;
  await candidateRespond(ctx, { action: 'accept', token, slotStart: at(6, 10), consentGiven: true });
  const candidateMail = sent.find((m) => m.template === 'interview_booked_candidate');
  assert(candidateMail.ics.content.includes('LOCATION:Bluewater & Bridge GmbH\\, Adlzreiterstraße 2\\, 80337 München'), 'Ort mit Adresse');
  assert(candidateMail.html.includes('Anfahrt in Karte öffnen'));
}});

Deno.test({ name: 'Kollegen einladen: Firmenkonto wird angelegt, Stelle angehängt, Einladung mit Funktion', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  tables.jobs[0].organization_id = null;
  tables.organizations = [];
  tables.organization_members = [];
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const me = user(CLIENT, 'marko@example.test');
  const r = await inviteColleague(ctx, me, { submissionId: SUB, name: 'Leon Benko', email: 'Leon@Example.test', functionKey: 'geschaeftsfuehrung', access: 'all', decisionMaker: true });
  eq(r.emailSent, true);
  eq([r.attendee.email, r.attendee.title, r.attendee.decisionMaker, r.attendee.invited], ['leon@example.test', 'Geschäftsführung', true, true]);
  eq(tables.organizations.length, 1, 'Firmenkonto angelegt');
  eq(tables.jobs[0].organization_id, tables.organizations[0].id, 'Stelle hängt am Firmenkonto');
  const invite = tables.organization_invites[0];
  eq([invite.role, invite.job_ids, invite.email], ['admin', [], 'leon@example.test']);
  const mail = sent.find((m) => m.template === 'team_invite_interview');
  assert(mail.html.includes('Geschäftsführung') && mail.html.includes('/invite/'), 'Mail mit Funktion und Annahme-Link');
  const again = await inviteColleague(ctx, me, { submissionId: SUB, name: 'Leon Benko', email: 'leon@example.test', functionKey: 'fachbereich' });
  assert(again.note?.includes('bereits eingeladen'), 'keine doppelte Einladung');

  const viewer = seed(); fixCandidate(viewer.tables);
  viewer.tables.organization_members.push({ organization_id: 'org1', user_id: 'u-hm', role: 'hiring_manager', status: 'active' });
  viewer.tables.job_collaborators.push({ job_id: 'j1', user_id: 'u-hm' });
  let reason = '';
  try { await inviteColleague(ctxFor(viewer.db, []), user('u-hm', 'hm@example.test'), { submissionId: SUB, name: 'X Y', email: 'x@y.de' }); } catch (e: any) { reason = e.message; }
  assert(reason.includes('Marko Benko'), 'Nicht-Admin bekommt den Namen der Admins');
}});

Deno.test({ name: 'Mit Outlook: Login-Adresse ≠ Outlook-Adresse, Puffer des Kunden gilt auch für Outlook-Termine', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(); fixCandidate(tables);
  const ms = { clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://x/cb', encryptionKey: KEY };
  // Login bei Matchunt mit privater Adresse, Outlook in der Firma
  tables.calendar_connections = [{
    id: 'conn1', user_id: CLIENT, provider: 'microsoft', status: 'connected', account_email: 'Marko.Benko@Bluewater-Bridge.de',
    access_token_encrypted: await encryptToken('ACCESS', KEY), refresh_token_encrypted: await encryptToken('REFRESH', KEY),
    // Ablauf gegen die echte Uhr (userAccessToken nutzt Date.now)
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
  }];
  const asked: string[][] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    if (!String(input).endsWith('/me/calendar/getSchedule')) return new Response('{}', { status: 404 });
    const schedules: string[] = JSON.parse(init.body).schedules;
    asked.push(schedules);
    // Wie Graph: nur Adressen aus dem eigenen Mandanten haben einen Kalender
    return new Response(JSON.stringify({ value: schedules.map((id) => id === 'marko.benko@bluewater-bridge.de'
      ? { scheduleId: id, scheduleItems: [
        { status: 'busy', start: { dateTime: at(5, 9).replace('Z', '') }, end: { dateTime: at(5, 10, 30).replace('Z', '') } },
        { status: 'busy', start: { dateTime: at(5, 14).replace('Z', '') }, end: { dateTime: at(5, 15).replace('Z', '') } },
      ] }
      : { scheduleId: id, error: { message: 'not found' } }) }), { status: 200 });
  }) as typeof fetch;
  try {
    const ctx = ctxFor(db, [], ms);
    const me = user(CLIENT, 'marko@example.test');
    const status = (week: any, d: number, h: number) => week.days.flatMap((x: any) => x.slots).find((s: any) => s.start === at(d, h))?.status;

    const week = await availability(ctx, me, { submissionId: SUB, durationMinutes: 60, weekStart: '2026-10-05', attendees: [] });
    eq(asked[0], ['marko.benko@bluewater-bridge.de'], 'Outlook-Adresse statt Login-Adresse');
    eq(week.selfVisible, true);
    eq([status(week, 5, 9), status(week, 5, 10), status(week, 5, 11)], ['busy', 'busy', 'all'], 'Termin 9:00–10:30');
    eq([status(week, 5, 14), status(week, 5, 15)], ['busy', 'all'], 'ohne Puffer direkt im Anschluss frei');

    tables.client_interview_hours = [{ user_id: CLIENT, rules: { bufferMinutes: 15 } }];
    const buffered = await availability(ctx, me, { submissionId: SUB, durationMinutes: 60, weekStart: '2026-10-05', attendees: [] });
    eq(status(buffered, 5, 15), 'busy', '15 Min. Puffer nach dem Outlook-Termin');
    eq(status(buffered, 5, 11), 'all', '10:30 + 15 Min. < 11:00');

    // Verbunden, aber Outlook liefert den eigenen Kalender nicht: ungeprüft statt still frei
    tables.calendar_connections[0].account_email = 'jemand@anderer-mandant.de';
    const blind = await availability(ctx, me, { submissionId: SUB, durationMinutes: 60, weekStart: '2026-10-05', attendees: [] });
    eq(blind.connected, true);
    eq(blind.selfVisible, false);
  } finally {
    globalThis.fetch = realFetch;
  }
}});
