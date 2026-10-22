// Ablauftests: Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026).
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { fakeDb } from './fixtures/fake-db.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';
import { createOffer, respondOffer } from '../functions/_shared/offer-service.ts';
import {
  applyEnvelopeEvent, check, confirm, contractContext, drop, report, runFollowups, sendDigital, sendSelf, signaturePage, undo, voidDigital,
  type ContractCtx, type FilePort, type SignPort,
} from '../functions/_shared/contract-service.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };
const fails = async (p: Promise<unknown>, text: string) => {
  let message = '';
  try { await p; } catch (e: any) { message = e.message; }
  assert(message.includes(text), `erwartet Fehler „${text}“, war „${message}“`);
};

const NOW = Date.parse('2026-10-22T12:00:00Z');
const CLIENT = 'u-client-0000-0000-0000-000000000001';
const RECRUITER = 'u-recr-000000-0000-0000-000000000003';
const ADMIN = 'u-admin-00000-0000-0000-000000000007';
const SUB = '11111111-1111-1111-1111-111111111111';

function seed() {
  return fakeDb({
    submissions: [{ id: SUB, stage: 'interview_completed', status: 'interview', identity_unlocked: true, company_revealed: false, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j1' }],
    jobs: [{ id: 'j1', title: 'Head of Sales DACH (m/w/d)', company_name: 'MedTec Süd GmbH', industry: 'Medizintechnik', client_id: CLIENT, organization_id: null, salary_min: 130000, salary_max: 160000, location: 'München', remote_type: 'hybrid', onsite_days_required: 3, benefits: [], fee_percentage: 20, mandate_id: null }],
    candidates: [{ id: 'c1', full_name: 'Dora Weber', email: 'dora@example.test', phone: '+49 171 1' }],
    profiles: [
      { user_id: CLIENT, full_name: 'Klara Kunde', email: 'klara@example.test' },
      { user_id: RECRUITER, full_name: 'Julia Hartmann', email: 'julia@example.test' },
      { user_id: ADMIN, full_name: 'Marko Admin', email: 'admin@example.test' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }, { user_id: RECRUITER, role: 'recruiter' }, { user_id: ADMIN, role: 'admin' }],
    interviews: [], offers: [], offer_events: [], offer_recommendations: [], notifications: [],
    employment_contracts: [], employment_contract_events: [],
  });
}

interface World { db: any; tables: any; sent: any[]; files: Map<string, Uint8Array>; envelopes: string[]; voided: string[]; clock: { now: number }; ctx: ContractCtx }

function world(withSign = true): World {
  const { db, tables } = seed();
  const sent: any[] = [];
  const files = new Map<string, Uint8Array>();
  const envelopes: string[] = [];
  const voided: string[] = [];
  const clock = { now: NOW };
  const sign: SignPort = {
    send: async (a) => { envelopes.push(a.company.email); return { envelopeId: `env-${envelopes.length}` }; },
    void: async (id) => { voided.push(id); },
    status: async () => null,
    document: async () => new TextEncoder().encode('%PDF-unterschrieben'),
  };
  const filePort: FilePort = {
    put: async (path, bytes) => { files.set(path, bytes); },
    get: async (path) => files.get(path) ?? null,
    url: async (path) => (files.has(path) ? `https://files.test/${path}` : null),
  };
  const ctx: ContractCtx = {
    db, ms: null, now: () => clock.now, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail: InterviewMail, log) => { sent.push({ ...mail, template: log.template }); return { sent: true }; },
    sign: withSign ? sign : null, files: filePort,
  };
  return { db, tables, sent, files, envelopes, voided, clock, ctx };
}

const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const OFFER = { salary: 150000, variable: 20000, startDate: '2027-01-01', responseDue: '2026-10-29', contractType: 'permanent', probationMonths: 6, workModel: 'München · 3 Tage Büro', extras: ['Firmenwagen'], message: '' };

async function accepted(w: World) {
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  await respondOffer(w.ctx, user(RECRUITER), { offerId: w.tables.offers[0].id, way: 'accepted', startConfirmed: '2027-01-01' });
}
const contract = (w: World) => w.tables.employment_contracts[w.tables.employment_contracts.length - 1];
const notes = (w: World, userId: string, type: string) => w.tables.notifications.filter((n: any) => n.user_id === userId && n.type === type);

Deno.test({ name: 'Zusage legt den Vertrag an; Headhunter sieht kein PDF, keine Kandidaten-Mail, Firma erst nach Freigabe', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  eq([contract(w).status, contract(w).way, contract(w).salary, contract(w).start_date], ['preparing', 'self', 150000, '2027-01-01']);
  const asClient = await contractContext(w.ctx, user(CLIENT), { submissionId: SUB });
  eq([asClient.role, asClient.candidateEmail, asClient.companyName, asClient.feePercent, asClient.digitalAvailable], ['client', 'dora@example.test', 'MedTec Süd GmbH', 20, true]);
  const asRecruiter = await contractContext(w.ctx, user(RECRUITER), { submissionId: SUB });
  eq([asRecruiter.role, asRecruiter.candidateEmail, asRecruiter.companyName, asRecruiter.feePercent, asRecruiter.contract?.hasSignedDocument], ['recruiter', null, 'Medizintechnik-Unternehmen', null, false]);
  await fails(contractContext(w.ctx, user('u-fremd-0000-0000-0000-000000000099'), { submissionId: SUB }), 'Berechtigung');
}});

Deno.test({ name: 'Selbst verschickt → Kunde meldet → 24 h rückgängig → erneut → verbindlich; Gegenprobe „weicht ab“ wird Fall für Matchunt', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendSelf(w.ctx, user(CLIENT), { submissionId: SUB, sentOn: '2026-10-22' });
  eq(contract(w).status, 'sent_self');
  assert(notes(w, RECRUITER, 'contract_update').some((n: any) => n.title.includes('selbst verschickt')), 'Julia weiß, dass der Vertrag raus ist');
  await fails(report(w.ctx, user(CLIENT), { submissionId: SUB, signedOn: '2026-10-30', salary: 150000 }), 'Zukunft');

  await report(w.ctx, user(CLIENT), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, variable: 20000, startDate: '2027-01-01', closeJob: true });
  eq([contract(w).status, contract(w).reported_role, contract(w).close_job], ['signed', 'client', true]);
  assert(contract(w).undo_until, '24-h-Fenster gesetzt');
  assert(notes(w, RECRUITER, 'contract_check').length === 1 && w.sent.some((m) => m.template === 'contract_check_recruiter'), 'Gegenprobe bei Julia');

  w.clock.now = NOW + 2 * 3_600_000;
  await undo(w.ctx, user(CLIENT), { submissionId: SUB });
  eq([contract(w).status, contract(w).signed_on], ['sent_self', null]);

  await report(w.ctx, user(CLIENT), { submissionId: SUB, signedOn: '2026-10-22', salary: 152000, startDate: '2027-01-01' });
  w.clock.now = NOW + 30 * 3_600_000;
  await fails(undo(w.ctx, user(CLIENT), { submissionId: SUB }), '24 Stunden');
  const ctxAfter = await contractContext(w.ctx, user(CLIENT), { submissionId: SUB });
  eq([ctxAfter.contract?.status, contract(w).salary], ['final', 152000]);

  await check(w.ctx, user(RECRUITER), { submissionId: SUB, way: 'differs', note: 'Start laut Dora 01.02.' });
  eq(contract(w).recruiter_check, 'differs');
  assert(notes(w, ADMIN, 'contract_case').some((n: any) => n.message.includes('01.02.')), 'Matchunt bekommt den Fall');
  await fails(check(w.ctx, user(RECRUITER), { submissionId: SUB, way: 'ok' }), 'keine Gegenprobe');
}});

Deno.test({ name: 'Headhunter meldet → Kunde: noch nicht / andere Werte; Matchunt mit Beleg direkt verbindlich', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await report(w.ctx, user(RECRUITER), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, startDate: '2027-01-01' });
  eq(contract(w).status, 'reported');
  assert(notes(w, CLIENT, 'contract_confirm').length === 1 && w.sent.some((m) => m.template === 'contract_confirm_client'), 'Kunde soll bestätigen');
  await fails(report(w.ctx, user(RECRUITER), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000 }), 'bestätigt noch');

  await confirm(w.ctx, user(CLIENT), { submissionId: SUB, way: 'not_yet' });
  eq([contract(w).status, contract(w).reported_role], ['preparing', null]);
  assert(notes(w, RECRUITER, 'contract_update').some((n: any) => n.title.includes('noch nicht')), 'Julia erfährt den Widerspruch');

  await report(w.ctx, user(RECRUITER), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, startDate: '2027-01-01' });
  await confirm(w.ctx, user(CLIENT), { submissionId: SUB, way: 'values', signedOn: '2026-10-21', salary: 148000, startDate: '2027-02-01' });
  eq([contract(w).status, contract(w).salary, contract(w).start_date, contract(w).signed_on], ['final', 148000, '2027-02-01', '2026-10-21']);

  const w2 = world();
  await accepted(w2);
  await report(w2.ctx, user(ADMIN), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, startDate: '2027-01-01', evidence: 'Telefonat mit Frau Kunde am 22.10.' });
  eq([contract(w2).status, contract(w2).reported_role, contract(w2).evidence_note], ['final', 'admin', 'Telefonat mit Frau Kunde am 22.10.']);
}});

Deno.test({ name: 'Digital: Schriftform-Sperre, Umschlag mit Unterschriftenseite, Firma zuerst, dann Kandidat → verbindlich mit PDF', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  const pdf = encodeBase64(new TextEncoder().encode('%PDF-1.4 Arbeitsvertrag Dora Weber'));
  const base = { submissionId: SUB, fileBase64: pdf, fileName: 'Vertrag.pdf', salary: 150000, variable: 20000, startDate: '2027-01-01', signerName: 'Dr. Martin Kühn', signerEmail: 'm.kuehn@medtec.test', candidateEmail: 'dora@example.test' };
  await fails(sendDigital(w.ctx, user(CLIENT), { ...base, fixedTerm: true, nonCompete: false }), 'Schriftform');
  await fails(sendDigital(w.ctx, user(CLIENT), { ...base, fileBase64: encodeBase64(new TextEncoder().encode('kein pdf, nur text, aber lang genug für die Prüfung der Mindestlänge im Dienst')), fixedTerm: false, nonCompete: false }), 'PDF-Datei');
  await fails(sendDigital(w.ctx, user(RECRUITER), { ...base, fixedTerm: false, nonCompete: false }), 'Berechtigung');

  await sendDigital(w.ctx, user(CLIENT), { ...base, fixedTerm: false, nonCompete: false });
  const c = contract(w);
  eq([c.status, c.way, c.envelope_id, c.company_signer_email], ['sent_digital', 'digital', 'env-1', 'm.kuehn@medtec.test']);
  assert(w.files.has(c.document_path), 'hochgeladener Vertrag gespeichert');
  await fails(report(w.ctx, user(CLIENT), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000 }), 'digital');

  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'sent', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T13:00:00Z' }, { recipientId: '2', status: 'sent' }] });
  eq(contract(w).status, 'company_signed');
  assert(notes(w, RECRUITER, 'contract_update').some((n: any) => n.title.includes('Firma hat unterschrieben')), 'Julia stößt Dora an');
  // doppelt zugestellt: nichts verschiebt sich
  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'sent', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T15:00:00Z' }, { recipientId: '2', status: 'sent' }] });
  eq(contract(w).company_signed_at, '2026-10-22T13:00:00Z');

  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'completed', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T13:00:00Z' }, { recipientId: '2', status: 'completed', signedDateTime: '2026-10-23T08:30:00Z' }] });
  const done = contract(w);
  eq([done.status, done.signed_on, done.reported_role], ['final', '2026-10-23', 'docusign']);
  assert(done.signed_document_path && w.files.has(done.signed_document_path), 'unterschriebenes PDF gesichert');
  assert(w.sent.some((m) => m.template === 'contract_done_client' && m.to === 'klara@example.test'), 'Kunde bekommt die Abschluss-Mail');
  assert(!w.sent.some((m) => m.to === 'dora@example.test'), 'keine Matchunt-Mail an die Kandidatin');
  eq((await contractContext(w.ctx, user(RECRUITER), { submissionId: SUB })).contract?.hasSignedDocument, false, 'Headhunter sieht das PDF nicht');
}});

Deno.test({ name: 'Digital abgelehnt, zurückziehen und selbst verschicken; ohne DocuSign kein digitaler Weg', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  const base = { submissionId: SUB, fileBase64: encodeBase64(new TextEncoder().encode('%PDF-1.4 Vertrag')), fileName: 'Vertrag.pdf', salary: 150000, startDate: '2027-01-01', signerName: 'Dr. Kühn', signerEmail: 'k@medtec.test', candidateEmail: 'dora@example.test', fixedTerm: false, nonCompete: false };
  await sendDigital(w.ctx, user(CLIENT), base);
  await voidDigital(w.ctx, user(CLIENT), { submissionId: SUB, toSelf: true });
  eq([contract(w).status, contract(w).way, w.voided], ['preparing', 'self', ['env-1']]);

  await sendDigital(w.ctx, user(CLIENT), base);
  await applyEnvelopeEvent(w.ctx, 'env-2', { status: 'declined', signers: [{ recipientId: '1', status: 'completed' }, { recipientId: '2', status: 'declined', declinedReason: 'Gehalt stimmt nicht' }] });
  eq([contract(w).status, contract(w).decline_reason], ['declined', 'Gehalt stimmt nicht']);
  assert(notes(w, CLIENT, 'contract_update').some((n: any) => n.message === 'Gehalt stimmt nicht'), 'Kunde sieht den Grund');
  // nach Ablehnung: neuer Umschlag ist eine neue Vertragszeile
  await sendDigital(w.ctx, user(CLIENT), base);
  eq([w.tables.employment_contracts.length, contract(w).status], [2, 'sent_digital']);

  const w2 = world(false);
  await accepted(w2);
  eq((await contractContext(w2.ctx, user(CLIENT), { submissionId: SUB })).digitalAvailable, false);
  await fails(sendDigital(w2.ctx, user(CLIENT), base), 'nicht eingerichtet');
}});

Deno.test({ name: 'Ohne Meldung: Tag 7 Kunde, Tag 10 Headhunter, Tag 21 Matchunt – je einmal; abgesprungen beendet', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  w.clock.now = NOW + 6 * 86_400_000;
  eq((await runFollowups(w.ctx)).client, 0);
  w.clock.now = NOW + 7 * 86_400_000 + 3_600_000;
  eq((await runFollowups(w.ctx)).client, 1);
  assert(w.sent.some((m) => m.template === 'contract_reminder_client' && m.html.includes('?vertrag=melden')), 'Mail mit drei Knöpfen');
  eq((await runFollowups(w.ctx)).client, 0, 'nur einmal');
  w.clock.now = NOW + 10 * 86_400_000 + 3_600_000;
  const r10 = await runFollowups(w.ctx);
  eq([r10.recruiter, r10.admin], [1, 0]);
  assert(notes(w, RECRUITER, 'contract_followup').length === 1, 'Julia fasst nach');
  w.clock.now = NOW + 21 * 86_400_000 + 3_600_000;
  eq((await runFollowups(w.ctx)).admin, 1);
  assert(notes(w, ADMIN, 'contract_case').length === 1, 'Fall für Matchunt');

  await drop(w.ctx, user(RECRUITER), { submissionId: SUB, reason: 'Gegenangebot angenommen' });
  eq([contract(w).status, w.tables.submissions[0].stage], ['dropped', 'withdrawn']);
  assert(notes(w, CLIENT, 'contract_update').some((n: any) => n.title.includes('abgesprungen')), 'Kunde informiert');
  // kein neuer Vertrag nach „abgesprungen“
  await contractContext(w.ctx, user(CLIENT), { submissionId: SUB });
  eq(w.tables.employment_contracts.length, 1);
}});

Deno.test({ name: 'Unterschriftenseite enthält beide Anker', permissions: { env: true }, fn: async () => {
  const bytes = await signaturePage({ companyName: 'MedTec Süd GmbH', candidateName: 'Dora Weber', jobTitle: 'Head of Sales DACH', fileName: 'Vertrag.pdf', signerName: 'Dr. Martin Kühn' });
  assert(new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-', 'PDF');
  assert(bytes.length > 800, 'Seite hat Inhalt');
}});
