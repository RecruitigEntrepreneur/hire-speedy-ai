import { callFunction } from '@/lib/interviewScheduling';

/**
 * Admin-Buchhaltung (Umbau 11.11.2026): Aufrufe der Edge Function „buchhaltung“.
 * A1–A9 (Besetzungen), A10/J6 (Pakete & Konditionen), J1 (Joker), F1 (Zusammenarbeit).
 */

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('buchhaltung', { action, ...body }, fallback);

// ---------------------------------------------------------------------------
// A1/A2
// ---------------------------------------------------------------------------

export interface Step { key: string; label: string; action: boolean }

export interface TrancheView {
  type: 'initial' | 'retention' | 'research_bounty'; label: string; status: string; amountCents: number;
  dueNow: boolean; dueSince: string | null; waitingFor: string | null; runName: string | null; creditNoteNumber: string | null; payUntil: string | null;
}

export interface FahrplanRow {
  placementId: string; submissionId: string; candidateName: string; companyName: string; jobTitle: string;
  recruiterName: string | null; recruiterFirst: string | null; packageKey: string | null; packageLabel: string; conditionsVersion: number;
  startDate: string | null; placementState: string; invoiceState: string; researchState: string;
  clientFeeCents: number; recruiterInitialCents: number; recruiterRetentionCents: number; bountyCents: number | null; matchuntCents: number; core: boolean;
  replacementFor: string | null;
  invoice: { id: string; number: string | null; status: string; totalCents: number; openCents: number; dueDate: string | null; overdue: boolean } | null;
  claimId: string | null;
  tranches: TrancheView[];
  next: Step;
}

export interface InvoiceItem {
  id: string; number: string | null; type: string; status: string; issuedAt: string | null; dueDate: string | null; signedOn: string | null;
  netCents: number; totalCents: number; paidCents: number; openCents: number; paidAt: string | null;
  recipient: string | null; email: string | null; candidateName: string | null; jobTitle: string | null; placementId: string;
  overdue: boolean; releaseBy: string | null; workdaysLeft: number | null;
  purchaseOrder: string | null; poFollows: boolean; poRequired: boolean;
  reminderSentAt: string | null; dunningLevel: number; lastDunning: { level: number; sentAt: string | null; payUntil: string | null } | null; dunningAllowed: boolean;
  hasPdf: boolean; sentAt: string | null; sentTo: string | null;
  cancelledAt: string | null; cancelledByNumber: string | null; correctsNumber: string | null; cancelReason: string | null; reportedPaidOn: string | null;
}

export interface Overview {
  today: string;
  rows: FahrplanRow[];
  invoices: InvoiceItem[];
  kpis: {
    drafts: number; draftsUntil: string | null; openCents: number; overdueCents: number; dunnable: number;
    run: { period: string; runName: string; deadline: string; opensOn: string; items: number; blockedItems: number };
  };
  blockers: string[];
}

export interface Check { key?: string; state: 'ok' | 'fail' | 'info'; label: string }

export interface InvoiceCheck {
  invoice: { id: string; company: string; totalCents: number; netCents: number; candidateName: string | null; jobTitle: string | null; type: string };
  pdfBase64: string; checks: Check[]; canRelease: boolean; poFollowsPossible: boolean; email: string | null; cc: string[];
}

export interface DunningPreview {
  invoice: { id: string; number: string; recipient: string | null; totalCents: number; paidCents: number; openCents: number; dueDate: string | null; issuedAt: string | null; reminderSentAt: string | null; dunningLevel: number; subject: string | null };
  options: { level: 1 | 2 | 3; label: string; allowed: boolean; why: string | null }[];
  history: { level: number; sentAt: string | null; payUntil: string | null; sentTo: string | null; interestCents: number; feeCents: number; note: string | null }[];
  level: 1 | 2 | 3; basePct: number | null; basePctFromConfig: number | null;
  amounts: { openCents: number; interestCents: number; interestDays: number; ratePct: number | null; feeCents: number; totalCents: number };
  payUntil: string | null; recipients: { to: string | null; cc: string[] }; preview: { subject: string; text: string } | null;
}

export interface CorrectionPreview {
  invoice: {
    id: string; number: string; type: string; status: string; totalCents: number; netCents: number; paidCents: number; dueDate: string | null; company: string | null; candidateName: string | null;
    purchaseOrder: string | null; costCenter: string | null; recipient: { name: string; street: string; city: string; country: string; vatId: string };
    grossCents: number | null; clientFeePct: number | null;
  };
  canCancelOnly: boolean; salaryChangeable: boolean; salaryLockedWhy: string | null;
  blockers: { cancellation: string[]; invoice: string[] };
  sampleNumbers: { cancellation: string | null; invoice: string | null };
}

export interface CorrectionChanges { purchaseOrder?: string; costCenter?: string; name?: string; street?: string; city?: string; country?: string; vatId?: string; grossCents?: number }

// ---------------------------------------------------------------------------
// A6
// ---------------------------------------------------------------------------

export interface Suggestion { kind: 'invoice' | 'credit_note' | 'credit_run' | 'none'; targetId: string | null; label: string; detail: string; safe: boolean; remainingCents?: number }
export interface BankTx {
  id: string; bookedOn: string; amountCents: number; counterparty: string | null; counterpartyIban: string | null; purpose: string | null;
  status: string; invoiceId: string | null; creditNoteId: string | null; bookedAt: string | null; suggestion: Suggestion | null; target?: string | null;
}
export interface PaymentsOverview {
  lastImport: { fileName: string; format: string; periodFrom: string | null; periodTo: string | null; rows: number; createdAt: string } | null;
  open: BankTx[]; safeCount: number; booked: BankTx[]; hiddenCount: number;
  reported: { id: string; number: string; candidateName: string | null; reportedOn: string; openCents: number }[];
  targets: {
    invoices: { id: string; number: string; openCents: number; recipient: string | null; candidateName: string | null }[];
    creditNotes: { id: string; number: string; totalCents: number; recruiterName: string | null }[];
  };
}
export interface ImportResult { ok: true; format: string; periodFrom: string | null; periodTo: string | null; imported: number; duplicates: number; skipped: number; warnings: string[] }

// ---------------------------------------------------------------------------
// A7
// ---------------------------------------------------------------------------

export interface RunGroup {
  recruiterId: string; name: string; taxMode: 'standard' | 'small_business' | 'foreign'; taxLabel: string; blocked: string | null; ibanMasked: string | null;
  netCents: number; vatCents: number; totalCents: number;
  items: { trancheId: string; placementId: string; short: string; label: string; candidateName: string; companyName: string; amountCents: number; dueSince: string | null }[];
}
export interface CreditNoteItem { id: string; number: string; status: string; recruiterName: string | null; netCents: number; vatCents: number; totalCents: number; payUntil: string | null; paidOn: string | null; sentAt: string | null; hasPdf: boolean; ibanMasked: string | null }
export interface CreditRunView { id: string; period: string; label: string; runName: string; status: string; issuedAt: string; sepaCreatedAt: string | null; totalCents: number; openCents: number; notes: CreditNoteItem[] }
export interface CreditRunOverview {
  period: string; label: string; runName: string; opensOn: string; deadline: string; payUntil: string; issued: boolean; canCreate: boolean;
  blockers: string[]; groups: RunGroup[];
  totals: { netCents: number; vatCents: number; totalCents: number; notes: number; items: number };
  blockedItems: number; laterCount: number; runs: CreditRunView[];
  objections: { id: string; creditNoteId: string; number: string | null; recruiterName: string | null; topic: string; note: string; createdAt: string }[];
  sepaReady: boolean;
}

// ---------------------------------------------------------------------------
// A8, J1
// ---------------------------------------------------------------------------

export interface CaseItem {
  kind: 'claim' | 'joker' | 'research' | 'waiting' | 'offer' | 'start' | 'shaky' | 'report';
  group: string; id: string; placementId: string | null; title: string; detail: string; action: string | null; since: string | null; warn?: boolean; ownerId?: string | null; jobId?: string | null;
}
export interface Consequence { title: string; lines: string[] }
export interface CaseDetail {
  claim: { id: string; kind: 'departure' | 'non_start'; status: string; reason: string; reasonText: string; note: string | null; separationDate: string; knownAt: string; reportedAt: string; deadline: string | null; statement: string | null; statementAt: string | null; clientSphereSuggested: boolean };
  placement: { id: string; candidateName: string; firstName: string; companyName: string; jobTitle: string; recruiterName: string | null; recruiterFirst: string | null; packageLabel: string; conditionsVersion: number; continuityEnd: string | null; firstWorkingDay: string | null; clientFeeCents: number };
  checks: Check[]; documents: { label: string; path: string }[];
  consequences: { client: Consequence; recruiter: Consequence; bounty: Consequence; matchunt: Consequence };
  clientSphere: { client: Consequence; recruiter: Consequence; bounty: Consequence; matchunt: Consequence };
}
export interface JokerDetail {
  placement: { id: string; candidateName: string; firstName: string; companyName: string; jobTitle: string; recruiterName: string | null; recruiterFirst: string | null; plannedStart: string | null; reason: string | null; reasonText: string; note: string | null; hasDocument: boolean; documentPath: string | null; grossCents: number };
  invoice: { number: string | null; totalCents: number; status: string; paidAt: string | null } | null;
  recruiterShareCents: number;
  defaults: { pct: number; validDays: number; priceCents: number; validUntil: string; bountyCents: number };
  decided: { decision: string; status: string; priceCents: number | null; validUntil: string | null } | null;
  clientSphereSuggested: boolean;
}
export interface StartDetail {
  placement: { id: string; candidateName: string; firstName: string; companyName: string; jobTitle: string; recruiterName: string | null; plannedStart: string | null; reportedOn: string | null; reportedAt: string | null; contestedAt: string | null; contestNote: string | null; packageKey: string };
  reasons: { key: string; label: string }[];
}
export interface ResearchDetail {
  placement: { id: string; candidateName: string; companyName: string; jobTitle: string; researchState: string; researchKind: string | null; since: string | null; jobId: string | null };
  bountyCents: number; submissions: number; recruiters: number;
}

// ---------------------------------------------------------------------------
// A9
// ---------------------------------------------------------------------------

export interface ExportOverview {
  period: string; label: string; months: { period: string; label: string }[]; locked: boolean; lockedAt: string | null;
  checks: Check[]; counts: { bookings: number; invoices: number; cancellations: number; creditNotes: number; documents: number };
  canLock: boolean; lockWhy: string | null;
}

// ---------------------------------------------------------------------------
// A10, J6
// ---------------------------------------------------------------------------

export interface ConditionsRow {
  key: string; version: number | null; label: string; clientPct: number; initialPct: number; retentionPct: number | null; matchuntPct: number;
  bountyPct: number | null; matchuntOnClaimPct: number | null; continuityDays: number | null; ok: boolean;
}
export interface ConditionsOverview {
  rows: ConditionsRow[]; allOk: boolean; checkText: string;
  settings: { activeFrom: string | null; forcedFrom: string | null; announcedAt: string | null };
  active: boolean; canEditDate: boolean;
  announce: { allowed: boolean; latest: string | null; why: string | null };
  consents: { count: number; total: number; list: { id: string; name: string; email: string | null; consentedAt: string | null }[] };
  joker: { pct: number; validDays: number };
}

// ---------------------------------------------------------------------------
// F1
// ---------------------------------------------------------------------------

export interface CoopSignal { key: string; level: 'warn' | 'info' | 'ok'; text: string; link?: string | null }
export interface CoopClient { ownerId: string; company: string; jobs: number; stage: number; stageLabel: string | null; stageSince: string | null; warn: number; openReports: number; signals: CoopSignal[] }
export interface CoopDetail {
  ownerId: string; company: string; ownerEmail: string | null; ownerName: string | null; since: string | null; activeJobs: number;
  stage: number; stageLabel: string | null; stageSince: string | null;
  signals: CoopSignal[];
  history: { id: string; at: string; kind: string; label: string; stage: number | null; note: string | null; deadline: string | null; jobTitle: string | null; by: string }[];
  jobs: { id: string; title: string; status: string; cooperationPaused: boolean; pausedAt: string | null; research: boolean }[];
  hint: { deadline: string; text: string };
  stages: string[];
}
export type CoopAction = 'call' | 'note' | 'hint' | 'pause' | 'resume' | 'end' | 'terminate';

// ---------------------------------------------------------------------------
// Aufrufe
// ---------------------------------------------------------------------------

export const buchhaltungApi = {
  overview: () => call<Overview>('overview'),
  invoiceCheck: (invoiceId: string) => call<InvoiceCheck>('invoice_check', { invoiceId }),
  release: (invoiceId: string, email: string, poFollows: boolean) => call<{ ok: true; number: string; sent: boolean; mailError: string | null }>('invoice_release', { invoiceId, email, poFollows }, 'Die Rechnung konnte nicht freigegeben werden.'),
  invoicePdf: (invoiceId: string) => call<{ url?: string; pdfBase64?: string }>('invoice_pdf', { invoiceId }),
  resend: (invoiceId: string, email?: string) => call<{ ok: true; sentTo: string[] }>('invoice_resend', { invoiceId, email }),
  manualPayment: (invoiceId: string, paidOn: string, amountCents: number, note: string) => call<{ ok: true; status: string }>('invoice_manual_payment', { invoiceId, paidOn, amountCents, note }),
  correctionPreview: (invoiceId: string) => call<CorrectionPreview>('correction_preview', { invoiceId }),
  correct: (invoiceId: string, mode: 'cancel' | 'correct', reason: string, changes: CorrectionChanges, redraft = true) =>
    call<{ ok: true; mode: string; stornoNumber: string; newNumber: string | null; draftId: string | null; sentTo: string[] }>('invoice_correct', { invoiceId, mode, reason, changes, redraft }),
  dunningPreview: (invoiceId: string, level?: number, basePct?: string) => call<DunningPreview>('dunning_preview', { invoiceId, level, basePct }),
  dunningSend: (invoiceId: string, level: number, basePct: string | undefined, attachPdf: boolean, note: string) => call<{ ok: true; level: number; sent: boolean; sentTo?: string[]; payUntil?: string }>('dunning_send', { invoiceId, level, basePct, attachPdf, note }),

  payments: () => call<PaymentsOverview>('payments'),
  importStatement: (fileName: string, content: string) => call<ImportResult>('statement_import', { fileName, content }, 'Der Kontoauszug konnte nicht gelesen werden.'),
  book: (transactionId: string, target?: { kind: 'invoice' | 'credit_note' | 'credit_run'; id: string }) => call<{ ok: true; kind: string; number: string; status?: string; openCents?: number }>('transaction_book', { transactionId, target }),
  bookSafe: () => call<{ ok: true; booked: number; problems: string[] }>('transactions_book_safe'),
  hide: (transactionId: string, hide = true) => call<{ ok: true }>('transaction_hide', { transactionId, hide }),
  hidden: () => call<{ rows: BankTx[] }>('transactions_hidden'),

  creditRun: (period?: string) => call<CreditRunOverview>('credit_run', { period }),
  creditNotePreview: (period: string, recruiterId?: string) => call<{ pdfBase64: string; recruiters: { recruiterId: string; name: string; blocked: string | null }[]; recruiterId: string }>('credit_note_preview', { period, recruiterId }),
  createCreditRun: (period: string) => call<{ ok: true; runId: string; period: string; notes: { number: string; name: string; totalCents: number; mailed: boolean; skipped: number }[]; problems: string[] }>('credit_run_create', { period }, 'Der Gutschriftlauf konnte nicht erstellt werden.'),
  sepa: (runId: string) => call<{ fileName: string; xml: string; count: number; totalCents: number; executionDate: string; skipped: { number: string; why: string }[] }>('credit_run_sepa', { runId }),
  creditNotePdf: (creditNoteId: string) => call<{ url: string }>('credit_note_pdf', { creditNoteId }),
  resolveObjection: (objectionId: string, resolution: string) => call<{ ok: true }>('objection_resolve', { objectionId, resolution }),

  cases: () => call<{ items: CaseItem[]; count: number }>('cases'),
  caseDetail: (claimId: string) => call<CaseDetail>('case_detail', { claimId }),
  decideCase: (claimId: string, decision: 'accept' | 'reject' | 'client_sphere', reason?: string, note?: string) => call<{ ok: true }>('case_decide', { claimId, decision, reason, note }),
  caseDocument: (path: string) => call<{ url: string }>('case_document', { path }),
  jokerDetail: (placementId: string) => call<JokerDetail>('joker_detail', { placementId }),
  decideJoker: (placementId: string, choice: 'offer' | 'none' | 'client_sphere', priceCents?: number, validUntil?: string, note?: string) => call<{ ok: true }>('joker_decide', { placementId, choice, priceCents, validUntil, note }),
  startDetail: (placementId: string) => call<StartDetail>('start_detail', { placementId }),
  resolveStart: (placementId: string, way: 'started' | 'not_started', opts: { startedOn?: string; reason?: string; note?: string }) => call<{ ok: true; state: string }>('start_resolve', { placementId, way, ...opts }),
  researchDetail: (placementId: string) => call<ResearchDetail>('research_detail', { placementId }),
  endResearch: (placementId: string, note: string) => call<{ ok: true }>('research_end', { placementId, note }),
  reportHandled: (reportId: string) => call<{ ok: true }>('report_handled', { reportId }),

  exportOverview: (period?: string) => call<ExportOverview>('export_overview', { period }),
  exportBookings: (period: string) => call<{ fileName: string; csv: string; rows: number; hint: string }>('export_bookings', { period }),
  exportDocuments: (period: string) => call<{ fileName: string; files: { name: string; url: string }[]; missing: string[] }>('export_documents', { period }),
  exportOpenItems: () => call<{ fileName: string; csv: string; rows: number }>('export_open_items'),
  lockPeriod: (period: string) => call<{ ok: true; period: string }>('period_lock', { period }),

  conditions: () => call<ConditionsOverview>('conditions'),
  setConditionsDate: (activeFrom: string | null) => call<{ ok: true }>('conditions_date', { activeFrom }),
  announceConditions: () => call<{ ok: true; notified: number; mailed: number; mailFailed: string[]; alreadyConsented: number }>('conditions_announce'),

  cooperationList: (all = false) => call<{ clients: CoopClient[]; total: number }>('cooperation_list', { all }),
  cooperationDetail: (ownerId: string) => call<CoopDetail>('cooperation_detail', { ownerId }),
  cooperationAction: (ownerId: string, action: CoopAction, payload: { note?: string; jobIds?: string[]; mailText?: string; deadline?: string; email?: string } = {}) =>
    call<{ ok: true; hint?: string; sentTo?: string }>('cooperation_action', { ownerId, action, ...payload }),
};

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

export const eur = (c: number | null | undefined, digits = 2) =>
  c == null ? '–' : `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(c / 100)} €`;
/** Ganze Euro wie im Fahrplan („19.000 €“) */
export const eur0 = (c: number | null | undefined) => eur(c, 0);
export const dateDe = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '–');
export const dateShort = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '–');
export const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
/** „1.234,56“ → Cent */
export const parseEuro = (s: string) => {
  const v = Number(String(s).replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
};
export const euroInput = (c: number) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100);

export function downloadText(content: string, fileName: string, type = 'text/csv;charset=utf-8') {
  downloadBlob(new Blob([content], { type }), fileName);
}
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function base64Url(base64: string, type = 'application/pdf'): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type }));
}
/** PDF öffnen: signierter Link oder Vorschau aus Base64 */
export async function openPdf(load: () => Promise<{ url?: string; pdfBase64?: string }>) {
  // Fenster sofort im Klick öffnen (sonst blockt der Browser), Adresse danach setzen
  const w = window.open('about:blank', '_blank');
  try {
    const r = await load();
    const url = r.url ?? (r.pdfBase64 ? base64Url(r.pdfBase64) : null);
    if (!url) throw new Error('PDF nicht abrufbar.');
    if (w) { w.opener = null; w.location.href = url; } else window.open(url, '_blank', 'noopener');
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Kontoauszug lesen: UTF-8, sonst Windows-1252 (viele Bank-CSV) */
export async function readStatementFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const utf = new TextDecoder('utf-8').decode(buf);
  if (!utf.includes('�')) return utf;
  try { return new TextDecoder('windows-1252').decode(buf); } catch { return utf; }
}
