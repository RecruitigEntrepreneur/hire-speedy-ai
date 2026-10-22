// Ablauftests: Angebot über den Headhunter und Empfehlung (22.10.2026).
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fakeDb } from './fixtures/fake-db.ts';
import type { ServiceCtx } from '../functions/_shared/interview-service.ts';
import { createOffer, extendOffer, keepOffer, offerContext, recommend, recruiterContext, respondOffer, withdrawOffer, workModelOf } from '../functions/_shared/offer-service.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };

// Donnerstag, 22. Oktober 2026, 12:00 UTC
const NOW = Date.parse('2026-10-22T12:00:00Z');
const CLIENT = 'u-client-0000-0000-0000-000000000001';
const RECRUITER = 'u-recr-000000-0000-0000-000000000003';
const OTHER = 'u-other-00000-0000-0000-000000000009';
const SUB = '11111111-1111-1111-1111-111111111111';

function seed(unlocked = true) {
  return fakeDb({
    submissions: [{ id: SUB, stage: 'interview_completed', status: 'interview', identity_unlocked: unlocked, company_revealed: unlocked, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j1' }],
    jobs: [{ id: 'j1', title: 'Head of Sales DACH (m/w/d)', company_name: 'MedTec Süd GmbH', industry: 'Medizintechnik', client_id: CLIENT, organization_id: null, salary_min: 130000, salary_max: 160000, location: 'München', remote_type: 'hybrid', onsite_days_required: 3, benefits: ['Dienstwagen', '30 Tage Urlaub'], fee_percentage: 20, mandate_id: 'm1' }],
    commercial_mandates: [{ id: 'm1', pricing_snapshot: { clientFeePct: 23 } }],
    candidates: [{ id: 'c1', full_name: 'Cem Aydın', email: 'cem@example.test' }],
    profiles: [
      { user_id: CLIENT, full_name: 'Klara Kunde', email: 'klara@example.test' },
      { user_id: RECRUITER, full_name: 'Julia Hartmann', email: 'julia@example.test' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }, { user_id: RECRUITER, role: 'recruiter' }],
    interviews: [{ id: 'iv1', submission_id: SUB, requested_by: CLIENT, created_at: '2026-10-14T08:00:00Z' }],
    offers: [], offer_events: [], offer_recommendations: [], notifications: [], interview_nachgespraeche: [],
  });
}

function ctxFor(db: any, sent: (InterviewMail & { template: string })[]): ServiceCtx {
  return { db, ms: null, now: () => NOW, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail, log) => { sent.push({ ...mail, template: log.template }); return { sent: true }; } };
}
const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const OFFER = { salary: 140000, variable: 20000, startDate: '2027-01-01', responseDue: '2026-10-29', contractType: 'permanent', probationMonths: 6, workModel: 'München · 3 Tage Büro', extras: ['Dienstwagen', '30 Tage Urlaub'], message: 'Beim Start sind wir flexibel.' };

Deno.test({ name: 'Angebot: nur nach Freigabe, geht an den Headhunter, Stufe „offer“, Glocke und Mail', permissions: { env: true }, fn: async () => {
  const locked = seed(false);
  let message = '';
  try { await createOffer(ctxFor(locked.db, []), user(CLIENT), { submissionId: SUB, ...OFFER }); } catch (e: any) { message = e.message; }
  assert(message.includes('freigegeben'), 'ohne Freigabe kein Angebot');

  const { db, tables } = seed();
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const context = await offerContext(ctx, user(CLIENT), { submissionId: SUB });
  eq([context.feePercent, context.defaults.workModel, context.salaryMin], [23, 'München · 3 Tage Büro', 130000]);
  message = '';
  try { await offerContext(ctx, user(OTHER), { submissionId: SUB }); } catch (e: any) { message = e.message; }
  assert(message.includes('dürfen Sie kein Angebot'), 'Fremde sehen keinen Kontext');

  const r = await createOffer(ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const o = tables.offers[0];
  eq([o.status, o.salary_offered, o.variable_salary, o.response_due, o.version, o.recruiter_id, o.created_by], ['with_recruiter', 140000, 20000, '2026-10-29', 1, RECRUITER, CLIENT]);
  assert(o.sent_at, 'sent_at für die Liga');
  eq(tables.submissions[0].stage, 'offer');
  eq(r.offer?.status, 'with_recruiter');
  assert(tables.notifications.some((n: any) => n.user_id === RECRUITER && n.type === 'offer_received' && n.related_type === 'candidate'));
  const mail = sent.find((m) => m.template === 'offer_received_recruiter');
  assert(mail?.to === 'julia@example.test' && mail.html.includes('140.000 €') && mail.html.includes('Beim Start sind wir flexibel'), 'Mail an Julia mit Eckdaten und Nachricht');
  assert(!sent.some((m) => m.to === 'cem@example.test'), 'keine Matchunt-Mail an den Kandidaten');
  eq(tables.offer_events.map((e: any) => e.event_type), ['sent']);

  message = '';
  try { await createOffer(ctx, user(CLIENT), { submissionId: SUB, ...OFFER, responseDue: '2026-10-01' }); } catch (e: any) { message = e.message; }
  assert(message.includes('Vergangenheit'), 'Frist nicht in der Vergangenheit');
}});

Deno.test({ name: 'Gegenwunsch → Kunde bleibt dabei → angepasstes Angebot ersetzt das alte → Zusage', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed();
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  await createOffer(ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const first = tables.offers[0];

  let message = '';
  try { await respondOffer(ctx, user(OTHER), { offerId: first.id, way: 'accepted' }); } catch (e: any) { message = e.message; }
  assert(message.includes('Nur der Headhunter'), 'nur Julia trägt die Antwort ein');

  sent.length = 0;
  await respondOffer(ctx, user(RECRUITER), { offerId: first.id, way: 'countered', wishSalary: 150000, wishOther: '4 Tage Homeoffice', reason: 'Liegt mit Bonus bei 155.000 €.' });
  eq([tables.offers[0].status, tables.offers[0].counter_offer_salary], ['countered', 150000]);
  assert(tables.notifications.some((n: any) => n.user_id === CLIENT && n.type === 'offer_answer' && n.message.includes('150.000 €')), 'Kunde sieht den Wunsch in der Glocke');
  const answer = sent.find((m) => m.template === 'offer_answer_countered');
  assert(answer?.to === 'klara@example.test' && answer.html.includes('4 Tage Homeoffice'), 'Mail an den Kunden mit Wunsch');

  sent.length = 0;
  await keepOffer(ctx, user(CLIENT), { offerId: first.id, note: 'Mehr geht im Moment nicht.' });
  eq(tables.offers[0].status, 'with_recruiter');
  assert(sent.some((m) => m.template === 'offer_update_recruiter' && m.html.includes('bleibt bei 140.000 €')), 'Julia erfährt, dass der Kunde dabei bleibt');

  await respondOffer(ctx, user(RECRUITER), { offerId: first.id, way: 'countered', wishSalary: 150000 });
  await createOffer(ctx, user(CLIENT), { submissionId: SUB, ...OFFER, salary: 145000 });
  eq(tables.offers.map((o: any) => [o.status, o.version]), [['superseded', 1], ['with_recruiter', 2]]);
  eq(tables.offers[1].previous_offer_id, first.id);
  eq(tables.offers[1].original_salary, 140000);

  sent.length = 0;
  await respondOffer(ctx, user(RECRUITER), { offerId: tables.offers[1].id, way: 'accepted', startConfirmed: '2027-01-01' });
  eq(tables.offers[1].status, 'accepted');
  assert(tables.offers[1].decision_at, 'Zeitpunkt der Zusage');
  assert(sent.some((m) => m.template === 'offer_answer_accepted' && m.subject === 'Cem Aydın hat zugesagt'));
  message = '';
  try { await respondOffer(ctx, user(RECRUITER), { offerId: tables.offers[1].id, way: 'declined' }); } catch (e: any) { message = e.message; }
  assert(message.includes('keine Antwort mehr offen'), 'nach der Zusage keine zweite Antwort');
}});

Deno.test({ name: 'Überlegt noch, Frist verlängern, zurückziehen, Absage mit Grund', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed();
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  await createOffer(ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const id = tables.offers[0].id;
  await respondOffer(ctx, user(RECRUITER), { offerId: id, way: 'considering', until: '2026-10-31', note: 'Bespricht es mit seiner Familie.' });
  eq([tables.offers[0].status, tables.offers[0].candidate_response.until], ['considering', '2026-10-31']);
  await extendOffer(ctx, user(CLIENT), { offerId: id, responseDue: '2026-11-05' });
  eq(tables.offers[0].response_due, '2026-11-05');
  await respondOffer(ctx, user(RECRUITER), { offerId: id, way: 'declined', reasonCategory: 'counter_offer', reason: 'Bleibt bei seinem Arbeitgeber.' });
  eq([tables.offers[0].status, tables.offers[0].rejection_reason], ['declined', 'Gegenangebot des Arbeitgebers: Bleibt bei seinem Arbeitgeber.']);

  await createOffer(ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  const second = tables.offers[1].id;
  await withdrawOffer(ctx, user(CLIENT), { offerId: second });
  eq(tables.offers[1].status, 'withdrawn');
  assert(tables.notifications.some((n: any) => n.user_id === RECRUITER && n.type === 'offer_update' && n.title.includes('zurückgezogen')));
}});

Deno.test({ name: 'Empfehlung: nur der eigene Headhunter, Kunde bekommt Glocke und Mail, Kontext zeigt sie', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed();
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  let message = '';
  try { await recommend(ctx, user(OTHER), { submissionId: SUB, items: [{ key: 'fix', label: 'Fixgehalt', value: 'ab 150.000 €' }] }); } catch (e: any) { message = e.message; }
  assert(message.includes('Nur der Headhunter'));
  message = '';
  try { await recommend(ctx, user(RECRUITER), { submissionId: SUB, items: [] }); } catch (e: any) { message = e.message; }
  assert(message.includes('mindestens einen Punkt'));
  await recommend(ctx, user(RECRUITER), {
    submissionId: SUB, intro: 'Cem war nach dem Termin begeistert.',
    items: [{ key: 'fix', label: 'Fixgehalt', value: 'ab 150.000 €' }, { key: 'homeoffice', label: 'Homeoffice', value: '3 Tage' }],
  });
  eq(tables.offer_recommendations.length, 1);
  assert(tables.notifications.some((n: any) => n.user_id === CLIENT && n.type === 'offer_recommendation'));
  const mail = sent.find((m) => m.template === 'offer_recommendation_client');
  assert(mail?.to === 'klara@example.test' && mail.html.includes('ab 150.000 €'));
  const context = await offerContext(ctx, user(CLIENT), { submissionId: SUB });
  eq(context.recommendation?.items.length, 2);
  eq(workModelOf({ location: 'Berlin', remote_type: 'remote' }), 'Berlin · remote');
}});

Deno.test({ name: 'Headhunter-Sicht: Nachgespräch mit Schmerzgrenze nur für den Headhunter, Firma vor Freigabe verdeckt', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed(false);
  tables.interview_nachgespraeche.push({ id: 'n1', submission_id: SUB, recruiter_id: RECRUITER, interview_id: 'iv1', angebot_fix_min: 140000, gehalt_besprochen: true, gehalt_kandidat: 150000, created_at: '2026-10-21T09:00:00Z' });
  const ctx = ctxFor(db, []);
  const r = await recruiterContext(ctx, user(RECRUITER), { submissionId: SUB });
  eq([r.companyName, r.nachgespraech?.angebot_fix_min, r.currentOffer], ['Medizintechnik-Unternehmen', 140000, null]);
  let message = '';
  try { await recruiterContext(ctx, user(CLIENT), { submissionId: SUB }); } catch (e: any) { message = e.message; }
  assert(message.includes('Nur der Headhunter'), 'Kunde sieht die Headhunter-Sicht nie');
  const client = await offerContext(ctx, user(CLIENT), { submissionId: SUB });
  assert(!JSON.stringify(client).includes('140000'), 'Schmerzgrenze nie im Kundenkontext');
}});
