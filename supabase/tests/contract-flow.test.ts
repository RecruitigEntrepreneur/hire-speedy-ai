// Ablauftests: Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026).
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { fakeDb } from './fixtures/fake-db.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';
import { createOffer } from '../functions/_shared/offer-service.ts';
import { acceptAsCandidate } from './fixtures/offer-accept.ts';
import {
  applyEnvelopeEvent, changeSigner, check, confirm, contractContext, drop, linkDocument, linkPeek, linkRenew, linkReturned, linkStart, refreshDigital,
  report, resendDigital, resendLink, runFollowups, sendDigital, sendSelf, signaturePage, signUrl, undo, voidDigital,
  type ContractCtx, type FilePort, type SignerSnapshot, type SignPort,
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
    employment_contracts: [], employment_contract_events: [], employment_sign_links: [],
  });
}

interface World { db: any; tables: any; sent: any[]; files: Map<string, Uint8Array>; envelopes: string[]; voided: string[]; views: any[]; embedded: boolean[]; resent: string[]; state: { snap: SignerSnapshot | null }; clock: { now: number }; ctx: ContractCtx }

function world(withSign = true): World {
  const { db, tables } = seed();
  const sent: any[] = [];
  const files = new Map<string, Uint8Array>();
  const envelopes: string[] = [];
  const voided: string[] = [];
  const views: any[] = [];
  const embedded: boolean[] = [];
  const resent: string[] = [];
  const state: { snap: SignerSnapshot | null } = { snap: null };
  const clock = { now: NOW };
  const sign: SignPort = {
    send: async (a) => { envelopes.push(a.company.email); embedded.push(!!a.embedded); return { envelopeId: `env-${envelopes.length}` }; },
    view: async (a) => { views.push(a); return `https://docusign.test/sign/${a.role}?return=${encodeURIComponent(a.returnUrl)}`; },
    void: async (id) => { voided.push(id); },
    resend: async (id) => { resent.push(id); },
    status: async () => state.snap,
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
  return { db, tables, sent, files, envelopes, voided, views, embedded, resent, state, clock, ctx };
}

const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const OFFER = { salary: 150000, variable: 20000, startDate: '2027-01-01', responseDue: '2026-10-29', contractType: 'permanent', probationMonths: 6, workModel: 'München · 3 Tage Büro', extras: ['Firmenwagen'], message: '' };

async function accepted(w: World) {
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  await acceptAsCandidate(w.ctx, w.sent, user(RECRUITER), w.tables.offers[0].id, { startConfirmed: '2027-01-01' });
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

Deno.test({ name: 'Digital über Matchunt: Schriftform-Sperre, eingebettet, Link an die Firma, nach ihrer Unterschrift Link an den Kandidaten, Kopie → verbindlich mit PDF', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  const pdf = encodeBase64(new TextEncoder().encode('%PDF-1.4 Arbeitsvertrag Dora Weber'));
  const base = { submissionId: SUB, fileBase64: pdf, fileName: 'Vertrag.pdf', salary: 150000, variable: 20000, startDate: '2027-01-01', signerName: 'Dr. Martin Kühn', signerEmail: 'm.kuehn@medtec.test', candidateEmail: 'dora@example.test' };
  await fails(sendDigital(w.ctx, user(CLIENT), { ...base, fixedTerm: true, nonCompete: false }), 'Schriftform');
  await fails(sendDigital(w.ctx, user(CLIENT), { ...base, fileBase64: encodeBase64(new TextEncoder().encode('kein pdf, nur text, aber lang genug für die Prüfung der Mindestlänge im Dienst')), fixedTerm: false, nonCompete: false }), 'PDF-Datei');
  await fails(sendDigital(w.ctx, user(RECRUITER), { ...base, fixedTerm: false, nonCompete: false }), 'Berechtigung');

  await sendDigital(w.ctx, user(CLIENT), { ...base, fixedTerm: false, nonCompete: false });
  const c = contract(w);
  eq([c.status, c.way, c.envelope_id, c.company_signer_email, c.signing_mode, w.embedded[0]], ['sent_digital', 'digital', 'env-1', 'm.kuehn@medtec.test', 'embedded', true]);
  assert(w.files.has(c.document_path), 'hochgeladener Vertrag gespeichert');
  // Unterzeichner ohne Konto: Link per Matchunt-Mail, nicht von DocuSign
  const toKuehn = w.sent.filter((m) => m.to === 'm.kuehn@medtec.test');
  eq(toKuehn.map((m) => m.template), ['contract_sign_company']);
  assert(/\/unterschrift\/[A-Za-z0-9_-]{43}/.test(toKuehn[0].html) && toKuehn[0].replyTo === 'klara@example.test', 'Link + Antwort an die Hochladende');
  eq(w.tables.employment_sign_links.map((l: any) => [l.signer_role, l.email]), [['company', 'm.kuehn@medtec.test']]);
  await fails(report(w.ctx, user(CLIENT), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000 }), 'digital');

  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'sent', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T13:00:00Z' }, { recipientId: '2', status: 'sent' }] });
  eq(contract(w).status, 'company_signed');
  assert(notes(w, RECRUITER, 'contract_update').some((n: any) => n.title.includes('Firma hat unterschrieben')), 'Julia stößt Dora an');
  const toDora = w.sent.filter((m) => m.to === 'dora@example.test' && String(m.template).startsWith('contract_'));
  eq(toDora.map((m) => m.template), ['contract_sign_candidate'], 'Dora bekommt ihren Link erst jetzt');
  assert(toDora[0].replyTo === 'julia@example.test' && toDora[0].html.includes('150.000'), 'Antwort geht an Julia, Eckdaten stehen drin');
  assert(w.tables.employment_sign_links.find((l: any) => l.signer_role === 'company').signed_at, 'Firmen-Link erledigt');
  // doppelt zugestellt: nichts verschiebt sich, kein zweiter Link
  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'sent', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T15:00:00Z' }, { recipientId: '2', status: 'sent' }] });
  eq(contract(w).company_signed_at, '2026-10-22T13:00:00Z');
  eq(w.sent.filter((m) => m.to === 'dora@example.test' && String(m.template).startsWith('contract_')).length, 1);

  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'completed', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T13:00:00Z' }, { recipientId: '2', status: 'completed', signedDateTime: '2026-10-23T08:30:00Z' }] });
  const done = contract(w);
  eq([done.status, done.signed_on, done.reported_role], ['final', '2026-10-23', 'docusign']);
  assert(done.signed_document_path && w.files.has(done.signed_document_path), 'unterschriebenes PDF gesichert');
  assert(w.sent.some((m) => m.template === 'contract_done_client' && m.to === 'klara@example.test'), 'Kunde bekommt die Abschluss-Mail');
  eq(w.sent.filter((m) => m.to === 'dora@example.test' && String(m.template).startsWith('contract_')).map((m) => m.template), ['contract_sign_candidate', 'contract_signed_copy_candidate'], 'Dora bekommt ihre Kopie von Matchunt');
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

// ---------------------------------------------------------------- Unterschrift über Matchunt (23.10.2026)

const PDF = encodeBase64(new TextEncoder().encode('%PDF-1.4 Arbeitsvertrag Dora Weber'));
const DIGITAL = { submissionId: SUB, fileBase64: PDF, fileName: 'Vertrag.pdf', salary: 150000, variable: 20000, startDate: '2027-01-01', candidateEmail: 'dora@example.test', fixedTerm: false, nonCompete: false };
const tokenIn = (mail: any) => String(mail?.html ?? '').match(/\/unterschrift\/([A-Za-z0-9_-]{43})/)?.[1] ?? '';
const lastMailTo = (w: World, to: string) => [...w.sent].reverse().find((m) => m.to === to);
const SIGNED_1 = { status: 'sent', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T13:00:00Z' }, { recipientId: '2', status: 'sent' }] };

Deno.test({ name: 'Ich selbst: Unterschrift startet sofort in Matchunt, ohne Mail an die Firma; nur der Unterzeichner darf', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await fails(sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerSelf: true, candidateEmail: 'klara@example.test' }), 'zwei verschiedene');
  const r = await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerSelf: true });
  const c = contract(w);
  eq([c.company_signer_name, c.company_signer_email, c.company_signer_user_id, c.signing_mode], ['Klara Kunde', 'klara@example.test', CLIENT, 'embedded']);
  assert(r.signUrl?.startsWith('https://docusign.test/sign/company'), 'Adresse der Unterschrift kommt sofort');
  eq([w.views[0].via, w.views[0].returnUrl], ['app', `https://matchunt.ai/dashboard/candidates/${SUB}?vertrag=zurueck`]);
  eq(w.sent.filter((m) => m.template === 'contract_sign_company').length, 0, 'keine Link-Mail an sich selbst');
  eq(w.tables.employment_sign_links.length, 0);
  // später erneut aus dem Profil
  assert((await signUrl(w.ctx, user(CLIENT), { submissionId: SUB })).url, 'Klara kann weiter unterschreiben');
  await fails(signUrl(w.ctx, user(RECRUITER), { submissionId: SUB }), 'Berechtigung');
  const ctxView = await contractContext(w.ctx, user(CLIENT), { submissionId: SUB });
  eq([ctxView.signing?.mode, ctxView.signing?.youSign, ctxView.signing?.companyViaApp], ['embedded', true, true]);
  // Rücksprung sofort: noch keine Abfrage (20 s), danach übernimmt der Stand die Unterschrift
  w.state.snap = SIGNED_1 as any;
  await refreshDigital(w.ctx, user(CLIENT), { submissionId: SUB, returned: true });
  eq(contract(w).status, 'sent_digital', 'innerhalb von 20 s nicht erneut gefragt');
  w.clock.now += 21_000;
  await refreshDigital(w.ctx, user(CLIENT), { submissionId: SUB, returned: true });
  eq(contract(w).status, 'company_signed');
  eq(lastMailTo(w, 'dora@example.test')?.template, 'contract_sign_candidate');
}});

Deno.test({ name: 'Link-Seite: Stand, geöffnet, Kandidat erst nach der Firma, Rücksprung, Kopie zum Herunterladen', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerName: 'Dr. Martin Kühn', signerEmail: 'm.kuehn@medtec.test' });
  const companyToken = tokenIn(lastMailTo(w, 'm.kuehn@medtec.test'));
  eq((await linkPeek(w.ctx, { token: 'x'.repeat(43) })).state, 'invalid');
  const peek = await linkPeek(w.ctx, { token: companyToken }) as any;
  eq([peek.state, peek.role, peek.companyName, peek.uploadedBy, peek.salary], ['ready', 'company', 'MedTec Süd GmbH', 'Klara Kunde', 150000]);
  assert(w.tables.employment_sign_links[0].opened_at, 'als geöffnet vermerkt');
  const started = await linkStart(w.ctx, { token: companyToken });
  assert(started.url.includes('sign/company'), 'Unterschrift startet');
  eq([w.views[0].via, w.views[0].returnUrl], ['link', `https://matchunt.ai/unterschrift/${companyToken}?zurueck=1`]);
  // Rücksprung: Stand wird geholt, Dora bekommt ihren Link
  w.state.snap = SIGNED_1 as any;
  w.clock.now += 21_000;
  eq((await linkReturned(w.ctx, { token: companyToken }) as any).state, 'signed');
  const doraToken = tokenIn(lastMailTo(w, 'dora@example.test'));
  eq((await linkPeek(w.ctx, { token: doraToken }) as any).state, 'ready');
  await linkStart(w.ctx, { token: doraToken });
  w.state.snap = { status: 'completed', signers: [{ recipientId: '1', status: 'completed', signedDateTime: '2026-10-22T13:00:00Z' }, { recipientId: '2', status: 'completed', signedDateTime: '2026-10-22T14:00:00Z' }] } as any;
  w.clock.now += 21_000;
  eq((await linkReturned(w.ctx, { token: doraToken }) as any).state, 'done');
  eq(contract(w).status, 'final');
  const copyToken = tokenIn(lastMailTo(w, 'dora@example.test'));
  assert(copyToken && copyToken !== doraToken, 'Kopie kommt mit eigenem Link');
  const copy = await linkPeek(w.ctx, { token: copyToken }) as any;
  eq([copy.state, copy.canDownload], ['done', true]);
  assert((await linkDocument(w.ctx, { token: copyToken })).url.startsWith('https://files.test/'), 'PDF abrufbar');
  // Kontext zeigt Versand und Öffnen, Headhunter ohne Adressen
  const forJulia = await contractContext(w.ctx, user(RECRUITER), { submissionId: SUB });
  eq([forJulia.signing?.companyEmail, forJulia.signing?.candidate?.email], [null, null]);
}});

Deno.test({ name: 'Kandidaten-Link vor der Firmen-Unterschrift: „noch nicht dran“; abgelaufen → neuer Link, nicht doppelt', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerName: 'Dr. Kühn', signerEmail: 'k@medtec.test' });
  await applyEnvelopeEvent(w.ctx, 'env-1', SIGNED_1 as any);
  const doraToken = tokenIn(lastMailTo(w, 'dora@example.test'));
  // künstlich: Firma doch noch offen
  w.tables.employment_contracts[0].company_signed_at = null;
  w.tables.employment_contracts[0].status = 'sent_digital';
  eq((await linkPeek(w.ctx, { token: doraToken }) as any).state, 'not_yet');
  await fails(linkStart(w.ctx, { token: doraToken }), 'Firma unterschreibt zuerst');
  w.tables.employment_contracts[0].company_signed_at = '2026-10-22T13:00:00Z';
  w.tables.employment_contracts[0].status = 'company_signed';
  w.clock.now = NOW + 15 * 86_400_000;
  eq((await linkPeek(w.ctx, { token: doraToken }) as any).state, 'expired');
  const before = w.sent.length;
  await linkRenew(w.ctx, { token: doraToken });
  await linkRenew(w.ctx, { token: doraToken });
  eq(w.sent.length - before, 1, 'innerhalb von 10 Minuten nur ein neuer Link');
  eq((await linkPeek(w.ctx, { token: tokenIn(lastMailTo(w, 'dora@example.test')) }) as any).state, 'ready');
  eq((await linkPeek(w.ctx, { token: doraToken }) as any).state, 'revoked', 'alter Link ist ersetzt');
}});

Deno.test({ name: 'Unterzeichner ändern: alter Umschlag zurück, neuer aus dem abgelegten PDF; Link erneut senden ersetzt den alten', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerName: 'Dr. Kühn', signerEmail: 'k@medtec.test' });
  const first = tokenIn(lastMailTo(w, 'k@medtec.test'));
  // erneut senden: neuer Link, alter widerrufen; Headhunter darf den Firmen-Link nicht
  await fails(resendLink(w.ctx, user(RECRUITER), { submissionId: SUB }), 'schickt der Kunde');
  await resendDigital(w.ctx, user(CLIENT), { submissionId: SUB });
  eq(w.resent.length, 0, 'über Matchunt keine DocuSign-Mail');
  const second = tokenIn(lastMailTo(w, 'k@medtec.test'));
  eq([(await linkPeek(w.ctx, { token: first }) as any).state, (await linkPeek(w.ctx, { token: second }) as any).state], ['revoked', 'ready']);
  // jetzt doch selbst
  const files = w.files.size;
  const r = await changeSigner(w.ctx, user(CLIENT), { submissionId: SUB, signerSelf: true });
  eq([w.voided, w.envelopes.length, contract(w).envelope_id, contract(w).company_signer_user_id], [['env-1'], 2, 'env-2', CLIENT]);
  eq(w.files.size, files, 'kein neues Hochladen nötig');
  assert(r.signUrl, 'Klara unterschreibt sofort');
  eq((await linkPeek(w.ctx, { token: second }) as any).state, 'withdrawn', 'Link zum alten Umschlag ist weg');
  await fails(changeSigner(w.ctx, user(CLIENT), { submissionId: SUB, signerName: 'Dora', signerEmail: 'dora@example.test' }), 'zwei verschiedene');
}});

Deno.test({ name: 'Alter Umschlag (DocuSign mailt): erneut senden bleibt DocuSign; „Unterzeichner ändern“ stellt auf Matchunt um', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerName: 'Luca', signerEmail: 'luca@firma.test' });
  // wie live vor dem 24.10.: alter Weg
  Object.assign(w.tables.employment_contracts[0], { signing_mode: 'email', company_signer_user_id: null });
  w.tables.employment_sign_links.length = 0;
  await resendDigital(w.ctx, user(CLIENT), { submissionId: SUB });
  eq(w.resent, ['env-1']);
  await changeSigner(w.ctx, user(CLIENT), { submissionId: SUB, signerName: 'Luca Bartosch', signerEmail: 'luca+firma@gmail.test' });
  eq([contract(w).signing_mode, contract(w).envelope_id, w.embedded], ['embedded', 'env-2', [true, true]]);
  eq(lastMailTo(w, 'luca+firma@gmail.test')?.template, 'contract_sign_company');
}});

Deno.test({ name: 'Erinnerungen über Matchunt: nach 24 Std., dann alle 2 Tage, höchstens 3-mal; Headhunter bei ungeöffnetem Kandidaten-Link; Fall nach 7 Tagen', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerName: 'Dr. Kühn', signerEmail: 'k@medtec.test' });
  const toKuehn = () => w.sent.filter((m) => m.to === 'k@medtec.test').map((m) => m.template);
  const H = 3_600_000;
  w.clock.now = NOW + 20 * H;
  eq((await runFollowups(w.ctx)).reminders, 0, 'vor 24 Std. nichts');
  w.clock.now = NOW + 25 * H;
  eq((await runFollowups(w.ctx)).reminders, 1);
  eq(toKuehn(), ['contract_sign_company', 'contract_sign_company_reminder']);
  w.clock.now = NOW + 49 * H;
  eq((await runFollowups(w.ctx)).reminders, 0, 'erst 2 Tage nach der letzten');
  w.clock.now = NOW + 74 * H;
  eq((await runFollowups(w.ctx)).reminders, 1);
  w.clock.now = NOW + 123 * H;
  eq((await runFollowups(w.ctx)).reminders, 1);
  w.clock.now = NOW + 172 * H;
  const last = await runFollowups(w.ctx);
  eq(last.reminders, 0, 'höchstens 3 Erinnerungen');
  eq(last.admin, 1, 'nach 7 Tagen ein Fall für Matchunt');
  eq(last.client, 0, 'keine Tag-7-Frage „ist er unterschrieben?“');
  // Die Firma unterschreibt, der Kandidat öffnet seinen Link nicht: Headhunter ruft an
  await applyEnvelopeEvent(w.ctx, 'env-1', { status: 'sent', signers: [{ recipientId: '1', status: 'completed', signedDateTime: new Date(w.clock.now).toISOString() }, { recipientId: '2', status: 'sent' }] } as any);
  w.clock.now += 25 * H;
  const r = await runFollowups(w.ctx);
  eq([r.reminders, r.recruiter], [1, 1]);
  assert(notes(w, RECRUITER, 'contract_update').some((n: any) => /Vertrags-Link nicht geöffnet/.test(n.title)), 'Julia soll anrufen');
  w.clock.now += 49 * H;
  eq((await runFollowups(w.ctx)).recruiter, 0, 'nur einmal');
}});

Deno.test({ name: 'Ich selbst: keine Erinnerungsmail an die Firma, die Aufgabe im Konto genügt', permissions: { env: true }, fn: async () => {
  const w = world();
  await accepted(w);
  await sendDigital(w.ctx, user(CLIENT), { ...DIGITAL, signerSelf: true });
  w.clock.now = NOW + 30 * 3_600_000;
  eq((await runFollowups(w.ctx)).reminders, 0);
  eq(w.sent.filter((m) => m.to === 'klara@example.test' && /sign_company/.test(m.template)).length, 0);
}});
