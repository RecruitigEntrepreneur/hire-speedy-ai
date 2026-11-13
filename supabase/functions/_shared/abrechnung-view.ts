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
import { baseLang, intlLocale, normLang, type BaseLang } from './i18n.ts';

// ---------------------------------------------------------------------------
// Sprache der Anzeige (Mehrsprachigkeit 13.11.2026)
// ---------------------------------------------------------------------------
// Ohne Angabe Deutsch, wie bisher (Server, Mails, Tests). Die Web-App gibt die
// Sprache der Oberfläche mit; die Function `abrechnung` liest sie aus body.lang.
// Gutschriften als Dokument (PDF, CSV für den Steuerberater) bleiben deutsch.

export type ViewLang = string | null | undefined;
const bl = (lang: ViewLang): BaseLang => baseLang(normLang(lang));
const isDe = (lang: ViewLang) => bl(lang) === 'de';
const loc = (lang: ViewLang) => intlLocale(normLang(lang));
/** Text in der Sprache der Anzeige (Deutsch ist die Quelle). */
const L = (lang: ViewLang, t: Record<BaseLang, string>) => t[bl(lang)];
const isoDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

// ---------------------------------------------------------------------------
// Formate
// ---------------------------------------------------------------------------

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
/** Monatsname (0–11) in der Sprache der Anzeige */
const monthName = (m: number, lang: ViewLang, short = false) => isDe(lang)
  ? (short ? MONTHS_SHORT[m] : MONTHS[m])
  : new Date(Date.UTC(2000, m, 15, 12)).toLocaleDateString(loc(lang), { month: short ? 'short' : 'long', timeZone: 'UTC' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const day = (v: unknown): string | null => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);
/** „01.11.“ */
export const dm = (iso: string | null | undefined, lang?: ViewLang) => (!iso ? '' : isDe(lang)
  ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`
  : isoDate(iso).toLocaleDateString(loc(lang), { day: '2-digit', month: '2-digit', timeZone: 'UTC' }));
/** „01.11.2026“ */
export const dmy = (iso: string | null | undefined, lang?: ViewLang) => (!iso ? '' : isDe(lang)
  ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
  : isoDate(iso).toLocaleDateString(loc(lang), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }));
/** „8.250 €“ (ganze Euro) */
export const eur0 = (c: number, lang?: ViewLang) => (isDe(lang)
  ? `${Math.round(c / 100).toLocaleString('de-DE')} €`
  : new Intl.NumberFormat(loc(lang), { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(c / 100)));
/** „8.250,00 €“ */
export const eur2 = (c: number, lang?: ViewLang) => (isDe(lang)
  ? `${(c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  : new Intl.NumberFormat(loc(lang), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100));
const maxIso = (...v: (string | null | undefined)[]) => (v.filter(Boolean) as string[]).sort().pop() ?? null;
const candidateWord = (lang: ViewLang) => L(lang, { de: 'Kandidat', en: 'Candidate', sv: 'Kandidat', nb: 'Kandidat' });
const firstOf = (name: string | null | undefined, lang?: ViewLang) => (name ? String(name).trim().split(/\s+/)[0] : candidateWord(lang));
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
export function runSlot(dueOn: string, today: string, doneRuns: readonly string[] = [], lang?: ViewLang): RunSlot {
  let period = dueOn.slice(0, 7);
  for (let i = 0; i < 24 && doneRuns.includes(period); i++) period = addMonths(period, 1);
  let runMonth = addMonths(period, 1);
  const current = today.slice(0, 7);
  if (runMonth < current) runMonth = current;
  const latest = tenthWorkday(runMonth);
  const m = Number(runMonth.slice(5, 7)) - 1;
  // Lauf überfällig (nach dem 10. Werktag noch nicht gemacht): kein falsches „Anfang …“
  if (runMonth === current && today > latest) {
    return {
      period, runMonth, latest,
      label: L(lang, { de: 'mit dem nächsten Lauf', en: 'with the next payout run', sv: 'med nästa utbetalningsomgång', nb: 'med neste utbetalingsrunde' }),
      short: L(lang, { de: 'demnächst', en: 'soon', sv: 'snart', nb: 'snart' }),
    };
  }
  const long = monthName(m, lang), short = monthName(m, lang, true);
  return {
    period, runMonth, latest,
    label: L(lang, { de: `Anfang ${long}`, en: `Early ${long}`, sv: `I början av ${long}`, nb: `I starten av ${long}` }),
    short: L(lang, { de: `Anfang ${short}`, en: `Early ${short}`, sv: `Början av ${short}`, nb: `Starten av ${short}` }),
  };
}

/** „Dezember-Lauf“ */
export const runName = (s: RunSlot, lang?: ViewLang) => {
  const month = monthName(Number(s.runMonth.slice(5, 7)) - 1, lang);
  return L(lang, { de: `${month}-Lauf`, en: `${month} payout run`, sv: `Utbetalningsomgång ${month}`, nb: `Utbetalingsrunde ${month}` });
};

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
/** TAX_MODE_TEXT in der Sprache der Anzeige (gespeichert wird nur der Schlüssel). */
export const taxModeText = (mode: TaxMode, lang?: ViewLang): string => isDe(lang) ? TAX_MODE_TEXT[mode] : ({
  standard: L(lang, { de: '', en: 'Standard VAT, so 19% VAT on every credit note', sv: 'Momsregistrerad, alltså 19 % tysk moms på varje självfaktura', nb: 'Ordinær avgiftsplikt, altså 19 % tysk mva. på hver kreditnota' }),
  small_business: L(lang, { de: '', en: 'Small business, no VAT on the credit note (Section 19 German VAT Act)', sv: 'Småföretagare, ingen moms på självfakturan (§ 19 tyska momslagen)', nb: 'Småbedrift, ingen mva. på kreditnotaen (§ 19 i tysk mva.-lov)' }),
  foreign: L(lang, { de: '', en: 'Abroad, reverse charge (VAT payable by the recipient)', sv: 'Utlandet, omvänd skattskyldighet (reverse charge)', nb: 'Utlandet, omvendt avgiftsplikt (reverse charge)' }),
} as Record<TaxMode, string>)[mode];

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
  /** Sprache der Anzeige (ohne Angabe Deutsch) */
  lang?: ViewLang;
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

// Feste Wörter der Anzeige
const W = {
  part1: (lang: ViewLang) => L(lang, { de: '1. Teil', en: 'Part 1', sv: 'Del 1', nb: 'Del 1' }),
  part2: (lang: ViewLang) => L(lang, { de: '2. Teil', en: 'Part 2', sv: 'Del 2', nb: 'Del 2' }),
  share: (lang: ViewLang) => L(lang, { de: 'Dein Anteil', en: 'Your share', sv: 'Din andel', nb: 'Din andel' }),
  shareLower: (lang: ViewLang) => L(lang, { de: 'Anteil', en: 'Share', sv: 'Andel', nb: 'Andel' }),
  bounty: (lang: ViewLang) => L(lang, { de: 'Auslobung', en: 'Bounty', sv: 'Belöning', nb: 'Dusør' }),
  replacement: (lang: ViewLang) => L(lang, { de: 'Nachbesetzung', en: 'Replacement', sv: 'Ersättningsrekrytering', nb: 'Erstatningsrekruttering' }),
  oldTerms: (lang: ViewLang) => L(lang, { de: 'Konditionen vor der Umstellung', en: 'Terms before the change', sv: 'Villkor före ändringen', nb: 'Vilkår før endringen' }),
  inOnePart: (lang: ViewLang) => L(lang, { de: 'in einem Teil', en: 'in one payment', sv: 'i en del', nb: 'i én del' }),
  inOnePartAfterStart: (lang: ViewLang) => L(lang, { de: 'in einem Teil nach Antritt', en: 'in one payment after the start', sv: 'i en del efter tillträdet', nb: 'i én del etter tiltredelsen' }),
  noShare: (lang: ViewLang) => L(lang, { de: 'kein Anteil', en: 'no share', sv: 'ingen andel', nb: 'ingen andel' }),
  matchuntChecks: (lang: ViewLang) => L(lang, { de: 'Matchunt prüft', en: 'Matchunt is reviewing', sv: 'Matchunt granskar', nb: 'Matchunt vurderer' }),
  matchuntChecksCase: (lang: ViewLang) => L(lang, { de: 'Matchunt prüft den Fall', en: 'Matchunt is reviewing the case', sv: 'Matchunt granskar ärendet', nb: 'Matchunt vurderer saken' }),
  matchuntChecked: (lang: ViewLang) => L(lang, { de: 'Matchunt hat geprüft', en: 'Matchunt has reviewed it', sv: 'Matchunt har granskat', nb: 'Matchunt har vurdert saken' }),
  client: (lang: ViewLang) => L(lang, { de: 'Kunde', en: 'Client', sv: 'Kunden', nb: 'Kunden' }),
  theClient: (lang: ViewLang) => L(lang, { de: 'Der Kunde', en: 'The client', sv: 'Kunden', nb: 'Kunden' }),
  placementEnds: (lang: ViewLang) => L(lang, { de: 'Besetzung endet', en: 'placement ends', sv: 'tillsättningen upphör', nb: 'plasseringen avsluttes' }),
  someoneElse: (lang: ViewLang) => L(lang, { de: 'Besetzt hat jemand anderes.', en: 'Someone else filled it.', sv: 'Någon annan tillsatte tjänsten.', nb: 'Noen andre fylte stillingen.' }),
  replacedByMe: (lang: ViewLang) => L(lang, { de: 'Du hast nachbesetzt. Deine Auslobung siehst du bei der neuen Besetzung.', en: 'You filled the replacement. You will see your bounty with the new placement.', sv: 'Du har tillsatt ersättaren. Din belöning ser du vid den nya tillsättningen.', nb: 'Du har fylt erstatningen. Dusøren din ser du ved den nye plasseringen.' }),
  notOpen: (lang: ViewLang) => L(lang, { de: 'Die Stelle ist nicht mehr offen.', en: 'The role is no longer open.', sv: 'Tjänsten är inte längre öppen.', nb: 'Stillingen er ikke lenger åpen.' }),
  coreOnStart: (lang: ViewLang) => L(lang, { de: 'Bei Core gibt es den Anteil erst mit dem Antritt.', en: 'With Core, the share is only paid once the candidate starts.', sv: 'Med Core betalas andelen först vid tillträdet.', nb: 'Med Core utbetales andelen først ved tiltredelsen.' }),
};

const moneyUntil = (iso: string, lang?: ViewLang) => {
  const d = dm(iso, lang);
  return L(lang, { de: `Geld bis ${d}`, en: `money by ${d}`, sv: `pengarna senast ${d}`, nb: `penger innen ${d}` });
};

export const trancheLabel = (t: TrancheLike, p: PlacementLike, lang?: ViewLang) =>
  t.tranche_type === 'retention' ? W.part2(lang)
    : t.tranche_type === 'research_bounty' ? L(lang, { de: 'Auslobung Nachbesetzung', en: 'Replacement bounty', sv: 'Belöning ersättningsrekrytering', nb: 'Dusør erstatningsrekruttering' })
      : continuityDaysOf(p) || Number(p.recruiter_retention_cents ?? 0) > 0 ? W.part1(lang) : W.share(lang);

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

const REASON_SHORT_X: Record<string, Record<Exclude<BaseLang, 'de'>, string>> = {
  declined_before_start: { en: 'declined before the start', sv: 'tackade nej före tillträdet', nb: 'takket nei før oppstart' },
  no_show: { en: 'did not show up', sv: 'dök inte upp', nb: 'møtte ikke opp' },
  offer_withdrawn: { en: 'offer withdrawn', sv: 'erbjudandet återkallat', nb: 'tilbudet trukket tilbake' },
  candidate_resigned: { en: 'resigned', sv: 'sade upp sig själv', nb: 'sa opp selv' },
  performance_conduct: { en: 'let go over performance or conduct', sv: 'skildes åt på grund av prestation eller uppförande', nb: 'avsluttet på grunn av prestasjon eller oppførsel' },
  mutual_on_request: { en: 'mutual termination at own request', sv: 'avslut på egen begäran', nb: 'avslutning etter eget ønske' },
  position_changed: { en: 'role removed or restructured', sv: 'tjänsten försvinner eller görs om', nb: 'stillingen faller bort eller endres' },
  other: { en: 'other reason', sv: 'annat skäl', nb: 'annen grunn' },
};
/** Kurzer Grund in der Sprache der Anzeige; unbekannt → undefined. */
export const reasonShort = (reason: string | null | undefined, lang?: ViewLang): string | undefined => {
  const key = String(reason);
  const b = bl(lang);
  return b === 'de' ? REASON_SHORT[key] : REASON_SHORT_X[key]?.[b];
};

export function caseTitleFor(kind: 'departure' | 'non_start', reason: string | null | undefined, first: string, lang?: ViewLang): string {
  if (kind === 'non_start') {
    if (reason === 'declined_before_start') return L(lang, { de: `${first} hat vor dem Start abgesagt`, en: `${first} declined before the start`, sv: `${first} tackade nej före tillträdet`, nb: `${first} takket nei før oppstart` });
    if (reason === 'no_show') return L(lang, { de: `${first} ist nicht erschienen`, en: `${first} did not show up`, sv: `${first} dök inte upp`, nb: `${first} møtte ikke opp` });
    if (reason === 'offer_withdrawn') return L(lang, { de: `Angebot an ${first} zurückgezogen`, en: `Offer to ${first} withdrawn`, sv: `Erbjudandet till ${first} återkallat`, nb: `Tilbudet til ${first} trukket tilbake` });
    return notStartedTitle(first, lang);
  }
  if (reason === 'candidate_resigned') return L(lang, { de: `${first} kündigt in der Garantiezeit`, en: `${first} resigns during the guarantee period`, sv: `${first} säger upp sig under garantitiden`, nb: `${first} sier opp i garantiperioden` });
  if (reason === 'performance_conduct') return L(lang, { de: 'Trennung in der Garantiezeit', en: 'Let go during the guarantee period', sv: 'Avslut under garantitiden', nb: 'Avslutning i garantiperioden' });
  if (reason === 'mutual_on_request') return L(lang, { de: `Aufhebung auf Wunsch von ${first}`, en: `Mutual termination at ${first}'s request`, sv: `Avslut på begäran av ${first}`, nb: `Avslutning etter ønske fra ${first}` });
  if (reason === 'position_changed') return L(lang, { de: 'Stelle fällt weg oder wird umgebaut', en: 'Role removed or restructured', sv: 'Tjänsten försvinner eller görs om', nb: 'Stillingen faller bort eller endres' });
  return L(lang, { de: 'Besetzung endet in der Garantiezeit', en: 'Placement ends during the guarantee period', sv: 'Tillsättningen upphör under garantitiden', nb: 'Plasseringen avsluttes i garantiperioden' });
}
const notStartedTitle = (first: string, lang?: ViewLang) =>
  L(lang, { de: `${first} hat nicht angefangen`, en: `${first} did not start`, sv: `${first} har inte börjat`, nb: `${first} har ikke begynt` });

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
export function runningSince(sinceIso: string | null | undefined, today: string, lang?: ViewLang): string {
  const since = day(sinceIso);
  if (!since) return L(lang, { de: 'läuft', en: 'running', sv: 'pågår', nb: 'pågår' });
  const n = daysBetween(since, today);
  if (n === 0) return L(lang, { de: 'läuft seit heute', en: 'running since today', sv: 'pågår sedan i dag', nb: 'pågår siden i dag' });
  if (n === 1) return L(lang, { de: 'läuft seit 1 Tag', en: 'running for 1 day', sv: 'pågår sedan 1 dag', nb: 'pågår siden 1 dag' });
  return L(lang, { de: `läuft seit ${n} Tagen`, en: `running for ${n} days`, sv: `pågår sedan ${n} dagar`, nb: `pågår siden ${n} dager` });
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

export function placementChain(f: PlacementFacts, lang?: ViewLang): ChainItem[] {
  const p = f.p;
  const invoiceL = L(lang, { de: 'Rechnung', en: 'Invoice', sv: 'Faktura', nb: 'Faktura' });
  const paidL = L(lang, { de: 'Bezahlt', en: 'Paid', sv: 'Betald', nb: 'Betalt' });
  const startL = (started: boolean) => started
    ? L(lang, { de: 'Angetreten', en: 'Started', sv: 'Tillträtt', nb: 'Tiltrådt' })
    : L(lang, { de: 'Antritt', en: 'Start', sv: 'Tillträde', nb: 'Tiltredelse' });
  const ts = tranchesOrVirtual(f);
  const invoiced = (!!f.invoice && f.invoice.status !== 'draft' && !!f.invoice.status) || ['invoiced', 'paid'].includes(String(p.invoice_state ?? ''));
  const paid = isInvoicePaid(p, f.invoice);
  const started = isStarted(p);
  if (isReplacement(p)) {
    const bounty = ts.find((t) => t.tranche_type === 'research_bounty');
    const items: { label: string; done: boolean; currentLabel?: string }[] = [];
    if (Number(p.client_fee_cents ?? 0) > 0) items.push({ label: invoiceL, done: invoiced }, { label: paidL, done: paid });
    items.push({ label: startL(started), done: started });
    items.push({ label: W.bounty(lang), done: bounty?.status === 'paid' });
    return markCurrent(items);
  }
  const init = ts.find((t) => t.tranche_type === 'initial');
  const ret = ts.find((t) => t.tranche_type === 'retention');
  const initPaid = init?.status === 'paid';
  const items: { label: string; done: boolean; currentLabel?: string }[] = [];
  if (!initPaid) {
    items.push({ label: invoiceL, done: invoiced }, { label: paidL, done: paid }, { label: startL(started), done: started });
  }
  if (continuityDaysOf(p) || ret) {
    const released = p.retention_state === 'released';
    const guarantee = L(lang, { de: 'Garantie', en: 'Guarantee', sv: 'Garanti', nb: 'Garanti' });
    const until = dm(p.continuity_end_date, lang);
    items.push({ label: W.part1(lang), done: initPaid });
    items.push({ label: guarantee, done: released, currentLabel: p.continuity_end_date ? L(lang, { de: `Garantie bis ${until}`, en: `Guarantee until ${until}`, sv: `Garanti till ${until}`, nb: `Garanti til ${until}` }) : guarantee });
    items.push({ label: W.part2(lang), done: ret?.status === 'paid' });
  } else if (started || initPaid) {
    items.push({ label: L(lang, { de: 'Gutschrift', en: 'Credit note', sv: 'Självfaktura', nb: 'Kreditnota' }), done: initPaid });
  }
  return markCurrent(items);
}

/** Betrag rechts in der Zeile und die Zeile darunter (H8). */
export function placementAmount(f: PlacementFacts, ctx: ViewCtx): { amountCents: number | null; amountSub: string | null } {
  const p = f.p;
  const lang = ctx.lang;
  const ts = tranchesOrVirtual(f);
  const stages = ts.map((t) => ({ t, s: trancheStage(t, p, f.origInvoicePaid) }));
  const open = stages.filter((x) => x.s !== 'paid' && x.s !== 'forfeited');
  const paidSum = stages.filter((x) => x.s === 'paid').reduce((a, x) => a + Number(x.t.amount_cents), 0);
  if (!open.length) {
    if (paidSum > 0) return { amountCents: paidSum, amountSub: L(lang, { de: 'ausgezahlt', en: 'paid out', sv: 'utbetald', nb: 'utbetalt' }) };
    return { amountCents: null, amountSub: ts.length ? W.noShare(lang) : null };
  }
  const [main, ...rest] = open;
  if (rest.length) {
    const restSum = rest.reduce((a, x) => a + Number(x.t.amount_cents), 0);
    const from = trancheDueOn(rest[0].t, p, ctx.today);
    const rs = eur0(restSum, lang), fr = dm(from, lang);
    return { amountCents: Number(main.t.amount_cents), amountSub: L(lang, { de: `+ ${rs} ab ${fr}`, en: `+ ${rs} from ${fr}`, sv: `+ ${rs} från ${fr}`, nb: `+ ${rs} fra ${fr}` }) };
  }
  const single = main.t.tranche_type === 'research_bounty' || (main.t.tranche_type === 'initial' && !ts.some((t) => t.tranche_type === 'retention'));
  if (main.s === 'credited') {
    const cn = main.t.credit_note_id ? f.creditNotes?.[main.t.credit_note_id] : undefined;
    return { amountCents: Number(main.t.amount_cents), amountSub: cn?.pay_until ? moneyUntil(cn.pay_until, lang) : L(lang, { de: 'in der Gutschrift', en: 'in the credit note', sv: 'i självfakturan', nb: 'i kreditnotaen' }) };
  }
  if (single && (main.s === 'waiting_start' || main.s === 'waiting_payment')) {
    return { amountCents: Number(main.t.amount_cents), amountSub: main.t.tranche_type === 'research_bounty' ? W.inOnePartAfterStart(lang) : W.inOnePart(lang) };
  }
  const slot = runSlot(trancheDueOn(main.t, p, ctx.today), ctx.today, ctx.doneRuns, lang);
  return { amountCents: Number(main.t.amount_cents), amountSub: slot.label };
}

const replacementPaused = (lang?: ViewLang) => L(lang, { de: 'Nachbesetzung ruht', en: 'Replacement on hold', sv: 'Ersättningsrekryteringen vilar', nb: 'Erstatningsrekrutteringen er satt på pause' });
const replacementPreparing = (lang?: ViewLang) => L(lang, { de: 'Nachbesetzung wird vorbereitet', en: 'Replacement being prepared', sv: 'Ersättningsrekryteringen förbereds', nb: 'Erstatningsrekrutteringen forberedes' });

function researchStatus(p: PlacementLike, today: string, lang?: ViewLang): string {
  switch (p.research_state) {
    case 'running': {
      const since = runningSince(p.research_started_at, today, lang);
      return L(lang, { de: `Stelle neu ausgeschrieben · ${since}`, en: `Role re-advertised · ${since}`, sv: `Tjänsten utannonserad på nytt · ${since}`, nb: `Stillingen utlyst på nytt · ${since}` });
    }
    case 'paused': return replacementPaused(lang);
    case 'awaiting_position': case 'awaiting_payment': return replacementPreparing(lang);
    case 'succeeded': return L(lang, { de: 'Nachbesetzt', en: 'Replaced', sv: 'Ersättare tillsatt', nb: 'Erstatter ansatt' });
    case 'cancelled': case 'exhausted': return L(lang, { de: 'Nachbesetzung beendet', en: 'Replacement ended', sv: 'Ersättningsrekryteringen avslutad', nb: 'Erstatningsrekrutteringen avsluttet' });
    default: return L(lang, { de: 'Matchunt hat den Fall anerkannt', en: 'Matchunt has accepted the case', sv: 'Matchunt har godkänt ärendet', nb: 'Matchunt har godkjent saken' });
  }
}

export function packageLabelOf(p: PlacementLike, v2Active?: boolean, lang?: ViewLang) {
  if (isReplacement(p)) return W.replacement(lang);
  if (v2Active && versionOf(p) === 1 && continuityDaysOf(p)) return W.oldTerms(lang);
  return PACKAGE_LABEL[packageKeyOf(p)];
}

export function placementRow(f: PlacementFacts, ctx: ViewCtx): PlacementRowView {
  const p = f.p;
  const kind = caseOf(f);
  const company = f.companyName ?? '';
  let status: string | null = null;
  let amount = placementAmount(f, ctx);
  const reason = p.non_start_reason ?? f.claim?.category ?? p.departure_category ?? null;
  const lang = ctx.lang;
  switch (kind) {
    case 'claim_open': {
      const r = reasonShort(reason, lang) ?? W.placementEnds(lang);
      status = L(lang, { de: `Gemeldet: ${r} · Matchunt prüft`, en: `Reported: ${r} · Matchunt is reviewing`, sv: `Anmält: ${r} · Matchunt granskar`, nb: `Meldt: ${r} · Matchunt vurderer` });
      break;
    }
    case 'claim_accepted': status = researchStatus(p, ctx.today, lang); break;
    case 'core_non_start':
      status = p.research_kind === 'joker' && (researchRunningLike(p) || p.research_started_at) ? researchStatus(p, ctx.today, lang) : L(lang, { de: 'Nicht angefangen', en: 'Did not start', sv: 'Har inte börjat', nb: 'Har ikke begynt' });
      amount = { amountCents: null, amountSub: f.jokerDecided ? W.noShare(lang) : W.matchuntChecks(lang) };
      break;
    case 'non_start_reported': {
      const c = company || W.client(lang);
      status = L(lang, { de: `Du hast gemeldet: nicht angefangen · ${c} bestätigt`, en: `You reported: did not start · ${c} confirms`, sv: `Du har anmält: har inte börjat · ${c} bekräftar`, nb: `Du har meldt: har ikke begynt · ${c} bekrefter` });
      break;
    }
    case 'client_sphere': status = L(lang, { de: 'Grund beim Kunden · voller Anteil', en: 'Reason lies with the client · full share', sv: 'Orsaken ligger hos kunden · full andel', nb: 'Årsaken ligger hos kunden · full andel' }); break;
    case 'core_ended': status = L(lang, { de: 'Besetzung vorzeitig beendet', en: 'Placement ended early', sv: 'Tillsättningen avslutad i förtid', nb: 'Plasseringen avsluttet før tiden' }); break;
    default: break;
  }
  const ended = ['succeeded', 'cancelled', 'exhausted'].includes(String(p.research_state ?? ''))
    || (kind === 'core_non_start' && !researchRunningLike(p))
    || tranchesOrVirtual(f).every((t) => ['paid', 'forfeited', 'cancelled'].includes(t.status));
  return {
    placementId: p.id,
    candidateName: f.candidateName ?? candidateWord(lang),
    companyName: company,
    jobTitle: f.jobTitle ?? '',
    packageLabel: packageLabelOf(p, ctx.v2Active, lang),
    chain: status && kind !== 'client_sphere' ? [] : placementChain(f, lang),
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
        const slot = runSlot(trancheDueOn(t, f.p, ctx.today), ctx.today, ctx.doneRuns, ctx.lang);
        const run = runs.get(slot.runMonth) ?? { slot, netCents: 0, vatCents: 0, lines: [] };
        run.lines.push({ placementId: f.p.id, trancheId: t.id, label: `${trancheLabel(t, f.p, ctx.lang)} · ${f.candidateName ?? candidateWord(ctx.lang)}`, cents: Number(t.amount_cents) });
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
export interface FigureView {
  /** stabiler Schlüssel der Kachel (Vergleiche nie gegen den Text) */
  key?: 'basis' | 'part1' | 'part2' | 'share' | 'bounty';
  label: string; value: string; note?: string | null; cents?: number | null;
}

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

function startFixedNote(p: PlacementLike, company: string, lang?: ViewLang): string | null {
  const reported = !!p.start_reported_at && p.start_report_kind === 'started';
  switch (p.start_fixed_how) {
    case 'client': return reported
      ? L(lang, { de: `du hast gemeldet, ${company} hat bestätigt`, en: `you reported it, ${company} confirmed`, sv: `du anmälde, ${company} bekräftade`, nb: `du meldte, ${company} bekreftet` })
      : L(lang, { de: `${company} hat bestätigt`, en: `${company} confirmed`, sv: `${company} bekräftade`, nb: `${company} bekreftet` });
    case 'recruiter_unopposed': return L(lang, { de: `du hast gemeldet, ${company} hat nicht widersprochen`, en: `you reported it, ${company} did not object`, sv: `du anmälde, ${company} invände inte`, nb: `du meldte, ${company} protesterte ikke` });
    case 'no_report_14d': return L(lang, { de: 'ohne abweichende Meldung', en: 'no conflicting report', sv: 'utan avvikande anmälan', nb: 'uten avvikende melding' });
    case 'admin': return L(lang, { de: 'von Matchunt festgestellt', en: 'confirmed by Matchunt', sv: 'fastställt av Matchunt', nb: 'fastslått av Matchunt' });
    case 'client_sphere': return L(lang, { de: 'Grund beim Kunden', en: 'reason lies with the client', sv: 'orsaken ligger hos kunden', nb: 'årsaken ligger hos kunden' });
    default: return null;
  }
}

function creditStep(t: TrancheLike, f: PlacementFacts, ctx: ViewCtx, label: string): StepView {
  const p = f.p;
  const lang = ctx.lang;
  const s = trancheStage(t, p, f.origInvoicePaid);
  const amount = eur0(Number(t.amount_cents), lang);
  const vat = vatRateFor(ctx.taxMode) > 0 ? L(lang, { de: ' + USt', en: ' + VAT', sv: ' + moms', nb: ' + mva.' }) : '';
  const cn = L(lang, { de: 'Gutschrift', en: 'Credit note', sv: 'Självfaktura', nb: 'Kreditnota' });
  const credit = label ? `${cn} ${label} · ${amount}${vat}` : `${cn} · ${amount}${vat}`;
  const what = label || W.shareLower(lang);
  if (s === 'paid') return { state: 'done', text: L(lang, { de: `${what} ausgezahlt · ${amount}`, en: `${what} paid out · ${amount}`, sv: `${what} utbetald · ${amount}`, nb: `${what} utbetalt · ${amount}` }), date: dm(day(t.paid_at), lang) || null };
  if (s === 'forfeited') return { state: 'done', text: L(lang, { de: `${what} entfällt`, en: `${what} lapses`, sv: `${what} bortfaller`, nb: `${what} bortfaller` }), date: null };
  if (s === 'credited') {
    const note = t.credit_note_id ? f.creditNotes?.[t.credit_note_id] : undefined;
    return { state: 'todo', text: credit, note: note ? L(lang, { de: `in ${note.number}`, en: `in ${note.number}`, sv: `i ${note.number}`, nb: `i ${note.number}` }) : null, date: note?.pay_until ? moneyUntil(note.pay_until, lang) : null };
  }
  const slot = runSlot(trancheDueOn(t, p, ctx.today), ctx.today, ctx.doneRuns, lang);
  return { state: 'todo', text: credit, date: slot.short };
}

/** Normale Schritte (H9). */
function normalSteps(f: PlacementFacts, ctx: ViewCtx, first: string, company: string): StepView[] {
  const p = f.p;
  const lang = ctx.lang;
  const steps: StepView[] = [];
  const ts = tranchesOrVirtual(f);
  const repl = isReplacement(p);
  steps.push({ state: 'done', text: L(lang, { de: 'Arbeitsvertrag unterschrieben', en: 'Employment contract signed', sv: 'Anställningsavtal undertecknat', nb: 'Arbeidsavtale signert' }), date: dm(day(f.contractSignedOn) ?? day(p.created_at), lang) || null });
  const needsInvoice = !repl || Number(p.client_fee_cents ?? 0) > 0;
  if (needsInvoice) {
    const inv = f.invoice;
    const issued = !!inv && !!inv.status && inv.status !== 'draft';
    const due = inv?.due_date ? dm(inv.due_date, lang) : '';
    const dueNote = L(lang, { de: `fällig ${due}`, en: `due ${due}`, sv: `förfaller ${due}`, nb: `forfaller ${due}` });
    steps.push(issued
      ? { state: 'done', text: L(lang, { de: 'Rechnung gestellt', en: 'Invoice issued', sv: 'Faktura skickad', nb: 'Faktura sendt' }) + (due ? ` · ${dueNote}` : ''), date: dm(day(inv?.issued_at), lang) || null }
      : { state: 'todo', text: L(lang, { de: 'Matchunt stellt die Rechnung', en: 'Matchunt issues the invoice', sv: 'Matchunt skickar fakturan', nb: 'Matchunt sender fakturaen' }) });
    steps.push(isInvoicePaid(p, inv)
      ? { state: 'done', text: L(lang, { de: `${company} hat bezahlt`, en: `${company} has paid`, sv: `${company} har betalat`, nb: `${company} har betalt` }), date: dm(day(inv?.paid_at) ?? day(p.paid_at), lang) || null }
      : { state: 'todo', text: L(lang, { de: `${company} bezahlt die Rechnung`, en: `${company} pays the invoice`, sv: `${company} betalar fakturan`, nb: `${company} betaler fakturaen` }), note: issued && due ? dueNote : null });
  }
  if (isStarted(p)) {
    steps.push({ state: 'done', text: L(lang, { de: `${first} hat angefangen`, en: `${first} has started`, sv: `${first} har börjat`, nb: `${first} har begynt` }), note: startFixedNote(p, company, lang), date: dm(plannedStartOf(p) ?? day(p.start_fixed_at), lang) || null });
  } else if (p.start_report_kind === 'started' && p.start_reported_at) {
    const until = dm(addWorkdays(String(p.start_reported_at).slice(0, 10), START_OBJECTION_WORKDAYS), lang);
    steps.push(p.start_contested_at
      ? { state: 'todo', text: L(lang, { de: `${company} sieht den Start anders`, en: `${company} disputes the start`, sv: `${company} ser tillträdet annorlunda`, nb: `${company} ser oppstarten annerledes` }), note: L(lang, { de: 'Matchunt klärt das', en: 'Matchunt is clarifying this', sv: 'Matchunt reder ut det', nb: 'Matchunt avklarer dette' }) }
      : { state: 'todo', text: L(lang, { de: `Du hast gemeldet: ${first} hat angefangen`, en: `You reported: ${first} has started`, sv: `Du har anmält: ${first} har börjat`, nb: `Du har meldt: ${first} har begynt` }), note: L(lang, { de: `${company} bestätigt bis ${until}`, en: `${company} confirms by ${until}`, sv: `${company} bekräftar senast ${until}`, nb: `${company} bekrefter innen ${until}` }), date: dm(day(p.start_reported_on), lang) || null });
  } else {
    const d = dmy(plannedStartOf(p), lang);
    steps.push({ state: 'todo', text: L(lang, { de: `Erster Arbeitstag ${d}`, en: `First working day ${d}`, sv: `Första arbetsdag ${d}`, nb: `Første arbeidsdag ${d}` }), note: p.start_report_kind === 'later' ? L(lang, { de: 'neuer Termin', en: 'new date', sv: 'nytt datum', nb: 'ny dato' }) : null });
  }
  const init = ts.find((t) => t.tranche_type === 'initial');
  const ret = ts.find((t) => t.tranche_type === 'retention');
  const bounty = ts.find((t) => t.tranche_type === 'research_bounty');
  if (bounty) steps.push(creditStep(bounty, f, ctx, W.bounty(lang)));
  if (init) steps.push(creditStep(init, f, ctx, ret || continuityDaysOf(p) ? W.part1(lang) : ''));
  if (continuityDaysOf(p) || ret) {
    const released = p.retention_state === 'released';
    const until = dmy(p.continuity_end_date, lang), report = dm(p.retention_release_date, lang);
    steps.push(released
      ? { state: 'done', text: L(lang, { de: 'Garantie überstanden', en: 'Guarantee period passed', sv: 'Garantitiden passerad', nb: 'Garantiperioden er over' }), date: dm(day(p.client_sphere_at) ?? day(p.retention_release_date), lang) || null }
      : { state: 'todo', text: L(lang, { de: `Garantie läuft bis ${until}, Meldefrist bis ${report}`, en: `Guarantee runs until ${until}, reporting deadline ${report}`, sv: `Garantin löper till ${until}, anmälningsfrist till ${report}`, nb: `Garantien løper til ${until}, meldefrist til ${report}` }) });
    if (ret) steps.push(creditStep(ret, f, ctx, W.part2(lang)));
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

function researchStep(p: PlacementLike, company: string, lang?: ViewLang): StepView {
  switch (p.research_state) {
    case 'running': return { state: 'current', text: L(lang, { de: 'Stelle für alle neu ausgeschrieben', en: 'Role re-advertised to everyone', sv: 'Tjänsten utannonserad på nytt för alla', nb: 'Stillingen utlyst på nytt for alle' }), date: dm(day(p.research_started_at), lang) || null };
    case 'paused': return { state: 'current', text: replacementPaused(lang), date: null };
    case 'awaiting_position': return { state: 'current', text: L(lang, { de: `${company} bestätigt die Stelle`, en: `${company} confirms the role`, sv: `${company} bekräftar tjänsten`, nb: `${company} bekrefter stillingen` }), note: L(lang, { de: 'danach wird sie für alle neu ausgeschrieben', en: 'then it is re-advertised to everyone', sv: 'därefter utannonseras den på nytt för alla', nb: 'deretter utlyses den på nytt for alle' }) };
    case 'awaiting_payment': return { state: 'current', text: L(lang, { de: 'Stelle wird ausgeschrieben, sobald die Rechnung bezahlt ist', en: 'The role will be advertised once the invoice is paid', sv: 'Tjänsten utannonseras så snart fakturan är betald', nb: 'Stillingen utlyses så snart fakturaen er betalt' }) };
    case 'succeeded': return { state: 'done', text: L(lang, { de: 'Stelle wieder besetzt', en: 'Role filled again', sv: 'Tjänsten tillsatt igen', nb: 'Stillingen er fylt igjen' }), date: dm(day(p.research_ended_at), lang) || null };
    case 'cancelled': case 'exhausted':
      return {
        state: 'done',
        text: p.research_end_reason === 'matchunt_ended'
          ? L(lang, { de: 'Matchunt hat die Nachbesetzung beendet', en: 'Matchunt ended the replacement', sv: 'Matchunt avslutade ersättningsrekryteringen', nb: 'Matchunt avsluttet erstatningsrekrutteringen' })
          : L(lang, { de: `${company} hat die Nachbesetzung beendet`, en: `${company} ended the replacement`, sv: `${company} avslutade ersättningsrekryteringen`, nb: `${company} avsluttet erstatningsrekrutteringen` }),
        date: dm(day(p.research_ended_at), lang) || null,
      };
    default: return { state: 'current', text: replacementPreparing(lang) };
  }
}

export function placementWindow(f: PlacementFacts, ctx: ViewCtx): PlacementWindowView {
  const p = f.p;
  const lang = ctx.lang;
  const first = firstOf(f.candidateName, lang);
  const company = f.companyName ?? W.theClient(lang);
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
  const e0 = (c: number) => eur0(c, lang);

  const pkgLabel = packageLabelOf(p, ctx.v2Active, lang);
  const startLabel = planned ? L(lang, { de: `Start ${dmy(planned)}`, en: `Start ${dmy(planned, lang)}`, sv: `Tillträde ${dmy(planned, lang)}`, nb: `Oppstart ${dmy(planned, lang)}` }) : null;
  const subtitle = [company, pkgLabel === W.oldTerms(lang) ? `${PACKAGE_LABEL[pkg]} · ${W.oldTerms(lang)}` : pkgLabel, startLabel].filter(Boolean).join(' · ');

  // Kacheln: Grundlage, 1. Teil, 2. Teil (bzw. Anteil / Auslobung)
  const gross = Number(p.gross_annual_target_compensation_cents ?? 0);
  const { initialPct, retentionPct } = pctsOf(p);
  const fmtPct = (n: number) => (bl(lang) === 'en' ? `${n}%` : `${String(n).replace('.', ',')} %`);
  const figures: FigureView[] = [];
  if (gross > 0) figures.push({ key: 'basis', label: L(lang, { de: 'Grundlage', en: 'Basis', sv: 'Underlag', nb: 'Grunnlag' }), value: e0(gross), note: L(lang, { de: 'Zielgehalt laut Vertrag', en: 'Target salary per contract', sv: 'Mållön enligt avtalet', nb: 'Mållønn ifølge avtalen' }), cents: gross });
  if (repl) {
    if (bounty) figures.push({ key: 'bounty', label: W.bounty(lang), value: e0(Number(bounty.amount_cents)), note: W.inOnePartAfterStart(lang), cents: Number(bounty.amount_cents) });
  } else if (ret || cont) {
    if (init) figures.push({ key: 'part1', label: `${W.part1(lang)} · ${fmtPct(initialPct)}`, value: e0(Number(init.amount_cents)), cents: Number(init.amount_cents) });
    if (ret) figures.push({ key: 'part2', label: `${W.part2(lang)} · ${fmtPct(retentionPct)}`, value: e0(Number(ret.amount_cents)), cents: Number(ret.amount_cents) });
  } else if (init) {
    figures.push({ key: 'share', label: `${W.share(lang)} · ${fmtPct(initialPct)}`, value: e0(Number(init.amount_cents)), note: W.inOnePart(lang), cents: Number(init.amount_cents) });
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
  const ifYouFill = (amount: string, rest: { de: string; en: string; sv: string; nb: string }) => L(lang, {
    de: `Besetzt du sie, bekommst du ${amount} in einem Teil, sobald der Ersatz angefangen hat.${rest.de}`,
    en: `If you fill it, you get ${amount} in one payment once the replacement has started.${rest.en}`,
    sv: `Tillsätter du den får du ${amount} i en del så snart ersättaren har börjat.${rest.sv}`,
    nb: `Fyller du den, får du ${amount} i én del så snart erstatteren har begynt.${rest.nb}`,
  });

  if (kind === 'claim_open') {
    caseTitle = caseTitleFor(claimKind, reason, first, lang);
    const r = reasonShort(reason, lang) ?? W.placementEnds(lang);
    steps = [
      ...(claimKind === 'departure' && init ? [initialKeptStep(init, f, ctx)] : []),
      { state: 'done', text: L(lang, { de: `${short} hat gemeldet: ${r}`, en: `${short} reported: ${r}`, sv: `${short} har anmält: ${r}`, nb: `${short} har meldt: ${r}` }), date: dm(day(claim?.reported_at), lang) || null },
      ...(statement ? [{ state: 'done' as const, text: L(lang, { de: 'Du hast deine Sicht geschildert', en: 'You gave your view', sv: 'Du har gett din bild', nb: 'Du har gitt ditt syn' }), date: dm(day(statement.at), lang) || null }] : []),
      { state: 'current', text: W.matchuntChecksCase(lang) },
    ];
    box = statement
      ? L(lang, { de: 'Matchunt hat deine Sicht und entscheidet. Du bekommst Bescheid.', en: 'Matchunt has your view and will decide. You will be notified.', sv: 'Matchunt har din bild och fattar beslut. Du får besked.', nb: 'Matchunt har ditt syn og avgjør saken. Du får beskjed.' })
      : L(lang, { de: `Matchunt hört dich an, bevor es entscheidet. Schreib kurz, was du über ${first} weißt.`, en: `Matchunt hears you before deciding. Briefly write what you know about ${first}.`, sv: `Matchunt hör dig innan beslut fattas. Skriv kort vad du vet om ${first}.`, nb: `Matchunt hører deg før saken avgjøres. Skriv kort hva du vet om ${first}.` });
  } else if (kind === 'claim_accepted') {
    caseTitle = caseTitleFor(claimKind, reason, first, lang);
    const research = researchStep(p, short, lang);
    const bountyBase = bountyCentsOf(p);
    const own = ownBountyCents(p, claimKind === 'non_start' ? 0 : keptInitial(f), bountyBase);
    if (claimKind === 'departure') {
      steps = [
        ...(init ? [initialKeptStep(init, f, ctx)] : []),
        { state: 'done', text: statement
          ? L(lang, { de: `${short} hat gemeldet, du wurdest angehört`, en: `${short} reported it, you were heard`, sv: `${short} har anmält, du har blivit hörd`, nb: `${short} har meldt, du har blitt hørt` })
          : L(lang, { de: `${short} hat gemeldet`, en: `${short} reported it`, sv: `${short} har anmält`, nb: `${short} har meldt` }), date: dm(day(claim?.reported_at), lang) || null },
        { state: 'done', text: L(lang, { de: 'Matchunt hat anerkannt', en: 'Matchunt accepted it', sv: 'Matchunt har godkänt', nb: 'Matchunt har godkjent' }), date: dm(day(claim?.decided_at), lang) || null },
        research,
      ];
      const retCents = Number(ret?.amount_cents ?? p.recruiter_retention_cents ?? 0);
      const part2Lapses = L(lang, { de: 'Dein 2. Teil entfällt.', en: 'Your part 2 lapses.', sv: 'Din del 2 bortfaller.', nb: 'Din del 2 bortfaller.' });
      if (p.research_state === 'succeeded') box = f.replacedByMe ? W.replacedByMe(lang) : `${W.someoneElse(lang)} ${part2Lapses}`;
      else if (['cancelled', 'exhausted'].includes(String(p.research_state))) box = `${W.notOpen(lang)} ${part2Lapses}`;
      else if (own > 0) {
        const a = e0(own);
        box = own === retCents
          ? L(lang, {
            de: `Besetzt du sie, bekommst du deinen 2. Teil (${a}), sobald der Ersatz angefangen hat. Besetzt sie jemand anderes, entfällt er.`,
            en: `If you fill it, you get your part 2 (${a}) once the replacement has started. If someone else fills it, it lapses.`,
            sv: `Tillsätter du den får du din del 2 (${a}) så snart ersättaren har börjat. Tillsätter någon annan den, bortfaller den.`,
            nb: `Fyller du den, får du din del 2 (${a}) så snart erstatteren har begynt. Fyller noen andre den, bortfaller den.`,
          })
          : ifYouFill(a, {
            de: ' Besetzt sie jemand anderes, entfällt dein 2. Teil.',
            en: ' If someone else fills it, your part 2 lapses.',
            sv: ' Tillsätter någon annan den, bortfaller din del 2.',
            nb: ' Fyller noen andre den, bortfaller din del 2.',
          });
      } else box = L(lang, { de: 'Die Stelle wird neu für alle ausgeschrieben, auch für dich. Dein 2. Teil entfällt.', en: 'The role is re-advertised to everyone, including you. Your part 2 lapses.', sv: 'Tjänsten utannonseras på nytt för alla, även för dig. Din del 2 bortfaller.', nb: 'Stillingen utlyses på nytt for alle, også for deg. Din del 2 bortfaller.' });
    } else {
      steps = [
        { state: 'done', text: isInvoicePaid(p, f.invoice)
          ? L(lang, { de: 'Rechnung bezahlt, Matchunt hat geprüft', en: 'Invoice paid, Matchunt has reviewed it', sv: 'Fakturan betald, Matchunt har granskat', nb: 'Faktura betalt, Matchunt har vurdert saken' })
          : W.matchuntChecked(lang), date: dm(day(claim?.decided_at), lang) || null },
        research,
      ];
      if (p.research_state === 'succeeded') box = f.replacedByMe ? W.replacedByMe(lang) : W.someoneElse(lang);
      else if (['cancelled', 'exhausted'].includes(String(p.research_state))) box = W.notOpen(lang);
      else box = ifYouFill(e0(own), {
        de: ' Für den Ersatz gibt es keine zweite Garantie.',
        en: ' There is no second guarantee for the replacement.',
        sv: ' För ersättaren finns ingen andra garanti.',
        nb: ' For erstatteren gis det ingen ny garanti.',
      });
    }
    if (researchRunningLike(p)) jobLink = jobOf();
  } else if (kind === 'claim_rejected') {
    box = L(lang, { de: 'Matchunt hat den Fall nicht anerkannt. Für dich ändert sich nichts.', en: 'Matchunt did not accept the case. Nothing changes for you.', sv: 'Matchunt godkände inte ärendet. För dig ändras ingenting.', nb: 'Matchunt godkjente ikke saken. For deg endres ingenting.' });
  } else if (kind === 'client_sphere') {
    box = cont || ret
      ? L(lang, { de: 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil, der 2. Teil wird sofort frei.', en: 'The reason lies with the client. You get your full share; part 2 is released immediately.', sv: 'Orsaken ligger hos kunden. Du får hela din andel, del 2 frigörs direkt.', nb: 'Årsaken ligger hos kunden. Du får hele andelen din, del 2 frigis umiddelbart.' })
      : L(lang, { de: 'Der Grund liegt beim Kunden. Du bekommst deinen vollen Anteil.', en: 'The reason lies with the client. You get your full share.', sv: 'Orsaken ligger hos kunden. Du får hela din andel.', nb: 'Årsaken ligger hos kunden. Du får hele andelen din.' });
  } else if (kind === 'core_non_start') {
    // J5: Ob und zu welchem Preis Matchunt etwas angeboten hat, erfährt der Headhunter nicht.
    const reopened = p.research_kind === 'joker' && (researchRunningLike(p) || !!p.research_started_at);
    const notStarted = L(lang, { de: 'nicht angefangen', en: 'did not start', sv: 'har inte börjat', nb: 'har ikke begynt' });
    const reasonText = `${reasonShort(reason, lang) ?? notStarted}${p.non_start_note ? ` (${String(p.non_start_note).slice(0, 140)})` : ''}`;
    steps = [
      { state: 'done', text: L(lang, { de: `${short} hat gemeldet: ${first} hat nicht angefangen`, en: `${short} reported: ${first} did not start`, sv: `${short} har anmält: ${first} har inte börjat`, nb: `${short} har meldt: ${first} har ikke begynt` }), date: dm(day(p.non_start_reported_at), lang) || null },
      f.jokerDecided || reopened ? { state: 'done', text: W.matchuntChecked(lang) } : { state: 'current', text: W.matchuntChecksCase(lang) },
    ];
    if (reopened) {
      caseTitle = L(lang, { de: 'Die Stelle wird neu ausgeschrieben', en: 'The role is being re-advertised', sv: 'Tjänsten utannonseras på nytt', nb: 'Stillingen utlyses på nytt' });
      steps.push(researchStep(p, short, lang));
      const own = ownBountyCents({ ...p, research_kind: 'joker' }, 0, bountyCentsOf({ ...p, research_kind: 'joker' }));
      const a = e0(own);
      box = p.research_state === 'succeeded'
        ? (f.replacedByMe ? W.replacedByMe(lang) : W.someoneElse(lang))
        : L(lang, { de: `Für alle Headhunter, auch für dich. Besetzt du sie, bekommst du ${a} in einem Teil nach Antritt.`, en: `For all headhunters, including you. If you fill it, you get ${a} in one payment after the start.`, sv: `För alla headhunters, även för dig. Tillsätter du den får du ${a} i en del efter tillträdet.`, nb: `For alle headhuntere, også for deg. Fyller du den, får du ${a} i én del etter tiltredelsen.` });
      if (researchRunningLike(p)) jobLink = jobOf();
    } else {
      caseTitle = notStartedTitle(first, lang);
      box = f.jokerDecided
        ? L(lang, { de: `Bei Core gibt es den Anteil erst mit dem Antritt, deshalb diesmal keinen. Grund laut Kunde: ${reasonText}.`, en: `With Core, the share is only paid once the candidate starts, so there is none this time. Reason according to the client: ${reasonText}.`, sv: `Med Core betalas andelen först vid tillträdet, därför ingen den här gången. Orsak enligt kunden: ${reasonText}.`, nb: `Med Core utbetales andelen først ved tiltredelsen, derfor ingen denne gangen. Årsak ifølge kunden: ${reasonText}.` })
        : L(lang, { de: `Matchunt prüft den Fall und meldet sich. Bei Core gibt es den Anteil erst mit dem Antritt. Grund laut Kunde: ${reasonText}.`, en: `Matchunt is reviewing the case and will be in touch. With Core, the share is only paid once the candidate starts. Reason according to the client: ${reasonText}.`, sv: `Matchunt granskar ärendet och hör av sig. Med Core betalas andelen först vid tillträdet. Orsak enligt kunden: ${reasonText}.`, nb: `Matchunt vurderer saken og tar kontakt. Med Core utbetales andelen først ved tiltredelsen. Årsak ifølge kunden: ${reasonText}.` });
    }
  } else if (kind === 'non_start_reported') {
    caseTitle = notStartedTitle(first, lang);
    steps = [
      { state: 'done', text: L(lang, { de: 'Du hast gemeldet: hat nicht angefangen', en: 'You reported: did not start', sv: 'Du har anmält: har inte börjat', nb: 'Du har meldt: har ikke begynt' }), date: dm(day(p.start_reported_at), lang) || null },
      { state: 'current', text: L(lang, { de: `${short} bestätigt, dann prüft Matchunt`, en: `${short} confirms, then Matchunt reviews`, sv: `${short} bekräftar, sedan granskar Matchunt`, nb: `${short} bekrefter, deretter vurderer Matchunt` }) },
    ];
    box = cont
      ? L(lang, { de: 'Bestätigt der Kunde, wird die Stelle neu für alle ausgeschrieben, auch für dich.', en: 'If the client confirms, the role is re-advertised to everyone, including you.', sv: 'Bekräftar kunden utannonseras tjänsten på nytt för alla, även för dig.', nb: 'Bekrefter kunden, utlyses stillingen på nytt for alle, også for deg.' })
      : W.coreOnStart(lang);
  } else if (kind === 'core_ended') {
    box = L(lang, { de: 'Die Besetzung ist vorzeitig beendet. Bei Core bleibt dein Anteil deiner.', en: 'The placement ended early. With Core, your share stays yours.', sv: 'Tillsättningen har avslutats i förtid. Med Core får du behålla din andel.', nb: 'Plasseringen er avsluttet før tiden. Med Core beholder du andelen din.' });
  } else if (isStarted(p)) {
    footer = cont && !repl
      ? L(lang, { de: `Du musst nichts tun. Wackelt es bei ${first}, sag uns früh Bescheid.`, en: `You don't need to do anything. If things look shaky with ${first}, let us know early.`, sv: `Du behöver inte göra något. Om det börjar vackla för ${first}, säg till oss i tid.`, nb: `Du trenger ikke gjøre noe. Hvis det begynner å vakle for ${first}, si fra tidlig.` })
      : L(lang, { de: 'Du musst nichts tun.', en: "You don't need to do anything.", sv: 'Du behöver inte göra något.', nb: 'Du trenger ikke gjøre noe.' });
  } else {
    footer = L(lang, { de: `Am ersten Arbeitstag fragen wir dich, ob ${first} angefangen hat.`, en: `On the first working day, we will ask you whether ${first} has started.`, sv: `På första arbetsdagen frågar vi dig om ${first} har börjat.`, nb: `På første arbeidsdag spør vi deg om ${first} har begynt.` });
  }

  // H7: Antritt melden und Kasten im Aufgaben-Fenster
  const canReport = !p.start_fixed_at && !p.start_reported_at && !p.non_start_reported_at && p.placement_state === 'agreed' && !!planned && planned <= ctx.today;
  const fixedText = p.start_fixed_at
    ? (p.start_fixed_how === 'client' && !(p.start_reported_at && p.start_report_kind === 'started')
      ? L(lang, { de: `${short} hat ${first}s Start bestätigt.`, en: `${short} confirmed ${first}'s start.`, sv: `${short} har bekräftat att ${first} har börjat.`, nb: `${short} har bekreftet at ${first} har begynt.` })
      : L(lang, { de: `${first}s Start steht fest.`, en: `${first}'s start is confirmed.`, sv: `${first}s tillträde är fastställt.`, nb: `${first}s oppstart er fastslått.` }))
    : null;
  const slot = runSlot(ctx.today, ctx.today, ctx.doneRuns, lang);
  const paidNow = isInvoicePaid(p, f.invoice);
  const n = START_OBJECTION_WORKDAYS;
  const what = repl
    ? { amount: e0(Number(bounty?.amount_cents ?? 0)), de: 'deine Auslobung', en: 'your bounty', sv: 'din belöning', nb: 'dusøren din' }
    : ret || cont
      ? { amount: e0(Number(init?.amount_cents ?? 0)), de: 'dein 1. Teil', en: 'your part 1', sv: 'din del 1', nb: 'din del 1' }
      : { amount: e0(Number(init?.amount_cents ?? 0)), de: 'dein Verdienst', en: 'your earnings', sv: 'din intäkt', nb: 'inntekten din' };
  const startBox = L(lang, {
    de: `Deine Meldung geht an ${short} zur Bestätigung. Bestätigt ${short} oder widerspricht ${n} Werktage nicht, wird ${what.de} fällig${paidNow ? '' : ', sobald die Rechnung bezahlt ist'}: ${what.amount} mit der Gutschrift ${slot.label}.`,
    en: `Your report goes to ${short} for confirmation. If ${short} confirms or does not object within ${n} working days, ${what.en} becomes due${paidNow ? '' : ' once the invoice is paid'}: ${what.amount} with the credit note (${slot.label}).`,
    sv: `Din anmälan går till ${short} för bekräftelse. Bekräftar ${short} eller invänder inte inom ${n} arbetsdagar förfaller ${what.sv}${paidNow ? '' : ' så snart fakturan är betald'}: ${what.amount} med självfakturan (${slot.label}).`,
    nb: `Meldingen din går til ${short} for bekreftelse. Bekrefter ${short} eller protesterer ikke innen ${n} virkedager, forfaller ${what.nb}${paidNow ? '' : ' så snart fakturaen er betalt'}: ${what.amount} med kreditnotaen (${slot.label}).`,
  });

  const halfwayPossible = !!cont && !repl && isStarted(p) && kind === 'none' && p.placement_state === 'started';

  return {
    placementId: p.id,
    submissionId: p.submission_id ?? null,
    candidateName: f.candidateName ?? candidateWord(lang),
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
  const lang = ctx.lang;
  const s = trancheStage(t, f.p, f.origInvoicePaid);
  if (s === 'paid') return { state: 'done', text: L(lang, { de: '1. Teil ausgezahlt, bleibt deiner', en: 'Part 1 paid out, stays yours', sv: 'Del 1 utbetald, du får behålla den', nb: 'Del 1 utbetalt, du beholder den' }), date: dm(day(t.paid_at), lang) || null };
  if (s === 'forfeited') return { state: 'done', text: L(lang, { de: '1. Teil entfällt', en: 'Part 1 lapses', sv: 'Del 1 bortfaller', nb: 'Del 1 bortfaller' }) };
  const slot = runSlot(trancheDueOn(t, f.p, ctx.today), ctx.today, ctx.doneRuns, lang);
  const a = eur0(Number(t.amount_cents), lang);
  return { state: 'done', text: L(lang, { de: `1. Teil (${a}) bleibt deiner`, en: `Part 1 (${a}) stays yours`, sv: `Del 1 (${a}) får du behålla`, nb: `Del 1 (${a}) beholder du` }), date: slot.short };
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

export function jobEarning(terms: JobTerms | null | undefined, salaryMin: number | null | undefined, salaryMax: number | null | undefined, lang?: ViewLang): JobEarning | null {
  if (!terms) return null;
  if (terms.research) {
    const r = terms.research;
    const own = r.ownCents != null;
    const total = own ? Number(r.ownCents) : r.bountyCents;
    const ownLine = L(lang, { de: 'dein 2. Teil, wenn du besetzt', en: 'your part 2 if you fill it', sv: 'din del 2 om du tillsätter', nb: 'din del 2 hvis du fyller stillingen' });
    return {
      totalCents: total, minCents: null, maxCents: null, pct: 0, initialCents: total, retentionCents: 0, continuityDays: null, twoParts: false,
      cardLine: own && r.ownIsRetention ? ownLine : W.inOnePartAfterStart(lang),
      line: own && r.ownIsRetention ? ownLine : W.inOnePartAfterStart(lang),
      detail: L(lang, { de: 'in einem Teil, sobald dein Kandidat angefangen hat · keine zweite Garantie', en: 'in one payment once your candidate has started · no second guarantee', sv: 'i en del så snart din kandidat har börjat · ingen andra garanti', nb: 'i én del så snart kandidaten din har begynt · ingen ny garanti' }),
      packageText: W.replacement(lang),
      research: {
        own,
        note: r.reason === 'non_start'
          ? L(lang, { de: 'Die erste Besetzung hat nicht angefangen.', en: 'The first placement did not start.', sv: 'Den första tillsättningen började aldrig.', nb: 'Den første plasseringen begynte aldri.' })
          : L(lang, { de: 'Die erste Besetzung hat in der Probezeit gekündigt.', en: 'The first placement resigned during the probation period.', sv: 'Den första tillsättningen sade upp sig under provanställningen.', nb: 'Den første plasseringen sa opp i prøvetiden.' }),
        since: r.since,
      },
    };
  }
  const lo = toCents(salaryMin), hi = toCents(salaryMax);
  if (lo == null && hi == null) return null;
  const mid = lo != null && hi != null ? Math.round((lo + hi) / 2) : (lo ?? hi)!;
  const pct = terms.initialPct + terms.retentionPct;
  const share = (gross: number | null) => (gross == null ? null : Math.round((gross * pct) / 100));
  let initial: number, retention: number, line: string, detail: string;
  let days = terms.continuityDays;
  if (terms.standard) {
    const plan = earningPlan(terms.packageKey, terms.version, mid);
    initial = plan.initialCents; retention = plan.retentionCents; line = plan.line; detail = plan.detail;
    days = plan.continuityDays ?? terms.continuityDays;
  } else {
    initial = Math.round((mid * terms.initialPct) / 100);
    retention = Math.round((mid * terms.retentionPct) / 100);
    line = retention > 0 && terms.continuityDays ? `${eur0(initial)} bei Antritt, Rest nach ${terms.continuityDays} Tagen` : 'ganz bei Antritt';
    detail = retention > 0 && terms.continuityDays ? `${eur0(initial)} bei Antritt · ${eur0(retention)} nach ${terms.continuityDays} Tagen` : 'ganz bei Antritt';
  }
  const allOnStart = L(lang, { de: 'ganz bei Antritt', en: 'all on start', sv: 'allt vid tillträdet', nb: 'alt ved tiltredelse' });
  if (!isDe(lang)) {
    // Gleiche Zeilen wie earningPlan (konditionen.ts), in der Sprache der Anzeige
    const i = eur0(initial, lang), r = eur0(retention, lang);
    line = retention > 0 && days ? L(lang, { de: '', en: `${i} on start, the rest after ${days} days`, sv: `${i} vid tillträdet, resten efter ${days} dagar`, nb: `${i} ved tiltredelse, resten etter ${days} dager` }) : allOnStart;
    detail = retention > 0 && days ? L(lang, { de: '', en: `${i} on start · ${r} after ${days} days`, sv: `${i} vid tillträdet · ${r} efter ${days} dagar`, nb: `${i} ved tiltredelse · ${r} etter ${days} dager` }) : allOnStart;
  }
  const twoParts = retention > 0;
  if (terms.v2Active && terms.version === 1 && terms.activatedAt && twoParts) {
    const d = dm(terms.activatedAt.slice(0, 10), lang);
    detail = `${detail} · ${L(lang, { de: `Konditionen vom ${d}`, en: `terms of ${d}`, sv: `villkor från ${d}`, nb: `vilkår fra ${d}` })}`;
  }
  return {
    totalCents: initial + retention, minCents: share(lo), maxCents: share(hi), pct, initialCents: initial, retentionCents: retention,
    continuityDays: twoParts ? terms.continuityDays : null, twoParts,
    cardLine: twoParts ? L(lang, { de: 'in 2 Teilen', en: 'in 2 parts', sv: 'i 2 delar', nb: 'i 2 deler' }) : allOnStart, line, detail,
    packageText: terms.continuityDays
      ? L(lang, { de: `mit Nachbesetzung, ${terms.continuityDays} Tage`, en: `with replacement, ${terms.continuityDays} days`, sv: `med ersättningsrekrytering, ${terms.continuityDays} dagar`, nb: `med erstatningsrekruttering, ${terms.continuityDays} dager` })
      : PACKAGE_LABEL[terms.packageKey],
    research: null,
  };
}

export interface EarningExplain {
  subtitle: string;
  payout: { n: number; title: string; note: string; cents: number | null }[];
  risks: string[];
}

/** H5: „So wird ausgezahlt“ und „Wenn etwas schiefgeht“. */
export function earningExplain(e: JobEarning, terms: JobTerms, lang?: ViewLang): EarningExplain {
  const reserved = { n: 1, title: L(lang, { de: 'Kunde unterschreibt und zahlt', en: 'Client signs and pays', sv: 'Kunden skriver under och betalar', nb: 'Kunden signerer og betaler' }), note: L(lang, { de: 'dein Anteil ist reserviert', en: 'your share is reserved', sv: 'din andel är reserverad', nb: 'andelen din er reservert' }), cents: null };
  const monthly = L(lang, { de: 'nächste Monats-Gutschrift, Geld 7 Tage danach', en: 'next monthly credit note, money 7 days later', sv: 'nästa månatliga självfaktura, pengarna 7 dagar senare', nb: 'neste månedlige kreditnota, penger 7 dager senere' });
  const starts = L(lang, { de: 'Kandidat fängt an', en: 'Candidate starts', sv: 'Kandidaten börjar', nb: 'Kandidaten begynner' });
  const clientReason = L(lang, { de: 'Liegt der Grund beim Kunden, bekommst du alles.', en: 'If the reason lies with the client, you get everything.', sv: 'Ligger orsaken hos kunden får du allt.', nb: 'Ligger årsaken hos kunden, får du alt.' });
  if (e.research) {
    return {
      subtitle: L(lang, { de: 'Verdient mit dem Arbeitsvertrag, ausgezahlt in einem Teil', en: 'Earned with the employment contract, paid in one payment', sv: 'Intjänat med anställningsavtalet, utbetalt i en del', nb: 'Opptjent med arbeidsavtalen, utbetalt i én del' }),
      payout: [
        { n: 1, title: L(lang, { de: 'Kunde unterschreibt', en: 'Client signs', sv: 'Kunden skriver under', nb: 'Kunden signerer' }), note: L(lang, { de: 'kein neues Honorar für den Kunden', en: 'no new fee for the client', sv: 'inget nytt arvode för kunden', nb: 'ingen nytt honorar for kunden' }), cents: null },
        { n: 2, title: starts, note: monthly, cents: e.totalCents },
      ],
      risks: [L(lang, { de: 'Für den Ersatz gibt es keine zweite Garantie.', en: 'There is no second guarantee for the replacement.', sv: 'För ersättaren finns ingen andra garanti.', nb: 'For erstatteren gis det ingen ny garanti.' }), e.research.note],
    };
  }
  if (!e.twoParts) {
    return {
      subtitle: L(lang, { de: 'Verdient mit dem Arbeitsvertrag, ausgezahlt bei Antritt', en: 'Earned with the employment contract, paid on start', sv: 'Intjänat med anställningsavtalet, utbetalt vid tillträdet', nb: 'Opptjent med arbeidsavtalen, utbetalt ved tiltredelse' }),
      payout: [reserved, { n: 2, title: starts, note: monthly, cents: e.totalCents }],
      risks: [
        L(lang, { de: 'Fängt dein Kandidat nicht an, gibt es bei Core keinen Anteil. Geld gibt es nur mit dem Antritt.', en: 'If your candidate does not start, there is no share with Core. Money is only paid on start.', sv: 'Om din kandidat inte börjar får du ingen andel med Core. Pengar betalas bara vid tillträdet.', nb: 'Begynner ikke kandidaten din, er det ingen andel med Core. Penger utbetales bare ved tiltredelse.' }),
        L(lang, { de: 'Geht er nach dem Start, bleibt dein Anteil deiner.', en: 'If they leave after the start, your share stays yours.', sv: 'Slutar hen efter tillträdet får du behålla din andel.', nb: 'Slutter vedkommende etter oppstart, beholder du andelen din.' }),
        clientReason,
      ],
    };
  }
  const days = e.continuityDays ?? terms.continuityDays ?? 90;
  // Midpoint als Grundlage, wie der Betrag oben
  const split: Split = terms.standard ? splitFor(terms.packageKey, terms.version) : { ...CONDITIONS[terms.version][terms.packageKey], initialPct: terms.initialPct, retentionPct: terms.retentionPct };
  const gross = e.pct > 0 ? Math.round((e.totalCents * 100) / e.pct) : 0;
  const bounty = terms.standard ? amountsFor(terms.packageKey, terms.version, gross).bountyCents : Math.round((gross * split.bountyPct) / 100);
  const nonStartOwn = bountyFor({ bountyCents: bounty, sameRecruiter: true, keptByOriginalCents: 0, split });
  const departOwn = bountyFor({ bountyCents: bounty, sameRecruiter: true, keptByOriginalCents: e.initialCents, split });
  const e0 = (c: number) => eur0(c, lang);
  const full = nonStartOwn >= e.totalCents;
  const nonStartAmount = L(lang, {
    de: full ? `die vollen ${e0(e.totalCents)}` : e0(nonStartOwn),
    en: full ? `the full ${e0(e.totalCents)}` : e0(nonStartOwn),
    sv: full ? `hela ${e0(e.totalCents)}` : e0(nonStartOwn),
    nb: full ? `hele ${e0(e.totalCents)}` : e0(nonStartOwn),
  });
  const own = departOwn === e.retentionCents;
  const departAmount = L(lang, {
    de: own ? `deine ${e0(departOwn)}` : e0(departOwn),
    en: own ? `your ${e0(departOwn)}` : e0(departOwn),
    sv: own ? `dina ${e0(departOwn)}` : e0(departOwn),
    nb: own ? `dine ${e0(departOwn)}` : e0(departOwn),
  });
  const kept = e0(e.initialCents);
  return {
    subtitle: L(lang, { de: 'Verdient mit dem Arbeitsvertrag, ausgezahlt in zwei Teilen', en: 'Earned with the employment contract, paid in two parts', sv: 'Intjänat med anställningsavtalet, utbetalt i två delar', nb: 'Opptjent med arbeidsavtalen, utbetalt i to deler' }),
    payout: [
      reserved,
      { n: 2, title: starts, note: monthly, cents: e.initialCents },
      { n: 3, title: L(lang, { de: `${days} Tage Garantie überstanden`, en: `${days}-day guarantee passed`, sv: `${days} dagars garanti passerad`, nb: `${days} dagers garanti passert` }), note: L(lang, { de: 'plus 14 Tage Meldefrist des Kunden', en: "plus the client's 14-day reporting period", sv: 'plus kundens anmälningsfrist på 14 dagar', nb: 'pluss kundens meldefrist på 14 dager' }), cents: e.retentionCents },
    ],
    risks: [
      L(lang, {
        de: `Fängt dein Kandidat nicht an, wird die Stelle neu für alle ausgeschrieben, auch für dich. Besetzt du sie, bekommst du ${nonStartAmount}.`,
        en: `If your candidate does not start, the role is re-advertised to everyone, including you. If you fill it, you get ${nonStartAmount}.`,
        sv: `Om din kandidat inte börjar utannonseras tjänsten på nytt för alla, även för dig. Tillsätter du den får du ${nonStartAmount}.`,
        nb: `Begynner ikke kandidaten din, utlyses stillingen på nytt for alle, også for deg. Fyller du den, får du ${nonStartAmount}.`,
      }),
      L(lang, {
        de: `Geht er in den ${days} Tagen, bleiben die ${kept} deine. Die Stelle wird neu für alle ausgeschrieben.${departOwn > 0 ? ` Besetzt du sie, kommen ${departAmount} dazu.` : ''}`,
        en: `If they leave within the ${days} days, the ${kept} stays yours. The role is re-advertised to everyone.${departOwn > 0 ? ` If you fill it, you get ${departAmount} on top.` : ''}`,
        sv: `Slutar hen inom ${days} dagar får du behålla ${kept}. Tjänsten utannonseras på nytt för alla.${departOwn > 0 ? ` Tillsätter du den tillkommer ${departAmount}.` : ''}`,
        nb: `Slutter vedkommende innen ${days} dager, beholder du ${kept}. Stillingen utlyses på nytt for alle.${departOwn > 0 ? ` Fyller du den, kommer ${departAmount} i tillegg.` : ''}`,
      }),
      clientReason,
    ],
  };
}

// ---------------------------------------------------------------------------
// H2: Tabelle bisher / neu
// ---------------------------------------------------------------------------

export function conditionsTable(lang?: ViewLang): { label: string; before: string; after: string; changed: boolean }[] {
  const s1 = CONDITIONS[1], s2 = CONDITIONS[2];
  const pct = (n: number) => (bl(lang) === 'en' ? `${n}%` : `${n} %`);
  const fmt = (s: Split) => (s.retentionPct
    ? L(lang, { de: `${s.initialPct} % bei Antritt, ${s.retentionPct} % nach ${s.continuityDays} Tagen`, en: `${pct(s.initialPct)} on start, ${pct(s.retentionPct)} after ${s.continuityDays} days`, sv: `${pct(s.initialPct)} vid tillträdet, ${pct(s.retentionPct)} efter ${s.continuityDays} dagar`, nb: `${pct(s.initialPct)} ved tiltredelse, ${pct(s.retentionPct)} etter ${s.continuityDays} dager` })
    : L(lang, { de: `${s.initialPct} % bei Antritt`, en: `${pct(s.initialPct)} on start`, sv: `${pct(s.initialPct)} vid tillträdet`, nb: `${pct(s.initialPct)} ved tiltredelse` }));
  const row = (label: string, a: Split, b: Split) => {
    const changed = fmt(a) !== fmt(b);
    return { label, before: fmt(a), after: changed ? fmt(b) : L(lang, { de: 'unverändert', en: 'unchanged', sv: 'oförändrat', nb: 'uendret' }), changed };
  };
  const or = L(lang, { de: 'bzw.', en: 'or', sv: 'resp.', nb: 'eller' });
  const bountyPct = (s: typeof s1) => s.continuity_90.bountyPct === s.continuity_180.bountyPct ? pct(s.continuity_90.bountyPct) : (isDe(lang) ? `${s.continuity_90.bountyPct} bzw. ${s.continuity_180.bountyPct} %` : `${pct(s.continuity_90.bountyPct)} ${or} ${pct(s.continuity_180.bountyPct)}`);
  const bountyBefore = bountyPct(s1);
  const bountyAfter = bountyPct(s2);
  return [
    row('Core', s1.core, s2.core),
    row('Continuity 90', s1.continuity_90, s2.continuity_90),
    row('Continuity 180', s1.continuity_180, s2.continuity_180),
    { label: W.replacement(lang), before: bountyBefore, after: L(lang, { de: `${bountyAfter}, für alle Headhunter ausgeschrieben`, en: `${bountyAfter}, advertised to all headhunters`, sv: `${bountyAfter}, utannonserad för alla headhunters`, nb: `${bountyAfter}, utlyst for alle headhuntere` }), changed: true },
    { label: L(lang, { de: 'Eigene Stelle nachbesetzen', en: 'Refilling your own role', sv: 'Tillsätta din egen tjänst på nytt', nb: 'Fylle din egen stilling på nytt' }), before: '–', after: L(lang, { de: 'dein 2. Teil, insgesamt höchstens dein normaler Anteil', en: 'your part 2, in total at most your normal share', sv: 'din del 2, totalt högst din vanliga andel', nb: 'din del 2, totalt maks. din vanlige andel' }), changed: true },
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
