// Rechenregeln der Buchhaltung (Admin A1–A9, Umbau 11.11.2026).
//
// Reine Funktionen (Import nur konditionen.ts, ebenfalls ohne Deno-APIs):
// Verzugszinsen, Mahnstufen, Fristen, Monatslauf der Gutschriften,
// Fälligkeit der Headhunter-Anteile, Steuer der Gutschrift, nächster Schritt im
// Fahrplan, CSV-Zeilen. Getestet in src/lib/buchhaltungRechnen.test.ts.
import { addDays, addWorkdays, CREDIT_NOTE_PAY_DAYS } from './konditionen.ts';

// ---------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------

export const dayDiff = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${fromIso.slice(0, 10)}T12:00:00Z`)) / 86_400_000);

/** Werktage (Mo–Fr) von heute bis zum Stichtag, ohne heute, mit Stichtag. Negativ, wenn vorbei. */
export function workdaysUntil(todayIso: string, deadlineIso: string): number {
  const a = todayIso.slice(0, 10);
  const b = deadlineIso.slice(0, 10);
  if (a === b) return 0;
  const sign = a < b ? 1 : -1;
  const [lo, hi] = sign > 0 ? [a, b] : [b, a];
  let n = 0;
  let d = lo;
  while (d < hi) {
    d = addDays(d, 1);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return sign * n;
}

export const dateDe = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};
export const dateDeShort = (iso: string | null | undefined) => (iso ? dateDe(iso).slice(0, 6) : '');

/** Rechnung freigeben bis: 10 Werktage nach der Unterschrift (A1, A3). */
export const releaseDeadline = (signedOn: string) => addWorkdays(signedOn, 10);
/** Ohne Bestellnummer mit Vermerk „Bestellnummer folgt“: ab 7 Tagen nach der Unterschrift (K12, A3). */
export const poFollowsFrom = (signedOn: string) => addDays(signedOn, 7);

// ---------------------------------------------------------------------------
// Monate und Gutschriftlauf
// ---------------------------------------------------------------------------

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const periodOf = (iso: string) => iso.slice(0, 7);
export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}
export const monthName = (period: string) => MONTHS[Number(period.slice(5, 7)) - 1] ?? period;
export const periodLabel = (period: string) => `${monthName(period)} ${period.slice(0, 4)}`;
export const periodStart = (period: string) => `${period}-01`;
export const periodEnd = (period: string) => addDays(`${shiftPeriod(period, 1)}-01`, -1);
/** Der Lauf für den Leistungszeitraum November heißt „Dezember-Lauf“. */
export const runName = (period: string) => `${monthName(shiftPeriod(period, 1))}-Lauf`;
/** Ab dem 1. des Folgemonats erstellen … */
export const runOpensOn = (period: string) => `${shiftPeriod(period, 1)}-01`;
/** … spätestens bis zum 10. Werktag. */
export const runDeadline = (period: string) => addWorkdays(addDays(runOpensOn(period), -1), 10);

/** Welcher Lauf steht an? Vormonat, solange er fehlt; sonst der laufende Monat (in Vorbereitung). */
export function pendingRunPeriod(todayIso: string, issuedPeriods: string[]): string {
  const prev = shiftPeriod(periodOf(todayIso), -1);
  return issuedPeriods.includes(prev) ? periodOf(todayIso) : prev;
}

// ---------------------------------------------------------------------------
// Verzugszinsen und Mahnstufen (A4, § 288 BGB)
// ---------------------------------------------------------------------------

export const LATE_INTEREST_EXTRA_PP = 9;
export const LATE_FEE_CENTS = 4000;
export const DUNNING_DAYS = 7;

/** Zinsen tagesgenau ab dem Tag nach Fälligkeit (Basiszinssatz + 9 Prozentpunkte, Tage/365). */
export function lateInterest(openCents: number, basePct: number, dueOn: string, untilOn: string) {
  const days = Math.max(0, dayDiff(dueOn, untilOn));
  const ratePct = Math.max(0, Math.round((basePct + LATE_INTEREST_EXTRA_PP) * 100) / 100);
  const interestCents = Math.max(0, Math.round((openCents * ratePct * days) / (100 * 365)));
  return { days, ratePct, interestCents };
}

export interface ReminderFact { level: number; payUntil: string | null; sentAt: string | null }

export interface DunningOption { level: 1 | 2 | 3; label: string; allowed: boolean; why: string | null }

/** Welche Mahnstufe ist jetzt wählbar? 1 nach der Erinnerung, 2 nach Ablauf der Frist der 1., 3 nach Ablauf der Frist der 2. */
export function dunningOptions(input: { status: string; dueDate: string | null; today: string; reminderSentAt: string | null; reminders: ReminderFact[] }): DunningOption[] {
  const open = ['open', 'partially_paid', 'pending'].includes(input.status);
  const overdue = open && !!input.dueDate && input.dueDate < input.today;
  const lvl = (n: number) => input.reminders.find((r) => r.level === n) ?? null;
  const reminded = !!input.reminderSentAt || !!lvl(0);
  const l1 = lvl(1);
  const l2 = lvl(2);
  const l3 = lvl(3);
  const passed = (r: ReminderFact | null) => !!r && (!r.payUntil || r.payUntil < input.today);
  const o1: DunningOption = { level: 1, label: '1. Mahnung · neue Frist 7 Tage', allowed: false, why: null };
  const o2: DunningOption = { level: 2, label: '2. Mahnung · mit Verzugszinsen und 40 € Pauschale', allowed: false, why: null };
  const o3: DunningOption = { level: 3, label: 'Inkasso oder Anwalt', allowed: false, why: null };
  if (!open) { const why = 'Die Rechnung ist nicht offen.'; return [{ ...o1, why }, { ...o2, why }, { ...o3, why }]; }
  if (!overdue) { const why = `Noch nicht fällig (fällig ${dateDe(input.dueDate)}).`; return [{ ...o1, why }, { ...o2, why }, { ...o3, why }]; }
  o1.allowed = reminded && !l1;
  o1.why = l1 ? `gesendet am ${dateDe(l1.sentAt)}` : reminded ? null : 'Erst nach der Zahlungserinnerung (7 Tage nach Fälligkeit).';
  o2.allowed = passed(l1) && !l2;
  o2.why = l2 ? `gesendet am ${dateDe(l2.sentAt)}` : !l1 ? 'Erst nach der 1. Mahnung.' : !passed(l1) ? `Erst nach Ablauf der Frist am ${dateDe(l1.payUntil)}.` : null;
  o3.allowed = passed(l2) && !l3;
  o3.why = l3 ? `vermerkt am ${dateDe(l3.sentAt)}` : !l2 ? 'Erst nach der 2. Mahnung.' : !passed(l2) ? `Erst nach Ablauf der Frist am ${dateDe(l2.payUntil)}.` : null;
  return [o1, o2, o3];
}

// ---------------------------------------------------------------------------
// Gutschriften: wann ist ein Anteil fällig? (A7)
// ---------------------------------------------------------------------------

export type TrancheType = 'initial' | 'retention' | 'research_bounty';

export interface TrancheFacts {
  type: TrancheType;
  status: string;
  creditNoteId: string | null;
  /** Besetzung, an der der Anteil hängt (bei der Auslobung: die Ersatzbesetzung) */
  invoicePaidOn: string | null;
  startFixedOn: string | null;
  started: boolean;
  placementCancelled: boolean;
  retentionState: string;
  retentionReleaseDate: string | null;
  clientSphereOn: string | null;
  openClaim: boolean;
  /** Auslobung: ursprüngliche Rechnung bezahlt am */
  originalPaidOn?: string | null;
  /** Auslobung: Rechnung über den Unterschied (null = gibt es nicht) */
  differenceInvoice?: { paidOn: string | null } | null;
}

export interface TrancheDue { due: boolean; since: string | null; waitingFor: string | null }

const latest = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).map((x) => String(x).slice(0, 10)).sort().pop() ?? null;

export function trancheDue(f: TrancheFacts): TrancheDue {
  if (!['pending', 'due'].includes(f.status) || f.creditNoteId) return { due: false, since: null, waitingFor: f.creditNoteId ? 'schon gutgeschrieben' : `Stand ${f.status}` };
  if (f.type === 'initial') {
    if (!f.invoicePaidOn) return { due: false, since: null, waitingFor: 'Zahlung des Kunden' };
    if (f.placementCancelled && !f.clientSphereOn) return { due: false, since: null, waitingFor: 'kein Antritt' };
    if (!f.started) return { due: false, since: null, waitingFor: 'Antritt' };
    if (f.openClaim && !f.startFixedOn) return { due: false, since: null, waitingFor: 'offener Fall' };
    return { due: true, since: latest(f.invoicePaidOn, f.startFixedOn), waitingFor: null };
  }
  if (f.type === 'retention') {
    if (!f.invoicePaidOn) return { due: false, since: null, waitingFor: 'Zahlung des Kunden' };
    if (f.openClaim) return { due: false, since: null, waitingFor: 'offener Fall' };
    if (f.retentionState !== 'released') return { due: false, since: null, waitingFor: f.retentionReleaseDate ? `Ende der Garantie (${dateDe(f.retentionReleaseDate)})` : 'Ende der Garantie' };
    return { due: true, since: latest(f.invoicePaidOn, f.clientSphereOn ?? f.retentionReleaseDate), waitingFor: null };
  }
  // Auslobung: Ersatz hat angefangen, ursprüngliche Rechnung bezahlt, ggf. Unterschied bezahlt
  if (!f.started) return { due: false, since: null, waitingFor: 'Antritt der Ersatzbesetzung' };
  if (!f.originalPaidOn) return { due: false, since: null, waitingFor: 'Zahlung der ursprünglichen Rechnung' };
  if (f.differenceInvoice && !f.differenceInvoice.paidOn) return { due: false, since: null, waitingFor: 'Zahlung der Rechnung über den Unterschied' };
  return { due: true, since: latest(f.startFixedOn, f.originalPaidOn, f.differenceInvoice?.paidOn ?? null), waitingFor: null };
}

/** In den Lauf für den Leistungszeitraum kommt, was bis Monatsende fällig war. */
export const inRun = (d: TrancheDue, period: string) => d.due && !!d.since && d.since <= periodEnd(period);

export type TaxMode = 'standard' | 'small_business' | 'foreign';

export function creditTax(taxMode: TaxMode, netCents: number) {
  if (taxMode === 'standard') {
    const vat = Math.round(netCents * 19 / 100);
    return { vatRate: 19, vatCents: vat, totalCents: netCents + vat, note: null as string | null };
  }
  if (taxMode === 'small_business') return { vatRate: 0, vatCents: 0, totalCents: netCents, note: 'Kein Ausweis der Umsatzsteuer (§ 19 UStG).' };
  return { vatRate: 0, vatCents: 0, totalCents: netCents, note: 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).' };
}

export const TAX_MODE_LABEL: Record<TaxMode, string> = { standard: 'regelbesteuert', small_business: 'Kleinunternehmer', foreign: 'Ausland' };

const pctDe = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** „1. Teil (5/23)“, „2. Teil nach Ende der Garantie (10/23)“, „Auslobung Nachbesetzung (15/23)“, „Core (15/20)“ */
export function positionLabel(type: TrancheType, pkg: string | null, sharePct: number | null, clientPct: number | null): string {
  const frac = sharePct != null && clientPct ? ` (${pctDe(sharePct)}/${pctDe(clientPct)})` : '';
  if (type === 'retention') return `2. Teil nach Ende der Garantie${frac}`;
  if (type === 'research_bounty') return `Auslobung Nachbesetzung${frac}`;
  return pkg === 'core' || !pkg ? `Core${frac}` : `1. Teil${frac}`;
}

/** Kurzname in Listen: „1. Teil“, „2. Teil“, „Core“, „Auslobung“ */
export function positionShort(type: TrancheType, pkg: string | null): string {
  if (type === 'retention') return '2. Teil';
  if (type === 'research_bounty') return 'Auslobung';
  return pkg === 'core' || !pkg ? 'Core' : '1. Teil';
}

export const creditPayUntil = (issuedOn: string) => addDays(issuedOn, CREDIT_NOTE_PAY_DAYS);

// ---------------------------------------------------------------------------
// Fahrplan: genau ein nächster Schritt (A1)
// ---------------------------------------------------------------------------

export interface StepFacts {
  today: string;
  openClaim: boolean;
  coreNonStartOpen: boolean;
  startContested: boolean;
  feeExpected: boolean;
  invoice: null | {
    status: string;
    dueDate: string | null;
    releaseBy: string | null;
    reminderSentAt: string | null;
    dunningLevel: number;
    lastDunningPayUntil: string | null;
    dunningAllowed: boolean;
  };
  placementState: string;
  startFixed: boolean;
  firstDay: string | null;
  startReported: boolean;
  research: { state: string; since: string | null };
  tranches: { label: string; status: string; dueNow: boolean; creditNoteNumber: string | null; payUntil: string | null }[];
  retention: { state: string; releaseDate: string | null; continuityEnd: string | null };
  runName: string;
}

export interface Step { key: string; label: string; action: boolean }

export function nextStep(f: StepFacts): Step {
  if (f.openClaim) return { key: 'case', label: 'Fall prüfen', action: true };
  if (f.coreNonStartOpen) return { key: 'joker', label: 'Nicht angefangen prüfen', action: true };
  if (f.startContested) return { key: 'start', label: 'Antritt klären', action: true };
  const inv = f.invoice;
  if (inv?.status === 'draft') return { key: 'release', label: 'Rechnung prüfen', action: true };
  if (!inv && f.feeExpected) return { key: 'no_invoice', label: 'Rechnung fehlt', action: false };
  if (inv && ['open', 'partially_paid', 'pending'].includes(inv.status)) {
    const overdue = !!inv.dueDate && inv.dueDate < f.today;
    if (overdue && inv.dunningAllowed) return { key: 'dunning', label: 'Mahnen', action: true };
    if (overdue && inv.dunningLevel >= 3) return { key: 'collection', label: 'Inkasso oder Anwalt vermerkt', action: false };
    if (overdue && inv.dunningLevel >= 1) return { key: 'dunned', label: `${inv.dunningLevel}. Mahnung, Frist bis ${dateDeShort(inv.lastDunningPayUntil)}`, action: false };
    if (overdue) return { key: 'overdue', label: `überfällig seit ${dateDeShort(inv.dueDate)}${inv.reminderSentAt ? '' : ` · Erinnerung am ${dateDeShort(addDays(inv.dueDate!, 7))}`}`, action: false };
    return { key: 'invoice_open', label: `Rechnung offen bis ${dateDeShort(inv.dueDate)}`, action: false };
  }
  if (f.research.state === 'awaiting_position') return { key: 'research_position', label: 'wartet auf Kunde: Position bestätigen', action: false };
  if (f.research.state === 'awaiting_payment') return { key: 'research_payment', label: 'Nachbesetzung wartet auf Zahlung', action: false };
  if (f.research.state === 'running' || f.research.state === 'paused') {
    const days = f.research.since ? Math.max(0, dayDiff(f.research.since, f.today)) : null;
    return { key: 'research_running', label: f.research.state === 'paused' ? 'Nachbesetzung ruht' : `Nachbesetzung läuft${days != null ? ` seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}` : ''}`, action: false };
  }
  if (f.placementState === 'cancelled' && !f.startFixed) return { key: 'not_started', label: 'nicht angefangen', action: false };
  if (f.placementState === 'agreed' && !f.startFixed) {
    return { key: 'wait_start', label: f.startReported ? 'Antritt gemeldet, Kunde bestätigt' : `wartet auf Antritt ${dateDeShort(f.firstDay)}`, action: false };
  }
  const issued = f.tranches.find((t) => t.status === 'approved' && t.creditNoteNumber);
  if (issued) return { key: 'credit_issued', label: `Gutschrift ${issued.creditNoteNumber} · Auszahlung bis ${dateDeShort(issued.payUntil)}`, action: false };
  const due = f.tranches.find((t) => t.dueNow);
  if (due) return { key: 'credit_due', label: `${due.label} im ${f.runName}`, action: false };
  if (f.retention.state === 'withheld') return { key: 'guarantee', label: `Garantie bis ${dateDeShort(f.retention.continuityEnd)} · 2. Teil ab ${dateDeShort(f.retention.releaseDate)}`, action: false };
  if (f.tranches.some((t) => ['pending', 'due'].includes(t.status))) return { key: 'wait', label: 'Anteil wartet', action: false };
  return { key: 'done', label: 'erledigt', action: false };
}

// ---------------------------------------------------------------------------
// CSV (Export, A9)
// ---------------------------------------------------------------------------

export const centsDe = (c: number | null | undefined) =>
  c == null ? '' : `${c < 0 ? '-' : ''}${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(Math.abs(c) / 100)}`;

export function csvLine(fields: (string | number | null | undefined)[]): string {
  return fields.map((f) => {
    const s = f == null ? '' : String(f);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';');
}

export const csvFile = (header: string[], rows: (string | number | null | undefined)[][]) => `﻿${[csvLine(header), ...rows.map(csvLine)].join('\r\n')}\r\n`;
