// Ablauftests: Besetzungen und Rechnungen für Kunden (Etappe 1, 25.10.2026).
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { fakeDb } from './fixtures/fake-db.ts';
import type { InterviewMail } from '../functions/_shared/interview-mailer.ts';
import { createOffer } from '../functions/_shared/offer-service.ts';
import { confirm, report, type ContractCtx } from '../functions/_shared/contract-service.ts';
import { invoiceFile, invoicePreview, releaseInvoice, type FilePort } from '../functions/_shared/placement-service.ts';
import { clientOverview, moveStart, nonStartDocument, reportDeparture, setPurchaseOrder } from '../functions/_shared/besetzung-service.ts';
import { clientInvoices, invoiceFiles, updateBillingSettings } from '../functions/_shared/billing-service.ts';
import { confirmStart, deriveClientTasks, invoicePaid, loadClientTaskInput } from '../functions/_shared/client-tasks.ts';
import { acceptAsCandidate } from './fixtures/offer-accept.ts';
import { BANK, NUMBERING } from '../functions/_shared/billing-config.ts';

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
const FIN = 'u-finance-000-0000-0000-000000000011';
const HM = 'u-hm-00000000-0000-0000-000000000012';
const HR = 'u-hr-00000000-0000-0000-000000000013';
const SUB = '11111111-1111-1111-1111-111111111111';
const J1 = '33333333-3333-3333-3333-333333333333';

const CONTINUITY_90 = {
  packageKey: 'continuity_90', publicName: 'Matchunt Continuity 90', clientFeePct: 23, continuityDays: 90, claimNoticeDays: 14,
  recruiterInitialPct: 10, recruiterRetentionPct: 5,
  eligibleClaimCategories: ['no_show', 'candidate_resigned', 'candidate_terminated_probation', 'employer_performance', 'employer_fit', 'employer_terminated_probation', 'mutual_separation_probation'],
  excludedClaimCategories: ['redundancy', 'restructuring', 'position_eliminated', 'economic_dismissal', 'role_materially_changed'],
};

function world(opts: { company?: Record<string, unknown>; org?: boolean } = {}) {
  const counters: Record<string, number> = {};
  const org = opts.org ?? false;
  const { db, tables } = fakeDb({
    submissions: [{ id: SUB, stage: 'interview_completed', status: 'interview', identity_unlocked: true, company_revealed: true, recruiter_id: RECRUITER, candidate_id: 'c1', job_id: J1 }],
    jobs: [{ id: J1, title: 'Head of Sales DACH (m/w/d)', company_name: 'MedTec Süd GmbH', client_id: CLIENT, organization_id: org ? 'o1' : null, salary_min: 130000, salary_max: 160000, fee_percentage: 20, mandate_id: null, status: 'published', benefits: [] }],
    candidates: [{ id: 'c1', full_name: 'Dora Weber', email: 'dora@example.test', phone: null }],
    profiles: [
      { user_id: CLIENT, full_name: 'Klara Kunde', email: 'klara@example.test' },
      { user_id: RECRUITER, full_name: 'Julia Hartmann', email: 'julia@example.test' },
      { user_id: ADMIN, full_name: 'Marko Admin', email: 'admin@example.test' },
      { user_id: FIN, full_name: 'Bea Buchhaltung', email: 'bea@example.test' },
    ],
    user_roles: [{ user_id: CLIENT, role: 'client' }, { user_id: RECRUITER, role: 'recruiter' }, { user_id: ADMIN, role: 'admin' }, { user_id: FIN, role: 'client' }, { user_id: HM, role: 'client' }, { user_id: HR, role: 'client' }],
    company_profiles: [{ id: 'cp1', user_id: CLIENT, company_name: 'MedTec Süd', legal_name: 'MedTec Süd GmbH', street: 'Leopoldstraße 120', postal_code: '80802', city: 'München', tax_id: 'DE123456789', billing_email: 'buchhaltung@medtec.test', billing_cc_emails: [], purchase_order_required: false, default_cost_center: null, ...(opts.company ?? {}) }],
    organizations: org ? [{ id: 'o1', owner_id: CLIENT, type: 'client' }] : [],
    organization_members: org ? [
      { organization_id: 'o1', user_id: FIN, role: 'finance', status: 'active' },
      { organization_id: 'o1', user_id: HM, role: 'hiring_manager', status: 'active' },
      { organization_id: 'o1', user_id: HR, role: 'hr', status: 'active' },
    ] : [],
    job_collaborators: org ? [{ id: 'jc1', job_id: J1, user_id: HM }] : [],
    interviews: [], offers: [], offer_events: [], offer_recommendations: [], notifications: [], messages: [], client_task_log: [],
    employment_contracts: [], employment_contract_events: [], placements: [], invoices: [], continuity_claims: [],
  }, {
    next_document_number: ({ _kind, _year, _start }: any) => { const k = `${_kind}-${_year}`; counters[k] = counters[k] ? counters[k] + 1 : _start; return counters[k]; },
  });
  const sent: any[] = [];
  const stored = new Map<string, Uint8Array>();
  const docs = new Map<string, { bytes: Uint8Array; type?: string }>();
  const invoiceFiles: FilePort = { put: async (p, b) => { stored.set(p, b); }, get: async (p) => stored.get(p) ?? null, url: async (p) => (stored.has(p) ? `https://files.test/${p}` : null) };
  const placementFiles: FilePort = { put: async (p, b, type) => { docs.set(p, { bytes: b, type }); }, get: async () => null, url: async () => null };
  const clock = { now: NOW };
  const ctx: ContractCtx & { placementFiles: FilePort } = {
    db, ms: null, now: () => clock.now, appUrl: () => 'https://matchunt.ai', fromEmail: 'termine@matchunt.ai',
    mail: async (mail: InterviewMail, log: any) => { sent.push({ ...mail, template: log.template }); return { sent: true }; },
    sign: null, files: { put: async () => {}, get: async () => null, url: async () => null }, invoiceFiles, placementFiles,
  } as any;
  return { db, tables, sent, docs, ctx, clock };
}
const user = (id: string) => ({ id, email: `${id}@example.test`, user_metadata: {} }) as unknown as User;
const OFFER = { salary: 150000, variable: 20000, startDate: '2027-01-01', responseDue: '2026-10-29', contractType: 'permanent', probationMonths: 6, workModel: 'München', extras: [], message: '' };
const at = (w: ReturnType<typeof world>, iso: string) => { w.clock.now = Date.parse(`${iso}T10:00:00Z`); };

async function signed(w: ReturnType<typeof world>) {
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  await acceptAsCandidate(w.ctx, w.sent, user(RECRUITER), w.tables.offers[0].id);
  await report(w.ctx, user(RECRUITER), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, variable: 20000, startDate: '2027-01-01', closeJob: false });
  await confirm(w.ctx, user(CLIENT), { submissionId: SUB, way: 'yes' });
  return w.tables.placements[0];
}
async function started(w: ReturnType<typeof world>) {
  const p = await signed(w);
  at(w, '2027-01-05');
  await confirmStart(w.ctx, user(CLIENT), { placementId: p.id, way: 'started' });
  return p;
}
function withConfig(fn: () => Promise<void>) {
  return async () => {
    const backup = { t: NUMBERING.invoice.template, s: NUMBERING.invoice.startNext, iban: BANK.iban, holder: BANK.holder };
    NUMBERING.invoice.template = 'RE-{YYYY}-{NNNN}'; NUMBERING.invoice.startNext = 42; BANK.iban = 'DE00 1234 5678 9012 3456 78'; BANK.holder = 'Bluewater & Bridge GmbH';
    try { await fn(); } finally { NUMBERING.invoice.template = backup.t; NUMBERING.invoice.startNext = backup.s; BANK.iban = backup.iban; BANK.holder = backup.holder; }
  };
}
const tasksOf = async (w: ReturnType<typeof world>, id = CLIENT) => deriveClientTasks(await loadClientTaskInput(w.db as any, id, [J1], w.clock.now)).tasks;

Deno.test({ name: 'Bestellnummer Pflicht: Aufgabe, Freigabe gesperrt, danach auf Rechnung und an alle Empfänger', permissions: { env: true }, fn: withConfig(async () => {
  const w = world({ company: { purchase_order_required: true, billing_cc_emails: ['controlling@medtec.test'], default_cost_center: '4100' } });
  const p = await signed(w);
  const draft = w.tables.invoices[0];
  eq([draft.purchase_order, draft.cost_center], [null, '4100'], 'Standard-Kostenstelle auf dem Entwurf');
  assert((await tasksOf(w)).some((t) => t.key === `po:${p.id}` && t.kind === 'purchase_order'), 'Kunde bekommt die Aufgabe');
  await fails(releaseInvoice(w.ctx as any, user(ADMIN), { invoiceId: draft.id }), 'Bestellnummer');
  assert((await invoicePreview(w.ctx as any, user(ADMIN), { invoiceId: draft.id })).blockers.includes('Bestellnummer des Kunden'), 'Vorschau nennt den Grund');

  await fails(setPurchaseOrder(w.ctx as any, user(RECRUITER), { placementId: p.id, purchaseOrder: 'X' }), 'Berechtigung');
  await setPurchaseOrder(w.ctx as any, user(CLIENT), { placementId: p.id, purchaseOrder: '4500-1182', costCenter: '' });
  eq([w.tables.placements[0].purchase_order, w.tables.invoices[0].purchase_order, w.tables.invoices[0].cost_center], ['4500-1182', '4500-1182', '4100'], 'leere Kostenstelle lässt die hinterlegte stehen');
  assert(w.tables.notifications.some((n: any) => n.user_id === ADMIN && n.type === 'invoice_purchase_order'), 'Matchunt erfährt es');
  assert(!(await tasksOf(w)).some((t) => t.kind === 'purchase_order'), 'Aufgabe erledigt');

  const r = await releaseInvoice(w.ctx as any, user(ADMIN), { invoiceId: draft.id });
  eq(r.sent, true);
  eq([w.tables.invoices[0].purchase_order, w.tables.invoices[0].sent_to], ['4500-1182', 'buchhaltung@medtec.test, controlling@medtec.test']);
  eq(w.sent.filter((m) => m.template === 'invoice_issued').map((m) => m.to), ['buchhaltung@medtec.test', 'controlling@medtec.test']);
})});

Deno.test({ name: 'Übersicht: Angebot → Bis zum Start → Im Haus → Abgeschlossen (Core 6 Monate)', permissions: { env: true }, fn: async () => {
  const w = world();
  await createOffer(w.ctx, user(CLIENT), { submissionId: SUB, ...OFFER });
  let o = await clientOverview(w.ctx as any, user(CLIENT));
  eq([o.items.length, o.items[0].group, o.items[0].dran, o.items[0].name, o.counts.angebot], [1, 'angebot', 'recruiter', 'Dora Weber', 1]);
  eq([o.items[0].package.key, o.items[0].feeCents], ['core', 3400000], 'Honorar aus Angebot und Satz');

  await acceptAsCandidate(w.ctx, w.sent, user(RECRUITER), w.tables.offers[0].id);
  o = await clientOverview(w.ctx as any, user(CLIENT));
  eq([o.items[0].group, o.items[0].placement], ['start', null]);

  const p = await (async () => { await report(w.ctx, user(RECRUITER), { submissionId: SUB, signedOn: '2026-10-22', salary: 150000, variable: 20000, startDate: '2027-01-01', closeJob: false }); await confirm(w.ctx, user(CLIENT), { submissionId: SUB, way: 'yes' }); return w.tables.placements[0]; })();
  o = await clientOverview(w.ctx as any, user(CLIENT));
  eq([o.items[0].group, o.items[0].placement.id, o.items[0].can.moveStart, o.items[0].can.departure], ['start', p.id, true, false]);
  eq(o.kpis.nextStart, { date: '2027-01-01', name: 'Dora Weber' });

  at(w, '2027-01-05');
  await confirmStart(w.ctx, user(CLIENT), { placementId: p.id, way: 'started' });
  o = await clientOverview(w.ctx as any, user(CLIENT));
  eq([o.items[0].group, o.items[0].placement.coreUntil, o.items[0].can.departure], ['haus', '2027-07-01', true]);
  at(w, '2027-07-02');
  o = await clientOverview(w.ctx as any, user(CLIENT));
  eq(o.items[0].group, 'ab');
  eq((await clientOverview(w.ctx as any, user(RECRUITER))).items.length, 0, 'Headhunter sieht die Kundenseite nicht');
}});

Deno.test({ name: 'Start verschoben: nur vorher, nicht in die Vergangenheit, Julia und Matchunt erfahren es', permissions: { env: true }, fn: async () => {
  const w = world();
  const p = await signed(w);
  await fails(moveStart(w.ctx as any, user(CLIENT), { placementId: p.id, startDate: '2026-10-01' }), 'Vergangenheit');
  await fails(moveStart(w.ctx as any, user(CLIENT), { placementId: p.id, startDate: '2027-01-01' }), 'schon der geplante');
  await fails(moveStart(w.ctx as any, user(RECRUITER), { placementId: p.id, startDate: '2027-02-01' }), 'Berechtigung');
  const r = await moveStart(w.ctx as any, user(CLIENT), { placementId: p.id, startDate: '2027-02-01', note: 'Kündigungsfrist länger' });
  eq([r.startDate, w.tables.placements[0].first_working_day, w.tables.placements[0].start_moved_note], ['2027-02-01', '2027-02-01', 'Kündigungsfrist länger']);
  assert(w.tables.notifications.some((n: any) => n.user_id === RECRUITER && n.type === 'placement_start_moved'), 'Julia erfährt es');
  assert(w.tables.notifications.some((n: any) => n.user_id === ADMIN && n.type === 'placement_start_moved' && n.message.includes('01.02.2027')), 'Matchunt erfährt es');
}});

Deno.test({ name: 'Nichtantritt: Erklärung erst nach der Meldung, Typ und Größe geprüft, landet in der Ablage', permissions: { env: true }, fn: async () => {
  const w = world();
  const p = await signed(w);
  const pdf = btoa('%PDF-1.4 Erklärung'.replace('ä', 'ae'));
  await fails(nonStartDocument(w.ctx as any, user(CLIENT), { placementId: p.id, fileName: 'e.pdf', fileBase64: pdf }), 'zuerst den Nichtantritt');
  at(w, '2027-01-03');
  await confirmStart(w.ctx, user(CLIENT), { placementId: p.id, way: 'not_started', reason: 'counter_offer' });
  let o = await clientOverview(w.ctx as any, user(CLIENT));
  eq([o.items[0].group, o.items[0].can.nonStartDocument], ['ab', true]);
  await fails(nonStartDocument(w.ctx as any, user(CLIENT), { placementId: p.id, fileName: 'e.exe', fileBase64: pdf }), 'PDF');
  await fails(nonStartDocument(w.ctx as any, user(CLIENT), { placementId: p.id, fileName: 'e.pdf', fileBase64: btoa('x'.repeat(5 * 1024 * 1024 + 1)) }), '5 MB');
  await nonStartDocument(w.ctx as any, user(CLIENT), { placementId: p.id, fileName: 'Erklärung Dora.pdf', fileBase64: pdf });
  const path = w.tables.placements[0].non_start_document_path;
  assert(path?.startsWith(`${p.id}/nichtantritt-`) && w.docs.get(path)?.type === 'application/pdf', 'abgelegt als PDF');
  assert(w.tables.notifications.some((n: any) => n.user_id === ADMIN && n.type === 'placement_non_start_document'), 'Matchunt erfährt es');
  o = await clientOverview(w.ctx as any, user(CLIENT));
  eq([o.items[0].placement.nonStartDocument, o.items[0].can.nonStartDocument], [true, false]);
}});

Deno.test({ name: 'Ausgeschieden mit Core: nur Meldung, Einstellung endet, kein Fall', permissions: { env: true }, fn: async () => {
  const w = world();
  const p = await started(w);
  at(w, '2027-02-12');
  await fails(reportDeparture(w.ctx as any, user(CLIENT), { placementId: p.id, category: 'candidate_resigned', eventOn: '2027-02-10', lastDay: '2027-03-10', knownOn: '2027-02-09' }), 'zwischen Kündigung und heute');
  await fails(reportDeparture(w.ctx as any, user(CLIENT), { placementId: p.id, category: 'candidate_resigned', eventOn: '2026-12-10', lastDay: '2027-03-10', knownOn: '2027-02-10' }), 'vor dem ersten Arbeitstag');
  const r = await reportDeparture(w.ctx as any, user(CLIENT), { placementId: p.id, category: 'candidate_resigned', eventOn: '2027-02-10', lastDay: '2027-03-10', knownOn: '2027-02-10', note: 'Wechsel zur Konkurrenz' });
  eq([r.outcome, w.tables.placements[0].placement_state, w.tables.placements[0].ended_at, w.tables.continuity_claims.length], ['no_continuity', 'ended_early', '2027-03-10', 0]);
  assert(w.tables.notifications.some((n: any) => n.user_id === ADMIN && n.title.startsWith('Ausscheiden gemeldet')), 'Matchunt erfährt es');
  assert(w.tables.notifications.some((n: any) => n.user_id === RECRUITER && n.type === 'placement_departure'), 'Julia erfährt es');
  await fails(reportDeparture(w.ctx as any, user(CLIENT), { placementId: p.id, category: 'candidate_resigned', eventOn: '2027-02-10', lastDay: '2027-03-10', knownOn: '2027-02-10' }), 'schon gemeldet');
  eq((await clientOverview(w.ctx as any, user(CLIENT))).items[0].group, 'ab');
}});

Deno.test({ name: 'Ausgeschieden mit Continuity 90: zugelassener Grund wird Fall; ausgeschlossen, verspätet, außerhalb nicht', permissions: { env: true }, fn: async () => {
  const cont = async (category: string, eventOn: string, knownOn: string, today: string) => {
    const w = world();
    const p = await started(w);
    Object.assign(w.tables.placements[0], { pricing_snapshot: CONTINUITY_90, package_key: 'continuity_90', continuity_end_date: '2027-04-01' });
    at(w, today);
    const r = await reportDeparture(w.ctx as any, user(CLIENT), { placementId: p.id, category, eventOn, lastDay: '2027-05-31', knownOn });
    return { w, r };
  };
  const ok = await cont('candidate_resigned', '2027-02-10', '2027-02-10', '2027-02-12');
  eq([ok.r.outcome, ok.r.deadline, ok.w.tables.continuity_claims.length, ok.w.tables.continuity_claims[0]?.deadline, ok.w.tables.placements[0].continuity_state, ok.w.tables.placements[0].placement_state],
    ['claim', '2027-02-24', 1, '2027-02-24', 'claim_open', 'started']);
  assert(ok.w.tables.notifications.some((n: any) => n.user_id === ADMIN && n.title.startsWith('Continuity-Fall prüfen')), 'Matchunt prüft');
  const o = await clientOverview(ok.w.ctx as any, user(CLIENT));
  eq([o.items[0].group, o.items[0].placement.claim.status, o.items[0].placement.reportUntil], ['haus', 'submitted', '2027-04-15']);

  eq((await cont('redundancy', '2027-02-10', '2027-02-10', '2027-02-12')).r.outcome, 'excluded');
  eq((await cont('candidate_resigned', '2027-02-10', '2027-02-10', '2027-03-01')).r.outcome, 'late');
  const out = await cont('candidate_resigned', '2027-04-10', '2027-04-10', '2027-04-12');
  eq([out.r.outcome, out.w.tables.continuity_claims.length, out.w.tables.placements[0].placement_state], ['outside', 0, 'ended_early']);
}});

Deno.test({ name: 'Rechnungen: Buchhaltung sieht alle Belege, keine Profile; Hiring Manager nicht; Rechnungsdaten nur Inhaber/Admin/Buchhaltung', permissions: { env: true }, fn: withConfig(async () => {
  const w = world({ org: true });
  await signed(w);
  const id = w.tables.invoices[0].id;
  eq((await clientInvoices(w.ctx as any, user(FIN))).invoices.length, 0, 'Entwurf sieht nur Matchunt');
  await releaseInvoice(w.ctx as any, user(ADMIN), { invoiceId: id });

  const fin = await clientInvoices(w.ctx as any, user(FIN));
  eq([fin.invoices.length, fin.financeOnly, fin.canManage, fin.invoices[0].submissionId, fin.invoices[0].candidateName, fin.invoices[0].number], [1, true, true, null, 'Dora Weber', 'RE-2026-0042']);
  eq([fin.totals.openCents, fin.totals.openCount, fin.totals.nextDue, fin.settings.billingEmail, fin.settings.bank?.holder], [4046000, 1, '2026-11-05', 'buchhaltung@medtec.test', 'Bluewater & Bridge GmbH']);
  const owner = await clientInvoices(w.ctx as any, user(CLIENT));
  eq([owner.invoices.length, owner.financeOnly, owner.invoices[0].submissionId], [1, false, SUB]);
  const hm = await clientInvoices(w.ctx as any, user(HM));
  eq([hm.invoices.length, hm.canSee, fin.canSee, owner.canSee], [0, false, true, true], 'Hiring Manager sieht keine Rechnungen, auch keinen Menüpunkt');
  const hr = await clientInvoices(w.ctx as any, user(HR));
  eq([hr.invoices.length, hr.canSee, hr.canManage], [1, true, false], 'HR sieht, ändert aber nicht');

  assert((await invoiceFile(w.ctx as any, user(FIN), { invoiceId: id })).url.includes('RE-2026-0042'), 'Buchhaltung holt das PDF');
  await fails(invoiceFile(w.ctx as any, user(HM), { invoiceId: id }), 'Berechtigung');
  eq((await invoiceFiles(w.ctx as any, user(FIN), { invoiceIds: [id] })).files.length, 1);
  eq((await invoiceFiles(w.ctx as any, user(HM), { invoiceIds: [id] })).files.length, 0);
  await invoicePaid(w.ctx as any, user(FIN), { invoiceId: id, paidOn: '2026-10-22' });
  eq((await clientInvoices(w.ctx as any, user(FIN))).invoices[0].reportedPaidOn, '2026-10-22');

  await fails(updateBillingSettings(w.ctx as any, user(HR), { purchaseOrderRequired: true }), 'dürfen');
  await fails(updateBillingSettings(w.ctx as any, user(FIN), { ccEmails: ['kein-mail'] }), 'gültige');
  const s = await updateBillingSettings(w.ctx as any, user(FIN), { ccEmails: ['Controlling@MedTec.test'], purchaseOrderRequired: true, defaultCostCenter: '4100' });
  eq([s.settings.ccEmails, s.settings.purchaseOrderRequired, s.settings.defaultCostCenter], [['controlling@medtec.test'], true, '4100']);
  eq(w.tables.company_profiles[0].purchase_order_required, true, 'Profil des Inhabers geändert');
  eq((await clientOverview(w.ctx as any, user(FIN))).items.length, 0, 'Buchhaltung sieht keine Besetzungen');
})});
