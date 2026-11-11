// Contracting statt Angebot (Etappe 1, 11.11.2026): kein Angebot über ein Gehalt,
// keine Besetzung mit Honorar; der Kunde fragt den Einsatz an.
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fakeDb } from './fixtures/fake-db.ts';
import type { ServiceCtx } from '../functions/_shared/interview-service.ts';
import { createOffer, offerContext, requestEngagement } from '../functions/_shared/offer-service.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };

// Mittwoch, 11. November 2026, 12:00 UTC
const NOW = Date.parse('2026-11-11T12:00:00Z');
const CLIENT = 'u-client-0000-0000-0000-000000000001';
const RECRUITER = 'u-recr-000000-0000-0000-000000000003';
const ADMIN = 'u-admin-00000-0000-0000-000000000007';
const SUB = '22222222-2222-2222-2222-222222222222';

function seed(employmentType = 'freelance') {
  return fakeDb({
    submissions: [{ id: SUB, stage: 'interview_completed', status: 'interview', identity_unlocked: true, company_revealed: true, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j1' }],
    jobs: [{ id: 'j1', title: 'TEST Senior SAP-Berater (m/w/d)', company_name: 'MedTec Süd GmbH', industry: 'Medizintechnik', client_id: CLIENT, organization_id: null,
      salary_min: null, salary_max: null, location: 'München', remote_type: 'hybrid', onsite_days_required: 2, benefits: [], fee_percentage: 22, mandate_id: null,
      employment_type: employmentType, day_rate_min: 850, day_rate_max: 1050, contract_duration_months: 12, utilization_days_per_week: 5 }],
    candidates: [{ id: 'c1', full_name: 'Max Mustermann', email: 'max@example.test' }],
    profiles: [
      { user_id: CLIENT, full_name: 'Klara Kunde', email: 'klara@example.test' },
      { user_id: RECRUITER, full_name: 'Julia Hartmann', email: 'julia@example.test' },
      { user_id: ADMIN, full_name: 'Matchunt Admin', email: 'admin@example.test' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }, { user_id: RECRUITER, role: 'recruiter' }, { user_id: ADMIN, role: 'admin' }],
    offers: [], offer_events: [], offer_recommendations: [], notifications: [], activity_logs: [], commercial_mandates: [],
  });
}

function ctxFor(db: any, sent: (InterviewMail & { template: string })[]): ServiceCtx {
  return { db, ms: null, now: () => NOW, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail, log) => { sent.push({ ...mail, template: log.template }); return { sent: true }; } };
}
const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const OFFER = { salary: 95000, startDate: '2027-02-01', responseDue: '2026-11-18', contractType: 'permanent', probationMonths: 6, workModel: 'München', extras: [] };

Deno.test({ name: 'Contracting: kein Angebot über ein Gehalt', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed();
  let message = '';
  try { await createOffer(ctxFor(db, []), user(CLIENT), { submissionId: SUB, ...OFFER }); } catch (e: any) { message = e.message; }
  assert(message.includes('kein Angebot über ein Gehalt'), 'Angebot bei Contracting gesperrt');
  eq(tables.offers.length, 0, 'kein Angebot angelegt');
}});

Deno.test({ name: 'Contracting: Kontext mit Budget und Vorgaben, ohne Anfrage', permissions: { env: true }, fn: async () => {
  const { db } = seed();
  const c = await offerContext(ctxFor(db, []), user(CLIENT), { submissionId: SUB });
  eq(c.contracting, { budget: 'Ihr Budget: 850–1.050 € je Tag, alles inklusive', defaults: { months: 12, daysPerWeek: 5 }, request: null });
  const fest = seed('full-time');
  eq((await offerContext(ctxFor(fest.db, []), user(CLIENT), { submissionId: SUB })).contracting, null, 'Festanstellung ohne Contracting-Teil');
}});

Deno.test({ name: 'Contracting: Einsatz anfragen → Protokoll, Glocke und Mail an Julia und Matchunt, nichts an Max', permissions: { env: true }, fn: async () => {
  const { db, tables } = seed();
  const sent: any[] = [];
  const ctx = ctxFor(db, sent);
  const r = await requestEngagement(ctx, user(CLIENT), { submissionId: SUB, startDate: '2027-02-01', months: 12, daysPerWeek: 5 });
  eq(r.einsatz, { startDate: '2027-02-01', months: 12, daysPerWeek: 5 });
  eq(tables.activity_logs.map((l: any) => [l.action, l.entity_id, l.user_id]), [['contracting_einsatz_angefragt', SUB, CLIENT]]);
  eq(tables.offers.length, 0, 'kein Angebot');
  assert(tables.notifications.some((n: any) => n.user_id === RECRUITER && n.type === 'engagement_requested' && n.title === 'MedTec Süd GmbH will Max einsetzen'), 'Glocke an Julia');
  assert(tables.notifications.some((n: any) => n.user_id === ADMIN && n.type === 'engagement_requested_admin'), 'Glocke an Matchunt');
  eq(sent.map((m) => [m.template, m.to]).sort(), [['engagement_requested_admin', 'admin@example.test'], ['engagement_requested_recruiter', 'julia@example.test']]);
  assert(!sent.some((m) => m.to === 'max@example.test'), 'keine Mail an den Kandidaten');
  const toJulia = sent.find((m) => m.to === 'julia@example.test');
  assert(toJulia.html.includes('12 Monate') && toJulia.html.includes('Matchunt meldet sich bei dir'), 'Mail an Julia mit Eckdaten');
  assert(!/\d+\s?%/.test(toJulia.text), 'keine Prozente in der Mail an Julia');

  const c = await offerContext(ctx, user(CLIENT), { submissionId: SUB });
  eq([c.contracting?.request?.months, c.contracting?.request?.daysPerWeek], [12, 5], 'Anfrage steht im Kontext');

  let message = '';
  try { await requestEngagement(ctx, user(CLIENT), { submissionId: SUB, startDate: '2026-11-01', months: 12, daysPerWeek: 5 }); } catch (e: any) { message = e.message; }
  assert(message.includes('Vergangenheit'), 'Beginn nicht in der Vergangenheit');
  message = '';
  try { await requestEngagement(ctx, user(CLIENT), { submissionId: SUB, startDate: '2027-02-01', months: 12, daysPerWeek: 6 }); } catch (e: any) { message = e.message; }
  assert(message.includes('Tage je Woche'), 'höchstens 5 Tage je Woche');
  message = '';
  try { await requestEngagement(ctx, user(RECRUITER), { submissionId: SUB, startDate: '2027-02-01', months: 12, daysPerWeek: 5 }); } catch (e: any) { message = e.message; }
  assert(message.includes('dürfen Sie kein Angebot'), 'nur der Kunde fragt an');
}});

Deno.test({ name: 'Festanstellung: Einsatz anfragen geht nicht', permissions: { env: true }, fn: async () => {
  const { db } = seed('full-time');
  let message = '';
  try { await requestEngagement(ctxFor(db, []), user(CLIENT), { submissionId: SUB, startDate: '2027-02-01', months: 12, daysPerWeek: 5 }); } catch (e: any) { message = e.message; }
  assert(message.includes('nur bei Contracting'), 'nur Contracting');
}});

Deno.test({ name: 'Contracting: aus einem Vertrag entsteht keine Besetzung mit Honorar', permissions: { env: true }, fn: async () => {
  const { onContractFinal } = await import('../functions/_shared/placement-service.ts');
  const { db, tables } = seed();
  tables.employment_contracts = [{ id: 'ec1', submission_id: SUB, status: 'final', salary: 95000, variable_salary: null, start_date: '2027-02-01' }];
  tables.placements = [];
  const r = await onContractFinal({ ...ctxFor(db, []), invoiceFiles: null } as any, 'ec1');
  eq([r.created, (r as any).contracting], [false, true]);
  eq(tables.placements.length, 0, 'keine Besetzung, keine Rechnung über Prozent vom Gehalt');
}});
