// Ablauftests: Einstellung und Rechnung (Paket 4a, 22.10.2026).
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fakeDb } from './fixtures/fake-db.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';
import { createOffer } from '../functions/_shared/offer-service.ts';
import { confirm, report, type ContractCtx } from '../functions/_shared/contract-service.ts';
import { adminOverview, bookPayment, invoiceFile, invoicePreview, onContractFinal, releaseInvoice, type FilePort } from '../functions/_shared/placement-service.ts';
import { BANK, NUMBERING, formatNumber, isReverseCharge } from '../functions/_shared/billing-config.ts';
import { acceptAsCandidate } from './fixtures/offer-accept.ts';

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
const OTHER_CLIENT = 'u-client-0000-0000-0000-000000000002';
const ADMIN = 'u-admin-00000-0000-0000-000000000007';
const SUB = '11111111-1111-1111-1111-111111111111';
const SUB2 = '22222222-2222-2222-2222-222222222222';

function world(taxId = 'DE123456789') {
  const counters: Record<string, number> = {};
  const { db, tables } = fakeDb({
    submissions: [
      { id: SUB, stage: 'interview_completed', status: 'interview', identity_unlocked: true, company_revealed: true, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j1' },
      { id: SUB2, stage: 'in_review', status: 'in_review', identity_unlocked: false, company_revealed: false, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: 'j2' },
    ],
    jobs: [
      { id: 'j1', title: 'Head of Sales DACH (m/w/d)', company_name: 'MedTec Süd GmbH', industry: 'Medizintechnik', client_id: CLIENT, organization_id: null, salary_min: 130000, salary_max: 160000, location: 'München', remote_type: 'hybrid', onsite_days_required: 3, benefits: [], fee_percentage: 20, mandate_id: null, status: 'published' },
      { id: 'j2', title: 'Vertriebsleiter (m/w/d)', company_name: 'Kunde B', client_id: OTHER_CLIENT, organization_id: null, fee_percentage: 20, mandate_id: null, status: 'published' },
    ],
    candidates: [{ id: 'c1', full_name: 'Dora Weber', email: 'dora@example.test', phone: null }],
    profiles: [
      { user_id: CLIENT, full_name: 'Klara Kunde', email: 'klara@example.test' },
      { user_id: RECRUITER, full_name: 'Julia Hartmann', email: 'julia@example.test' },
      { user_id: ADMIN, full_name: 'Marko Admin', email: 'admin@example.test' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }, { user_id: RECRUITER, role: 'recruiter' }, { user_id: ADMIN, role: 'admin' }],
    company_profiles: [{ user_id: CLIENT, company_name: 'MedTec Süd', legal_name: 'MedTec Süd GmbH', street: 'Leopoldstraße 120', postal_code: '80802', city: 'München', tax_id: taxId, billing_email: 'buchhaltung@medtec.test' }],
    interviews: [], offers: [], offer_events: [], offer_recommendations: [], notifications: [],
    employment_contracts: [], employment_contract_events: [], placements: [], invoices: [],
  }, {
    next_document_number: ({ _kind, _year, _start }: any) => { const k = `${_kind}-${_year}`; counters[k] = counters[k] ? counters[k] + 1 : _start; return counters[k]; },
  });
  const sent: any[] = [];
  const stored = new Map<string, Uint8Array>();
  const invoiceFiles: FilePort = { put: async (p, b) => { stored.set(p, b); }, get: async (p) => stored.get(p) ?? null, url: async (p) => (stored.has(p) ? `https://files.test/${p}` : null) };
  const ctx: ContractCtx = {
    db, ms: null, now: () => NOW, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail: InterviewMail, log) => { sent.push({ ...mail, template: log.template }); return { sent: true }; },
    sign: null, files: { put: async () => {}, get: async () => null, url: async () => null }, invoiceFiles,
  };
  return { db, tables, sent, stored, ctx };
}
const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const OFFER = { salary: 150000, variable: 20000, startDate: '2027-01-01', responseDue: '2026-10-29', contractType: 'permanent', probationMonths: 6, workModel: 'München', extras: [], message: '' };

async function signed(w: ReturnType<typeof world>, closeJob = true) {
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  await acceptAsCandidate(w.ctx, w.sent, user(RECRUITER), w.tables.offers[0].id);
  await report(w.ctx, user(RECRUITER), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, variable: 20000, startDate: '2027-01-01', closeJob });
  await confirm(w.ctx, user(CLIENT), { submissionId: SUB, way: 'yes' });
}
function withConfig(fn: () => Promise<void>) {
  return async () => {
    const backup = { t: NUMBERING.invoice.template, s: NUMBERING.invoice.startNext, iban: BANK.iban, holder: BANK.holder };
    NUMBERING.invoice.template = 'RE-{YYYY}-{NNNN}'; NUMBERING.invoice.startNext = 42; BANK.iban = 'DE00 1234 5678 9012 3456 78'; BANK.holder = 'Bluewater & Bridge GmbH';
    try { await fn(); } finally { NUMBERING.invoice.template = backup.t; NUMBERING.invoice.startNext = backup.s; BANK.iban = backup.iban; BANK.holder = backup.holder; }
  };
}

Deno.test({ name: 'Verbindlich → genau ein Placement, Bewerbung eingestellt, andere Einreichung zurückgezogen, Stelle besetzt, Rechnungsentwurf', permissions: { env: true }, fn: async () => {
  const w = world();
  await signed(w);
  eq(w.tables.placements.length, 1);
  const p = w.tables.placements[0];
  eq([p.agreed_salary, p.gross_annual_target_compensation_cents, p.client_fee_cents, p.recruiter_initial_cents, p.matchunt_cents, p.placement_state], [170000, 17000000, 3400000, 2550000, 850000, 'agreed']);
  eq(w.tables.submissions.map((s: any) => s.stage), ['placed', 'withdrawn']);
  assert(w.tables.notifications.some((n: any) => n.user_id === OTHER_CLIENT && n.type === 'candidate_unavailable' && n.message.startsWith('Ein Kandidat')), 'Kunde B erfährt es, ohne Namen');
  eq([w.tables.jobs[0].status, w.tables.jobs[0].closed_hire_submission_id], ['filled', SUB]);
  const inv = w.tables.invoices[0];
  eq([inv.status, inv.amount_cents, inv.tax_amount_cents, inv.total_amount_cents, inv.reverse_charge, inv.recipient.email], ['draft', 3400000, 646000, 4046000, false, 'buchhaltung@medtec.test']);
  assert(inv.invoice_number.startsWith('ENTWURF-'), 'Entwurf ohne feste Nummer');
  assert(w.tables.notifications.some((n: any) => n.user_id === ADMIN && n.type === 'invoice_draft'), 'Matchunt soll freigeben');
  // zweiter Aufruf legt nichts doppelt an
  await onContractFinal(w.ctx as any, w.tables.employment_contracts[0].id);
  eq([w.tables.placements.length, w.tables.invoices.length], [1, 1]);
}});

Deno.test({ name: 'Ohne Häkchen bleibt die Stelle offen; EU-Kunde mit USt-ID bekommt Reverse Charge', permissions: { env: true }, fn: async () => {
  const w = world('ATU12345678');
  await signed(w, false);
  eq(w.tables.jobs[0].status, 'published');
  eq([w.tables.invoices[0].reverse_charge, w.tables.invoices[0].tax_amount_cents, w.tables.invoices[0].vat_rate], [true, 0, 0]);
  eq([isReverseCharge('DE123456789'), isReverseCharge('ATU12345678'), isReverseCharge('')], [false, true, false]);
  eq(formatNumber('RE-{YYYY}-{NNNN}', 2026, 42), 'RE-2026-0042');
}});

Deno.test({ name: 'Freigabe gesperrt ohne Nummernkreis und Bankverbindung; Vorschau nur für Matchunt', permissions: { env: true }, fn: async () => {
  const w = world();
  await signed(w);
  const id = w.tables.invoices[0].id;
  await fails(releaseInvoice(w.ctx as any, user(ADMIN), { invoiceId: id }), 'Nummernkreis');
  await fails(invoicePreview(w.ctx as any, user(CLIENT), { invoiceId: id }), 'Nur für Matchunt');
  const preview = await invoicePreview(w.ctx as any, user(ADMIN), { invoiceId: id });
  assert(preview.pdfBase64.length > 1000 && preview.blockers.length === 2, 'Entwurfs-PDF und Sperrgründe');
  await fails(invoiceFile(w.ctx as any, user(CLIENT), { invoiceId: id }), 'noch nicht gestellt');
}});

Deno.test({ name: 'Freigabe: Nummer im Anschluss, PDF, Mail mit Anhang an die Rechnungs-E-Mail; Zahlung teilweise, dann voll', permissions: { env: true }, fn: withConfig(async () => {
  const w = world();
  await signed(w);
  const id = w.tables.invoices[0].id;
  const r = await releaseInvoice(w.ctx as any, user(ADMIN), { invoiceId: id });
  eq([r.number, r.sent], ['RE-2026-0042', true]);
  const inv = w.tables.invoices[0];
  eq([inv.status, inv.issued_at, inv.due_date, inv.sent_to], ['open', '2026-10-22', '2026-11-05', 'buchhaltung@medtec.test']);
  assert(w.stored.has(inv.pdf_path), 'PDF abgelegt');
  const mail = w.sent.find((m) => m.template === 'invoice_issued');
  assert(mail?.to === 'buchhaltung@medtec.test' && mail.attachments?.[0]?.contentType === 'application/pdf', 'Mail mit PDF');
  eq(w.tables.placements[0].invoice_state, 'invoiced');
  assert(w.tables.notifications.some((n: any) => n.user_id === CLIENT && n.type === 'invoice_issued'), 'Kunde sieht die Rechnung');
  await fails(releaseInvoice(w.ctx as any, user(ADMIN), { invoiceId: id }), 'schon gestellt');
  eq((await invoiceFile(w.ctx as any, user(CLIENT), { invoiceId: id })).url.includes(inv.pdf_path), true);
  await fails(invoiceFile(w.ctx as any, user(RECRUITER), { invoiceId: id }), 'Berechtigung');

  await bookPayment(w.ctx as any, user(ADMIN), { invoiceId: id, paidOn: '2026-10-22', amountCents: 2000000 });
  eq([w.tables.invoices[0].status, w.tables.placements[0].invoice_state], ['partially_paid', 'invoiced']);
  await bookPayment(w.ctx as any, user(ADMIN), { invoiceId: id, paidOn: '2026-10-22', amountCents: 2046000 });
  eq([w.tables.invoices[0].status, w.tables.placements[0].invoice_state], ['paid', 'paid']);
  assert(w.tables.notifications.some((n: any) => n.user_id === RECRUITER && n.type === 'placement_paid'), 'Julia erfährt die Zahlung');

  const o = await adminOverview(w.ctx as any, user(ADMIN));
  eq([o.rows.length, o.rows[0].next.key, o.kpis.openCents, o.blockers.length], [1, 'wait_start', 0, 0]);
})});
