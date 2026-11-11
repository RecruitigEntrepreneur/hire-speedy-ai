// deno-lint-ignore-file no-explicit-any
// Headhunter: Ansichtslogik für Verdienste, Besetzungs-Fenster, Gutschriften und
// den Verdienst an Stellen (H1–H13, J5). Umbau 11.11.2026.
//
// Reine Funktionen ohne Deno-APIs: die Edge Function `abrechnung` baut damit die
// Antworten, die Web-App (Import ohne Endung) rechnet damit die Zeilen an Stellen.
// Beträge kommen aus konditionen.ts; hier wird nur zusammengestellt und formuliert.
import {
  CONDITIONS, CREDIT_NOTE_PAY_DAYS, START_OBJECTION_WORKDAYS, addDays, addWorkdays, amountsFor, bountyFor, earningPlan,
  isPackageKey, splitFor, type ConditionsVersion, type PackageKey, type Split,
} from './konditionen.ts';

// ---------------------------------------------------------------------------
// Formate
// ---------------------------------------------------------------------------

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

const day = (v: unknown): string | null => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);
/** „01.11.“ */
export const dm = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '');
/** „01.11.2026“ */
export const dmy = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
/** „8.250 €“ (ganze Euro) */
export const eur0 = (c: number) => `${Math.round(c / 100).toLocaleString('de-DE')} €`;
/** „8.250,00 €“ */
export const eur2 = (c: number) => `${(c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const maxIso = (...v: (string | null | undefined)[]) => (v.filter(Boolean) as string[]).sort().pop() ?? null;
const firstOf = (name: string | null | undefined) => (name ? String(name).trim().split(/\s+/)[0] : 'Kandidat');
/** „MedTec Süd GmbH“ → „MedTec Süd“ (in Sätzen) */
export const companyShort = (name: string) => name.replace(/\s+(GmbH|AG|SE|KG|UG|GmbH & Co\. KG|e\.K\.|mbH)\b.*$/i, '') || name;

export const PACKAGE_LABEL: Record<PackageKey, string> = { core: 'Core', continuity_90: 'Continuity 90', continuity_180: 'Continuity 180' };

// ---------------------------------------------------------------------------
// Gutschriftlauf: Anfang des Monats, spätestens am 10. Werktag (Mo–Fr)
// ---------------------------------------------------------------------------

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1, 12)).toISOString().slice(0, 7);
}

/** 10. Werktag eines Monats (YYYY-MM): spätester Tag des Gutschriftlaufs. */
export function tenthWorkday(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const lastOfPrev = new Date(Date.UTC(y, m - 1, 0, 12)).toISOString().slice(0, 10);
  return addWorkdays(lastOfPrev, 10);
}

export interface RunSlot {
  /** Leistungszeitraum (YYYY-MM), dessen Lauf den Posten abrechnet */
  period: string;
  /** Monat des Laufs (YYYY-MM) */
  runMonth: string;
  /** „Anfang Dezember“ */
  label: string;
  /** „Anfang Dez.“ */
  short: string;
  /** Spätester Tag des Laufs (10. Werktag), ISO */
  latest: string;
}

/**
 * In welchem Lauf landet ein Posten, der an `dueOn` fällig wird bzw. wurde?
 * Lauf für den Monat der Fälligkeit, Anfang des Folgemonats. Ist dieser Lauf
 * schon gemacht (doneRuns), rutscht der Posten in den nächsten.
 */
export function runSlot(dueOn: string, today: string, doneRuns: readonly string[] = []): RunSlot {
  let period = dueOn.slice(0, 7);
  for (let i = 0; i < 24 && doneRuns.includes(period); i++) period = addMonths(period, 1);
  let runMonth = addMonths(period, 1);
  const current = today.slice(0, 7);
  if (runMonth < current) runMonth = current;
  const latest = tenthWorkday(runMonth);
  const m = Number(runMonth.slice(5, 7)) - 1;
  // Lauf überfällig (nach dem 10. Werktag noch nicht gemacht): kein falsches „Anfang …“
  if (runMonth === current && today > latest) return { period, runMonth, label: 'mit dem nächsten Lauf', short: 'demnächst', latest };
  return { period, runMonth, label: `Anfang ${MONTHS[m]}`, short: `Anfang ${MONTHS_SHORT[m]}`, latest };
}

/** „Dezember-Lauf“ */
export const runName = (s: RunSlot) => `${MONTHS[Number(s.runMonth.slice(5, 7)) - 1]}-Lauf`;

// ---------------------------------------------------------------------------
// Steuer auf der Gutschrift
// ---------------------------------------------------------------------------

export type TaxMode = 'standard' | 'small_business' | 'foreign';
export const isTaxMode = (v: unknown): v is TaxMode => v === 'standard' || v === 'small_business' || v === 'foreign';
export const vatRateFor = (mode: TaxMode | null | undefined) => (mode === 'standard' || !mode ? 19 : 0);
export const vatCentsFor = (netCents: number, mode: TaxMode | null | undefined) => Math.round((netCents * vatRateFor(mode)) / 100);
export const TAX_MODE_TEXT: Record<TaxMode, string> = {
  standard: 'Regelbesteuert, also 19 % USt auf jede Gutschrift',
  small_business: 'Kleinunternehmer, keine USt auf der Gutschrift (§ 19 UStG)',
  foreign: 'Ausland, Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)',
};
export const TAX_MODE_LABEL: Record<TaxMode, string> = { standard: 'Regelbesteuert', small_business: 'Kleinunternehmer', foreign: 'Ausland' };

/** Einwände gegen eine Gutschrift: binnen 30 Tagen ab Datum (Vertrag § 14 Abs. 3). */
export const OBJECTION_DAYS = 30;
export const objectionUntil = (issuedOn: string) => addDays(issuedOn, OBJECTION_DAYS);
export const OBJECTION_TOPICS: Record<string, string> = { basis: 'Grundlage (Gehalt)', percentage: 'Prozentsatz', vat: 'Umsatzsteuer', other: 'Etwas anderes' };

// ---------------------------------------------------------------------------
// Zeilen aus der Datenbank (nur die Felder, die hier gebraucht werden)
// ---------------------------------------------------------------------------

export interface PlacementLike {
  id: string;
  submission_id?: string | null;
  package_key?: string | null;
  pricing_snapshot?: Record<string, any> | null;
  conditions_version?: number | null;
  placement_state?: string | null;
  continuity_state?: string | null;
  retention_state?: string | null;
  invoice_state?: string | null;
  research_state?: string | null;
  research_kind?: string | null;
  research_bounty_cents?: number | null;
  research_started_at?: string | null;
  research_ended_at?: string | null;
  research_end_reason?: string | null;
  research_job_id?: string | null;
  first_working_day?: string | null;
  start_date?: string | null;
  continuity_end_date?: string | null;
  retention_release_date?: string | null;
  start_fixed_at?: string | null;
  start_fixed_how?: string | null;
  start_reported_at?: string | null;
  start_reported_on?: string | null;
  start_report_kind?: string | null;
  start_contested_at?: string | null;
  non_start_reported_at?: string | null;
  non_start_reason?: string | null;
  non_start_note?: string | null;
  departure_reported_at?: string | null;
  departure_category?: string | null;
  client_sphere_at?: string | null;
  replaces_placement_id?: string | null;
  gross_annual_target_compensation_cents?: number | null;
  client_fee_cents?: number | null;
  recruiter_initial_cents?: number | null;
  recruiter_retention_cents?: number | null;
  recruiter_payout?: number | null;
  paid_at?: string | null;
  created_at?: string | null;
  halfway_status?: string | null;
  halfway_at?: string | null;
}

export interface TrancheLike {
  id: string;
  placement_id: string;
  tranche_type: 'initial' | 'retention' | 'research_bounty' | string;
  amount_cents: number;
  status: string;
  due_date?: string | null;
  credit_note_id?: string | null;
  paid_at?: string | null;
  /** keine echte Zeile (Altfall ohne Tranchen) */
  virtual?: boolean;
}

export interface ClaimLike {
  id: string;
  kind?: string | null;
  category?: string | null;
  status: string;
  reported_at?: string | null;
  decided_at?: string | null;
  client_sphere?: boolean | null;
  recruiter_statement?: string | null;
  recruiter_statement_at?: string | null;
}

export interface InvoiceLike { status?: string | null; issued_at?: string | null; due_date?: string | null; paid_at?: string | null }
export interface CreditNoteRef { id: string; number: string; issued_on?: string | null; pay_until?: string | null; paid_on?: string | null; status?: string | null }

export interface PlacementFacts {
  p: PlacementLike;
  /** Tranchen dieses Headhunters an der Besetzung */
  tranches: TrancheLike[];
  candidateName: string | null;
  jobTitle: string | null;
  jobId: string | null;
  companyName: string | null;
  invoice: InvoiceLike | null;
  claim: ClaimLike | null;
  /** Core-Nichtantritt: hat Matchunt entschieden? (Inhalt des Angebots erfährt der Headhunter nicht, J5) */
  jokerDecided?: boolean;
  contractSignedOn?: string | null;
  /** Ersatzbesetzung: ist die ursprüngliche Rechnung bezahlt? */
  origInvoicePaid?: boolean | null;
  /** Nachbesetzung erfolgreich: hat dieser Headhunter den Ersatz gestellt? */
  replacedByMe?: boolean | null;
  creditNotes?: Record<string, CreditNoteRef>;
}

export interface ViewCtx {
  today: string;
  doneRuns?: readonly string[];
  /** Gibt es Fassung 2 schon (Stichtag gesetzt)? Erst dann heißen Altfälle „Konditionen vor der Umstellung“. */
  v2Active?: boolean;
  taxMode?: TaxMode | null;
}

// ---------------------------------------------------------------------------
// Grundbegriffe
// ---------------------------------------------------------------------------

export const packageKeyOf = (p: PlacementLike): PackageKey => (isPackageKey(p.package_key) ? p.package_key : 'core');
export const continuityDaysOf = (p: PlacementLike): number | null => {
  const d = Number(p.pricing_snapshot?.continuityDays);
  return d > 0 ? d : null;
};
export const versionOf = (p: PlacementLike): ConditionsVersion =>
  Number(p.conditions_version ?? p.pricing_snapshot?.conditionsVersion) === 2 ? 2 : 1;
export const isReplacement = (p: PlacementLike) => !!p.replaces_placement_id;
export const isStarted = (p: PlacementLike) => !!p.start_fixed_at || ['started', 'completed', 'ended_early'].includes(String(p.placement_state ?? ''));
export const isInvoicePaid = (p: PlacementLike, inv?: InvoiceLike | null) => p.invoice_state === 'paid' || inv?.status === 'paid';
const startDayOf = (p: PlacementLike) => day(p.start_fixed_at) ?? day(p.first_working_day) ?? day(p.start_date);
const plannedStartOf = (p: PlacementLike) => day(p.first_working_day) ?? day(p.start_date);

/** Prozentsätze des Headhunters laut Snapshot (Altfälle) bzw. Fassung. */
export function pctsOf(p: PlacementLike) {
  const s = p.pricing_snapshot ?? {};
  const split = splitFor(packageKeyOf(p), versionOf(p));
  const num = (v: unknown, fb: number) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Number(v) : fb);
  return { initialPct: num(s.recruiterInitialPct, split.initialPct), retentionPct: num(s.recruiterRetentionPct, split.retentionPct) };
}

export type TrancheStage = 'paid' | 'credited' | 'due' | 'waiting_payment' | 'waiting_start' | 'waiting_guarantee' | 'forfeited';

/** Wo steht ein Teil? Fällig = kommt in die nächste Gutschrift. */
export function trancheStage(t: TrancheLike, p: PlacementLike, origInvoicePaid?: boolean | null): TrancheStage {
  if (t.status === 'forfeited' || t.status === 'cancelled') return 'forfeited';
  if (t.status === 'paid') return 'paid';
  if (t.credit_note_id) return 'credited';
  if (t.status === 'due' || t.status === 'approved') return 'due';
  const paid = p.invoice_state === 'paid';
  if (t.tranche_type === 'retention') {
    if (p.retention_state === 'released') return paid ? 'due' : 'waiting_payment';
    return 'waiting_guarantee';
  }
  if (t.tranche_type === 'research_bounty') {
    if (!isStarted(p)) return 'waiting_start';
    if (origInvoicePaid === false || (Number(p.client_fee_cents ?? 0) > 0 && !paid)) return 'waiting_payment';
    return 'due';
  }
  if (!isStarted(p)) return 'waiting_start';
  return paid ? 'due' : 'waiting_payment';
}

/** Tag, an dem der Teil fällig wurde bzw. voraussichtlich wird. */
export function trancheDueOn(t: TrancheLike, p: PlacementLike, today: string): string {
  if (t.tranche_type === 'retention') return day(p.client_sphere_at) ?? day(p.retention_release_date) ?? day(t.due_date) ?? today;
  if (t.tranche_type === 'research_bounty') return startDayOf(p) ?? today;
  return maxIso(startDayOf(p), day(p.paid_at)) ?? today;
}

export const trancheLabel = (t: TrancheLike, p: PlacementLike) =>
  t.tranche_type === 'retention' ? '2. Teil'
    : t.tranche_type === 'research_bounty' ? 'Auslobung Nachbesetzung'
      : continuityDaysOf(p) || Number(p.recruiter_retention_cents ?? 0) > 0 ? '1. Teil' : 'Dein Anteil';

const ORDER: Record<string, number> = { initial: 0, retention: 1, research_bounty: 2 };
const sortTranches = (ts: TrancheLike[]) => [...ts].sort((a, b) => (ORDER[a.tranche_type] ?? 9) - (ORDER[b.tranche_type] ?? 9));

/** Altfälle ohne Tranchen: der Anteil steht nur an der Besetzung. */
export function tranchesOrVirtual(f: PlacementFacts): TrancheLike[] {
  if (f.tranches.length) return sortTranches(f.tranches);
  const p = f.p;
  const out: TrancheLike[] = [];
  const init = Number(p.recruiter_initial_cents ?? 0) || Math.round(Number(p.recruiter_payout ?? 0) * 100);
  if (init > 0) out.push({ id: `v-${p.id}-i`, placement_id: p.id, tranche_type: 'initial', amount_cents: init, status: 'pending', virtual: true });
  const ret = Number(p.recruiter_retention_cents ?? 0);
  if (ret > 0) out.push({ id: `v-${p.id}-r`, placement_id: p.id, tranche_type: 'retention', amount_cents: ret, status: 'pending', virtual: true });
  return out;
}

// ---------------------------------------------------------------------------
// Gründe und Fälle
// ---------------------------------------------------------------------------

export const REASON_SHORT: Record<string, string> = {
  declined_before_start: 'vor dem Start abgesagt',
  no_show: 'nicht erschienen',
  offer_withdrawn: 'Angebot zurückgezogen',
  candidate_resigned: 'selbst gekündigt',
  performance_conduct: 'Trennung wegen Leistung oder Verhalten',
  mutual_on_request: 'Aufhebung auf eigenen Wunsch',
  position_changed: 'Stelle fällt weg oder wird umgebaut',
  other: 'anderer Grund',
};

export function caseTitleFor(kind: 'departure' | 'non_start', reason: string | null | undefined, first: string): string {
  if (kind === 'non_start') {
    if (reason === 'declined_before_start') return `${first} hat vor dem Start abgesagt`;
    if (reason === 'no_show') return `${first} ist nicht erschienen`;
    if (reason === 'offer_withdrawn') return `Angebot an ${first} zurückgezogen`;
    return `${first} hat nicht angefangen`;
  }
  if (reason === 'candidate_resigned') return `${first} kündigt in der Garantiezeit`;
  if (reason === 'performance_conduct') return 'Trennung in der Garantiezeit';
  if (reason === 'mutual_on_request') return `Aufhebung auf Wunsch von ${first}`;
  if (reason === 'position_changed') return 'Stelle fällt weg oder wird umgebaut';
  return 'Besetzung endet in der Garantiezeit';
}

export type CaseKind = 'none' | 'claim_open' | 'claim_accepted' | 'claim_rejected' | 'client_sphere' | 'core_non_start' | 'core_ended' | 'non_start_reported';

export function caseOf(f: PlacementFacts): CaseKind {
  const p = f.p;
  if (p.client_sphere_at) return 'client_sphere';
  const c = f.claim;
  if (c) {
    if (c.status === 'submitted' || c.status === 'in_review') return 'claim_open';
    if (c.status === 'accepted') return 'claim_accepted';
    if (c.status === 'rejected') return c.client_sphere ? 'client_sphere' : 'claim_rejected';
  }
  const cont = continuityDaysOf(p);
  if (!cont && p.non_start_reported_at) return 'core_non_start';
  if (!p.non_start_reported_at && p.start_report_kind === 'not_started' && !p.start_fixed_at) return 'non_start_reported';
  if (p.placement_state === 'ended_early' || (p.placement_state === 'cancelled' && !cont)) return 'core_ended';
  return 'none';
}

const researchRunningLike = (p: PlacementLike) => ['running', 'paused'].includes(String(p.research_state ?? ''));
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000));

/** „läuft seit 12 Tagen“ (keine Suchtage, Entscheidung 11.11.2026). */
export function runningSince(sinceIso: string | null | undefined, today: string): string {
  const since = day(sinceIso);
  if (!since) return 'läuft';
  const n = daysBetween(since, today);
  return n === 0 ? 'läuft seit heute' : n === 1 ? 'läuft seit 1 Tag' : `läuft seit ${n} Tagen`;
}

/** Eigene Auslobung des ursprünglichen Headhunters (Deckel, R4) – rechnet konditionen.ts. */
export function ownBountyCents(p: PlacementLike, keptInitialCents: number, bountyCents: number): number {
  return bountyFor({ bountyCents, sameRecruiter: true, keptByOriginalCents: keptInitialCents, split: splitFor(packageKeyOf(p), versionOf(p)) });
}

/** Auslobung einer ursprünglichen Besetzung (wie bountyOf in nachbesetzung.ts). */
export function bountyCentsOf(p: PlacementLike): number {
  if (Number(p.research_bounty_cents ?? 0) > 0) return Number(p.research_bounty_cents);
  const gross = Number(p.gross_annual_target_compensation_cents ?? 0);
  const split = splitFor(packageKeyOf(p), versionOf(p));
  const pct = p.research_kind === 'joker' ? split.initialPct + split.retentionPct : (Number(p.pricing_snapshot?.researchBountyPct) || split.bountyPct);
  return Math.round((gross * pct) / 100);
}

const keptInitial = (f: PlacementFacts) => f.tranches
  .filter((t) => t.tranche_type === 'initial' && t.status !== 'forfeited' && t.status !== 'cancelled')
  .reduce((a, t) => a + Number(t.amount_cents ?? 0), 0);

// ---------------------------------------------------------------------------
// H8: Zeile „Deine Besetzungen“
// ---------------------------------------------------------------------------

export interface ChainItem { label: string; state: 'done' | 'current' | 'todo' }

export interface PlacementRowView {
  placementId: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  /** „Continuity 90“, „Core“, „Nachbesetzung“ oder „Konditionen vor der Umstellung“ */
  packageLabel: string;
  chain: ChainItem[];
  /** statt der Kette, wenn etwas schiefgeht */
  status: string | null;
  amountCents: number | null;
  amountSub: string | null;
  /** Für die Reihenfolge: offene Besetzungen zuerst */
  active: boolean;
  createdAt: string;
}

function markCurrent(items: { label: string; done: boolean; currentLabel?: string }[]): ChainItem[] {
  let seen = false;
  return items.map((i) => {
    if (i.done) return { label: i.label, state: 'done' as const };
    if (!seen) { seen = true; return { label: i.currentLabel ?? i.label, state: 'current' as const }; }
    return { label: i.label, state: 'todo' as const };
  });
}

export function placementChain(f: PlacementFacts): ChainItem[] {
  const p = f.p;
  const ts = tranchesOrVirtual(f);
  const invoiced = (!!f.invoice && f.invoice.status !== 'draft' && !!f.invoice.status) || ['invoiced', 'paid'].includes(String(p.invoice_state ?? ''));
  const paid = isInvoicePaid(p, f.invoice);
  const started = isStarted(p);
  if (isReplacement(p)) {
    const bounty = ts.find((t) => t.tranche_type === 'research_bounty');
    const items: { label: string; done: boolean; currentLabel?: string }[] = [];
    if (Number(p.client_fee_cents ?? 0) > 0) items.push({ label: 'Rechnung', done: invoiced }, { label: 'Bezahlt', done: paid });
    items.push({ label: started ? 'Angetreten' : 'Antritt', done: started });
    items.push({ label: 'Auslobung', done: bounty?.status === 'paid' });
    return markCurrent(items);
  }
  const init = ts.find((t) => t.tranche_type === 'initial');
  const ret = ts.find((t) => t.tranche_type === 'retention');
  const initPaid = init?.status === 'paid';
  const items: { label: string; done: boolean; currentLabel?: string }[] = [];
  if (!initPaid) {
    items.push({ label: 'Rechnung', done: invoiced }, { label: 'Bezahlt', done: paid }, { label: started ? 'Angetreten' : 'Antritt', done: started });
  }
  if (continuityDaysOf(p) || ret) {
    const released = p.retention_state === 'released';
    items.push({ label: '1. Teil', done: initPaid });
    items.push({ label: 'Garantie', done: released, currentLabel: p.continuity_end_date ? `Garantie bis ${dm(p.continuity_end_date)}` : 'Garantie' });
    items.push({ label: '2. Teil', done: ret?.status === 'paid' });
  } else if (started || initPaid) {
    items.push({ label: 'Gutschrift', done: initPaid });
  }
  return markCurrent(items);
}

/** Betrag rechts in der Zeile und die Zeile darunter (H8). */
export function placementAmount(f: PlacementFacts, ctx: ViewCtx): { amountCents: number | null; amountSub: string | null } {
  const p = f.p;
  const ts = tranchesOrVirtual(f);
  const stages = ts.map((t) => ({ t, s: trancheStage(t, p, f.origInvoicePaid) }));
  const open = stages.filter((x) => x.s !== 'paid' && x.s !== 'forfeited');
  const paidSum = stages.filter((x) => x.s === 'paid').reduce((a, x) => a + Number(x.t.amount_cents), 0);
  if (!open.length) {
    if (paidSum > 0) return { amountCents: paidSum, amountSub: 'ausgezahlt' };
    return { amountCents: null, amountSub: ts.length ? 'kein Anteil' : null };
  }
  const [main, ...rest] = open;
  if (rest.length) {
    const restSum = rest.reduce((a, x) => a + Number(x.t.amount_cents), 0);
    const from = trancheDueOn(rest[0].t, p, ctx.today);
    return { amountCents: Number(main.t.amount_cents), amountSub: `+ ${eur0(restSum)} ab ${dm(from)}` };
  }
  const single = main.t.tranche_type === 'research_bounty' || (main.t.tranche_type === 'initial' && !ts.some((t) => t.tranche_type === 'retention'));
  if (main.s === 'credited') {
    const cn = main.t.credit_note_id ? f.creditNotes?.[main.t.credit_note_id] : undefined;
    return { amountCents: Number(main.t.amount_cents), amountSub: cn?.pay_until ? `Geld bis ${dm(cn.pay_until)}` : 'in der Gutschrift' };
  }
  if (single && (main.s === 'waiting_start' || main.s === 'waiting_payment')) {
    return { amountCents: Number(main.t.amount_cents), amountSub: main.t.tranche_type === 'research_bounty' ? 'in einem Teil nach Antritt' : 'in einem Teil' };
  }
  const slot = runSlot(trancheDueOn(main.t, p, ctx.today), ctx.today, ctx.doneRuns);
  return { amountCents: Number(main.t.amount_cents), amountSub: slot.label };
}

function researchStatus(p: PlacementLike, today: string): string {
  switch (p.research_state) {
    case 'running': return `Stelle neu ausgeschrieben · ${runningSince(p.research_started_at, today)}`;
    case 'paused': return 'Nachbesetzung ruht';
    case 'awaiting_position': case 'awaiting_payment': return 'Nachbesetzung wird vorbereitet';
    case 'succeeded': return 'Nachbesetzt';
    case 'cancelled': case 'exhausted': return 'Nachbesetzung beendet';
    default: return 'Matchunt hat den Fall anerkannt';
  }
}

export function packageLabelOf(p: PlacementLike, v2Active?: boolean) {
  if (isReplacement(p)) return 'Nachbesetzung';
  if (v2Active && versionOf(p) === 1 && continuityDaysOf(p)) return 'Konditionen vor der Umstellung';
  return PACKAGE_LABEL[packageKeyOf(p)];
}

export function placementRow(f: PlacementFacts, ctx: ViewCtx): PlacementRowView {
  const p = f.p;
  const kind = caseOf(f);
  const company = f.companyName ?? '';
  let status: string | null = null;
  let amount = placementAmount(f, ctx);
  const reason = p.non_start_reason ?? f.claim?.category ?? p.departure_category ?? null;
  switch (kind) {
    case 'claim_open': status = `Gemeldet: ${REASON_SHORT[String(reason)] ?? 'Besetzung endet'} · Matchunt prüft`; break;
    case 'claim_accepted': status = researchStatus(p, ctx.today); break;
    case 'core_non_start':
      status = p.research_kind === 'joker' && (researchRunningLike(p) || p.research_started_at) ? researchStatus(p, ctx.today) : 'Nicht angefangen';
      amount = { amountCents: null, amountSub: f.jokerDecided ? 'kein Anteil' : 'Matchunt prüft' };
      break;
    case 'non_start_reported': status = `Du hast gemeldet: nicht angefangen · ${company || 'Kunde'} bestätigt`; break;
    case 'client_sphere': status = 'Grund beim Kunden · voller Anteil'; break;
    case 'core_ended': status = 'Besetzung vorzeitig beendet'; break;
    default: break;
  }
  const ended = ['succeeded', 'cancelled', 'exhausted'].includes(String(p.research_state ?? ''))
    || (kind === 'core_non_start' && !researchRunningLike(p))
    || tranchesOrVirtual(f).every((t) => ['paid', 'forfeited', 'cancelled'].includes(t.status));
  return {
    placementId: p.id,
    candidateName: f.candidateName ?? 'Kandidat',
    companyName: company,
    jobTitle: f.jobTitle ?? '',
    packageLabel: packageLabelOf(p, ctx.v2Active),
    chain: status && kind !== 'client_sphere' ? [] : placementChain(f),
    status,
    amountCents: amount.amountCents,
    amountSub: amount.amountSub,
    active: !ended,
    createdAt: String(p.created_at ?? ''),
  };
}

// ---------------------------------------------------------------------------
// H8: Kacheln und nächste Gutschrift
// ---------------------------------------------------------------------------

export interface UpcomingLine { placementId: string; trancheId: string; label: string; cents: number }
export interface UpcomingRun { slot: RunSlot; netCents: number; vatCents: number; lines: UpcomingLine[] }

export interface CreditNoteLike { id: string; status: string; net_cents: number; issued_on: string; paid_on?: string | null }

export interface OverviewTotals {
  receivedYearCents: number;
  waitingStartCents: number;
  /** davon wartet auf die Zahlung des Kunden */
  waitingPaymentCents: number;
  waitingGuaranteeCents: number;
  upcoming: UpcomingRun[];
}

export function overviewTotals(facts: PlacementFacts[], creditNotes: CreditNoteLike[], legacyPaid: { amount_cents: number; paid_at?: string | null }[], ctx: ViewCtx): OverviewTotals {
  const year = ctx.today.slice(0, 4);
  const receivedFromNotes = creditNotes.filter((c) => c.status === 'paid' && String(c.paid_on ?? c.issued_on).slice(0, 4) === year).reduce((a, c) => a + Number(c.net_cents ?? 0), 0);
  const receivedLegacy = legacyPaid.filter((t) => String(t.paid_at ?? '').slice(0, 4) === year).reduce((a, t) => a + Number(t.amount_cents ?? 0), 0);
  let waitingStart = 0, waitingPayment = 0, waitingGuarantee = 0;
  const runs = new Map<string, UpcomingRun>();
  for (const f of facts) {
    const kind = caseOf(f);
    for (const t of tranchesOrVirtual(f)) {
      const s = trancheStage(t, f.p, f.origInvoicePaid);
      if (s === 'waiting_start' && kind !== 'core_non_start' && kind !== 'non_start_reported') waitingStart += Number(t.amount_cents);
      if (s === 'waiting_payment') { waitingStart += Number(t.amount_cents); waitingPayment += Number(t.amount_cents); }
      if (s === 'waiting_guarantee' && kind !== 'claim_accepted') waitingGuarantee += Number(t.amount_cents);
      if (s === 'due' && !t.virtual) {
        const slot = runSlot(trancheDueOn(t, f.p, ctx.today), ctx.today, ctx.doneRuns);
        const run = runs.get(slot.runMonth) ?? { slot, netCents: 0, vatCents: 0, lines: [] };
        run.lines.push({ placementId: f.p.id, trancheId: t.id, label: `${trancheLabel(t, f.p)} · ${f.candidateName ?? 'Kandidat'}`, cents: Number(t.amount_cents) });
        run.netCents += Number(t.amount_cents);
        runs.set(slot.runMonth, run);
      }
    }
  }
  const upcoming = [...runs.values()].sort((a, b) => a.slot.runMonth.localeCompare(b.slot.runMonth))
    .map((r) => ({ ...r, vatCents: vatCentsFor(r.netCents, ctx.taxMode) }));
  return { receivedYearCents: receivedFromNotes + receivedLegacy, waitingStartCents: waitingStart, waitingPaymentCents: waitingPayment, waitingGuaranteeCents: waitingGuarantee, upcoming };
}

// ---------------------------------------------------------------------------
// H9 / H10 / J5: Besetzungs-Fenster
// ---------------------------------------------------------------------------

export interface StepView { state: 'done' | 'current' | 'todo'; text: string; note?: string | null; date?: string | null }
export interface FigureView { label: string; value: string; note?: string | null; cents?: number | null }

export interface PlacementWindowView {
  placementId: string;
  submissionId: string | null;
  candidateName: string;
  firstName: string;
  jobTitle: string;
  companyName: string;
  /** „MedTec Süd GmbH · Continuity 90 · Start 01.11.2026“ */
  subtitle: string;
  figures: FigureView[];
  /** H10/J5: Überschrift des Falls, sonst null */
  caseTitle: string | null;
  steps: StepView[];
  /** Kasten unter den Schritten */
  box: string | null;
  footer: string | null;
  /** „Zur Stelle“ */
  jobLink: string | null;
  /** Stellungnahme abgeben (offener Fall, noch nichts geschrieben) */
  canStatement: boolean;
  statement: { text: string; at: string | null } | null;
  /** H7: Antritt melden */
  start: {
    canReport: boolean;
    planned: string | null;
    fixed: boolean;
    /** „MedTec hat Cems Start bestätigt“ */
    fixedText: string | null;
    /** Kasten im Aufgaben-Fenster */
    box: string;
  };
  /** H7 rechts: Halbzeit der Garantie */
  halfway: { possible: boolean; status: string | null; at: string | null; guaranteeUntil: string | null };
}

function startFixedNote(p: PlacementLike, company: string): string | null {
  const reported = !!p.start_reported_at && p.start_report_kind === 'started';
  switch (p.start_fixed_how) {
    case 'client': return reported ? `du hast gemeldet, ${company} hat bestätigt` : `${company} hat bestätigt`;
    case 'recruiter_unopposed': return `du hast gemeldet, ${company} hat nicht widersprochen`;
    case 'no_report_14d': return 'ohne abweichende Meldung';
    case 'admin': return 'von Matchunt festgestellt';
    case 'client_sphere': return 'Grund beim Kunden';
    default: return null;
  }
}

function creditStep(t: TrancheLike, f: PlacementFacts, ctx: ViewCtx, label: string): StepView {
  const p = f.p;
  const s = trancheStage(t, p, f.origInvoicePaid);
  const amount = eur0(Number(t.amount_cents));
  const vat = vatRateFor(ctx.taxMode) > 0 ? ' + USt' : '';
  const credit = label ? `Gutschrift ${label} · ${amount}${vat}` : `Gutschrift · ${amount}${vat}`;
  if (s === 'paid') return { state: 'done', text: `${label || 'Anteil'} ausgezahlt · ${amount}`, date: dm(day(t.paid_at)) || null };
  if (s === 'forfeited') return { state: 'done', text: `${label || 'Anteil'} entfällt`, date: null };
  if (s === 'credited') {
    const cn = t.credit_note_id ? f.creditNotes?.[t.credit_note_id] : undefined;
    return { state: 'todo', text: credit, note: cn ? `in ${cn.number}` : null, date: cn?.pay_until ? `Geld bis ${dm(cn.pay_until)}` : null };
  }
  const slot = runSlot(trancheDueOn(t, p, ctx.today), ctx.today, ctx.doneRuns);
  return { state: 'todo', text: credit, date: slot.short };
}

/** Normale Schritte (H9). */
function normalSteps(f: PlacementFacts, ctx: ViewCtx, first: string, company: string): StepView[] {
  const p = f.p;
  const steps: StepView[] = [];
  const ts = tranchesOrVirtual(f);
  const repl = isReplacement(p);
  steps.push({ state: 'done', text: 'Arbeitsvertrag unterschrieben', date: dm(day(f.contractSignedOn) ?? day(p.created_at)) || null });
  const needsInvoice = !repl || Number(p.client_fee_cents ?? 0) > 0;
  if (needsInvoice) {
    const inv = f.invoice;
    const issued = !!inv && !!inv.status && inv.status !== 'draft';
    steps.push(issued
      ? { state: 'done', text: `Rechnung gestellt${inv?.due_date ? ` · fällig ${dm(inv.due_date)}` : ''}`, date: dm(day(inv?.issued_at)) || null }
      : { state: 'todo', text: 'Matchunt stellt die Rechnung' });
    steps.push(isInvoicePaid(p, inv)
      ? { state: 'done', text: `${company} hat bezahlt`, date: dm(day(inv?.paid_at) ?? day(p.paid_at)) || null }
      : { state: 'todo', text: `${company} bezahlt die Rechnung`, note: issued && inv?.due_date ? `fällig ${dm(inv.due_date)}` : null });
  }
  if (isStarted(p)) {
    steps.push({ state: 'done', text: `${first} hat angefangen`, note: startFixedNote(p, company), date: dm(plannedStartOf(p) ?? day(p.start_fixed_at)) || null });
  } else if (p.start_report_kind === 'started' && p.start_reported_at) {
    steps.push(p.start_contested_at
      ? { state: 'todo', text: `${company} sieht den Start anders`, note: 'Matchunt klärt das' }
      : { state: 'todo', text: `Du hast gemeldet: ${first} hat angefangen`, note: `${company} bestätigt bis ${dm(addWorkdays(String(p.start_reported_at).slice(0, 10), START_OBJECTION_WORKDAYS))}`, date: dm(day(p.start_reported_on)) || null });
  } else {
    steps.push({ state: 'todo', text: `Erster Arbeitstag ${dmy(plannedStartOf(p))}`, note: p.start_report_kind === 'later' ? 'neuer Termin' : null });
  }
  const init = ts.find((t) => t.tranche_type === 'initial');
  const ret = ts.find((t) => t.tranche_type === 'retention');
  const bounty = ts.find((t) => t.tranche_type === 'research_bounty');
  if (bounty) steps.push(creditStep(bounty, f, ctx, 'Auslobung'));
  if (init) steps.push(creditStep(init, f, ctx, ret || continuityDaysOf(p) ? '1. Teil' : ''));
  if (continuityDaysOf(p) || ret) {
    const released = p.retention_state === 'released';
    steps.push(released
      ? { state: 'done', text: 'Garantie überstanden', date: dm(day(p.client_sphere_at) ?? day(p.retention_release_date)) || null }
      : { state: 'todo', text: `Garantie läuft bis ${dmy(p.continuity_end_date)}, Meldefrist bis ${dm(p.retention_release_date)}` });
    if (ret) steps.push(creditStep(ret, f, ctx, '2. Teil'));
  }
  return markCurrentSteps(steps);
}

function markCurrentSteps(steps: StepView[]): StepView[] {
  let seen = false;
  return steps.map((s) => {
    if (s.state === 'done') return s;
    if (!seen) { seen = true; return { ...s, state: 'current' }; }
    return { ...s, state: 'todo' };
  });
}

function researchStep(p: PlacementLike, company: string): StepView {
  switch (p.research_state) {
    case 'running': return { state: 'current', text: 'Stelle für alle neu ausgeschrieben', date: dm(day(p.research_started_at)) || null };
    case 'paused': return { state: 'current', text: 'Nachbesetzung ruht', date: null };
    case 'awaiting_position': return { state: 'current', text: `${company} bestätigt die Stelle`, note: 'danach wird sie für alle neu ausgeschrieben' };
    case 'awaiting_payment': return { state: 'current', text: 'Stelle wird ausgeschrieben, sobald die Rechnung bezahlt ist' };
    case 'succeeded': return { state: 'done', text: 'Stelle wieder besetzt', date: dm(day(p.research_ended_at)) || null };
    case 'cancelled': case 'exhausted':
      return { state: 'done', text: p.research_end_reason === 'matchunt_ended' ? 'Matchunt hat die Nachbesetzung beendet' : `${company} hat die Nachbesetzung beendet`, date: dm(day(p.research_ended_at)) || null };
    default: return { state: 'current', text: 'Nachbesetzung wird vorbereitet' };
  }
}

export function placementWindow(f: PlacementFacts, ctx: ViewCtx): PlacementWindowView {
  const p = f.p;
  const first = firstOf(f.candidateName);
  const company = f.companyName ?? 'Der Kunde';
  const short = companyShort(company);
  const pkg = packageKeyOf(p);
  const cont = continuityDaysOf(p);
  const repl = isReplacement(p);
  const ts = tranchesOrVirtual(f);
  const init = ts.find((t) => t.tranche_type === 'initial');
  const ret = ts.find((t) => t.tranche_type === 'retention');
  const bounty = ts.find((t) => t.tranche_type === 'research_bounty');
  const planned = plannedStartOf(p);
  const kind = caseOf(f);

  const subtitle = [company, packageLabelOf(p, ctx.v2Active) === 'Konditionen vor der Umstellung' ? `${PACKAGE_LABEL[pkg]} · Konditionen vor der Umstellung` : packageLabelOf(p, ctx.v2Active), planned ? `Start ${dmy(planned)}` : null].filter(Boolean).join(' · ');

  // Kacheln: Grundlage, 1. Teil, 2. Teil (bzw. Anteil / Auslobung)
  const gross = Number(p.gross_annual_target_compensation_cents ?? 0);
  const { initialPct, retentionPct } = pctsOf(p);
  const fmtPct = (n: number) => `${String(n).replace('.', ',')} %`;
  const figures: FigureView[] = [];
  if (gross > 0) figures.push({ label: 'Grundlage', value: eur0(gross), note: 'Zielgehalt laut Vertrag', cents: gross });
  if (repl) {
    if (bounty) figures.push({ label: 'Auslobung', value: eur0(Number(bounty.amount_cents)), note: 'in einem Teil nach Antritt', cents: Number(bounty.amount_cents) });
  } else if (ret || cont) {
    if (init) figures.push({ label: `1. Teil · ${fmtPct(initialPct)}`, value: eur0(Number(init.amount_cents)), cents: Number(init.amount_cents) });
    if (ret) figures.push({ label: `2. Teil · ${fmtPct(retentionPct)}`, value: eur0(Number(ret.amount_cents)), cents: Number(ret.amount_cents) });
  } else if (init) {
    figures.push({ label: `Dein Anteil · ${fmtPct(initialPct)}`, value: eur0(Number(init.amount_cents)), note: 'in einem Teil', cents: Number(init.amount_cents) });
  }

  let steps = normalSteps(f, ctx, first, short);
  let caseTitle: string | null = null;
  let box: string | null = null;
  let footer: string | null = null;
  let jobLink: string | null = null;
  const jobOf = () => (p.research_job_id ?? f.jobId) ? `/recruiter/jobs/${p.research_job_id ?? f.jobId}` : null;
  const claim = f.claim;
  const claimKind: 'departure' | 'non_start' = claim?.kind === 'non_start' || (!!p.non_start_reported_at && !isStarted(p)) ? 'non_start' : 'departure';
  const reason = claim?.category ?? p.non_start_reason ?? p.departure_category ?? null;
  const statement = claim?.recruiter_statement ? { text: claim.recruiter_statement, at: claim.recruiter_statement_at ?? null } : null;

  if (kind === 'claim_open') {
    caseTitle = caseTitleFor(claimKind, reason, first);
    steps = [
      ...(claimKind === 'departure' && init ? [initialKeptStep(init, f, ctx)] : []),
      { state: 'done', text: `${short} hat gemeldet: ${REASON_SHORT[String(reason)] ?? 'Besetzung endet'}`, date: dm(day(claim?.reported_at)) || null },
      ...(statement ? [{ state: 'done' as const, text: 'Du hast deine Sicht geschildert', date: dm(day(statement.at)) || null }] : []),
      { state: 'current', text: 'Matchunt prüft den Fall' },
    ];
    box = statement
      ? 'Matchunt hat deine Sicht und entscheidet. Du bekommst Bescheid.'
      : `Matchunt hört dich an, bevor es entscheidet. Schreib kurz, was du über ${first} weißt.`;
  } else if (kind === 'claim_accepted') {
    caseTitle = caseTitleFor(claimKind, reason, first);
    const research = researchStep(p, short);
    const bountyBase = bountyCentsOf(p);
    const own = ownBountyCents(p, claimKind === 'non_start' ? 0 : keptInitial(f), bountyBase);
    if (claimKind === 'departure') {
      steps = [
        ...(init ? [initialKeptStep(init, f, ctx)] : []),
        { state: 'done', text: `${short} hat gemeldet${statement ? ', du wurdest angehört' : ''}`, date: dm(day(claim?.reported_at)) || null },
        { state: 'done', text: 'Matchunt hat anerkannt', date: dm(day(claim?.decided_at)) || null },
        research,
      ];
      const retCents = Number(ret?.amount_cents ?? p.recruiter_retention_cents ?? 0);
      if (p.research_state === 'succeeded') box = f.replacedByMe ? 'Du hast nachbesetzt. Deine Auslobung siehst du bei der neuen Besetzung.' : 'Besetzt hat jemand anderes. Dein 2. Teil entfällt.';
      else if (['cancelled', 'exhausted'].includes(String(p.research_state))) box = 'Die Stelle ist nicht mehr offen. Dein 2. Teil entfällt.';
      else if (own > 0) box = own === retCents
        ? `Besetzt du sie, bekommst du deinen 2. Teil (${eur0(own)}), sobald der Ersatz angefangen hat. Besetzt sie jemand anderes, entfällt er.`
        : `Besetzt du sie, bekommst du ${eur0(own)} in einem Teil, sobald der Ersatz angefangen hat. Besetzt sie jemand anderes, entfällt dein 2. Teil.`;
      else box = 'Die Stelle wird neu für alle ausgeschrieben, auch für dich. Dein 2. Teil entfällt.';
    } else {
      steps = [
        { state: 'done', text: `${isInvoicePaid(p, f.invoice) ? 'Rechnung bezahlt, ' : ''}Matchunt hat geprüft`, date: dm(day(claim?.decided_at)) || null },
        research,
      ];
      if (p.research_state === 'succeeded') box = f.replacedByMe ? 'Du hast nachbesetzt. Deine Auslobung siehst du bei der neuen Besetzung.' : 'Besetzt hat jemand anderes.';
      else if (['cancelled', 'exhausted'].includes(String(p.research_state))) box = 'Die Stelle ist nicht mehr offen.';
      else box = `Besetzt du sie, bekommst du ${eur0(own)} in einem Teil, sobald der Ersatz angefangen hat. Für den Ersatz gibt es keine zweite Garantie.`;
    }
    if (researchRunningLike(p)) jobLink = jobOf();
  } else if (kind === 'claim_rejected') {
    box = 'Matchunt hat den Fall nicht anerkannt. Für dich ändert sich nichts.';
  } else if (kind === 'client_sphere') {
    box = cont || ret ? 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil, der 2. Teil wird sofort frei.' : 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil.';
  } else if (kind === 'core_non_start') {
    // J5: Ob und zu welchem Preis Matchunt etwas angeboten hat, erfährt der Headhunter nicht.
    const reopened = p.research_kind === 'joker' && (researchRunningLike(p) || !!p.research_started_at);
    const reasonText = `${REASON_SHORT[String(reason)] ?? 'nicht angefangen'}${p.non_start_note ? ` (${String(p.non_start_note).slice(0, 140)})` : ''}`;
    steps = [
      { state: 'done', text: `${short} hat gemeldet: ${first} hat nicht angefangen`, date: dm(day(p.non_start_reported_at)) || null },
      f.jokerDecided || reopened ? { state: 'done', text: 'Matchunt hat geprüft' } : { state: 'current', text: 'Matchunt prüft den Fall' },
    ];
    if (reopened) {
      caseTitle = 'Die Stelle wird neu ausgeschrieben';
      steps.push(researchStep(p, short));
      const own = ownBountyCents({ ...p, research_kind: 'joker' }, 0, bountyCentsOf({ ...p, research_kind: 'joker' }));
      box = p.research_state === 'succeeded'
        ? (f.replacedByMe ? 'Du hast nachbesetzt. Deine Auslobung siehst du bei der neuen Besetzung.' : 'Besetzt hat jemand anderes.')
        : `Für alle Headhunter, auch für dich. Besetzt du sie, bekommst du ${eur0(own)} in einem Teil nach Antritt.`;
      if (researchRunningLike(p)) jobLink = jobOf();
    } else {
      caseTitle = `${first} hat nicht angefangen`;
      box = f.jokerDecided
        ? `Bei Core gibt es den Anteil erst mit dem Antritt, deshalb diesmal keinen. Grund laut Kunde: ${reasonText}.`
        : `Matchunt prüft den Fall und meldet sich. Bei Core gibt es den Anteil erst mit dem Antritt. Grund laut Kunde: ${reasonText}.`;
    }
  } else if (kind === 'non_start_reported') {
    caseTitle = `${first} hat nicht angefangen`;
    steps = [
      { state: 'done', text: 'Du hast gemeldet: hat nicht angefangen', date: dm(day(p.start_reported_at)) || null },
      { state: 'current', text: `${short} bestätigt, dann prüft Matchunt` },
    ];
    box = cont ? 'Bestätigt der Kunde, wird die Stelle neu für alle ausgeschrieben, auch für dich.' : 'Bei Core gibt es den Anteil erst mit dem Antritt.';
  } else if (kind === 'core_ended') {
    box = 'Die Besetzung ist vorzeitig beendet. Bei Core bleibt dein Anteil deiner.';
  } else if (isStarted(p)) {
    footer = cont && !repl ? `Du musst nichts tun. Wackelt es bei ${first}, sag uns früh Bescheid.` : 'Du musst nichts tun.';
  } else {
    footer = `Am ersten Arbeitstag fragen wir dich, ob ${first} angefangen hat.`;
  }

  // H7: Antritt melden und Kasten im Aufgaben-Fenster
  const canReport = !p.start_fixed_at && !p.start_reported_at && !p.non_start_reported_at && p.placement_state === 'agreed' && !!planned && planned <= ctx.today;
  const fixedText = p.start_fixed_at ? (p.start_fixed_how === 'client' && !(p.start_reported_at && p.start_report_kind === 'started') ? `${short} hat ${first}s Start bestätigt.` : `${first}s Start steht fest.`) : null;
  const slot = runSlot(ctx.today, ctx.today, ctx.doneRuns);
  const paidNow = isInvoicePaid(p, f.invoice);
  const later = paidNow ? '' : ', sobald die Rechnung bezahlt ist';
  const startBox = repl
    ? `Deine Meldung geht an ${short} zur Bestätigung. Bestätigt ${short} oder widerspricht ${START_OBJECTION_WORKDAYS} Werktage nicht, wird deine Auslobung fällig${later}: ${eur0(Number(bounty?.amount_cents ?? 0))} mit der Gutschrift ${slot.label}.`
    : ret || cont
      ? `Deine Meldung geht an ${short} zur Bestätigung. Bestätigt ${short} oder widerspricht ${START_OBJECTION_WORKDAYS} Werktage nicht, wird dein 1. Teil fällig${later}: ${eur0(Number(init?.amount_cents ?? 0))} mit der Gutschrift ${slot.label}.`
      : `Deine Meldung geht an ${short} zur Bestätigung. Bestätigt ${short} oder widerspricht ${START_OBJECTION_WORKDAYS} Werktage nicht, wird dein Verdienst fällig${later}: ${eur0(Number(init?.amount_cents ?? 0))} mit der Gutschrift ${slot.label}.`;

  const halfwayPossible = !!cont && !repl && isStarted(p) && kind === 'none' && p.placement_state === 'started';

  return {
    placementId: p.id,
    submissionId: p.submission_id ?? null,
    candidateName: f.candidateName ?? 'Kandidat',
    firstName: first,
    jobTitle: f.jobTitle ?? '',
    companyName: company,
    subtitle,
    figures,
    caseTitle,
    steps,
    box,
    footer,
    jobLink,
    canStatement: kind === 'claim_open' && !statement,
    statement,
    start: { canReport, planned, fixed: !!p.start_fixed_at, fixedText, box: startBox },
    halfway: { possible: halfwayPossible, status: p.halfway_status ?? null, at: p.halfway_at ?? null, guaranteeUntil: p.continuity_end_date ?? null },
  };
}

function initialKeptStep(t: TrancheLike, f: PlacementFacts, ctx: ViewCtx): StepView {
  const s = trancheStage(t, f.p, f.origInvoicePaid);
  if (s === 'paid') return { state: 'done', text: '1. Teil ausgezahlt, bleibt deiner', date: dm(day(t.paid_at)) || null };
  if (s === 'forfeited') return { state: 'done', text: '1. Teil entfällt' };
  const slot = runSlot(trancheDueOn(t, f.p, ctx.today), ctx.today, ctx.doneRuns);
  return { state: 'done', text: `1. Teil (${eur0(Number(t.amount_cents))}) bleibt deiner`, date: slot.short };
}

// ---------------------------------------------------------------------------
// H7: Aufgaben am ersten Arbeitstag und zur Halbzeit
// ---------------------------------------------------------------------------

export const startTaskTitle = (first: string) => `Hat ${first} angefangen?`;
export const halfwayTaskTitle = (first: string) => `Wie läuft es bei ${first}?`;
export function startTaskKind(title: string | null | undefined): 'start' | 'halfway' | null {
  const t = String(title ?? '');
  if (/^Hat .+ angefangen\?$/.test(t)) return 'start';
  if (/^Wie läuft es bei .+\?$/.test(t)) return 'halfway';
  return null;
}

/** Halbzeit der Garantie: erster Arbeitstag + halbe Garantie. */
export function halfwayDay(firstWorkingDay: string, continuityDays: number) {
  return addDays(firstWorkingDay, Math.floor(continuityDays / 2));
}

// ---------------------------------------------------------------------------
// H3–H6: Verdienst an Stellen
// ---------------------------------------------------------------------------

export interface JobTerms {
  jobId: string;
  packageKey: PackageKey;
  version: ConditionsVersion;
  /** Aufteilung laut Konditionen (false = Bestandsstelle mit eigenem Satz) */
  standard: boolean;
  initialPct: number;
  retentionPct: number;
  continuityDays: number | null;
  /** Gibt es Fassung 2 schon (Stichtag gesetzt)? */
  v2Active: boolean;
  /** Tag der Aktivierung („Ich suche“), wenn schon aktiviert */
  activatedAt: string | null;
  research: null | {
    reason: 'departure' | 'non_start';
    since: string | null;
    bountyCents: number;
    /** Nur für den ursprünglichen Headhunter: was er bekommt, wenn er selbst besetzt (Deckel) */
    ownCents: number | null;
    ownIsRetention: boolean;
  };
  /** F2: zuletzt gemeldet (eigene Meldung) */
  reportedAt: string | null;
}

export interface JobEarning {
  totalCents: number;
  minCents: number | null;
  maxCents: number | null;
  pct: number;
  initialCents: number;
  retentionCents: number;
  continuityDays: number | null;
  twoParts: boolean;
  /** unter dem Betrag in der Liste: „in 2 Teilen“ / „ganz bei Antritt“ / „in einem Teil nach Antritt“ */
  cardLine: string;
  /** Vorschau und „Ich suche“: „8.250 € bei Antritt, Rest nach 90 Tagen“ */
  line: string;
  /** Kopf der Stelle: „8.250 € bei Antritt · 16.500 € nach 90 Tagen“ */
  detail: string;
  /** „Paket des Kunden“ */
  packageText: string;
  research: null | { own: boolean; note: string; since: string | null };
}

const toCents = (euros: number | null | undefined) => (euros != null && Number.isFinite(Number(euros)) && Number(euros) > 0 ? Math.round(Number(euros) * 100) : null);

export function jobEarning(terms: JobTerms | null | undefined, salaryMin: number | null | undefined, salaryMax: number | null | undefined): JobEarning | null {
  if (!terms) return null;
  if (terms.research) {
    const r = terms.research;
    const own = r.ownCents != null;
    const total = own ? Number(r.ownCents) : r.bountyCents;
    return {
      totalCents: total, minCents: null, maxCents: null, pct: 0, initialCents: total, retentionCents: 0, continuityDays: null, twoParts: false,
      cardLine: own && r.ownIsRetention ? 'dein 2. Teil, wenn du besetzt' : 'in einem Teil nach Antritt',
      line: own && r.ownIsRetention ? 'dein 2. Teil, wenn du besetzt' : 'in einem Teil nach Antritt',
      detail: 'in einem Teil, sobald dein Kandidat angefangen hat · keine zweite Garantie',
      packageText: 'Nachbesetzung',
      research: { own, note: r.reason === 'non_start' ? 'Die erste Besetzung hat nicht angefangen.' : 'Die erste Besetzung hat in der Probezeit gekündigt.', since: r.since },
    };
  }
  const lo = toCents(salaryMin), hi = toCents(salaryMax);
  if (lo == null && hi == null) return null;
  const mid = lo != null && hi != null ? Math.round((lo + hi) / 2) : (lo ?? hi)!;
  const pct = terms.initialPct + terms.retentionPct;
  const share = (gross: number | null) => (gross == null ? null : Math.round((gross * pct) / 100));
  let initial: number, retention: number, line: string, detail: string;
  if (terms.standard) {
    const plan = earningPlan(terms.packageKey, terms.version, mid);
    initial = plan.initialCents; retention = plan.retentionCents; line = plan.line; detail = plan.detail;
  } else {
    initial = Math.round((mid * terms.initialPct) / 100);
    retention = Math.round((mid * terms.retentionPct) / 100);
    line = retention > 0 && terms.continuityDays ? `${eur0(initial)} bei Antritt, Rest nach ${terms.continuityDays} Tagen` : 'ganz bei Antritt';
    detail = retention > 0 && terms.continuityDays ? `${eur0(initial)} bei Antritt · ${eur0(retention)} nach ${terms.continuityDays} Tagen` : 'ganz bei Antritt';
  }
  const twoParts = retention > 0;
  if (terms.v2Active && terms.version === 1 && terms.activatedAt && twoParts) detail = `${detail} · Konditionen vom ${dm(terms.activatedAt.slice(0, 10))}`;
  return {
    totalCents: initial + retention, minCents: share(lo), maxCents: share(hi), pct, initialCents: initial, retentionCents: retention,
    continuityDays: twoParts ? terms.continuityDays : null, twoParts,
    cardLine: twoParts ? 'in 2 Teilen' : 'ganz bei Antritt', line, detail,
    packageText: terms.continuityDays ? `mit Nachbesetzung, ${terms.continuityDays} Tage` : PACKAGE_LABEL[terms.packageKey],
    research: null,
  };
}

export interface EarningExplain {
  subtitle: string;
  payout: { n: number; title: string; note: string; cents: number | null }[];
  risks: string[];
}

/** H5: „So wird ausgezahlt“ und „Wenn etwas schiefgeht“. */
export function earningExplain(e: JobEarning, terms: JobTerms): EarningExplain {
  const reserved = { n: 1, title: 'Kunde unterschreibt und zahlt', note: 'dein Anteil ist reserviert', cents: null };
  const monthly = 'nächste Monats-Gutschrift, Geld 7 Tage danach';
  if (e.research) {
    return {
      subtitle: 'Verdient mit dem Arbeitsvertrag, ausgezahlt in einem Teil',
      payout: [{ n: 1, title: 'Kunde unterschreibt', note: 'kein neues Honorar für den Kunden', cents: null }, { n: 2, title: 'Kandidat fängt an', note: monthly, cents: e.totalCents }],
      risks: ['Für den Ersatz gibt es keine zweite Garantie.', e.research.note],
    };
  }
  if (!e.twoParts) {
    return {
      subtitle: 'Verdient mit dem Arbeitsvertrag, ausgezahlt bei Antritt',
      payout: [reserved, { n: 2, title: 'Kandidat fängt an', note: monthly, cents: e.totalCents }],
      risks: ['Fängt dein Kandidat nicht an, gibt es bei Core keinen Anteil. Geld gibt es nur mit dem Antritt.', 'Geht er nach dem Start, bleibt dein Anteil deiner.', 'Liegt der Grund beim Kunden, bekommst du alles.'],
    };
  }
  const days = e.continuityDays ?? terms.continuityDays ?? 90;
  // Midpoint als Grundlage, wie der Betrag oben
  const split: Split = terms.standard ? splitFor(terms.packageKey, terms.version) : { ...CONDITIONS[terms.version][terms.packageKey], initialPct: terms.initialPct, retentionPct: terms.retentionPct };
  const gross = e.pct > 0 ? Math.round((e.totalCents * 100) / e.pct) : 0;
  const bounty = terms.standard ? amountsFor(terms.packageKey, terms.version, gross).bountyCents : Math.round((gross * split.bountyPct) / 100);
  const nonStartOwn = bountyFor({ bountyCents: bounty, sameRecruiter: true, keptByOriginalCents: 0, split });
  const departOwn = bountyFor({ bountyCents: bounty, sameRecruiter: true, keptByOriginalCents: e.initialCents, split });
  return {
    subtitle: 'Verdient mit dem Arbeitsvertrag, ausgezahlt in zwei Teilen',
    payout: [
      reserved,
      { n: 2, title: 'Kandidat fängt an', note: monthly, cents: e.initialCents },
      { n: 3, title: `${days} Tage Garantie überstanden`, note: 'plus 14 Tage Meldefrist des Kunden', cents: e.retentionCents },
    ],
    risks: [
      `Fängt dein Kandidat nicht an, wird die Stelle neu für alle ausgeschrieben, auch für dich. Besetzt du sie, bekommst du ${nonStartOwn >= e.totalCents ? `die vollen ${eur0(e.totalCents)}` : eur0(nonStartOwn)}.`,
      `Geht er in den ${days} Tagen, bleiben die ${eur0(e.initialCents)} deine. Die Stelle wird neu für alle ausgeschrieben.${departOwn > 0 ? ` Besetzt du sie, kommen ${departOwn === e.retentionCents ? `deine ${eur0(departOwn)}` : eur0(departOwn)} dazu.` : ''}`,
      'Liegt der Grund beim Kunden, bekommst du alles.',
    ],
  };
}

// ---------------------------------------------------------------------------
// H2: Tabelle bisher / neu
// ---------------------------------------------------------------------------

export function conditionsTable(): { label: string; before: string; after: string; changed: boolean }[] {
  const s1 = CONDITIONS[1], s2 = CONDITIONS[2];
  const fmt = (s: Split) => (s.retentionPct ? `${s.initialPct} % bei Antritt, ${s.retentionPct} % nach ${s.continuityDays} Tagen` : `${s.initialPct} % bei Antritt`);
  const row = (label: string, a: Split, b: Split) => {
    const changed = fmt(a) !== fmt(b);
    return { label, before: fmt(a), after: changed ? fmt(b) : 'unverändert', changed };
  };
  const bountyBefore = s1.continuity_90.bountyPct === s1.continuity_180.bountyPct ? `${s1.continuity_90.bountyPct} %` : `${s1.continuity_90.bountyPct} bzw. ${s1.continuity_180.bountyPct} %`;
  const bountyAfter = s2.continuity_90.bountyPct === s2.continuity_180.bountyPct ? `${s2.continuity_90.bountyPct} %` : `${s2.continuity_90.bountyPct} bzw. ${s2.continuity_180.bountyPct} %`;
  return [
    row('Core', s1.core, s2.core),
    row('Continuity 90', s1.continuity_90, s2.continuity_90),
    row('Continuity 180', s1.continuity_180, s2.continuity_180),
    { label: 'Nachbesetzung', before: bountyBefore, after: `${bountyAfter}, für alle Headhunter ausgeschrieben`, changed: true },
    { label: 'Eigene Stelle nachbesetzen', before: '–', after: 'dein 2. Teil, insgesamt höchstens dein normaler Anteil', changed: true },
  ];
}

// ---------------------------------------------------------------------------
// H11: CSV für den Steuerberater
// ---------------------------------------------------------------------------

export interface CreditNoteCsvRow {
  number: string; issued_on: string; period: string; status: string; tax_mode: string; vat_rate: number;
  net_cents: number; vat_cents: number; total_cents: number; paid_on?: string | null; lines?: unknown;
}

const BOM = String.fromCharCode(0xfeff);
export function creditNotesCsv(rows: CreditNoteCsvRow[]): string {
  const n = (c: number) => (Number(c) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const q = (v: unknown) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const status: Record<string, string> = { issued: 'gestellt', paid: 'ausgezahlt', cancelled: 'storniert' };
  const linesText = (l: unknown) => (Array.isArray(l) ? l.map((x: any) => x?.title ?? x?.label ?? '').filter(Boolean).join(' | ') : '');
  const head = ['Gutschrift-Nr.', 'Datum', 'Leistungszeitraum', 'Positionen', 'Netto', 'USt-Satz', 'USt', 'Auszahlung', 'Steuer', 'Status', 'Ausgezahlt am'];
  const out = rows.map((r) => [
    r.number, dmy(r.issued_on), r.period, linesText(r.lines), n(r.net_cents), `${r.vat_rate ?? 0} %`, n(r.vat_cents), n(r.total_cents),
    isTaxMode(r.tax_mode) ? TAX_MODE_LABEL[r.tax_mode] : r.tax_mode, status[r.status] ?? r.status, dmy(r.paid_on ?? null),
  ].map(q).join(';'));
  return `${BOM}${[head.join(';'), ...out].join('\r\n')}\r\n`;
}

/** Zahlung bis: Gutschrift + 7 Tage (falls die Zeile kein Datum trägt). */
export const payUntilOf = (issuedOn: string, payUntil?: string | null) => payUntil ?? addDays(issuedOn, CREDIT_NOTE_PAY_DAYS);

// ---------------------------------------------------------------------------
// Antworten der Function `abrechnung` (gemeinsame Typen für die Web-App)
// ---------------------------------------------------------------------------

export interface OverviewResponse {
  today: string;
  year: string;
  taxMode: TaxMode | null;
  rows: PlacementRowView[];
  totals: { receivedYearCents: number; waitingStartCents: number; waitingPaymentCents: number; waitingGuaranteeCents: number };
  next: UpcomingRun | null;
  upcoming: UpcomingRun[];
  creditNoteCount: number;
  /** Was für die Auszahlung noch fehlt (leer = alles da) */
  payoutGaps: string[];
}

export interface CreditNoteItem {
  id: string; number: string; status: 'issued' | 'paid' | 'cancelled' | string; issuedOn: string; period: string; payUntil: string | null; paidOn: string | null;
  netCents: number; vatCents: number; totalCents: number; vatRate: number; taxMode: string;
  lines: { title: string; detail: string | null; amountCents: number | null }[];
  hasPdf: boolean; ibanMasked: string | null;
  objectionUntil: string; canObject: boolean;
  objection: { status: string; topic: string; note: string; createdAt: string; resolution: string | null; resolvedAt: string | null } | null;
}

export interface CreditNotesResponse { notes: CreditNoteItem[]; upcoming: UpcomingRun[]; taxMode: TaxMode | null; years: string[] }

export interface BillingView {
  exists: boolean;
  recipient: { legalName: string; legalForm: string; street: string; postalCode: string; city: string; country: string; countryLabel: string };
  tax: { mode: TaxMode; vatId: string; taxNumber: string; text: string };
  account: { holder: string; ibanMasked: string; bic: string; confirmedAt: string | null; fromProfile: boolean } | null;
  pending: { holder: string; ibanMasked: string; requestedAt: string | null; confirmedAt: string | null; effectiveAt: string | null } | null;
  selfBilling: { consented: boolean | null; objectedAt: string | null };
  loginEmailMasked: string;
  complete: boolean;
}

export interface ConditionsResponse {
  show: boolean;
  activeFrom: string | null;
  forcedFrom: string | null;
  consentedAt: string | null;
  version: ConditionsVersion;
  table: { label: string; before: string; after: string; changed: boolean }[];
}
