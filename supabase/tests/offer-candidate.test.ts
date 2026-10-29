// Ablauftests: Angebot schriftlich an den Kandidaten, Zusage nur vom Kandidaten (G + H, 25.10.2026).
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fakeDb } from './fixtures/fake-db.ts';
import { tokenFrom } from './fixtures/offer-accept.ts';
import type { ServiceCtx } from '../functions/_shared/interview-service.ts';
import { acceptCounter, createOffer, offerContext, respondOffer, withdrawOffer } from '../functions/_shared/offer-service.ts';
import { candidateAnswer, candidatePeek, deliveryTime, outsideQuietHours, recruiterCallbackDone, recruiterTalked } from '../functions/_shared/offer-candidate.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };
const fails = async (p: Promise<unknown>, text: string) => {
  let message = '';
  try { await p; } catch (e: any) { message = e.message; }
  assert(message.includes(text), `erwartet Fehler „${text}“, war „${message}“`);
};

// Donnerstag, 22.10.2026, 14:00 Uhr deutscher Zeit
const NOW = Date.parse('2026-10-22T12:00:00Z');
const CLIENT = 'u-client-0000-0000-0000-000000000001';
const RECRUITER = 'u-recr-000000-0000-0000-000000000003';
const ADMIN = 'u-admin-00000-0000-0000-000000000007';
const SUB = '11111111-1111-1111-1111-111111111111';
const OFFER = { salary: 140000, variable: 20000, startDate: '2027-02-01', responseDue: '2026-10-30', contractType: 'permanent', probationMonths: 6, workModel: 'Hybrid · 2 Tage Homeoffice', extras: ['Dienstwagen'], message: 'Für Julia: Start flexibel.', candidateMessage: 'Wir freuen uns sehr auf Sie.' };

function world() {
  const { db, tables } = fakeDb({
    submissions: [{ id: SUB, stage: 'interview_completed', status: 'interview', identity_unlocked: true, company_revealed: true, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j1' }],
    jobs: [{ id: 'j1', title: 'Head of Sales DACH (m/w/d)', company_name: 'MedTec Süd GmbH', industry: 'Medizintechnik', client_id: CLIENT, organization_id: null, salary_min: 130000, salary_max: 160000, location: 'München', remote_type: 'hybrid', onsite_days_required: 3, benefits: [], fee_percentage: 20, mandate_id: null }],
    candidates: [{ id: 'c1', full_name: 'Tessa Testfall', email: 'tessa@example.test' }],
    profiles: [
      { user_id: CLIENT, full_name: 'Klara Kunde', email: 'klara@example.test' },
      { user_id: RECRUITER, full_name: 'Julia Hartmann', email: 'julia@example.test', phone: '0151 123' },
      { user_id: ADMIN, full_name: 'Marko Admin', email: 'admin@example.test' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }, { user_id: RECRUITER, role: 'recruiter' }, { user_id: ADMIN, role: 'admin' }],
    interviews: [], offers: [], offer_events: [], offer_recommendations: [], notifications: [], interview_nachgespraeche: [],
    offer_candidate_links: [], employment_contracts: [],
  });
  const sent: any[] = [];
  const cancelled: string[] = [];
  const clock = { now: NOW };
  let n = 0;
  const ctx: ServiceCtx = {
    db, ms: null, now: () => clock.now, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail, log) => { n += 1; sent.push({ ...mail, template: log.template, id: `m${n}` }); return { sent: true, id: `m${n}` }; },
    mailCancel: async (id) => { cancelled.push(id); return true; },
  };
  return { db, tables, sent, cancelled, clock, ctx };
}
const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const toTessa = (w: ReturnType<typeof world>) => w.sent.filter((m) => m.to === 'tessa@example.test');
const notes = (w: ReturnType<typeof world>, uid: string, type: string) => w.tables.notifications.filter((x: any) => x.user_id === uid && x.type === type);

Deno.test('Ruhezeit: 2 Stunden, zwischen 20 und 8 Uhr erst um 8 Uhr', () => {
  eq(new Date(deliveryTime(NOW)).toISOString(), '2026-10-22T14:00:00.000Z', '14:00 → 16:00');
  eq(new Date(deliveryTime(Date.parse('2026-10-22T17:00:00Z'))).toISOString(), '2026-10-23T06:00:00.000Z', '19:00 → 21:00 → morgen 08:00');
  eq(new Date(deliveryTime(Date.parse('2026-10-22T04:30:00Z'))).toISOString(), '2026-10-22T06:30:00.000Z', '06:30 → 08:30');
  eq(new Date(outsideQuietHours(Date.parse('2026-10-21T23:30:00Z'))).toISOString(), '2026-10-22T06:00:00.000Z', '01:30 → 08:00');
  // Winterzeit ab 25.10.: 08:00 Uhr = 07:00 UTC
  eq(new Date(outsideQuietHours(Date.parse('2026-10-26T20:00:00Z'))).toISOString(), '2026-10-27T07:00:00.000Z', 'nach der Zeitumstellung');
});

Deno.test({ name: 'Angebot: Mail an den Kandidaten in 2 Std., „Gespräch geführt“ schickt sie sofort, Erinnerung rückt nach', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const o = w.tables.offers[0];
  eq([o.candidate_message, o.message_to_recruiter], ['Wir freuen uns sehr auf Sie.', 'Für Julia: Start flexibel.'], 'Nachricht an Tessa getrennt von der an Julia');
  eq(toTessa(w).map((m) => [m.template, m.scheduledAt, m.fromName]), [
    ['offer_candidate_offer', '2026-10-22T14:00:00.000Z', 'Julia Hartmann über Matchunt'],
    ['offer_candidate_reminder', '2026-10-23T14:00:00.000Z', 'Julia Hartmann über Matchunt'],
  ]);
  assert(toTessa(w)[0].html.includes('Wir freuen uns sehr auf Sie.') && !toTessa(w)[0].html.includes('Start flexibel'), 'Tessa sieht nur ihre Nachricht');
  eq([o.candidate_mail_id, o.candidate_reminder_mail_id, o.candidate_mail_sent_at], ['m2', 'm3', null]);
  const ctx = await offerContext(w.ctx, user(CLIENT), { submissionId: SUB });
  eq([ctx.currentOffer?.candidate.mailSent, ctx.currentOffer?.candidate.mailDueAt], [false, '2026-10-22T14:00:00.000Z']);

  await fails(recruiterTalked(w.ctx, user(CLIENT), { offerId: o.id }), 'Nur der Headhunter');
  w.clock.now = NOW + 20 * 60_000; // 14:20 Uhr
  const r = await recruiterTalked(w.ctx, user(RECRUITER), { offerId: o.id });
  eq(r.alreadySent, false);
  eq(w.cancelled, ['m2', 'm3'], 'geplante Mail und Erinnerung abgebrochen');
  const now = toTessa(w).slice(-2);
  eq(now.map((m) => [m.template, m.scheduledAt ?? null]), [['offer_candidate_offer', null], ['offer_candidate_reminder', '2026-10-23T12:20:00.000Z']], 'sofort, Erinnerung 24 Std. später');
  assert(w.tables.offers[0].candidate_mail_sent_at && w.tables.offers[0].recruiter_talked_at, 'Mail gilt als verschickt');
  eq(w.tables.offer_candidate_links.filter((l: any) => !l.revoked_at).length, 1, 'nur der neue Link gilt');
  eq((await recruiterTalked(w.ctx, user(RECRUITER), { offerId: o.id })).alreadySent, true, 'zweiter Klick schickt nichts doppelt');
}});

Deno.test({ name: 'Antwortseite: Zusage gilt sofort, Vertrag beginnt, Kunde erfährt es mit „selbst“', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const token = tokenFrom(w.sent, 'offer_candidate_offer');
  const page = await candidatePeek(w.ctx, { token });
  eq([page.state, page.purpose, page.companyName, page.offer.salary, page.message, page.recruiter?.phone], ['open', 'answer', 'MedTec Süd GmbH', 140000, 'Wir freuen uns sehr auf Sie.', '0151 123']);
  assert(w.tables.offer_candidate_links[0].opened_at, 'Link geöffnet');
  await fails(candidatePeek(w.ctx, { token: 'x'.repeat(30) }), 'ungültig');

  w.sent.length = 0;
  const r = await candidateAnswer(w.ctx, { token, way: 'accepted' });
  eq([r.answer, w.tables.offers[0].status, w.tables.employment_contracts.length], ['accepted', 'accepted', 1]);
  assert(w.tables.offers[0].candidate_confirmed_at, 'Zusage bestätigt');
  const mail = w.sent.find((m) => m.template === 'offer_answer_accepted');
  assert(mail?.to === 'klara@example.test' && mail.html.includes('selbst auf Ihr Angebot geantwortet'), 'Kunde erfährt: selbst geantwortet');
  assert(notes(w, RECRUITER, 'offer_answer').some((x: any) => x.title.includes('zugesagt')), 'Julia erfährt es');
  eq(w.cancelled, ['m3'], 'Erinnerung abgebrochen');
  await fails(candidateAnswer(w.ctx, { token, way: 'declined', reasonCategory: 'salary' }), 'schon geantwortet');
  eq((await candidatePeek(w.ctx, { token })).state, 'answered');
}});

Deno.test({ name: 'Antwortseite: Absage nur mit Grund; Rückruf geht an den Headhunter mit 2-Stunden-Frist', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const token = tokenFrom(w.sent, 'offer_candidate_offer');
  const cb = await candidateAnswer(w.ctx, { token, way: 'callback', topic: 'Startdatum, Homeoffice' });
  eq([cb.state, w.tables.offers[0].status, w.tables.offers[0].callback_topic], ['callback', 'with_recruiter', 'Startdatum, Homeoffice']);
  assert(notes(w, RECRUITER, 'offer_callback')[0]?.message.includes('16:00 Uhr'), 'Rückruf bis 16:00 Uhr');
  // nachts: Rückruf-Frist erst ab 8 Uhr
  w.clock.now = Date.parse('2026-10-22T20:30:00Z'); // 22:30 Uhr
  await candidateAnswer(w.ctx, { token, way: 'callback', topic: 'noch eine Frage' });
  assert(notes(w, RECRUITER, 'offer_callback').some((x: any) => x.message.includes('08:00 Uhr')), 'nachts bis 08:00 Uhr');
  w.clock.now = NOW;
  assert(w.sent.some((m) => m.template === 'offer_callback_recruiter' && m.to === 'julia@example.test'), 'Mail an Julia');
  const view = await offerContext(w.ctx, user(CLIENT), { submissionId: SUB });
  eq(view.currentOffer?.candidate.callbackTopic, 'noch eine Frage', 'Kunde sieht „spricht mit Julia“, das neueste Thema');
  eq((await candidatePeek(w.ctx, { token })).state, 'open', 'Seite bleibt offen');

  await fails(candidateAnswer(w.ctx, { token, way: 'declined' }), 'Grund');
  await candidateAnswer(w.ctx, { token, way: 'declined', reasonCategory: 'counter_offer', note: 'Mein Arbeitgeber legt nach.' });
  eq([w.tables.offers[0].status, w.tables.offers[0].rejection_reason], ['declined', 'Gegenangebot des Arbeitgebers: Mein Arbeitgeber legt nach.']);
  assert(w.sent.some((m) => m.template === 'offer_answer_declined' && m.html.includes('Mein Arbeitgeber legt nach.')), 'Kunde bekommt den Grund');
  eq(w.tables.employment_contracts.length, 0);
}});

Deno.test({ name: 'Rückruf: Frist im Stand, „nicht erreicht“ nur notiert, „bleibt beim Angebot“ und Gegenwunsch schließen ihn', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const id = w.tables.offers[0].id;
  await fails(recruiterCallbackDone(w.ctx, user(RECRUITER), { offerId: id, outcome: 'stays' }), 'kein offener Rückrufwunsch');
  const token = tokenFrom(w.sent, 'offer_candidate_offer');
  await candidateAnswer(w.ctx, { token, way: 'callback', topic: 'Startdatum' });
  const ctxOf = async () => (await offerContext(w.ctx, user(CLIENT), { submissionId: SUB })).currentOffer!.candidate;
  eq((await ctxOf()).callbackDueAt, '2026-10-22T14:00:00.000Z', 'Rückruf bis 16:00 Uhr Berlin');
  await fails(recruiterCallbackDone(w.ctx, user(CLIENT), { offerId: id, outcome: 'stays' }), '');
  await recruiterCallbackDone(w.ctx, user(RECRUITER), { offerId: id, outcome: 'unreachable' });
  eq([w.tables.offers[0].callback_done_at ?? null, (await ctxOf()).callbackTopic], [null, 'Startdatum'], 'Aufgabe bleibt');
  await recruiterCallbackDone(w.ctx, user(RECRUITER), { offerId: id, outcome: 'stays' });
  const c = await ctxOf();
  eq([c.callbackAt, c.callbackDueAt], [null, null], 'Rückruf erledigt');
  eq(w.tables.offer_events.filter((e: any) => e.offer_id === id && e.event_type.startsWith('callback_')).map((e: any) => e.event_type), ['callback_requested', 'callback_unreachable', 'callback_done']);
  eq((await candidatePeek(w.ctx, { token })).state, 'open', 'Tessa antwortet selbst');

  // erneuter Wunsch, dann Gegenwunsch: schließt den Rückruf
  await candidateAnswer(w.ctx, { token, way: 'callback', topic: 'Gehalt' });
  await respondOffer(w.ctx, user(RECRUITER), { offerId: id, way: 'countered', wishSalary: 150000, candidateAgrees: true });
  eq([w.tables.offers[0].status, (await ctxOf()).callbackAt], ['countered', null]);
}});

Deno.test({ name: 'Ältere Angebote „überlegt noch“: Headhunter kann noch Zusage melden', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  w.tables.offers[0].status = 'considering';
  const r = await respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'accepted' });
  eq([r.awaitingConfirmation, w.tables.offers[0].status], [true, 'accept_reported']);
}});

Deno.test({ name: 'Gemeldete Zusage zählt erst nach Bestätigung; „stimmt so nicht“ öffnet das Angebot wieder', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  await fails(respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'considering', until: '2026-10-29' }), 'gibt es nicht mehr');
  const r = await respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'accepted', note: 'am Telefon' });
  eq([r.awaitingConfirmation, w.tables.offers[0].status, w.tables.employment_contracts.length], [true, 'accept_reported', 0]);
  eq(w.cancelled, ['m2', 'm3'], 'geplante Angebotsmail nicht mehr nötig');
  assert(notes(w, CLIENT, 'offer_accept_reported').length === 1, 'Kunde sieht „bestätigt noch“');
  const confirm = tokenFrom(w.sent, 'offer_candidate_confirm');
  assert(toTessa(w).some((m) => m.template === 'offer_candidate_confirm_reminder' && m.scheduledAt === '2026-10-23T12:00:00.000Z'), 'Erinnerung nach 24 Std.');
  eq((await candidatePeek(w.ctx, { token: confirm })).state, 'confirm');
  await fails(candidateAnswer(w.ctx, { token: confirm, way: 'accepted' }), 'bestätigen');

  await candidateAnswer(w.ctx, { token: confirm, way: 'not_confirmed' });
  eq([w.tables.offers[0].status, w.tables.offers[0].accept_reported_at, w.tables.employment_contracts.length], ['with_recruiter', null, 0]);
  assert(notes(w, ADMIN, 'offer_not_confirmed').length === 1 && notes(w, RECRUITER, 'offer_not_confirmed').length === 1, 'Matchunt und Julia erfahren es');

  await respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'accepted' });
  await candidateAnswer(w.ctx, { token: tokenFrom(w.sent, 'offer_candidate_confirm'), way: 'confirmed' });
  eq([w.tables.offers[0].status, w.tables.employment_contracts.length], ['accepted', 1]);
  assert(notes(w, RECRUITER, 'offer_confirmed').length === 1, 'Julia erfährt die Bestätigung');
}});

Deno.test({ name: 'Gegenwunsch nur mit Haken; angenommener Wunsch geht als Version 2 sofort an den Kandidaten', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const v1Token = tokenFrom(w.sent, 'offer_candidate_offer');
  await fails(respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'countered', wishSalary: 150000 }), 'sagt bei diesen Werten zu');
  await respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'countered', wishSalary: 150000, wishStart: '2027-03-01', reason: 'Kündigungsfrist', candidateAgrees: true });
  eq([w.tables.offers[0].status, w.tables.offers[0].candidate_mail_due_at], ['countered', null], 'noch nicht verschickte Mail zurückgehalten');
  eq(w.cancelled, ['m2', 'm3']);
  w.sent.length = 0;
  await acceptCounter(w.ctx, user(CLIENT), { offerId: w.tables.offers[0].id });
  const v2 = w.tables.offers[1];
  eq([v2.version, v2.salary_offered, v2.candidate_message], [2, 150000, 'Wir freuen uns sehr auf Sie.']);
  const mail = toTessa(w).find((m) => m.template === 'offer_candidate_offer');
  assert(mail && !mail.scheduledAt && mail.html.includes('Version 2') && mail.html.includes('150.000 €'), 'Version 2 sofort an Tessa');
  eq((await candidatePeek(w.ctx, { token: v1Token })).state, 'closed', 'Link zu Version 1 gilt nicht mehr');
  await candidateAnswer(w.ctx, { token: tokenFrom(w.sent, 'offer_candidate_offer'), way: 'accepted' });
  eq(w.tables.offers[1].status, 'accepted');
}});

Deno.test({ name: 'Zurückgezogen oder Frist abgelaufen: Seite geschlossen, geplante Mails abgebrochen', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const token = tokenFrom(w.sent, 'offer_candidate_offer');
  await withdrawOffer(w.ctx, user(CLIENT), { offerId: w.tables.offers[0].id });
  eq(w.cancelled, ['m2', 'm3']);
  const page = await candidatePeek(w.ctx, { token });
  eq([page.state, page.withdrawn], ['closed', true]);
  await fails(candidateAnswer(w.ctx, { token, way: 'accepted' }), 'nicht mehr antworten');

  const w2 = world();
  await createOffer(w2.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  w2.clock.now = Date.parse('2026-10-31T10:00:00Z');
  const t2 = tokenFrom(w2.sent, 'offer_candidate_offer');
  eq((await candidatePeek(w2.ctx, { token: t2 })).state, 'expired');
  await fails(candidateAnswer(w2.ctx, { token: t2, way: 'accepted' }), 'nicht mehr antworten');
}});
