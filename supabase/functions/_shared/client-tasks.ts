// Aufgaben des Kunden (Etappe A, 23.10.2026): leitet aus dem echten Stand ab, wo der Kunde
// dran ist – 15 Arten, je Bewerbung höchstens eine offene Aufgabe aus dem Ablauf. Dazu „läuft
// bei anderen“ (Kandidat, Headhunter, Matchunt sind dran). Aufgaben schließen sich mit der
// Handlung; nichts wird hier gespeichert außer dem Erledigt-Protokoll.
//
// Umbau 11.11.2026 (K1, K7, K8, J2, F3): Start bestätigen (Headhunter hat zuerst gemeldet),
// Absage vor dem Start bestätigen, Position für die Nachbesetzung, Angebot Nachbesetzung,
// Stelle ruht; Wartezeilen „Matchunt prüft Ihre Meldung bis …“ und „Nachbesetzung läuft seit …“.
//
// Reine Ableitung (deriveClientTasks) + Laden aus der Datenbank (loadClientTaskInput), damit
// die Regeln ohne Datenbank testbar sind.

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { berlinDateKey, formatBerlinDateShort, formatBerlinRange, formatBerlinTime } from './interview-time.ts';
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { canUserActOnJob, getAccessibleJobIds } from './team-access.ts';
import { dbFail, must, type ServiceCtx } from './interview-service.ts';
import { BANK } from './billing-config.ts';
import { billingOwnerOfJob, billingScope, canSeeInvoice } from './billing-access.ts';
import { START_OBJECTION_WORKDAYS, addWorkdays } from './konditionen.ts';
import { baseLang, intlLocale, normLang, type Lang } from './i18n.ts';
import { m, pick, type Msg } from './mail-i18n.ts';
import { languageOfUser } from './recipient-language.ts';

export type ClientTaskKind =
  | 'review' | 'alternative' | 'expired_request' | 'feedback' | 'decide_unsure' | 'make_offer'
  | 'counter' | 'offer_overdue' | 'send_contract' | 'contract_signed_check' | 'docusign_sign'
  | 'confirm_signature' | 'recruiter_question' | 'confirm_start' | 'invoice' | 'purchase_order'
  // Umbau 11.11.2026
  | 'start_check' | 'end_confirm' | 'research_position' | 'research_offer' | 'job_paused';

export interface ClientTask {
  /** stabil, z. B. feedback:<interviewId> – das Protokoll erkennt damit Erledigtes */
  key: string;
  kind: ClientTaskKind;
  submissionId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  /** Name (freigegeben), Kürzel PR-… oder bei Rechnungen die Stelle */
  who: string;
  title: string;
  detail: string;
  /** seit wann offen (ISO) */
  since: string;
  /** jemand wartet auf den Kunden: oberster Abschnitt, rot */
  urgent: boolean;
  /** wer wartet, für „Tessa wartet · 2 Tage“ */
  waitingWho: string | null;
  ref: { interviewId?: string; offerId?: string; responseDue?: string; contractId?: string; placementId?: string; invoiceId?: string; notificationId?: string; questions?: string[]; signMode?: 'email' | 'embedded'; signerExternal?: boolean; researchOfferId?: string; reportedOn?: string };
  /** Zusatz, z. B. „Frage an Marko gestellt“ – die Aufgabe bleibt trotzdem offen */
  note: string | null;
  /** Entscheidungshilfe: was der Kunde zum Entscheiden braucht (Fenster oben, Zeile auf der Seite) */
  context: TaskContext | null;
}

export interface TaskChip { text: string; tone: 'good' | 'warn' | 'bad' }
/** `key` bleibt in jeder Sprache gleich (z. B. 'meeting' für das Gespräch); das Etikett ist übersetzt. */
export interface TaskFact { key?: string; label: string; value: string; chip?: TaskChip | null }
export interface TaskContext {
  /** Frage als Fenstertitel, z. B. „Wollen Sie PR-E495EA kennenlernen?“ */
  ask: string | null;
  facts: TaskFact[];
  /** Kurzfassung für die Zeile auf der Seite „Aufgaben“ */
  line: string[];
  /** Etikett hinter der Zeile, z. B. „im Budget“ */
  chip: TaskChip | null;
  /** Satz einer Person, z. B. des Headhunters */
  quote: { by: string; text: string } | null;
  /** Gegenüberstellung, z. B. Angebot | Wunsch | Rahmen */
  compare: { heads: string[]; rows: { key?: string; label: string; cells: string[]; changed: boolean }[] } | null;
  timeline: { text: string; state: 'done' | 'now' | 'next' }[] | null;
  /** Lage der Stelle oder warum es eilt */
  why: string | null;
  foot: string | null;
}

/**
 * Meilenstein für die Leiste oben im Dashboard (24.10.2026): Zusage, Gegenwunsch, Absage des
 * Kandidaten, Vertrag unterschrieben, erster Arbeitstag. Mit Aufgabe (taskKey) bleibt er, bis sie
 * erledigt ist; reine Erfolgs- und Absagemeldungen 3 Tage.
 */
export interface NewsItem {
  key: string;
  kind: 'accepted' | 'counter' | 'declined' | 'signed' | 'start';
  submissionId: string;
  title: string;
  detail: string;
  hint: string | null;
  cta: string;
  /** Aufgabe, die der Knopf öffnet */
  taskKey: string | null;
  at: string;
}

export interface WaitingItem {
  key: string;
  submissionId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  who: string;
  /** Kandidat · Headhunter · Matchunt · Termin */
  by: 'candidate' | 'recruiter' | 'matchunt' | 'date';
  title: string;
  detail: string;
}

export interface ClientTaskInput {
  now: number;
  jobs: any[];
  submissions: any[];
  candidates: any[];
  recruiters: any[];
  interviews: any[];
  offers: any[];
  recommendations: any[];
  contracts: any[];
  placements: any[];
  invoices: any[];
  /** Fragen des Headhunters an diesen Nutzer (Glocke, Typ recruiter_job_questions) */
  questions: any[];
  /** Nachrichten Kunde ↔ Headhunter je Einreichung (für „Frage an Marko gestellt“) */
  messages: any[];
  /** erledigte Aufgaben (Protokoll), für Fragen und „Erledigt · 7 Tage“ */
  log: any[];
  // Für die Entscheidungshilfe (optional, Ableitung läuft auch ohne):
  /** eigene Notizen des Nutzers im Bewerberprofil (candidate_comments) */
  comments?: any[];
  /** Headhunter, die für die Stellen suchen (recruiter_job_activations) */
  activations?: any[];
  /** Partnerstufe der Headhunter (recruiter_partner_status) */
  partners?: any[];
  /** wer welche Frage gestellt hat: notification id → recruiter id */
  questionSenders?: Record<string, string>;
  /** Honorarsatz je Stelle laut Rahmenvertrag */
  feePct?: Record<string, number>;
  /** angemeldeter Nutzer (unterschreibt er selbst für die Firma?) */
  userId?: string;
  /** Unterschrifts-Links (Unterschrift über Matchunt): verschickt, geöffnet */
  signLinks?: any[];
  /** Stellen, deren Rechnung eine Bestellnummer braucht (Rechnungsdaten des Kunden) */
  poRequiredJobs?: string[];
  /** Standard-Kostenstelle je Stelle (Rechnungsdaten des Kunden) */
  defaultCostCenter?: Record<string, string>;
  /** Fälle zu Besetzungen (continuity_claims) */
  claims?: any[];
  /** Angebote einer Nachbesetzung bei Core (research_offers) */
  researchOffers?: any[];
  /** Sprache der Texte (Oberfläche des Kunden, body.lang); ohne Angabe Deutsch */
  lang?: Lang | null;
}

/** Rückmeldung zu einer Vorstellung binnen 5 Werktagen (Rahmenvertrag § 7 Abs. 2, F3 Stufe 1). */
export const REVIEW_WORKDAYS = 5;
/** Werktage, in denen Matchunt eine Meldung prüft (wie CASE_REVIEW_WORKDAYS in besetzung-service.ts). */
const CASE_REVIEW_WORKDAYS = 3;
const CLIENT_SPHERE = ['offer_withdrawn', 'position_changed'];

/** Werktage (Mo–Fr) seit einem Zeitpunkt bis heute (Berlin). */
export function workdaysSince(isoStr: string | null | undefined, now: number): number {
  if (!isoStr || Number.isNaN(Date.parse(isoStr))) return 0;
  const end = berlinDateKey(now);
  const d = new Date(`${berlinDateKey(Date.parse(isoStr))}T12:00:00Z`);
  let n = 0;
  for (let i = 0; i < 400 && d.toISOString().slice(0, 10) < end; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

const DAY = 86400000;
const CLOSED = ['placed', 'hired', 'rejected', 'client_rejected', 'withdrawn', 'expired'];
// accept_reported (G + H, 25.10.2026): Headhunter hat die Zusage gemeldet, der Kandidat bestätigt per Mail
const OPEN_OFFER = ['with_recruiter', 'considering', 'countered', 'accept_reported'];
const BOOKED = ['scheduled', 'confirmed', 'completed', 'no_show'];

// ---------------------------------------------------------------------------
// Sprache (Mehrsprachigkeit, 13.11.2026): Die Texte gehen an den angemeldeten Kunden, in der
// Sprache seiner Oberfläche (body.lang). Ohne Angabe Deutsch, wortgleich wie bisher.
// Kunden auf Deutsch „Sie“, auf Englisch „you“, auf Schwedisch und Norwegisch „du“.
// ---------------------------------------------------------------------------

/** Text je Sprache; `m`-Vorlagen halten Namen aus der Schweizer Schreibweise heraus. */
const tx = (lang: Lang | null | undefined, de: Msg | string, en: Msg | string, sv: Msg | string, nb: Msg | string) => pick(lang, { de, en, sv, nb });
const isDe = (lang: Lang | null | undefined) => baseLang(lang) === 'de';

const t = (v: unknown) => (typeof v === 'string' && v ? Date.parse(v) : NaN);
const iso = (ms: number) => new Date(ms).toISOString();
/** Datum aus einem Tagesschlüssel: deutsch „23.10.2026“, sonst nach Region (en-GB „23/10/2026“, sv „2026-10-23“). */
const dateIn = (key: string | null | undefined, lang?: Lang | null) => {
  if (!key) return '';
  const [y, m, d] = String(key).slice(0, 10).split('-');
  if (isDe(lang)) return `${d}.${m}.${y}`;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d), 12);
  if (Number.isNaN(ms)) return `${d}.${m}.${y}`;
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));
};
const dateDe = (key: string | null | undefined) => dateIn(key);
const whenIn = (isoStr: string, lang?: Lang | null) => `${formatBerlinDateShort(isoStr, lang)} ${formatBerlinTime(isoStr, lang)}`;
const euroIn = (n: number | null | undefined, lang?: Lang | null) => (n == null ? '' : `${new Intl.NumberFormat(intlLocale(lang)).format(n)} €`);
const euro = (n: number | null | undefined) => euroIn(n);
const euroCentsIn = (c: number | null | undefined, lang?: Lang | null) => (c == null ? '' : `${new Intl.NumberFormat(intlLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100)} €`);
const first = (name: string) => name.split(/\s+/)[0];

function parseFeedback(raw: unknown): { way: string | null; at: number; text: string | null; missing: string | null; question: string | null } {
  if (!raw) return { way: null, at: NaN, text: null, missing: null, question: null };
  let v: any = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return { way: null, at: NaN, text: null, missing: null, question: null }; }
  }
  const r = v?.recommendation;
  const way = r === 'proceed' ? 'next_round' : r === 'maybe' ? 'unsure' : typeof r === 'string' ? r : null;
  const question = typeof v?.question === 'string' && v.question ? v.question : null;
  return { way, at: t(v?.submitted_at), text: typeof v?.impression === 'string' ? v.impression : (typeof v?.summary === 'string' ? v.summary : null), missing: question ?? (typeof v?.concerns === 'string' && v.concerns ? v.concerns : null), question };
}

const slotStarts = (raw: unknown) =>
  ((Array.isArray(raw) ? raw : []) as any[]).map((x) => t(typeof x === 'string' ? x : x?.datetime)).filter((x) => !Number.isNaN(x));

/** Offene Interview-Anfrage ist abgelaufen: alle Vorschläge vorbei oder der Link ist abgelaufen. */
function requestExpired(iv: any, now: number): boolean {
  const starts = slotStarts(iv.proposed_slots);
  const allPast = starts.length > 0 && starts.every((s) => s < now);
  const tokenGone = !Number.isNaN(t(iv.response_token_expires_at)) && t(iv.response_token_expires_at) < now;
  return allPast || tokenGone;
}

// ---------------------------------------------------------------------------
// Entscheidungshilfe (23.10.2026): nur, was der Kunde im Profil ohnehin sieht –
// ohne Freigabe Bänder wie client_candidate_view (Region, Erfahrung, Gehalt).
// ---------------------------------------------------------------------------

const ctxOf = (x: Partial<TaskContext>): TaskContext => ({ ask: null, facts: [], line: [], chip: null, quote: null, compare: null, timeline: null, why: null, foot: null, ...x });
/** Fakt mit Etikett; `key` bleibt in jeder Sprache gleich (z. B. 'meeting' für „Gespräch“). */
const fact = (label: string, value: string | null | undefined, chip?: TaskChip | null, key?: string): TaskFact[] => (value ? [{ ...(key ? { key } : {}), label, value, chip: chip ?? null }] : []);

const NOTICE: Record<string, string> = {
  immediate: 'sofort', immediately: 'sofort', '2_weeks': '2 Wochen', '1_month': '1 Monat', '6_weeks': '6 Wochen',
  '2_months': '2 Monate', '3_months': '3 Monate', '3_months_eoq': '3 Monate zum Quartalsende', '6_months': '6 Monate',
};
const IMMEDIATE = ['immediate', 'immediately', 'sofort'];
/** Kündigungsfrist lesbar, nie als Rohwert („3_months“ → „3 Monate“). Ohne Sprache Deutsch. */
export function noticeLabel(v: unknown, lang?: Lang | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  if (!isDe(lang)) {
    if (IMMEDIATE.includes(s)) return tx(lang, 'sofort', 'immediately', 'omedelbart', 'umiddelbart');
    const m = s.match(/^(\d+)_(months?|weeks?)(?:_(eom|eoq|eoy))?$/);
    if (m) {
      const one = m[1] === '1';
      const unit = m[2].startsWith('month')
        ? tx(lang, '', one ? 'month' : 'months', one ? 'månad' : 'månader', one ? 'måned' : 'måneder')
        : tx(lang, '', one ? 'week' : 'weeks', one ? 'vecka' : 'veckor', one ? 'uke' : 'uker');
      const end = m[3] === 'eom' ? tx(lang, '', ' to the end of the month', ' till månadsskiftet', ' til utgangen av måneden')
        : m[3] === 'eoq' ? tx(lang, '', ' to the end of the quarter', ' till kvartalsskiftet', ' til utgangen av kvartalet')
          : m[3] === 'eoy' ? tx(lang, '', ' to the end of the year', ' till årsskiftet', ' til utgangen av året') : '';
      return `${m[1]} ${unit}${end}`;
    }
    return s.replace(/_/g, ' ');
  }
  if (NOTICE[s]) return NOTICE[s];
  // „2_months_eom“ → „2 Monate zum Monatsende“, „3_months_eoq“ → „… zum Quartalsende“
  const m = s.match(/^(\d+)_(months?|weeks?)(?:_(eom|eoq|eoy))?$/);
  if (m) {
    const unit = m[2].startsWith('month') ? (m[1] === '1' ? 'Monat' : 'Monate') : (m[1] === '1' ? 'Woche' : 'Wochen');
    const end = m[3] === 'eom' ? ' zum Monatsende' : m[3] === 'eoq' ? ' zum Quartalsende' : m[3] === 'eoy' ? ' zum Jahresende' : '';
    return `${m[1]} ${unit}${end}`;
  }
  return s.replace(/_/g, ' ');
}
/** „2 Monate zum Monatsende“ → „2 Monate Kündigungsfrist zum Monatsende“ */
const noticeSentence = (n: string, lang?: Lang | null) => (!isDe(lang)
  ? tx(lang, '', m`${n} notice`, m`uppsägningstid ${n}`, m`oppsigelsestid ${n}`)
  : /^\d+ \S+/.test(n) ? n.replace(/^(\d+ \S+)/, '$1 Kündigungsfrist') : `${n} Kündigungsfrist`);
const remoteLabel = (v: unknown, lang?: Lang | null): string | null => {
  switch (String(v ?? '')) {
    case 'remote': return tx(lang, 'Remote', 'Remote', 'Distans', 'Fjernarbeid');
    case 'hybrid': return 'Hybrid';
    case 'onsite': return tx(lang, 'vor Ort', 'On site', 'På plats', 'På stedet');
    case 'flexible': return tx(lang, 'flexibel', 'Flexible', 'Flexibelt', 'Fleksibelt');
    default: return null;
  }
};
const formatLabel = (v: unknown, lang?: Lang | null): string | null => {
  switch (String(v ?? '')) {
    case 'teams': return 'Teams';
    case 'video': return 'Video';
    case 'phone': return tx(lang, 'Telefon', 'Phone', 'Telefon', 'Telefon');
    case 'onsite': return tx(lang, 'vor Ort', 'On site', 'På plats', 'På stedet');
    default: return null;
  }
};
/** „Tessas“, „Max’“; en „Tessa’s“; sv „Tessas“, „Max“; nb „Tessas“, „Max’“ */
const genitiveIn = (n: string, lang?: Lang | null) => {
  const b = baseLang(lang);
  if (b === 'en') return `${n}’s`;
  if (b === 'sv') return /[sxz]$/i.test(n) ? n : `${n}s`;
  if (b === 'nb') return /[sxz]$/i.test(n) ? `${n}’` : `${n}s`;
  return /[sßxz]$/i.test(n) ? `${n}’` : `${n}s`;
};
const cap = (s: unknown) => (typeof s === 'string' && s ? s[0].toUpperCase() + s.slice(1) : null);
const tsd = (n: number) => `${Math.round(n / 1000)}`;
/** Tausend Euro: „T€“, außer Deutsch „k€“ */
const kEuro = (lang?: Lang | null) => (isDe(lang) ? 'T€' : 'k€');

const REGION: Record<string, [string, string, string]> = {
  Süddeutschland: ['Southern Germany', 'södra Tyskland', 'Sør-Tyskland'],
  Norddeutschland: ['Northern Germany', 'norra Tyskland', 'Nord-Tyskland'],
  Westdeutschland: ['Western Germany', 'västra Tyskland', 'vestlige Tyskland'],
  Ostdeutschland: ['Eastern Germany', 'östra Tyskland', 'østlige Tyskland'],
  Österreich: ['Austria', 'Österrike', 'Østerrike'],
  Schweiz: ['Switzerland', 'Schweiz', 'Sveits'],
};

/** wie anon_region_broad */
export function regionBroad(city: unknown, lang?: Lang | null): string | null {
  const c = typeof city === 'string' ? city.trim().toLowerCase() : '';
  if (!c) return null;
  const rules: [RegExp, string][] = [
    [/münchen|munich|augsburg|nürnberg|regensburg|stuttgart|ulm|freiburg|karlsruhe/, 'Süddeutschland'],
    [/berlin|hamburg|bremen|hannover|kiel|rostock|lübeck|schwerin/, 'Norddeutschland'],
    [/köln|düsseldorf|dortmund|essen|frankfurt|bonn|aachen|wiesbaden|mainz/, 'Westdeutschland'],
    [/dresden|leipzig|chemnitz|erfurt|magdeburg|potsdam/, 'Ostdeutschland'],
    [/wien|vienna|graz|linz|salzburg|innsbruck|klagenfurt|österreich|austria/, 'Österreich'],
    [/zürich|zurich|basel|bern|genf|geneva|lausanne|schweiz|switzerland/, 'Schweiz'],
  ];
  const de = rules.find(([re]) => re.test(c))?.[1] ?? 'DACH';
  const other = REGION[de];
  return other ? tx(lang, de, other[0], other[1], other[2]) : de;
}

/** wie anon_experience_band */
function experienceBand(years: unknown, lang?: Lang | null): string | null {
  const y = Number(years);
  if (years == null || !Number.isFinite(y)) return null;
  const band = y < 2 ? '0–2' : y < 5 ? '3–5' : y < 10 ? '6–10' : y < 15 ? '10–15' : '15+';
  return tx(lang, `${band} Jahre`, `${band} years`, `${band} år`, `${band} år`);
}

/** Gehaltswunsch als 10-T€-Band wie anon_salary_band (auch nach Freigabe nur das Band). */
export function wishBand(c: any): { lo: number; hi: number } | null {
  const v = Number(c?.expected_salary ?? c?.salary_expectation_max);
  if (!Number.isFinite(v) || v <= 0) return null;
  const lo = Math.floor(v / 10000) * 10000;
  return { lo, hi: lo + 10000 };
}

/** Etikett Gehaltswunsch gegen das Budget der Stelle; ohne Obergrenze keins. */
export function budgetChip(b: { lo: number; hi: number } | null, job: any, lang?: Lang | null): TaskChip | null {
  const max = Number(job?.salary_max);
  if (!b || !Number.isFinite(max) || max <= 0) return null;
  if (b.hi <= max) return { text: tx(lang, 'im Budget', 'within budget', 'inom budget', 'innenfor budsjett'), tone: 'good' };
  if (b.lo <= max) return { text: tx(lang, 'am oberen Rand', 'at the upper end', 'i övre delen', 'i øvre del'), tone: 'warn' };
  return { text: tx(lang, 'über Budget', 'over budget', 'över budget', 'over budsjett'), tone: 'bad' };
}

function jobRange(job: any, lang?: Lang | null): string | null {
  const min = Number(job?.salary_min), max = Number(job?.salary_max);
  const hasMin = Number.isFinite(min) && min > 0, hasMax = Number.isFinite(max) && max > 0;
  const k = kEuro(lang);
  if (hasMin && hasMax) return `${tsd(min)}–${tsd(max)} ${k}`;
  if (hasMax) return tx(lang, `bis ${tsd(max)} ${k}`, `up to ${tsd(max)} ${k}`, `upp till ${tsd(max)} ${k}`, `opptil ${tsd(max)} ${k}`);
  if (hasMin) return tx(lang, `ab ${tsd(min)} ${k}`, `from ${tsd(min)} ${k}`, `från ${tsd(min)} ${k}`, `fra ${tsd(min)} ${k}`);
  return null;
}

/** Kalendertage von heute (Berlin) bis zu einem Datum; negativ = vorbei */
function daysTo(key: string | null | undefined, now: number): number | null {
  if (!key) return null;
  const d = Date.parse(`${String(key).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.parse(`${berlinDateKey(now)}T12:00:00Z`)) / DAY);
}
const inDaysIn = (n: number | null, lang?: Lang | null) => (n === null ? ''
  : n === 0 ? tx(lang, 'heute', 'today', 'i dag', 'i dag')
    : n === 1 ? tx(lang, 'morgen', 'tomorrow', 'i morgon', 'i morgen')
      : n > 1 ? tx(lang, `in ${n} Tagen`, `in ${n} days`, `om ${n} dagar`, `om ${n} dager`)
        : n === -1 ? tx(lang, 'gestern', 'yesterday', 'i går', 'i går')
          : tx(lang, `vor ${-n} Tagen`, `${-n} days ago`, `för ${-n} dagar sedan`, `for ${-n} dager siden`));

/** Monate addieren (Probezeit-Ende = Start + n Monate − 1 Tag) */
function plusMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d) - DAY);
  return end.toISOString().slice(0, 10);
}

function offerTerms(o: any, lang?: Lang | null): string {
  return [`${euroIn(o.salary_offered, lang)}${o.variable_salary ? ` + ${euroIn(o.variable_salary, lang)}` : ''}`, o.start_date ? `${tx(lang, 'Start', 'Start', 'Start', 'Oppstart')} ${dateIn(o.start_date, lang)}` : null].filter(Boolean).join(' · ');
}

/** F3 Stufe 1: wie viele Vorstellungen über der Grenze warten (für eine Sammelzeile). */
export interface ReviewReminder { count: number; oldestWorkdays: number; text: string }

export function deriveClientTasks(input: ClientTaskInput): { tasks: ClientTask[]; waiting: WaitingItem[]; news: NewsItem[]; reminder: ReviewReminder | null } {
  const { now } = input;
  const lang = input.lang ?? null;
  const T = (de: Msg | string, en: Msg | string, sv: Msg | string, nb: Msg | string) => tx(lang, de, en, sv, nb);
  // Datum, Zahl, Uhrzeit in der Sprache des Kunden (Zeitzone Berlin wie bisher)
  const dateDe = (key: string | null | undefined) => dateIn(key, lang);
  const euro = (n: number | null | undefined) => euroIn(n, lang);
  const euroCents = (c: number | null | undefined) => euroCentsIn(c, lang);
  const when = (isoStr: string) => whenIn(isoStr, lang);
  const short = (x: string | number) => formatBerlinDateShort(x, lang);
  const inDays = (n: number | null) => inDaysIn(n, lang);
  const genitive = (n: string) => genitiveIn(n, lang);
  const FORMAT = (v: unknown) => formatLabel(v, lang);
  const kE = kEuro(lang);
  const START = T('Start', 'Start', 'Start', 'Oppstart');
  const round = (n: unknown) => T(m`Runde ${n}`, m`Round ${n}`, m`Omgång ${n}`, m`Runde ${n}`);

  const jobById = new Map(input.jobs.map((j) => [j.id, j]));
  const candById = new Map(input.candidates.map((c) => [c.id, c]));
  const recName = new Map(input.recruiters.map((r) => [r.user_id, r.full_name as string]));
  const doneKeys = new Set(input.log.map((l) => l.task_key));
  const tasks: ClientTask[] = [];
  const waiting: WaitingItem[] = [];
  /** Werktage je überfälliger Vorstellung (F3 Stufe 1) */
  const lateReviews: number[] = [];

  const by = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    return m;
  };
  const ivBySub = by(input.interviews, (i: any) => i.submission_id);
  const offersBySub = by(input.offers, (o: any) => o.submission_id);
  const recBySub = by(input.recommendations, (r: any) => r.submission_id);
  const msgBySub = by(input.messages, (m: any) => `${m.job_id}:${m.candidate_id}`);
  const contractBySub = new Map(input.contracts.map((c: any) => [c.submission_id, c]));
  const placementBySub = new Map(input.placements.map((p: any) => [p.submission_id, p]));
  const notesBySub = by(input.comments ?? [], (c: any) => c.submission_id);
  const lastOf = <T,>(rows: T[] | undefined, at: (r: T) => unknown) => (rows ?? []).slice().sort((a, b) => t(at(b)) - t(at(a)))[0] ?? null;

  // Wo stehen die anderen Kandidaten der Stelle? (für „Außerdem für diese Stelle …“)
  const phase = new Map<string, 'new' | 'interview' | 'offer'>();
  for (const s of input.submissions) {
    if (placementBySub.has(s.id) || CLOSED.includes(String(s.stage ?? '')) || CLOSED.includes(String(s.status ?? ''))) continue;
    const c = contractBySub.get(s.id);
    const offerOpen = (offersBySub.get(s.id) ?? []).some((o: any) => OPEN_OFFER.includes(o.status));
    const ivOpen = (ivBySub.get(s.id) ?? []).some((i: any) => !['cancelled', 'declined', 'superseded', 'withdrawn', 'expired'].includes(i.status));
    phase.set(s.id, (c && !['dropped', 'voided'].includes(c.status)) || offerOpen ? 'offer' : ivOpen ? 'interview' : 'new');
  }
  const others = (jobId: string, subId: string) => {
    const mates = input.submissions.filter((x) => x.job_id === jobId && x.id !== subId && phase.has(x.id));
    const iv = mates.filter((x) => phase.get(x.id) === 'interview').length;
    const off = mates.filter((x) => phase.get(x.id) === 'offer').length;
    if (!mates.length) return { text: T('Bisher der einzige Kandidat für diese Stelle', 'So far the only candidate for this role', 'Hittills den enda kandidaten för tjänsten', 'Så langt den eneste kandidaten til stillingen'), iv, off };
    const parts = [iv ? T(`${iv} im Interview`, `${iv} in interviews`, `${iv} på intervju`, `${iv} på intervju`) : null, off ? T(`${off} mit Angebot`, `${off} with an offer`, `${off} med erbjudande`, `${off} med tilbud`) : null].filter(Boolean);
    const n = mates.length, one = n === 1;
    const rest = parts.length ? ` · ${parts.join(' · ')}` : '';
    return { text: T(`Außerdem für diese Stelle: ${n} ${one ? 'Kandidat' : 'Kandidaten'}${rest}`, `Also for this role: ${n} ${one ? 'candidate' : 'candidates'}${rest}`,
      `Dessutom för tjänsten: ${n} ${one ? 'kandidat' : 'kandidater'}${rest}`, `I tillegg til denne stillingen: ${n} ${one ? 'kandidat' : 'kandidater'}${rest}`), iv, off };
  };

  /** Kurzprofil wie im Bewerberprofil (ohne Freigabe nur Bänder) */
  const profile = (s: any, cand: any, job: any) => {
    const unlocked = !!(s.identity_unlocked || s.identity_revealed);
    const yrs = cand?.experience_years;
    const exp = unlocked && yrs != null ? T(`${yrs} J. Erfahrung`, `${yrs} yrs experience`, `${yrs} års erfarenhet`, `${yrs} års erfaring`) : experienceBand(yrs, lang);
    const role = [cand?.job_title, cap(cand?.seniority)].filter(Boolean).join(' · ') || null;
    const region = unlocked && cand?.city ? String(cand.city) : regionBroad(cand?.city, lang);
    const model = remoteLabel(cand?.remote_preference, lang);
    const immediate = IMMEDIATE.includes(String(cand?.notice_period ?? '').trim());
    const notice = noticeLabel(cand?.notice_period, lang);
    const availDays = daysTo(cand?.availability_date, now);
    const now_ = T('sofort', 'immediately', 'omedelbart', 'umiddelbart');
    const avail = [cand?.availability_date ? (availDays !== null && availDays <= 0 ? now_ : T(`ab ${dateDe(cand.availability_date)}`, `from ${dateDe(cand.availability_date)}`, `från ${dateDe(cand.availability_date)}`, `fra ${dateDe(cand.availability_date)}`)) : null,
      notice ? (immediate ? (cand?.availability_date ? null : now_) : noticeSentence(notice, lang)) : null].filter(Boolean).join(' · ') || null;
    const band = wishBand(cand);
    const chip = budgetChip(band, job, lang);
    const range = jobRange(job, lang);
    const wish = band ? `${tsd(band.lo)}–${tsd(band.hi)} ${kE}` : null;
    const skills = (Array.isArray(cand?.skills) ? cand.skills : []).filter((x: unknown) => typeof x === 'string' && x.trim()).slice(0, 4) as string[];
    return {
      facts: [
        ...fact(T('Rolle', 'Role', 'Roll', 'Rolle'), [role, exp].filter(Boolean).join(' · '), null, 'role'),
        ...fact(T('Gehaltswunsch', 'Salary expectation', 'Löneanspråk', 'Lønnsforventning'), wish ? `${wish}${range ? T(` · Ihre Stelle ${range}`, ` · your role ${range}`, ` · din tjänst ${range}`, ` · din stilling ${range}`) : ''}` : null, chip, 'salary_wish'),
        ...fact(T('Verfügbar', 'Available', 'Tillgänglig', 'Tilgjengelig'), avail, null, 'available'),
        ...fact(T('Ort · Modell', 'Location · model', 'Ort · modell', 'Sted · modell'), [region, model].filter(Boolean).join(' · '), null, 'location'),
        ...fact(T('Stärken', 'Strengths', 'Styrkor', 'Styrker'), skills.join(', '), null, 'skills'),
      ],
      line: [role, exp, wish ? T(`Wunsch ${wish}`, `expects ${wish}`, `anspråk ${wish}`, `ønsker ${wish}`) : null, region, avail, skills.slice(0, 3).join(', ') || null].filter(Boolean) as string[],
      chip,
    };
  };
  const clip = (v: unknown, n = 240) => {
    const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
    return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
  };

  for (const s of input.submissions) {
    const job = jobById.get(s.job_id);
    if (!job) continue;
    const cand = candById.get(s.candidate_id);
    const unlocked = !!(s.identity_unlocked || s.identity_revealed);
    const who = unlocked && cand?.full_name ? cand.full_name : `PR-${String(s.candidate_id ?? '').slice(0, 6).toUpperCase()}`;
    const named = !!(unlocked && cand?.full_name);
    const name = named ? first(cand.full_name) : T('Der Kandidat', 'The candidate', 'Kandidaten', 'Kandidaten');
    // im Satz klein und gebeugt: „Hat der Kandidat …“, „mit dem Kandidaten“, „für den Kandidaten“
    const nameIn = named ? first(cand.full_name) : T('der Kandidat', 'the candidate', 'kandidaten', 'kandidaten');
    const nameDat = named ? first(cand.full_name) : T('dem Kandidaten', 'the candidate', 'kandidaten', 'kandidaten');
    const nameAkk = named ? first(cand.full_name) : T('den Kandidaten', 'the candidate', 'kandidaten', 'kandidaten');
    const hh = recName.get(s.recruiter_id) ?? T('Ihr Headhunter', 'Your headhunter', 'Din headhunter', 'Din headhunter');
    const hhFirst = first(hh);
    const base = { submissionId: s.id, jobId: job.id, jobTitle: job.title ?? null, who };
    const push = (x: Omit<ClientTask, 'submissionId' | 'jobId' | 'jobTitle' | 'who' | 'note' | 'context'> & { note?: string | null; context?: TaskContext | null }) => {
      if (!doneKeys.has(x.key)) tasks.push({ ...base, note: null, context: null, ...x });
    };
    const pct = input.feePct?.[job.id] ?? null;
    const fee = (target: number) => (pct ? Math.round((target * pct) / 100) : null);
    const accepted = lastOf((offersBySub.get(s.id) ?? []).filter((o: any) => o.status === 'accepted'), (o: any) => o.decision_at ?? o.updated_at);
    const wait = (x: Omit<WaitingItem, 'submissionId' | 'jobId' | 'jobTitle' | 'who'>) => waiting.push({ submissionId: s.id, jobId: job.id, jobTitle: job.title ?? null, who, ...x });

    // Frage des Kunden an den Headhunter offen? (letzte Nachricht vom Kundenteam)
    const thread = (msgBySub.get(`${s.job_id}:${s.candidate_id}`) ?? []).slice().sort((a: any, b: any) => t(a.created_at) - t(b.created_at));
    const last = thread[thread.length - 1];
    const askedOpen = last && last.sender_id !== s.recruiter_id ? last : null;
    const askedOn = askedOpen ? short(askedOpen.created_at) : '';
    const askNote = askedOpen ? T(m`Frage an ${hhFirst} gestellt am ${askedOn} – Antwort steht noch aus`, m`Question to ${hhFirst} asked on ${askedOn} – no answer yet`, m`Fråga till ${hhFirst} ställd ${askedOn} – svar saknas än`, m`Spørsmål til ${hhFirst} stilt ${askedOn} – svar mangler ennå`) : null;
    if (askedOpen) wait({ key: `question-open:${s.id}`, by: 'recruiter', title: T(m`${hhFirst} beantwortet Ihre Frage`, m`${hhFirst} is answering your question`, m`${hhFirst} svarar på din fråga`, m`${hhFirst} svarer på spørsmålet ditt`), detail: T(`gestellt am ${askedOn}`, `asked on ${askedOn}`, `ställd ${askedOn}`, `stilt ${askedOn}`) });

    // ---------------------------------------------------------------- nach der Einstellung
    const pl = placementBySub.get(s.id);
    if (pl) {
      const startKey = pl.first_working_day ?? pl.start_date;
      const startMs = startKey ? Date.parse(`${String(startKey).slice(0, 10)}T00:00:00Z`) : NaN;
      const endKind = pl.non_start_reported_at ? 'non_start' : pl.departure_reported_at ? 'departure' : null;
      const fixed = !!pl.start_fixed_at || pl.placement_state !== 'agreed';
      const reporter = pl.start_reported_by ? (recName.get(pl.start_reported_by) ?? hh) : hh;
      const reporterFirst = first(reporter);
      const continuity = Number(pl.pricing_snapshot?.continuityDays) > 0 && !pl.replaces_placement_id;
      // Name im Satz: Vorname nach Freigabe, sonst das Kürzel
      const nm = unlocked && cand?.full_name ? first(cand.full_name) : who;
      if (!fixed && !endKind && !pl.start_confirmed_at) {
        if (pl.start_report_kind === 'started' && pl.start_reported_at && !pl.start_contested_at) {
          // K7: Headhunter hat zuerst gemeldet → Gegenprobe; ohne Widerspruch nach 3 Werktagen fest
          const until = addWorkdays(berlinDateKey(t(pl.start_reported_at)), START_OBJECTION_WORKDAYS);
          const title = unlocked && cand?.full_name ? T(m`${genitive(nm)} Start bestätigen`, m`Confirm ${genitive(nm)} start`, m`Bekräfta ${genitive(nm)} start`, m`Bekreft ${genitive(nm)} oppstart`) : T(m`Start von ${who} bestätigen`, m`Confirm start of ${who}`, m`Bekräfta start för ${who}`, m`Bekreft oppstart for ${who}`);
          const on = dateDe(pl.start_reported_on);
          push({ key: `start-check:${pl.id}`, kind: 'start_check', since: pl.start_reported_at, urgent: false, waitingWho: null,
            title, detail: T(m`${reporter} meldet: angefangen am ${on}`, m`${reporter} reports: started on ${on}`, m`${reporter} meddelar: började ${on}`, m`${reporter} melder: begynte ${on}`), ref: { placementId: pl.id, reportedOn: pl.start_reported_on ?? undefined },
            context: ctxOf({
              ask: title,
              facts: [
                ...fact(T('Gemeldet', 'Reported', 'Anmält', 'Meldt'), T(m`${reporter}: angefangen am ${on}`, m`${reporter}: started on ${on}`, m`${reporter}: började ${on}`, m`${reporter}: begynte ${on}`), null, 'reported'),
                ...fact(T('Laut Vertrag', 'Per contract', 'Enligt avtal', 'Ifølge kontrakt'), startKey ? dateDe(startKey) : null, null, 'contract_start'),
              ],
              line: [T(m`${reporterFirst} meldet: angefangen am ${on}`, m`${reporterFirst} reports: started on ${on}`, m`${reporterFirst} meddelar: började ${on}`, m`${reporterFirst} melder: begynte ${on}`)],
              foot: T(`Ohne Antwort gilt es am ${dateDe(until)} als bestätigt.`, `Without a reply, it counts as confirmed on ${dateDe(until)}.`, `Utan svar räknas det som bekräftat ${dateDe(until)}.`, `Uten svar regnes det som bekreftet ${dateDe(until)}.`),
            }) });
        } else if (pl.start_report_kind === 'started' && pl.start_contested_at) {
          wait({ key: `start-contested:${pl.id}`, by: 'matchunt', title: T(m`Matchunt klärt den Start von ${nm}`, m`Matchunt is clarifying the start of ${nm}`, m`Matchunt utreder starten för ${nm}`, m`Matchunt avklarer oppstarten til ${nm}`), detail: T(m`${reporterFirst} meldet „angefangen“, Sie sehen es anders`, m`${reporterFirst} reports “started”, you see it differently`, m`${reporterFirst} meddelar ”började”, du ser det annorlunda`, m`${reporterFirst} melder «begynt», du ser det annerledes`) });
        } else if (pl.start_report_kind === 'not_started') {
          // K8 (2): Headhunter meldet die Absage zuerst → Kunde bestätigt über „Besetzung endet“ (K5 mit „Nein“)
          const head = T(m`${reporterFirst} meldet: ${nm} hat vor dem Start abgesagt`, m`${reporterFirst} reports: ${nm} withdrew before starting`, m`${reporterFirst} meddelar: ${nm} tackade nej före start`, m`${reporterFirst} melder: ${nm} trakk seg før oppstart`);
          const confirmReplace = T('Bitte bestätigen, dann prüft Matchunt die Nachbesetzung', 'Please confirm, then Matchunt will review the replacement', 'Bekräfta, så granskar Matchunt ersättningsrekryteringen', 'Bekreft, så vurderer Matchunt erstatningsrekrutteringen');
          push({ key: `end-confirm:${pl.id}`, kind: 'end_confirm', since: pl.start_reported_at ?? iso(now), urgent: true, waitingWho: null,
            title: head,
            detail: continuity ? confirmReplace : T('Bitte bestätigen, dann meldet sich Matchunt', 'Please confirm, then Matchunt will be in touch', 'Bekräfta, så hör Matchunt av sig', 'Bekreft, så tar Matchunt kontakt'),
            ref: { placementId: pl.id },
            context: ctxOf({
              ask: head,
              facts: [
                ...fact(T('Erster Tag laut Vertrag', 'First day per contract', 'Första dag enligt avtal', 'Første dag ifølge kontrakt'), startKey ? dateDe(startKey) : null, null, 'contract_start'),
                ...fact(T('Gemeldet', 'Reported', 'Anmält', 'Meldt'), pl.start_reported_at ? T(m`${reporter} am ${short(pl.start_reported_at)}`, m`${reporter} on ${short(pl.start_reported_at)}`, m`${reporter} ${short(pl.start_reported_at)}`, m`${reporter} ${short(pl.start_reported_at)}`) : null, null, 'reported'),
              ],
              line: [continuity ? confirmReplace : T('Bitte bestätigen', 'Please confirm', 'Bekräfta', 'Bekreft')],
              quote: pl.start_contest_note ? { by: reporter, text: clip(pl.start_contest_note) } : null,
              foot: T('Mit „Bestätigen“ öffnet sich die Meldung „Besetzung endet“.', '“Confirm” opens the report “Placement ends”.', '”Bekräfta” öppnar anmälan ”Placeringen upphör”.', '«Bekreft» åpner meldingen «Ansettelsen avsluttes».'),
            }) });
        } else if (!Number.isNaN(startMs) && startMs <= now) {
          const probation = Number(accepted?.probation_months);
          const pkg = pl.package_key ? cap(String(pl.package_key).replace(/_/g, ' ')) : null;
          const ask = T(m`Hat ${nameIn} angefangen?`, m`Has ${nameIn} started?`, m`Har ${nameIn} börjat?`, m`Har ${nameIn} begynt?`);
          const hasProbation = Number.isFinite(probation) && probation > 0;
          const probEnd = hasProbation ? dateDe(plusMonthsKey(String(startKey), probation)) : '';
          push({ key: `start:${pl.id}`, kind: 'confirm_start', since: iso(startMs), urgent: now - startMs > 3 * DAY, waitingWho: hh,
            title: ask, detail: T(`Erster Arbeitstag laut Vertrag: ${dateDe(startKey)}`, `First working day per contract: ${dateDe(startKey)}`, `Första arbetsdag enligt avtal: ${dateDe(startKey)}`, `Første arbeidsdag ifølge kontrakt: ${dateDe(startKey)}`), ref: { placementId: pl.id },
            context: ctxOf({
              ask,
              facts: [
                ...fact(T('Erster Tag', 'First day', 'Första dag', 'Første dag'), `${dateDe(startKey)} · ${inDays(daysTo(startKey, now))}`, null, 'first_day'),
                ...fact(T('Probezeit', 'Probation', 'Provanställning', 'Prøvetid'), hasProbation ? T(`${probation} Monate · bis ${probEnd}`, `${probation} months · until ${probEnd}`, `${probation} månader · till ${probEnd}`, `${probation} måneder · til ${probEnd}`) : null, null, 'probation'),
                // Nachbesetzung nur mit Continuity-Paket (Core hat keine; ältere Einstellungen tragen teils ein Fristende)
                ...fact(T('Nachbesetzung möglich', 'Replacement possible', 'Ersättning möjlig', 'Erstatning mulig'), pl.continuity_end_date && continuity ? `${pkg ? `${pkg} · ` : ''}${T('bis', 'until', 'till', 'til')} ${dateDe(pl.continuity_end_date)}` : null, null, 'replacement'),
              ],
              line: [`${START} ${dateDe(startKey)}`, hasProbation ? T(`Probezeit bis ${probEnd}`, `probation until ${probEnd}`, `provanställning till ${probEnd}`, `prøvetid til ${probEnd}`) : null].filter(Boolean) as string[],
              foot: T(m`${hhFirst} erfährt Ihre Antwort sofort.`, m`${hhFirst} will see your answer right away.`, m`${hhFirst} får ditt svar direkt.`, m`${hhFirst} får svaret ditt med en gang.`),
            }) });
        } else if (!Number.isNaN(startMs)) {
          const along = T(m`${hhFirst} begleitet ${name} bis zum ersten Tag`, m`${hhFirst} stays with ${nameIn} until the first day`, m`${hhFirst} följer ${nameIn} fram till första dagen`, m`${hhFirst} følger ${nameIn} fram til første dag`);
          wait({ key: `start-wait:${pl.id}`, by: 'date', title: T(`Start am ${dateDe(startKey)}`, `Start on ${dateDe(startKey)}`, `Start ${dateDe(startKey)}`, `Oppstart ${dateDe(startKey)}`),
            detail: pl.start_report_kind === 'later' ? `${T(m`von ${reporterFirst} verschoben`, m`moved by ${reporterFirst}`, m`flyttad av ${reporterFirst}`, m`flyttet av ${reporterFirst}`)} · ${along}` : along });
        }
      }

      // Ende gemeldet: Matchunt prüft (Fall oder bei Core die Entscheidung über ein Angebot)
      const claim = (input.claims ?? []).filter((c: any) => c.placement_id === pl.id).sort((a: any, b: any) => t(b.reported_at) - t(a.reported_at))[0] ?? null;
      const offerRow = (input.researchOffers ?? []).find((o: any) => o.placement_id === pl.id) ?? null;
      if (endKind) {
        const reason = endKind === 'non_start' ? pl.non_start_reason : pl.departure_category;
        const sphere = !!pl.client_sphere_at || !!claim?.client_sphere || CLIENT_SPHERE.includes(String(reason ?? ''));
        const openCase = !!claim && ['submitted', 'in_review'].includes(claim.status);
        const corePending = endKind === 'non_start' && !continuity && !pl.replaces_placement_id && !offerRow && !sphere && pl.placement_state !== 'cancelled';
        if (openCase || corePending) {
          const reportedAt = claim?.reported_at ?? pl.non_start_reported_at ?? pl.departure_reported_at;
          const until = dateDe(addWorkdays(berlinDateKey(t(reportedAt)), CASE_REVIEW_WORKDAYS));
          wait({ key: `case:${pl.id}`, by: 'matchunt', title: T(m`Matchunt prüft Ihre Meldung zu ${who}`, m`Matchunt is reviewing your report on ${who}`, m`Matchunt granskar din anmälan om ${who}`, m`Matchunt gjennomgår meldingen din om ${who}`), detail: T(`bis ${until}`, `until ${until}`, `till ${until}`, `til ${until}`) });
        }
      }

      // Nachbesetzung (K6, K8)
      const replaceTitle = (jt: string) => T(m`Nachbesetzung ${jt}`, m`Replacement ${jt}`, m`Ersättning ${jt}`, m`Erstatning ${jt}`).trim();
      if (pl.research_state === 'awaiting_position') {
        const ask = T('Position für die Nachbesetzung bestätigen', 'Confirm the role for the replacement', 'Bekräfta tjänsten för ersättningen', 'Bekreft stillingen for erstatningen');
        push({ key: `research-pos:${pl.id}`, kind: 'research_position', since: claim?.decided_at ?? offerRow?.answered_at ?? pl.non_start_reported_at ?? pl.departure_reported_at ?? iso(now), urgent: false, waitingWho: null,
          title: ask, detail: `${job.title ?? T('Ihre Stelle', 'Your role', 'Din tjänst', 'Din stilling')} · ${T(m`für ${who}`, m`for ${who}`, m`för ${who}`, m`for ${who}`)}`, ref: { placementId: pl.id },
          context: ctxOf({
            ask,
            facts: [
              ...fact(T('Stelle', 'Role', 'Tjänst', 'Stilling'), job.title ?? null, null, 'job'),
              ...fact(T('Für', 'For', 'För', 'For'), who, null, 'for'),
              ...fact(T('Matchunt hat geprüft', 'Matchunt reviewed', 'Matchunt har granskat', 'Matchunt har vurdert'), claim?.decided_at ? short(claim.decided_at) : null, null, 'reviewed'),
            ],
            line: [T(m`für ${who}`, m`for ${who}`, m`för ${who}`, m`for ${who}`)],
            why: T('Bestätigen Sie die Stelle so, wie sie ist, oder passen Sie sie vorher an. Danach schreiben wir sie für alle Headhunter neu aus.', 'Confirm the role as it is, or adjust it first. Then we re-advertise it to all headhunters.', 'Bekräfta tjänsten som den är eller justera den först. Sedan annonserar vi ut den på nytt till alla headhunters.', 'Bekreft stillingen slik den er, eller juster den først. Deretter lyser vi den ut på nytt for alle headhuntere.'),
            foot: T('Liegt das Gehalt höher, berechnen wir nur den Unterschied.', 'If the salary is higher, we only charge the difference.', 'Om lönen är högre debiterar vi bara mellanskillnaden.', 'Er lønnen høyere, fakturerer vi bare differansen.'),
          }) });
      } else if (pl.research_state === 'awaiting_payment') {
        wait({ key: `research-pay:${pl.id}`, by: 'matchunt', title: replaceTitle(job.title ?? ''), detail: T('startet, sobald die Rechnung bezahlt ist', 'starts as soon as the invoice is paid', 'startar så snart fakturan är betald', 'starter så snart fakturaen er betalt') });
      } else if (pl.research_state === 'running' || pl.research_state === 'paused') {
        const rjobId = pl.research_job_id ?? s.job_id;
        const rjob = jobById.get(rjobId);
        const days = pl.research_started_at ? Math.max(0, Math.floor((now - t(pl.research_started_at)) / DAY)) : 0;
        const n = (input.activations ?? []).filter((a: any) => a.job_id === rjobId && a.status === 'active').length;
        const paused = pl.research_state === 'paused' || !!rjob?.cooperation_paused_at;
        const running = days === 0 ? T('läuft seit heute', 'running since today', 'pågår sedan i dag', 'pågår siden i dag')
          : T(`läuft seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`, `running for ${days} ${days === 1 ? 'day' : 'days'}`, `pågår sedan ${days} ${days === 1 ? 'dag' : 'dagar'}`, `pågår i ${days} ${days === 1 ? 'dag' : 'dager'}`);
        const searching = T(`${n} ${n === 1 ? 'Headhunter sucht' : 'Headhunter suchen'}`, `${n} ${n === 1 ? 'headhunter searching' : 'headhunters searching'}`, `${n} ${n === 1 ? 'headhunter söker' : 'headhunters söker'}`, `${n} ${n === 1 ? 'headhunter søker' : 'headhuntere søker'}`);
        wait({ key: `research:${pl.id}`, by: 'recruiter', title: replaceTitle(job.title ?? ''),
          detail: paused ? T('ruht gerade', 'currently paused', 'vilar just nu', 'står på pause nå') : `${running} · ${searching}` });
      }
      // Angebot einer Nachbesetzung bei Core (J2): das Wort „Joker“ sieht der Kunde nie
      if (offerRow && offerRow.decision === 'offer' && offerRow.status === 'open' && (!offerRow.valid_until || String(offerRow.valid_until) >= berlinDateKey(now))) {
        const price = euroCents(Number(offerRow.price_cents ?? 0));
        const valid = dateDe(offerRow.valid_until);
        push({ key: `research-offer:${offerRow.id}`, kind: 'research_offer', since: offerRow.decided_at ?? iso(now), urgent: false, waitingWho: null,
          title: T(m`${nm} hat nicht angefangen: unser Angebot`, m`${nm} did not start: our offer`, m`${nm} började inte: vårt erbjudande`, m`${nm} begynte ikke: vårt tilbud`),
          detail: T(`Nachbesetzung für einmalig ${price} netto · gültig bis ${valid}`, `Replacement for a one-off ${price} net · valid until ${valid}`, `Ersättning för engångsbelopp ${price} netto · giltigt till ${valid}`, `Erstatning for engangsbeløp ${price} netto · gyldig til ${valid}`),
          ref: { placementId: pl.id, researchOfferId: offerRow.id },
          context: ctxOf({
            ask: T('Wir bieten Ihnen eine Nachbesetzung an', 'We are offering you a replacement', 'Vi erbjuder dig en ersättningsrekrytering', 'Vi tilbyr deg en erstatningsrekruttering'),
            facts: [
              ...fact(T('Preis', 'Price', 'Pris', 'Pris'), T(`${price} netto, einmalig`, `${price} net, one-off`, `${price} netto, engångsbelopp`, `${price} netto, engangsbeløp`), null, 'price'),
              ...fact(T('Angebot gültig bis', 'Offer valid until', 'Erbjudandet gäller till', 'Tilbudet gjelder til'), offerRow.valid_until ? valid : null, null, 'valid_until'),
            ],
            line: [T(`einmalig ${price} netto`, `one-off ${price} net`, `engångsbelopp ${price} netto`, `engangsbeløp ${price} netto`), offerRow.valid_until ? T(`gültig bis ${valid}`, `valid until ${valid}`, `giltigt till ${valid}`, `gyldig til ${valid}`) : null].filter(Boolean) as string[],
            why: T(`Wir schreiben die Stelle neu für alle Headhunter aus, bis sie besetzt ist. Sie zahlen dafür einmalig ${price} netto, kein neues Honorar.`, `We re-advertise the role to all headhunters until it is filled. You pay a one-off ${price} net for this, no new fee.`, `Vi annonserar ut tjänsten på nytt till alla headhunters tills den är tillsatt. Du betalar ett engångsbelopp på ${price} netto, inget nytt arvode.`, `Vi lyser ut stillingen på nytt for alle headhuntere til den er besatt. Du betaler et engangsbeløp på ${price} netto, ikke noe nytt honorar.`),
          }) });
      }

      // Bestellnummer für die Rechnung (K1, K8): nur, solange die Rechnung noch nicht gestellt ist.
      // Fehlt sie nach 7 Tagen, stellt Matchunt die Rechnung mit „Bestellnummer folgt“.
      const released = input.invoices.some((i: any) => i.placement_id === pl.id && i.status !== 'draft');
      if ((input.poRequiredJobs ?? []).includes(s.job_id) && !pl.purchase_order && !endKind && !released) {
        const createdMs = t(pl.created_at);
        const fee = pl.client_fee_cents != null && Number(pl.client_fee_cents) > 0 ? euroCents(Number(pl.client_fee_cents)) : null;
        const costCenter = pl.cost_center ?? input.defaultCostCenter?.[s.job_id] ?? null;
        const title = T(m`Bestellnummer für ${who}`, m`Purchase order number for ${who}`, m`Inköpsordernummer för ${who}`, m`Innkjøpsordrenummer for ${who}`);
        const needs = T('Ihre Buchhaltung braucht sie auf der Rechnung', 'Your accounts team needs it on the invoice', 'Din ekonomiavdelning behöver det på fakturan', 'Regnskapet ditt trenger det på fakturaen');
        const only = T('nur, weil sie bei Ihnen Pflicht ist', 'only because it is mandatory for you', 'bara för att det är obligatoriskt hos er', 'bare fordi det er påkrevd hos dere');
        push({ key: `po:${pl.id}`, kind: 'purchase_order', since: iso(createdMs || now), urgent: false, waitingWho: null,
          title, detail: `${needs} · ${only}`, ref: { placementId: pl.id },
          context: ctxOf({
            ask: title,
            facts: [
              ...fact(T('Honorar', 'Fee', 'Arvode', 'Honorar'), fee ? T(`${fee} netto`, `${fee} net`, `${fee} netto`, `${fee} netto`) : null, null, 'fee'),
              ...fact(T('Kostenstelle', 'Cost centre', 'Kostnadsställe', 'Kostnadssted'), costCenter ?? T('keine hinterlegt', 'none on file', 'inget angivet', 'ikke registrert'), null, 'cost_center'),
            ],
            line: [needs, only],
            foot: T('Fehlt sie nach 7 Tagen, stellen wir die Rechnung mit „Bestellnummer folgt“. Die Pflicht ändern Sie unter Rechnungen › Rechnungsdaten.', 'If it is still missing after 7 days, we issue the invoice with “PO number to follow”. You can change the requirement under Invoices › Billing details.', 'Saknas det efter 7 dagar skickar vi fakturan med ”Inköpsordernummer följer”. Kravet ändrar du under Fakturor › Faktureringsuppgifter.', 'Mangler det etter 7 dager, sender vi fakturaen med «Innkjøpsordrenummer følger». Kravet endrer du under Fakturaer › Fakturaopplysninger.'),
          }) });
      }
      continue;
    }
    if (CLOSED.includes(String(s.stage ?? '')) || CLOSED.includes(String(s.status ?? ''))) continue;
    if (job.status && !['published', 'active', 'paused'].includes(job.status)) continue;

    // ---------------------------------------------------------------- Vertrag
    const c = contractBySub.get(s.id);
    const salaryText = (cc: any, variableWord: boolean) => `${euro(cc.salary)}${cc.variable_salary ? ` + ${euro(cc.variable_salary)}${variableWord ? T(' variabel', ' variable', ' rörligt', ' variabel') : ''}` : ''}`;
    const startIn = (start: string) => `${dateDe(start)} · ${inDays(daysTo(start, now))}`;
    // Vertragsdaten aus der Zusage (Fenster „Arbeitsvertrag schicken“)
    const contractCtx = (cc: any, declined: boolean) => {
      const start = cc.start_date ?? accepted?.start_date ?? null;
      const probation = accepted?.probation_months;
      const fixedTerm = cc.fixed_term ?? (accepted?.contract_type === 'fixed_term');
      const later: TaskChip = { text: T('im Vertrag festlegen', 'set in the contract', 'fastställ i avtalet', 'fastsett i kontrakten'), tone: 'warn' };
      const immediate = IMMEDIATE.includes(String(cand?.notice_period ?? '').trim());
      const notice = noticeLabel(cand?.notice_period, lang);
      const notInOffer = T('nicht im Angebot', 'not in the offer', 'inte med i erbjudandet', 'ikke med i tilbudet');
      return ctxOf({
        ask: declined ? T(m`Arbeitsvertrag für ${nameAkk} neu schicken`, m`Resend the employment contract for ${nameAkk}`, m`Skicka anställningsavtalet för ${nameAkk} igen`, m`Send arbeidskontrakten for ${nameAkk} på nytt`)
          : T(m`Arbeitsvertrag für ${nameAkk} schicken`, m`Send the employment contract for ${nameAkk}`, m`Skicka anställningsavtalet för ${nameAkk}`, m`Send arbeidskontrakten for ${nameAkk}`),
        facts: [
          ...fact(START, start ? startIn(start) : null, null, 'start'),
          ...fact(T('Gehalt', 'Salary', 'Lön', 'Lønn'), cc.salary ? salaryText(cc, true) : null, null, 'salary'),
          { key: 'contract', label: T('Vertrag', 'Contract', 'Avtal', 'Kontrakt'), value: fixedTerm ? T('befristet', 'fixed-term', 'visstid', 'midlertidig') : T('unbefristet', 'permanent', 'tillsvidare', 'fast') },
          { key: 'probation', label: T('Probezeit', 'Probation', 'Provanställning', 'Prøvetid'), value: probation == null ? notInOffer : probation ? T(`${probation} Monate`, `${probation} months`, `${probation} månader`, `${probation} måneder`) : T('ohne Probezeit', 'no probation', 'ingen provanställning', 'ingen prøvetid'), chip: probation == null ? later : null },
          { key: 'work_model', label: T('Arbeitsmodell', 'Work model', 'Arbetsmodell', 'Arbeidsmodell'), value: accepted?.work_model || notInOffer, chip: accepted?.work_model ? null : later },
          ...fact(T('Extras', 'Extras', 'Förmåner', 'Goder'), Array.isArray(accepted?.extras) && accepted.extras.length ? accepted.extras.join(', ') : null, null, 'extras'),
          ...fact(T('Kündigungsfrist', 'Notice period', 'Uppsägningstid', 'Oppsigelsestid'), notice && !immediate ? T(`${notice} laut Profil`, `${notice} per profile`, `${notice} enligt profilen`, `${notice} ifølge profilen`) : null, null, 'notice'),
        ],
        line: [cc.salary ? salaryText(cc, false) : null, start ? `${START} ${startIn(start)}` : null].filter(Boolean) as string[],
        quote: declined && cc.decline_reason ? { by: 'DocuSign', text: clip(cc.decline_reason) } : null,
        why: accepted?.decision_at ? T(m`${name} hat am ${short(accepted.decision_at)} zugesagt · ${hhFirst} hält Kontakt`, m`${name} accepted on ${short(accepted.decision_at)} · ${hhFirst} stays in touch`, m`${name} tackade ja ${short(accepted.decision_at)} · ${hhFirst} håller kontakten`, m`${name} takket ja ${short(accepted.decision_at)} · ${hhFirst} holder kontakten`)
          : T(m`${hhFirst} hält Kontakt zu ${nameDat}`, m`${hhFirst} stays in touch with ${nameDat}`, m`${hhFirst} håller kontakten med ${nameDat}`, m`${hhFirst} holder kontakten med ${nameDat}`),
        foot: fixedTerm || cc.non_compete ? T('Befristung oder Wettbewerbsverbot: bitte auf Papier unterschreiben lassen (Schriftform).', 'Fixed term or non-compete: please have it signed on paper (written form required).', 'Visstid eller konkurrensklausul: låt avtalet skrivas under på papper.', 'Midlertidig ansettelse eller konkurranseklausul: la kontrakten signeres på papir.') : null,
      });
    };
    const linkSent = (l: any) => `${T('Link verschickt', 'Link sent', 'Länk skickad', 'Lenke sendt')} ${short(l.sent_at)} · ${l.opened_at ? `${T('geöffnet', 'opened', 'öppnad', 'åpnet')} ${short(l.opened_at)}` : T('noch nicht geöffnet', 'not opened yet', 'inte öppnad än', 'ikke åpnet ennå')}`;
    const thenCandidate = T(m`danach ${nameIn} (Link per Mail von Matchunt)`, m`then ${nameIn} (link by email from Matchunt)`, m`sedan ${nameIn} (länk via e-post från Matchunt)`, m`deretter ${nameIn} (lenke på e-post fra Matchunt)`);
    const uploaded = (at: string | null) => `${at ? `${when(at)} · ` : ''}${T('Vertrag hochgeladen', 'Contract uploaded', 'Avtal uppladdat', 'Kontrakt lastet opp')}`;
    if (c && c.status === 'declined') {
      // DocuSign abgelehnt: neu schicken (digital oder selbst)
      push({ key: `contract-send:${c.id}:declined`, kind: 'send_contract', since: c.updated_at ?? c.created_at, urgent: true, waitingWho: name,
        title: T('Arbeitsvertrag neu schicken', 'Resend the employment contract', 'Skicka anställningsavtalet igen', 'Send arbeidskontrakten på nytt'), detail: T('Der Umschlag in DocuSign wurde abgelehnt', 'The DocuSign envelope was declined', 'Kuvertet i DocuSign avböjdes', 'Konvolutten i DocuSign ble avvist'), ref: { contractId: c.id }, context: contractCtx(c, true) });
      continue;
    }
    if (c && !['final', 'declined', 'dropped', 'voided'].includes(c.status)) {
      if (['preparing', 'sent_self'].includes(c.status) && c.candidate_status === 'missing') {
        // Kandidat sagt „Noch nicht da“ (29.10.2026): erneut schicken, selbst oder über Matchunt
        const sentOn = c.sent_at ? short(c.sent_at) : '';
        push({ key: `contract-missing:${c.id}:${c.candidate_status_at ?? ''}`, kind: 'send_contract', since: c.candidate_status_at ?? c.updated_at, urgent: true, waitingWho: name,
          title: T(m`${name} hat den Arbeitsvertrag noch nicht`, m`${name} does not have the employment contract yet`, m`${name} har inte fått anställningsavtalet än`, m`${name} har ikke fått arbeidskontrakten ennå`),
          detail: c.status === 'sent_self' && c.sent_at ? T(`Laut Ihrer Angabe verschickt am ${sentOn} · bitte erneut schicken`, `Sent on ${sentOn} according to you · please send it again`, `Skickat ${sentOn} enligt dig · skicka igen`, `Sendt ${sentOn} ifølge deg · send på nytt`) : T('Bitte jetzt schicken', 'Please send it now', 'Skicka nu', 'Send nå'),
          ref: { contractId: c.id }, context: contractCtx(c, false) });
      } else if (c.status === 'preparing') {
        push({ key: `contract-send:${c.id}`, kind: 'send_contract', since: c.created_at, urgent: true, waitingWho: name,
          title: T('Arbeitsvertrag schicken', 'Send the employment contract', 'Skicka anställningsavtalet', 'Send arbeidskontrakten'), detail: `${T('Zusage', 'Accepted', 'Ja-besked', 'Ja-svar')}${c.salary ? `: ${salaryText(c, false)}` : ''}${c.start_date ? ` · ${START} ${dateDe(c.start_date)}` : ''}`, ref: { contractId: c.id },
          context: contractCtx(c, false) });
      } else if (c.status === 'sent_self') {
        const sent = t(c.sent_at) || t(c.updated_at);
        const sentOn = short(iso(sent));
        if (now - sent >= 7 * DAY) {
          // „Noch nicht“ gilt eine Woche: danach neue Woche, neue Frage
          const start = c.start_date ?? accepted?.start_date ?? null;
          const ago = Math.floor((now - sent) / DAY);
          const ask = T(m`Hat ${nameIn} den Vertrag unterschrieben?`, m`Has ${nameIn} signed the contract?`, m`Har ${nameIn} skrivit under avtalet?`, m`Har ${nameIn} signert kontrakten?`);
          push({ key: `contract-check:${c.id}:${Math.floor((now - sent - 7 * DAY) / (7 * DAY))}`, kind: 'contract_signed_check', since: iso(sent + 7 * DAY), urgent: false, waitingWho: null,
            title: ask, detail: T(`Von Ihnen verschickt am ${sentOn}`, `Sent by you on ${sentOn}`, `Skickat av dig ${sentOn}`, `Sendt av deg ${sentOn}`), ref: { contractId: c.id },
            context: ctxOf({
              ask,
              facts: [
                ...fact(T('Verschickt', 'Sent', 'Skickat', 'Sendt'), `${sentOn} · ${inDays(-ago)}`, null, 'sent'),
                ...fact(START, start ? startIn(start) : null, null, 'start'),
                ...fact(T('Gehalt', 'Salary', 'Lön', 'Lønn'), c.salary ? salaryText(c, false) : null, null, 'salary'),
              ],
              line: [T(`verschickt vor ${ago} Tagen`, `sent ${ago} days ago`, `skickat för ${ago} dagar sedan`, `sendt for ${ago} dager siden`), start ? `${START} ${inDays(daysTo(start, now))}` : null].filter(Boolean) as string[],
              why: T(m`${hhFirst} hält Kontakt zu ${nameDat}.`, m`${hhFirst} stays in touch with ${nameDat}.`, m`${hhFirst} håller kontakten med ${nameDat}.`, m`${hhFirst} holder kontakten med ${nameDat}.`),
            }) });
        } else {
          const arrived = c.candidate_status === 'arrived' ? T(m` · angekommen laut ${name}`, m` · arrived according to ${name}`, m` · har kommit fram enligt ${name}`, m` · kommet frem ifølge ${name}`) : '';
          wait({ key: `contract-self:${c.id}`, by: 'candidate', title: T(m`Vertrag liegt bei ${name}`, m`Contract is with ${nameIn}`, m`Avtalet ligger hos ${nameIn}`, m`Kontrakten ligger hos ${nameIn}`),
            detail: `${T(`verschickt am ${sentOn}`, `sent on ${sentOn}`, `skickat ${sentOn}`, `sendt ${sentOn}`)}${arrived} · ${T('melden Sie die Unterschrift, sobald sie da ist', 'report the signature as soon as you have it', 'meddela underskriften så snart den finns', 'meld signaturen så snart den er der')}` });
        }
      } else if (c.status === 'sent_digital' && c.signing_mode === 'embedded' && !c.company_signed_at && c.company_signer_user_id !== input.userId) {
        // Über Matchunt, und jemand anderes unterschreibt für die Firma: läuft bei ihr bzw. ihm
        const l = (input.signLinks ?? []).filter((x: any) => x.contract_id === c.id && x.signer_role === 'company').sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
        const linkState = l ? linkSent(l) : T('Link per Mail', 'Link by email', 'Länk via e-post', 'Lenke på e-post');
        const signer = c.company_signer_name ?? T('Ihr Unterzeichner', 'Your signatory', 'Din undertecknare', 'Din signatar');
        const notYet = T(m`${signer} hat noch nicht unterschrieben`, m`${signer} has not signed yet`, m`${signer} har inte skrivit under än`, m`${signer} har ikke signert ennå`);
        const forCompany = T(m`${signer} unterschreibt für die Firma`, m`${signer} signs for the company`, m`${signer} skriver under för företaget`, m`${signer} signerer for firmaet`);
        if (!c.company_signer_user_id && now - (t(c.sent_at) || now) >= 2 * DAY) {
          // 2 Tage ohne Unterschrift der Firma: wird zur Aufgabe des Kunden
          push({ key: `sign-company-late:${c.id}`, kind: 'docusign_sign', since: iso(t(c.sent_at) + 2 * DAY), urgent: true, waitingWho: name,
            title: notYet, detail: linkState, ref: { contractId: c.id, signMode: 'embedded', signerExternal: true },
            context: ctxOf({
              ask: notYet,
              timeline: [
                { text: uploaded(c.sent_at), state: 'done' },
                { text: `${forCompany} · ${linkState}`, state: 'now' },
                { text: thenCandidate, state: 'next' },
              ],
              line: [linkState],
              foot: T('Mail nicht angekommen? Link erneut senden oder eine andere Person unterschreiben lassen, auch Sie selbst.', 'Email not received? Resend the link or let someone else sign, including yourself.', 'Har mejlet inte kommit fram? Skicka länken igen eller låt någon annan skriva under, även du själv.', 'Har ikke e-posten kommet frem? Send lenken på nytt eller la en annen signere, også deg selv.'),
            }) });
        } else {
          wait({ key: `sign-company:${c.id}`, by: 'date', title: forCompany, detail: c.company_signer_user_id ? T('in Matchunt', 'in Matchunt', 'i Matchunt', 'i Matchunt') : linkState });
        }
      } else if (c.status === 'sent_digital') {
        if (!c.company_signed_at) {
          const viaMatchunt = c.signing_mode === 'embedded';
          const signerName = c.company_signer_name ?? T('Ihr Unterzeichner', 'Your signatory', 'Din undertecknare', 'Din signatar');
          const mailPart = c.company_signer_email ? ` (${c.company_signer_email})` : '';
          const youFirst = T('Sie unterschreiben zuerst', 'You sign first', 'Du skriver under först', 'Du signerer først');
          push({ key: `docusign:${c.id}`, kind: 'docusign_sign', since: c.sent_at ?? c.updated_at, urgent: true, waitingWho: name,
            title: viaMatchunt ? T('Arbeitsvertrag unterschreiben', 'Sign the employment contract', 'Skriv under anställningsavtalet', 'Signer arbeidskontrakten') : T('In DocuSign unterschreiben', 'Sign in DocuSign', 'Skriv under i DocuSign', 'Signer i DocuSign'),
            detail: viaMatchunt ? T(m`Sie unterschreiben zuerst, hier in Matchunt; danach ${nameIn}`, m`You sign first, here in Matchunt; then ${nameIn}`, m`Du skriver under först, här i Matchunt; sedan ${nameIn}`, m`Du signerer først, her i Matchunt; deretter ${nameIn}`)
              : T(m`${signerName} unterschreibt zuerst${mailPart}, danach ${nameIn}`, m`${signerName} signs first${mailPart}, then ${nameIn}`, m`${signerName} skriver under först${mailPart}, sedan ${nameIn}`, m`${signerName} signerer først${mailPart}, deretter ${nameIn}`),
            ref: { contractId: c.id, signMode: viaMatchunt ? 'embedded' : 'email' },
            context: viaMatchunt ? ctxOf({
              ask: youFirst,
              timeline: [
                { text: uploaded(c.sent_at), state: 'done' },
                { text: T('Ihre Unterschrift, hier in Matchunt', 'Your signature, here in Matchunt', 'Din underskrift, här i Matchunt', 'Din signatur, her i Matchunt'), state: 'now' },
                { text: thenCandidate, state: 'next' },
              ],
              line: [T('Sie zuerst, in Matchunt', 'You first, in Matchunt', 'Du först, i Matchunt', 'Du først, i Matchunt'), c.sent_at ? `${T('hochgeladen', 'uploaded', 'uppladdat', 'lastet opp')} ${short(c.sent_at)}` : null].filter(Boolean) as string[],
            }) : ctxOf({
              ask: youFirst,
              timeline: [
                { text: `${c.sent_at ? `${when(c.sent_at)} · ` : ''}${T('an DocuSign übergeben', 'handed over to DocuSign', 'överlämnat till DocuSign', 'overlevert til DocuSign')}`, state: 'done' },
                { text: `${T(m`Unterschrift ${c.company_signer_name ?? 'Ihres Unterzeichners'}`, m`Signature of ${c.company_signer_name ?? 'your signatory'}`, m`Underskrift av ${c.company_signer_name ?? 'din undertecknare'}`, m`Signatur fra ${c.company_signer_name ?? 'din signatar'}`)}${c.company_signer_email ? T(m` · DocuSign-Mail an ${c.company_signer_email}`, m` · DocuSign email to ${c.company_signer_email}`, m` · DocuSign-mejl till ${c.company_signer_email}`, m` · DocuSign-e-post til ${c.company_signer_email}`) : ''}`, state: 'now' },
                { text: `${T(m`danach ${nameIn}`, m`then ${nameIn}`, m`sedan ${nameIn}`, m`deretter ${nameIn}`)}${unlocked && c.candidate_email ? ` (${c.candidate_email})` : ''}`, state: 'next' },
              ],
              line: [T(m`${signerName} zuerst`, m`${signerName} first`, m`${signerName} först`, m`${signerName} først`), c.sent_at ? `${T('verschickt', 'sent', 'skickat', 'sendt')} ${short(c.sent_at)}` : null].filter(Boolean) as string[],
              foot: T('Mail nicht gefunden? „Anderer Unterzeichner“ stellt auf die Unterschrift über Matchunt um, ohne neues Hochladen.', 'Can’t find the email? “Other signatory” switches to signing via Matchunt, without uploading again.', 'Hittar du inte mejlet? ”Annan undertecknare” byter till underskrift via Matchunt, utan ny uppladdning.', 'Finner du ikke e-posten? «Annen signatar» bytter til signering via Matchunt, uten ny opplasting.'),
            }) });
        } else {
          wait({ key: `docusign-cand:${c.id}`, by: 'candidate', title: T(m`${name} unterschreibt in DocuSign`, m`${name} is signing in DocuSign`, m`${name} skriver under i DocuSign`, m`${name} signerer i DocuSign`), detail: T(`Ihre Unterschrift ist da (${short(c.company_signed_at)})`, `Your signature is in (${short(c.company_signed_at)})`, `Din underskrift finns (${short(c.company_signed_at)})`, `Signaturen din er på plass (${short(c.company_signed_at)})`) });
        }
      } else if (c.status === 'company_signed' && c.signing_mode === 'embedded') {
        const l = (input.signLinks ?? []).filter((x: any) => x.contract_id === c.id && x.signer_role === 'candidate').sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
        wait({ key: `docusign-cand:${c.id}`, by: 'candidate', title: T(m`${name} unterschreibt`, m`${name} is signing`, m`${name} skriver under`, m`${name} signerer`), detail: l ? linkSent(l) : T('Link per Mail von Matchunt', 'Link by email from Matchunt', 'Länk via e-post från Matchunt', 'Lenke på e-post fra Matchunt') });
      } else if (c.status === 'reported') {
        const reporterName = c.reported_role === 'admin' ? 'Matchunt' : c.reported_role === 'candidate' ? name : hhFirst;
        const terms = `${c.salary ? ` · ${salaryText(c, false)}` : ''}${c.start_date ? ` · ${START} ${dateDe(c.start_date)}` : ''}`;
        const signedOn = dateDe(c.signed_on);
        push({ key: `confirm:${c.id}`, kind: 'confirm_signature', since: c.reported_at ?? c.updated_at, urgent: true, waitingWho: c.reported_role === 'candidate' ? name : hh,
          title: T('Unterschrift bestätigen', 'Confirm signature', 'Bekräfta underskrift', 'Bekreft signatur'),
          detail: `${T(m`${reporterName} meldet: unterschrieben am ${signedOn}`, m`${reporterName} reports: signed on ${signedOn}`, m`${reporterName} meddelar: underskrivet ${signedOn}`, m`${reporterName} melder: signert ${signedOn}`)}${terms}`, ref: { contractId: c.id },
          context: (() => {
            const by = c.reported_role === 'admin' ? 'Matchunt' : c.reported_role === 'candidate' ? name : hh;
            const row = (key: string, label: string, a: unknown, b: unknown, fmt: (v: any) => string) => {
              const x = a == null || a === '' ? '–' : fmt(a), y = b == null || b === '' ? '–' : fmt(b);
              return { key, label, cells: [x, y], changed: x !== '–' && y !== '–' && x !== y };
            };
            const rows = [
              { key: 'signed', label: T('Unterschrieben', 'Signed', 'Underskrivet', 'Signert'), cells: [signedOn || '–', '–'], changed: false },
              row('salary', T('Fixgehalt', 'Base salary', 'Fast lön', 'Fastlønn'), c.salary, accepted?.salary_offered, euro),
              row('variable', T('Variabel', 'Variable', 'Rörlig', 'Variabel'), c.variable_salary, accepted?.variable_salary, euro),
              row('start', START, c.start_date, accepted?.start_date, dateDe),
            ];
            const off = rows.filter((r) => r.changed).length;
            const reportedBy = by === 'Matchunt' ? 'Matchunt' : hhFirst;
            return ctxOf({
              ask: c.reported_role === 'candidate' ? T(m`Stimmt das? ${name} meldet die Unterschrift selbst`, m`Is this right? ${name} is reporting the signature themselves`, m`Stämmer det? ${name} meddelar underskriften själv`, m`Stemmer det? ${name} melder signaturen selv`)
                : T(m`Stimmt das? ${reportedBy} meldet die Unterschrift`, m`Is this right? ${reportedBy} is reporting the signature`, m`Stämmer det? ${reportedBy} meddelar underskriften`, m`Stemmer det? ${reportedBy} melder signaturen`),
              compare: { heads: [T('Gemeldet', 'Reported', 'Anmält', 'Meldt'), T('Zusage', 'Accepted offer', 'Accepterat erbjudande', 'Akseptert tilbud')], rows },
              line: [T(m`gemeldet von ${by}`, m`reported by ${by}`, m`anmält av ${by}`, m`meldt av ${by}`),
                off ? T(`${off} ${off === 1 ? 'Wert weicht' : 'Werte weichen'} von der Zusage ab`, `${off} ${off === 1 ? 'value differs' : 'values differ'} from the accepted offer`, `${off} ${off === 1 ? 'värde avviker' : 'värden avviker'} från erbjudandet`, `${off} ${off === 1 ? 'verdi avviker' : 'verdier avviker'} fra tilbudet`)
                  : T('wie zugesagt', 'as agreed', 'som överenskommet', 'som avtalt')],
              chip: off ? { text: T('weicht ab', 'differs', 'avviker', 'avviker'), tone: 'warn' } : null,
              quote: c.report_note ? { by, text: clip(c.report_note) } : null,
              foot: T('Mit „Stimmt“ wird die Einstellung verbindlich und die Rechnung vorbereitet.', '“Correct” makes the hire binding and prepares the invoice.', '”Stämmer” gör anställningen bindande och förbereder fakturan.', '«Stemmer» gjør ansettelsen bindende og forbereder fakturaen.'),
            });
          })() });
      } else if (c.status === 'signed') {
        wait({ key: `contract-undo:${c.id}`, by: 'date', title: T('Unterschrift gemeldet', 'Signature reported', 'Underskrift anmäld', 'Signatur meldt'),
          detail: c.undo_until ? T(`verbindlich ab ${when(c.undo_until)} · bis dahin rücknehmbar`, `binding from ${when(c.undo_until)} · can be undone until then`, `bindande från ${when(c.undo_until)} · kan ångras fram till dess`, `bindende fra ${when(c.undo_until)} · kan angres frem til da`) : T('wird verbindlich', 'becoming binding', 'blir bindande', 'blir bindende') });
      } else if (c.status === 'company_signed') {
        wait({ key: `docusign-cand:${c.id}`, by: 'candidate', title: T(m`${name} unterschreibt`, m`${name} is signing`, m`${name} skriver under`, m`${name} signerer`), detail: T('Ihre Unterschrift ist da', 'Your signature is in', 'Din underskrift finns', 'Signaturen din er på plass') });
      }
      continue;
    }

    // ---------------------------------------------------------------- Angebot
    const offers = (offersBySub.get(s.id) ?? []).slice().sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
    const offer = offers.find((o: any) => OPEN_OFFER.includes(o.status)) ?? null;
    if (offer && offer.status === 'accept_reported') {
      wait({ key: `offer-confirm:${offer.id}`, by: 'candidate', title: T(m`${hhFirst} meldet eine Zusage`, m`${hhFirst} reports an acceptance`, m`${hhFirst} meddelar ett ja`, m`${hhFirst} melder et ja`), detail: T(m`${name} bestätigt gerade per Mail`, m`${name} is confirming by email`, m`${name} bekräftar via e-post`, m`${name} bekrefter på e-post`) });
      continue;
    }
    if (offer) {
      const due = offer.status === 'considering' ? (offer.candidate_response?.until ?? offer.response_due) : offer.response_due;
      const dueMs = due ? Date.parse(`${String(due).slice(0, 10)}T23:59:59Z`) : NaN;
      if (offer.status === 'countered') {
        const wish = offer.candidate_response?.wish ?? {};
        const parts = [wish.salary ? T(`${euro(wish.salary)} fix`, `${euro(wish.salary)} base`, `${euro(wish.salary)} fast`, `${euro(wish.salary)} fast`) : null, wish.variable ? T(`${euro(wish.variable)} variabel`, `${euro(wish.variable)} variable`, `${euro(wish.variable)} rörligt`, `${euro(wish.variable)} variabel`) : null, wish.startDate ? `${START} ${dateDe(wish.startDate)}` : null, wish.other ?? null].filter(Boolean);
        const cell = (v: unknown, fmt: (x: any) => string) => (v == null || v === '' ? '–' : fmt(v));
        const rows = [
          { key: 'salary', label: T('Fixgehalt', 'Base salary', 'Fast lön', 'Fastlønn'), cells: [cell(offer.salary_offered, euro), cell(wish.salary ?? offer.salary_offered, euro), jobRange(job, lang) ?? '–'], changed: !!wish.salary && wish.salary !== offer.salary_offered },
          { key: 'variable', label: T('Variabel', 'Variable', 'Rörlig', 'Variabel'), cells: [cell(offer.variable_salary, euro), cell(wish.variable ?? offer.variable_salary, euro), '–'], changed: wish.variable != null && wish.variable !== offer.variable_salary },
          { key: 'start', label: START, cells: [cell(offer.start_date, dateDe), cell(wish.startDate ?? offer.start_date, dateDe), '–'], changed: !!wish.startDate && wish.startDate !== offer.start_date },
          ...(offer.work_model ? [{ key: 'work_model', label: T('Arbeitsmodell', 'Work model', 'Arbetsmodell', 'Arbeidsmodell'), cells: [String(offer.work_model), String(offer.work_model), '–'], changed: false }] : []),
          ...(wish.other ? [{ key: 'other', label: T('Sonstiges', 'Other', 'Övrigt', 'Annet'), cells: ['–', String(wish.other), '–'], changed: true }] : []),
        ];
        const feeNow = fee(Number(offer.salary_offered ?? 0) + Number(offer.variable_salary ?? 0));
        const feeWish = fee(Number(wish.salary ?? offer.salary_offered ?? 0) + Number(wish.variable ?? offer.variable_salary ?? 0));
        const reason = offer.candidate_response?.reason ?? offer.candidate_response?.note ?? null;
        const wishes = parts.join(' · ') || T('Änderungen', 'changes', 'ändringar', 'endringer');
        push({ key: `counter:${offer.id}`, kind: 'counter', since: offer.counter_offer_at ?? offer.updated_at, urgent: true, waitingWho: name,
          title: T('Gegenwunsch beantworten', 'Respond to the counter-request', 'Svara på motförslaget', 'Svar på motforslaget'), detail: T(m`${name} wünscht ${wishes}`, m`${name} would like ${wishes}`, m`${name} önskar ${wishes}`, m`${name} ønsker ${wishes}`), ref: { offerId: offer.id },
          context: ctxOf({
            ask: T(m`${name} hat einen Gegenwunsch`, m`${name} has a counter-request`, m`${name} har ett motförslag`, m`${name} har et motforslag`),
            compare: { heads: [T('Ihr Angebot', 'Your offer', 'Ditt erbjudande', 'Ditt tilbud'), unlocked && cand?.full_name ? T(m`${genitive(name)} Wunsch`, m`${genitive(name)} request`, m`${genitive(name)} önskemål`, m`${genitive(name)} ønske`) : T('Wunsch', 'Request', 'Önskemål', 'Ønske'), T('Rahmen Stelle', 'Role range', 'Ram för tjänsten', 'Ramme for stillingen')], rows },
            line: [wish.salary ? T(`Wunsch ${euro(wish.salary)} statt ${euro(offer.salary_offered)}`, `requests ${euro(wish.salary)} instead of ${euro(offer.salary_offered)}`, `önskar ${euro(wish.salary)} i stället för ${euro(offer.salary_offered)}`, `ønsker ${euro(wish.salary)} i stedet for ${euro(offer.salary_offered)}`) : null,
              wish.startDate ? T(`Start ${dateDe(wish.startDate)} statt ${dateDe(offer.start_date)}`, `start ${dateDe(wish.startDate)} instead of ${dateDe(offer.start_date)}`, `start ${dateDe(wish.startDate)} i stället för ${dateDe(offer.start_date)}`, `oppstart ${dateDe(wish.startDate)} i stedet for ${dateDe(offer.start_date)}`) : null, wish.other ? clip(wish.other, 60) : null].filter(Boolean) as string[],
            chip: wish.salary ? budgetChip({ lo: wish.salary, hi: wish.salary }, job, lang) : null,
            quote: reason ? { by: hh, text: clip(reason) } : null,
            why: feeNow && feeWish && feeWish !== feeNow ? T(`Honorar beim Wunsch: ${euro(feeWish)} statt ${euro(feeNow)} zzgl. USt. (${pct} % vom Zielgehalt)`, `Fee at the requested salary: ${euro(feeWish)} instead of ${euro(feeNow)} plus VAT (${pct} % of target salary)`, `Arvode vid önskemålet: ${euro(feeWish)} i stället för ${euro(feeNow)} plus moms (${pct} % av mållönen)`, `Honorar ved ønsket: ${euro(feeWish)} i stedet for ${euro(feeNow)} pluss MVA (${pct} % av mållønnen)`) : null,
          }) });
      } else if ((!Number.isNaN(dueMs) && dueMs < now) || offer.candidate_response?.extension_asked) {
        // Der Headhunter kann schon vor Fristende um mehr Zeit bitten (02.11.2026)
        const moreTime = offer.candidate_response?.extension_asked;
        const askTitle = moreTime ? T(m`${hhFirst} bittet um mehr Zeit für ${name}`, m`${hhFirst} asks for more time for ${nameIn}`, m`${hhFirst} ber om mer tid för ${nameIn}`, m`${hhFirst} ber om mer tid for ${nameIn}`) : T(m`${name} hat noch nicht geantwortet`, m`${name} has not replied yet`, m`${name} har inte svarat än`, m`${name} har ikke svart ennå`);
        const dueOn = dateDe(due);
        push({ key: `overdue:${offer.id}:${String(due).slice(0, 10)}`, kind: 'offer_overdue', since: moreTime?.at ?? iso(dueMs), urgent: false, waitingWho: moreTime ? hh : null,
          title: askTitle, detail: dueMs < now ? T(`Antwortfrist ${dueOn} ist vorbei`, `Reply deadline ${dueOn} has passed`, `Svarsfristen ${dueOn} har gått ut`, `Svarfristen ${dueOn} er utløpt`) : T(`Antwort bis ${dueOn}`, `Reply by ${dueOn}`, `Svar senast ${dueOn}`, `Svar innen ${dueOn}`), ref: { offerId: offer.id, responseDue: String(due).slice(0, 10) },
          context: ctxOf({
            ask: moreTime ? askTitle : T(m`${name} hat auf Ihr Angebot nicht geantwortet`, m`${name} has not replied to your offer`, m`${name} har inte svarat på ditt erbjudande`, m`${name} har ikke svart på tilbudet ditt`),
            facts: [
              ...fact(T('Angebot', 'Offer', 'Erbjudande', 'Tilbud'), offerTerms(offer, lang), null, 'offer'),
              ...fact(T('Verschickt', 'Sent', 'Skickat', 'Sendt'), offer.sent_at ? `${short(offer.sent_at)} · ${T('Version', 'version', 'version', 'versjon')} ${offer.version ?? 1}` : null, null, 'sent'),
              ...fact(T('Frist', 'Deadline', 'Svarsfrist', 'Frist'), `${dueOn} · ${inDays(daysTo(due, now))}`, null, 'deadline'),
              ...fact(T('Zuletzt', 'Latest', 'Senast', 'Sist'), offer.status === 'considering' ? T(m`${name} überlegt noch (laut ${hhFirst})`, m`${name} is still considering (according to ${hhFirst})`, m`${name} funderar fortfarande (enligt ${hhFirst})`, m`${name} tenker fortsatt (ifølge ${hhFirst})`) : T(m`${hhFirst} hat das Angebot überbracht`, m`${hhFirst} delivered the offer`, m`${hhFirst} har framfört erbjudandet`, m`${hhFirst} har overlevert tilbudet`), null, 'latest'),
            ],
            line: [offerTerms(offer, lang), T(`Frist war ${dueOn}`, `deadline was ${dueOn}`, `fristen var ${dueOn}`, `fristen var ${dueOn}`)],
            why: others(job.id, s.id).text,
          }) });
      } else {
        // Je Stand ein Satz, wie im Angebots-Fenster (OfferBox.offerStandLine)
        const mailDue = offer.candidate_mail_due_at ? Date.parse(offer.candidate_mail_due_at) : null;
        const mailDone = !!offer.candidate_mail_sent_at || (mailDue !== null && mailDue <= now);
        const talking = !!offer.callback_requested_at && !offer.callback_done_at;
        const mailAt = (ms: number) => (berlinDateKey(ms) === berlinDateKey(now) ? '' : `${short(iso(ms))}, `) + formatBerlinTime(iso(ms), lang);
        const title = talking ? T(m`${name} spricht gerade mit ${hhFirst}`, m`${name} is talking to ${hhFirst}`, m`${name} pratar just nu med ${hhFirst}`, m`${name} snakker med ${hhFirst} nå`)
          : mailDue !== null && !mailDone ? T(m`${hhFirst} ruft ${name} an, Mail an ${name} spätestens um ${mailAt(mailDue)}`, m`${hhFirst} is calling ${nameIn}, email to ${nameIn} at the latest at ${mailAt(mailDue)}`, m`${hhFirst} ringer ${nameIn}, mejl till ${nameIn} senast ${mailAt(mailDue)}`, m`${hhFirst} ringer ${nameIn}, e-post til ${nameIn} senest ${mailAt(mailDue)}`)
            : mailDone ? T(m`${name} hat das Angebot seit ${mailAt(Date.parse(offer.candidate_mail_sent_at ?? offer.candidate_mail_due_at))}`, m`${name} has had the offer since ${mailAt(Date.parse(offer.candidate_mail_sent_at ?? offer.candidate_mail_due_at))}`, m`${name} har haft erbjudandet sedan ${mailAt(Date.parse(offer.candidate_mail_sent_at ?? offer.candidate_mail_due_at))}`, m`${name} har hatt tilbudet siden ${mailAt(Date.parse(offer.candidate_mail_sent_at ?? offer.candidate_mail_due_at))}`)
              : T(m`${hhFirst} bespricht Ihr Angebot mit ${name}`, m`${hhFirst} is discussing your offer with ${nameIn}`, m`${hhFirst} går igenom ditt erbjudande med ${nameIn}`, m`${hhFirst} går gjennom tilbudet ditt med ${nameIn}`);
        wait({ key: `offer-wait:${offer.id}`, by: talking || (mailDue !== null && !mailDone) ? 'recruiter' : 'candidate', title, detail: due ? T(`Antwort bis ${dateDe(due)}`, `Reply by ${dateDe(due)}`, `Svar senast ${dateDe(due)}`, `Svar innen ${dateDe(due)}`) : T('Antwort folgt', 'Reply to follow', 'Svar kommer', 'Svar kommer') });
      }
      continue;
    }
    // Ein Angebot gab es schon (abgelehnt, zurückgezogen, ersetzt): keine neue „Angebot machen“-Aufgabe
    if (offers.length > 0) continue;

    // ---------------------------------------------------------------- Interviews
    const ivs = (ivBySub.get(s.id) ?? []).filter((i: any) => i.status !== 'superseded').sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
    const latest = ivs[0] ?? null;
    const meeting = T('Gespräch', 'Meeting', 'Samtal', 'Samtale');
    if (!latest) {
      // 1 Kandidat prüfen. F3 Stufe 1: über 5 Werktage (Rahmenvertrag § 7 Abs. 2) sagt die
      // Aufgabe selbst, wie lange sie wartet – keine zweite Aufgabe daneben.
      const sub = t(s.submitted_at);
      const waitedWd = workdaysSince(s.submitted_at, now);
      const late = waitedWd > REVIEW_WORKDAYS;
      if (late) lateReviews.push(waitedWd);
      const subOn = short(s.submitted_at);
      const waitedText = T(`wartet seit ${waitedWd} Werktagen`, `waiting for ${waitedWd} working days`, `väntar sedan ${waitedWd} arbetsdagar`, `har ventet i ${waitedWd} arbeidsdager`);
      push({ key: `review:${s.id}`, kind: 'review', since: s.submitted_at, urgent: now - sub > 2 * DAY, waitingWho: hh,
        title: T('Kandidat prüfen', 'Review candidate', 'Granska kandidat', 'Vurder kandidat'),
        detail: late ? T(`wartet seit ${waitedWd} Werktagen auf Ihre Rückmeldung`, `waiting ${waitedWd} working days for your feedback`, `har väntat ${waitedWd} arbetsdagar på din återkoppling`, `har ventet ${waitedWd} arbeidsdager på tilbakemeldingen din`)
          : T(m`eingereicht von ${hh} am ${subOn}`, m`submitted by ${hh} on ${subOn}`, m`inskickad av ${hh} ${subOn}`, m`sendt inn av ${hh} ${subOn}`), ref: {}, note: askNote,
        context: (() => {
          const pf = profile(s, cand, job);
          const o = others(job.id, s.id);
          const note = clip(s.recruiter_notes);
          const meet = unlocked && cand?.full_name ? first(cand.full_name) : who;
          return ctxOf({
            ask: T(m`Wollen Sie ${meet} kennenlernen?`, m`Would you like to meet ${meet}?`, m`Vill du träffa ${meet}?`, m`Vil du møte ${meet}?`),
            facts: [...fact(T('Eingereicht', 'Submitted', 'Inskickad', 'Sendt inn'), `${T(m`${subOn} von ${hh}`, m`${subOn} by ${hh}`, m`${subOn} av ${hh}`, m`${subOn} av ${hh}`)}${late ? ` · ${waitedText}` : ''}`, null, 'submitted'), ...pf.facts], line: pf.line, chip: pf.chip,
            quote: note ? { by: hh, text: note } : null,
            why: o.iv || o.off ? `${o.text} – ${T('andere sind schon weiter', 'others are further along', 'andra har kommit längre', 'andre har kommet lenger')}` : o.text,
            foot: late ? T('Die Headhunter brauchen Ihre Einschätzung, um gezielt weiterzusuchen.', 'The headhunters need your assessment to keep searching in the right direction.', 'Headhuntrarna behöver din bedömning för att kunna söka vidare målinriktat.', 'Headhunterne trenger vurderingen din for å søke videre målrettet.') : null,
          });
        })() });
      continue;
    }
    const meetingFacts = (withDuration: boolean) => [round(latest.round ?? 1), FORMAT(latest.meeting_format), withDuration ? `${latest.duration_minutes ?? 60} Min.` : null].filter(Boolean).join(' · ');
    if (latest.status === 'counter_proposed') {
      const want = slotStarts(latest.counter_slots)[0];
      const wanted = want ? when(iso(want)) : '';
      push({ key: `alt:${latest.id}`, kind: 'alternative', since: latest.updated_at ?? latest.created_at, urgent: true, waitingWho: name,
        title: T('Andere Zeit bestätigen', 'Confirm the other time', 'Bekräfta den andra tiden', 'Bekreft det andre tidspunktet'),
        detail: want ? T(m`${name} fragt ${wanted} an`, m`${name} is asking for ${wanted}`, m`${name} föreslår ${wanted}`, m`${name} foreslår ${wanted}`) : T(m`${name} fragt eine andere Zeit an`, m`${name} is asking for another time`, m`${name} föreslår en annan tid`, m`${name} foreslår et annet tidspunkt`), ref: { interviewId: latest.id },
        context: ctxOf({
          ask: want ? T(`Passt Ihnen ${wanted}?`, `Does ${wanted} work for you?`, `Passar ${wanted} dig?`, `Passer ${wanted} for deg?`) : T(m`${name} bittet um eine andere Zeit`, m`${name} asks for another time`, m`${name} ber om en annan tid`, m`${name} ber om et annet tidspunkt`),
          facts: [
            ...fact(T('Gewünscht', 'Requested', 'Önskad', 'Ønsket'), want ? formatBerlinRange(want, latest.duration_minutes ?? 60, lang) : null, null, 'requested'),
            ...fact(T('Ihre Vorschläge', 'Your suggestions', 'Dina förslag', 'Dine forslag'), slotStarts(latest.proposed_slots).slice(0, 3).map((x) => when(iso(x))).join(' · '), null, 'proposals'),
            ...fact(meeting, meetingFacts(true), null, 'meeting'),
          ],
          line: [want ? T(`wünscht ${wanted}`, `requests ${wanted}`, `önskar ${wanted}`, `ønsker ${wanted}`) : null, round(latest.round ?? 1), FORMAT(latest.meeting_format)].filter(Boolean) as string[],
          quote: latest.candidate_message ? { by: name, text: clip(latest.candidate_message) } : null,
        }) });
      continue;
    }
    if (latest.status === 'pending_response') {
      const askedOn = short(latest.created_at);
      if (requestExpired(latest, now)) {
        const lastSlot = Math.max(...slotStarts(latest.proposed_slots), t(latest.response_token_expires_at) || 0);
        const agoDays = Math.max(0, Math.floor((now - t(latest.created_at)) / DAY));
        push({ key: `expired:${latest.id}`, kind: 'expired_request', since: iso(Number.isFinite(lastSlot) && lastSlot > 0 ? Math.min(lastSlot, now) : now), urgent: false, waitingWho: null,
          title: T(m`${name} hat nicht geantwortet`, m`${name} did not reply`, m`${name} har inte svarat`, m`${name} har ikke svart`), detail: T(`Vorschläge vom ${askedOn} sind abgelaufen`, `Suggestions from ${askedOn} have expired`, `Förslagen från ${askedOn} har gått ut`, `Forslagene fra ${askedOn} er utløpt`), ref: { interviewId: latest.id },
          context: ctxOf({
            ask: T(m`${name} hat auf Ihre Terminvorschläge nicht reagiert`, m`${name} did not respond to your suggested times`, m`${name} har inte svarat på dina tidsförslag`, m`${name} har ikke svart på tidsforslagene dine`),
            facts: [
              ...fact(T('Angefragt', 'Requested', 'Förfrågan', 'Forespurt'), `${askedOn} · ${T(`vor ${agoDays} Tagen`, `${agoDays} days ago`, `för ${agoDays} dagar sedan`, `for ${agoDays} dager siden`)}`, null, 'requested'),
              ...fact(T('Vorschläge', 'Suggestions', 'Förslag', 'Forslag'), slotStarts(latest.proposed_slots).slice(0, 4).map((x) => when(iso(x))).join(' · '), null, 'proposals'),
              ...fact(meeting, meetingFacts(false), null, 'meeting'),
            ],
            line: [T(`angefragt ${askedOn}`, `requested ${askedOn}`, `förfrågan ${askedOn}`, `forespurt ${askedOn}`), round(latest.round ?? 1)],
            why: others(job.id, s.id).text,
            foot: T(m`${hhFirst} kann ${nameAkk} anrufen und nachfragen.`, m`${hhFirst} can call ${nameAkk} and follow up.`, m`${hhFirst} kan ringa ${nameAkk} och fråga.`, m`${hhFirst} kan ringe ${nameAkk} og høre.`),
          }) });
      } else {
        wait({ key: `iv-wait:${latest.id}`, by: 'candidate', title: T(m`${name} wählt einen Termin`, m`${name} is choosing a time`, m`${name} väljer en tid`, m`${name} velger et tidspunkt`), detail: `${T(`angefragt am ${askedOn}`, `requested on ${askedOn}`, `förfrågan ${askedOn}`, `forespurt ${askedOn}`)}${(latest.round ?? 1) > 1 ? ` · ${round(latest.round)}` : ''}` });
      }
      continue;
    }
    if (BOOKED.includes(latest.status) && latest.scheduled_at) {
      const start = t(latest.scheduled_at);
      const end = start + (latest.duration_minutes ?? 60) * 60000;
      const fb = parseFeedback(latest.feedback);
      const at = when(latest.scheduled_at);
      if (start > now) {
        const r = (latest.round ?? 1) > 1 ? T(` (Runde ${latest.round})`, ` (round ${latest.round})`, ` (omgång ${latest.round})`, ` (runde ${latest.round})`) : '';
        wait({ key: `iv-date:${latest.id}`, by: 'date', title: T(`Interview${r} am ${at}`, `Interview${r} on ${at}`, `Intervju${r} ${at}`, `Intervju${r} ${at}`), detail: T('Termin steht', 'Time confirmed', 'Tiden är bokad', 'Tidspunktet er avtalt') });
        continue;
      }
      if (!fb.way) {
        // 4 Feedback geben
        const r = (latest.round ?? 1) > 1 ? ` ${latest.round}` : '';
        push({ key: `feedback:${latest.id}`, kind: 'feedback', since: iso(Math.min(end, now)), urgent: true, waitingWho: T(m`${name} und ${hhFirst}`, m`${name} and ${hhFirst}`, m`${name} och ${hhFirst}`, m`${name} og ${hhFirst}`),
          title: T('Feedback geben', 'Give feedback', 'Ge feedback', 'Gi tilbakemelding'), detail: T(`Interview${r} am ${at}`, `Interview${r} on ${at}`, `Intervju${r} ${at}`, `Intervju${r} ${at}`), ref: { interviewId: latest.id },
          context: (() => {
            const prev = ivs.find((i: any) => i.id !== latest.id && parseFeedback(i.feedback).way);
            const pf = prev ? parseFeedback(prev.feedback) : null;
            const notes = (notesBySub.get(s.id) ?? []).slice().sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
            const rd = latest.round ?? 1;
            const prevRound = prev?.round ?? rd - 1;
            return ctxOf({
              ask: rd > 1 ? T(m`Wie war Interview ${rd} mit ${nameDat}?`, m`How was interview ${rd} with ${nameDat}?`, m`Hur gick intervju ${rd} med ${nameDat}?`, m`Hvordan gikk intervju ${rd} med ${nameDat}?`)
                : T(m`Wie war das Interview mit ${nameDat}?`, m`How was the interview with ${nameDat}?`, m`Hur gick intervjun med ${nameDat}?`, m`Hvordan gikk intervjuet med ${nameDat}?`),
              facts: [
                ...fact(meeting, [formatBerlinRange(latest.scheduled_at, latest.duration_minutes ?? 60, lang), FORMAT(latest.meeting_format)].filter(Boolean).join(' · '), null, 'meeting'),
                ...fact(T('Ort', 'Location', 'Plats', 'Sted'), latest.meeting_format === 'onsite' ? latest.onsite_address : null, null, 'location'),
                ...fact(T('Ihre Notizen', 'Your notes', 'Dina anteckningar', 'Notatene dine'), notes.length ? T(m`${notes.length} im Profil · „${clip(notes[0].content, 90)}“`, m`${notes.length} in the profile · “${clip(notes[0].content, 90)}”`, m`${notes.length} i profilen · ”${clip(notes[0].content, 90)}”`, m`${notes.length} i profilen · «${clip(notes[0].content, 90)}»`) : null, null, 'notes'),
                ...fact(T(`Aus Runde ${prevRound}`, `From round ${prevRound}`, `Från omgång ${prevRound}`, `Fra runde ${prevRound}`), pf ? [pf.text ? T(m`„${clip(pf.text, 120)}“`, m`“${clip(pf.text, 120)}”`, m`”${clip(pf.text, 120)}”`, m`«${clip(pf.text, 120)}»`) : null, pf.missing ? T(m`offen: ${clip(pf.missing, 80)}`, m`open: ${clip(pf.missing, 80)}`, m`öppet: ${clip(pf.missing, 80)}`, m`åpent: ${clip(pf.missing, 80)}`) : null].filter(Boolean).join(' · ') : null, null, 'previous_round'),
              ],
              line: [`${T('Interview', 'Interview', 'Intervju', 'Intervju')} ${rd}`, at, FORMAT(latest.meeting_format)].filter(Boolean) as string[],
              why: notes.length ? T(`Ihre Notizen: ${notes.length}`, `Your notes: ${notes.length}`, `Dina anteckningar: ${notes.length}`, `Notatene dine: ${notes.length}`) : null,
              foot: T(m`${name} und ${hhFirst} warten auf Ihre Rückmeldung.`, m`${name} and ${hhFirst} are waiting for your feedback.`, m`${name} och ${hhFirst} väntar på din återkoppling.`, m`${name} og ${hhFirst} venter på tilbakemeldingen din.`),
            });
          })() });
        continue;
      }
      const fbAt = Number.isNaN(fb.at) ? end : fb.at;
      if (fb.way === 'unsure') {
        // Die Frage steht als eigene Zeile da, nicht zusätzlich als „beantwortet Ihre Frage“
        const openQuestion = waiting.findIndex((w) => w.key === `question-open:${s.id}`);
        if (openQuestion >= 0) waiting.splice(openQuestion, 1);
        // Julia hat geantwortet: sofort entscheiden. Sonst nach 3 Tagen, ab Tag 7 dringend (02.11.2026)
        const answers = thread.filter((m: any) => m.sender_id === s.recruiter_id && t(m.created_at) > fbAt);
        const answer = answers[answers.length - 1] ?? null;
        const days = Math.floor((now - fbAt) / DAY);
        const unsureOn = short(iso(fbAt));
        if (answer || now - fbAt >= 3 * DAY) {
          const ask = T(m`Wie geht es mit ${nameDat} weiter?`, m`What’s next with ${nameDat}?`, m`Hur går du vidare med ${nameDat}?`, m`Hvordan går du videre med ${nameDat}?`);
          const missingPart = fb.missing ? T(m`: „${fb.missing}“`, m`: “${fb.missing}”`, m`: ”${fb.missing}”`, m`: «${fb.missing}»`) : '';
          push({ key: `unsure:${latest.id}`, kind: 'decide_unsure', since: answer ? answer.created_at : iso(fbAt + 3 * DAY), urgent: days >= 7, waitingWho: hh,
            title: ask,
            detail: days >= 7 ? T(m`${name} wartet seit ${days} Tagen auf eine Rückmeldung`, m`${name} has been waiting ${days} days for feedback`, m`${name} har väntat ${days} dagar på återkoppling`, m`${name} har ventet ${days} dager på tilbakemelding`)
              : answer ? T(m`${hhFirst} hat Ihre Frage beantwortet`, m`${hhFirst} has answered your question`, m`${hhFirst} har svarat på din fråga`, m`${hhFirst} har svart på spørsmålet ditt`)
                : `${T(`Sie waren am ${unsureOn} unsicher`, `You were unsure on ${unsureOn}`, `Du var osäker ${unsureOn}`, `Du var usikker ${unsureOn}`)}${missingPart}`,
            ref: { interviewId: latest.id }, note: answer ? null : T(m`${hhFirst} hat noch nicht geantwortet. Sie können auch ohne Antwort entscheiden.`, m`${hhFirst} has not replied yet. You can also decide without an answer.`, m`${hhFirst} har inte svarat än. Du kan också bestämma dig utan svar.`, m`${hhFirst} har ikke svart ennå. Du kan også bestemme deg uten svar.`),
            context: ctxOf({
              ask,
              facts: [
                ...fact(T('Ihr Eindruck', 'Your impression', 'Ditt intryck', 'Inntrykket ditt'), fb.text ? T(m`„${clip(fb.text, 160)}“`, m`“${clip(fb.text, 160)}”`, m`”${clip(fb.text, 160)}”`, m`«${clip(fb.text, 160)}»`) : null, null, 'impression'),
                ...fact(fb.question ? T('Ihre Frage', 'Your question', 'Din fråga', 'Spørsmålet ditt') : T('Offen war', 'Open point', 'Öppen fråga', 'Åpent punkt'), fb.missing ? clip(fb.missing, 160) : null, null, 'open_point'),
                ...fact(T(m`Antwort von ${hhFirst}`, m`Answer from ${hhFirst}`, m`Svar från ${hhFirst}`, m`Svar fra ${hhFirst}`), answer?.content ? T(m`„${clip(String(answer.content), 400)}“`, m`“${clip(String(answer.content), 400)}”`, m`”${clip(String(answer.content), 400)}”`, m`«${clip(String(answer.content), 400)}»`) : null, null, 'answer'),
                ...fact(meeting, `${round(latest.round ?? 1)} · ${short(latest.scheduled_at)}`, null, 'meeting'),
              ],
              line: [fb.missing ? T(m`offen: ${clip(fb.missing, 60)}`, m`open: ${clip(fb.missing, 60)}`, m`öppet: ${clip(fb.missing, 60)}`, m`åpent: ${clip(fb.missing, 60)}`) : null, T(`unsicher seit ${unsureOn}`, `unsure since ${unsureOn}`, `osäker sedan ${unsureOn}`, `usikker siden ${unsureOn}`)].filter(Boolean) as string[],
              why: others(job.id, s.id).text,
            }) });
        } else {
          wait({ key: `unsure-wait:${latest.id}`, by: 'recruiter', title: T(m`${hhFirst} klärt Ihre Frage zu ${name}`, m`${hhFirst} is clarifying your question about ${nameIn}`, m`${hhFirst} reder ut din fråga om ${nameIn}`, m`${hhFirst} avklarer spørsmålet ditt om ${nameIn}`),
            detail: fb.question ? T(m`„${clip(fb.question, 120)}“`, m`“${clip(fb.question, 120)}”`, m`”${clip(fb.question, 120)}”`, m`«${clip(fb.question, 120)}»`) : T('danach entscheiden Sie', 'then you decide', 'sedan bestämmer du', 'deretter bestemmer du') });
        }
        continue;
      }
      if (fb.way === 'offer') {
        const offerCtx = (rec: any) => {
          const items = (Array.isArray(rec?.items) ? rec.items : []).filter((i: any) => i?.label && i?.value).slice(0, 6);
          const band = wishBand(cand);
          return ctxOf({
            ask: T(m`Was bieten Sie ${nameDat} an?`, m`What will you offer ${nameDat}?`, m`Vad erbjuder du ${nameDat}?`, m`Hva tilbyr du ${nameDat}?`),
            facts: [
              ...items.map((i: any) => ({ ...(typeof i.key === 'string' ? { key: `rec_${i.key}` } : {}), label: String(i.label), value: clip(String(i.value), 120), chip: null })),
              ...fact(T('Rahmen Stelle', 'Role range', 'Ram för tjänsten', 'Ramme for stillingen'), jobRange(job, lang), null, 'job_range'),
              ...fact(T('Gehaltswunsch', 'Salary expectation', 'Löneanspråk', 'Lønnsforventning'), !items.some((i: any) => i.key === 'fix') && band ? T(`${tsd(band.lo)}–${tsd(band.hi)} ${kE} laut Profil`, `${tsd(band.lo)}–${tsd(band.hi)} ${kE} per profile`, `${tsd(band.lo)}–${tsd(band.hi)} ${kE} enligt profilen`, `${tsd(band.lo)}–${tsd(band.hi)} ${kE} ifølge profilen`) : null, budgetChip(band, job, lang), 'salary_wish'),
              ...fact(T('Ihr Feedback', 'Your feedback', 'Din feedback', 'Tilbakemeldingen din'), fb.text ? T(m`„${clip(fb.text, 120)}“`, m`“${clip(fb.text, 120)}”`, m`”${clip(fb.text, 120)}”`, m`«${clip(fb.text, 120)}»`) : null, null, 'feedback'),
            ],
            line: items.length ? items.filter((i: any) => ['fix', 'start'].includes(i.key)).map((i: any) => `${i.label} ${clip(String(i.value), 40)}`) : [T('Empfehlung fehlt noch', 'Recommendation still missing', 'Rekommendation saknas än', 'Anbefaling mangler ennå')],
            quote: rec?.intro ? { by: hh, text: clip(rec.intro) } : null,
            why: pct ? T(`Honorar: ${pct} % vom Zielgehalt (fix + variabel), fällig erst mit dem unterschriebenen Vertrag`, `Fee: ${pct} % of target salary (base + variable), due only once the contract is signed`, `Arvode: ${pct} % av mållönen (fast + rörlig), förfaller först när avtalet är underskrivet`, `Honorar: ${pct} % av mållønnen (fast + variabel), forfaller først når kontrakten er signert`) : null,
            foot: rec ? null : T('Sie können das Angebot auch ohne Empfehlung machen.', 'You can also make the offer without a recommendation.', 'Du kan också lämna erbjudandet utan rekommendation.', 'Du kan også gi tilbudet uten anbefaling.'),
          });
        };
        const rec = (recBySub.get(s.id) ?? []).slice().sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
        const makeOffer = T('Angebot machen', 'Make an offer', 'Lämna erbjudande', 'Gi tilbud');
        if (rec) {
          push({ key: `offer:${s.id}:${rec.id}`, kind: 'make_offer', since: rec.created_at, urgent: true, waitingWho: name,
            title: makeOffer, detail: T(m`Empfehlung von ${hh} liegt vor`, m`Recommendation from ${hh} is in`, m`Rekommendation från ${hh} finns`, m`Anbefaling fra ${hh} foreligger`), ref: { interviewId: latest.id }, note: askNote,
            context: offerCtx(rec) });
        } else if (now - fbAt >= 2 * DAY) {
          push({ key: `offer:${s.id}:ohne`, kind: 'make_offer', since: iso(fbAt + 2 * DAY), urgent: false, waitingWho: name,
            title: makeOffer, detail: T(m`Empfehlung von ${hhFirst} fehlt noch. Sie können das Angebot auch ohne sie machen.`, m`Recommendation from ${hhFirst} is still missing. You can also make the offer without it.`, m`Rekommendation från ${hhFirst} saknas än. Du kan också lämna erbjudandet utan den.`, m`Anbefaling fra ${hhFirst} mangler ennå. Du kan også gi tilbudet uten den.`), ref: { interviewId: latest.id }, note: askNote,
            context: offerCtx(null) });
        } else {
          wait({ key: `rec-wait:${s.id}`, by: 'recruiter', title: T(m`${hhFirst} schreibt die Empfehlung`, m`${hhFirst} is writing the recommendation`, m`${hhFirst} skriver rekommendationen`, m`${hhFirst} skriver anbefalingen`), detail: T(m`was es für ${name}s Zusage braucht`, m`what it takes for ${genitive(nameIn)} acceptance`, m`vad som krävs för att ${nameIn} ska tacka ja`, m`hva som skal til for at ${nameIn} takker ja`) });
        }
        continue;
      }
      if (fb.way === 'next_round') {
        wait({ key: `next-round:${latest.id}`, by: 'recruiter', title: T('Nächste Runde geplant', 'Next round planned', 'Nästa omgång planerad', 'Neste runde planlagt'), detail: T('Interview anfragen, sobald Sie Zeiten haben', 'Request the interview as soon as you have times', 'Boka intervjun så snart du har tider', 'Be om intervju så snart du har tider') });
      }
    }
  }

  // ---------------------------------------------------------------- Rechnungen (15)
  const invoiceWord = T('Rechnung', 'Invoice', 'Faktura', 'Faktura');
  for (const inv of input.invoices) {
    if (!['open', 'pending', 'partially_paid'].includes(inv.status) || !inv.released_at) continue;
    const job = jobById.get(inv.job_id);
    const dueMs = inv.due_date ? Date.parse(`${String(inv.due_date).slice(0, 10)}T23:59:59Z`) : NaN;
    if (inv.client_paid_reported_at) {
      const nr = inv.invoice_number ?? T('der Rechnung', 'the invoice', 'fakturan', 'fakturaen');
      const paidOn = dateDe(inv.client_paid_reported_on ?? inv.client_paid_reported_at);
      waiting.push({ key: `inv-paid:${inv.id}`, submissionId: inv.submission_id ?? null, jobId: inv.job_id ?? null, jobTitle: job?.title ?? null, who: inv.invoice_number ?? invoiceWord, by: 'matchunt',
        title: T(m`Zahlung zu ${nr} wird geprüft`, m`Payment for ${nr} is being checked`, m`Betalningen för ${nr} kontrolleras`, m`Betalingen for ${nr} kontrolleres`), detail: T(`überwiesen am ${paidOn}`, `transferred on ${paidOn}`, `överförd ${paidOn}`, `overført ${paidOn}`) });
      continue;
    }
    if (doneKeys.has(`invoice:${inv.id}`)) continue;
    const isub = input.submissions.find((x) => x.id === inv.submission_id);
    const icand = isub ? candById.get(isub.candidate_id) : null;
    const iname = isub && (isub.identity_unlocked || isub.identity_revealed) && icand?.full_name ? icand.full_name : null;
    const left = daysTo(inv.due_date, now);
    const overdue = left !== null && left < 0;
    const paid = Number(inv.paid_amount_cents ?? 0);
    const rest = Math.max(0, Number(inv.total_amount_cents ?? 0) - paid);
    // Nur Überfälliges farbig (K9); kurz vor Fälligkeit ohne Etikett
    const dueChip: TaskChip | null = overdue ? { text: T('überfällig', 'overdue', 'förfallen', 'forfalt'), tone: 'bad' } : null;
    const bank = BANK.iban && BANK.holder ? [BANK.holder, `IBAN ${BANK.iban}`, BANK.bic ? `BIC ${BANK.bic}` : null].filter(Boolean).join(' · ') : null;
    const nr = inv.invoice_number ?? '';
    const isOverdue = T(' ist überfällig', ' is overdue', ' är förfallen', ' er forfalt');
    const open = T(`${euroCents(rest)} offen`, `${euroCents(rest)} outstanding`, `${euroCents(rest)} obetalt`, `${euroCents(rest)} utestående`);
    const vat = T('USt.', 'VAT', 'Moms', 'MVA');
    const invoiceCtx = ctxOf({
      ask: `${invoiceWord} ${nr}${overdue ? isOverdue : ''}`.trim(),
      facts: [
        ...fact(T('Honorar', 'Fee', 'Arvode', 'Honorar'), inv.amount_cents != null ? T(`${euroCents(inv.amount_cents)} netto`, `${euroCents(inv.amount_cents)} net`, `${euroCents(inv.amount_cents)} netto`, `${euroCents(inv.amount_cents)} netto`) : null, null, 'fee'),
        ...fact(inv.reverse_charge ? vat : `${vat} ${inv.vat_rate ?? 19} %`, inv.reverse_charge ? T('Steuerschuldnerschaft des Leistungsempfängers', 'Reverse charge', 'Omvänd skattskyldighet', 'Omvendt avgiftsplikt') : (inv.tax_amount_cents != null ? euroCents(inv.tax_amount_cents) : null), null, 'vat'),
        ...fact(T('Gesamt', 'Total', 'Totalt', 'Totalt'), `${euroCents(inv.total_amount_cents)}${inv.due_date ? ` · ${T('fällig', 'due', 'förfaller', 'forfaller')} ${dateDe(inv.due_date)}` : ''}`, dueChip, 'total'),
        ...fact(T('Bezahlt', 'Paid', 'Betalt', 'Betalt'), paid > 0 ? euroCents(paid) : null, null, 'paid'),
        ...fact(T('Noch offen', 'Outstanding', 'Kvar att betala', 'Utestående'), paid > 0 ? euroCents(rest) : null, null, 'outstanding'),
        ...fact(T('Überweisen an', 'Pay to', 'Betala till', 'Betal til'), bank, null, 'bank'),
        ...fact(T('Verwendungszweck', 'Payment reference', 'Referens', 'Referanse'), inv.invoice_number ?? null, null, 'reference'),
      ],
      line: [paid > 0 ? open : euroCents(inv.total_amount_cents), inv.due_date ? `${overdue ? T('fällig war', 'was due', 'förföll', 'forfalt') : T('fällig', 'due', 'förfaller', 'forfaller')} ${dateDe(inv.due_date)}` : null].filter(Boolean) as string[],
      chip: dueChip,
      why: [iname ? T(m`für ${iname}`, m`for ${iname}`, m`för ${iname}`, m`for ${iname}`) : null, job?.title ?? null, inv.issued_at ? T(`gestellt am ${short(inv.issued_at)}`, `issued on ${short(inv.issued_at)}`, `utfärdad ${short(inv.issued_at)}`, `utstedt ${short(inv.issued_at)}`) : null].filter(Boolean).join(' · ') || null,
    });
    tasks.push({
      key: `invoice:${inv.id}`, kind: 'invoice', submissionId: inv.submission_id ?? null, jobId: inv.job_id ?? null, jobTitle: job?.title ?? null,
      who: iname ?? inv.invoice_number ?? invoiceWord,
      title: overdue ? `${invoiceWord} ${nr}${isOverdue}` : `${invoiceWord} ${nr} · ${euroCents(rest)}`.trim(),
      detail: overdue || paid > 0 ? open : inv.due_date ? T(`fällig am ${dateDe(inv.due_date)}`, `due on ${dateDe(inv.due_date)}`, `förfaller ${dateDe(inv.due_date)}`, `forfaller ${dateDe(inv.due_date)}`) : T('Honorar', 'Fee', 'Arvode', 'Honorar'), since: inv.issued_at ?? inv.released_at,
      urgent: !Number.isNaN(dueMs) && dueMs - now < 3 * DAY, waitingWho: null, ref: { invoiceId: inv.id }, note: null, context: invoiceCtx,
    });
  }

  // ---------------------------------------------------------------- Fragen des Headhunters (13)
  for (const q of input.questions) {
    const key = `question:${q.id}`;
    if (doneKeys.has(key)) continue;
    const job = jobById.get(q.related_id);
    const lines = String(q.message ?? '').split('\n');
    const questions = lines.filter((l) => l.startsWith('– ')).map((l) => l.slice(2).trim()).filter(Boolean);
    const intro = lines.filter((l) => !l.startsWith('– ')).join(' ').trim().replace(/:$/, '');
    const jobActs = (input.activations ?? []).filter((a: any) => a.job_id === (job?.id ?? q.related_id) && !['ended', 'cancelled'].includes(String(a.status ?? '')));
    const senderId = input.questionSenders?.[q.id] ?? (jobActs.length === 1 ? jobActs[0].recruiter_id : null);
    const sender = senderId ? input.recruiters.find((r) => r.user_id === senderId) : null;
    const senderName = (sender?.full_name as string) || T('Ihr Headhunter', 'Your headhunter', 'Din headhunter', 'Din headhunter');
    const act = senderId ? jobActs.find((a: any) => a.recruiter_id === senderId) : null;
    const tier = senderId ? (input.partners ?? []).find((p: any) => p.user_id === senderId && !p.ended_at)?.tier : null;
    const subCount = senderId ? input.submissions.filter((x) => x.job_id === (job?.id ?? q.related_id) && x.recruiter_id === senderId).length : 0;
    const TIER: Record<string, string> = { partner: 'Partner', silver: T('Silber Partner', 'Silver Partner', 'Silverpartner', 'Sølvpartner'), gold: T('Gold Partner', 'Gold Partner', 'Guldpartner', 'Gullpartner') };
    const jt = job?.title ?? T('Ihrer Stelle', 'your role', 'din tjänst', 'stillingen din');
    const nq = questions.length;
    const questionCtx = ctxOf({
      ask: T(m`${senderName} fragt zu ${jt}`, m`${senderName} has a question about ${jt}`, m`${senderName} har en fråga om ${jt}`, m`${senderName} har et spørsmål om ${jt}`),
      line: [senderName, T(`${nq} ${nq === 1 ? 'Frage' : 'Fragen'}`, `${nq} ${nq === 1 ? 'question' : 'questions'}`, `${nq} ${nq === 1 ? 'fråga' : 'frågor'}`, `${nq} ${nq === 1 ? 'spørsmål' : 'spørsmål'}`)],
      quote: intro ? { by: senderName, text: clip(intro) } : null,
      why: senderId ? [sender?.company_name ?? null, tier ? TIER[tier] ?? null : null, act?.activated_at ? T(`sucht seit ${short(act.activated_at)}`, `searching since ${short(act.activated_at)}`, `söker sedan ${short(act.activated_at)}`, `søker siden ${short(act.activated_at)}`) : null,
        T(`${subCount} ${subCount === 1 ? 'Kandidat' : 'Kandidaten'} eingereicht`, `${subCount} ${subCount === 1 ? 'candidate' : 'candidates'} submitted`, `${subCount} ${subCount === 1 ? 'kandidat' : 'kandidater'} inskickade`, `${subCount} ${subCount === 1 ? 'kandidat' : 'kandidater'} sendt inn`)].filter(Boolean).join(' · ') : null,
      foot: jobActs.length > 1 ? T(`Ihre Antwort geht an alle ${jobActs.length} Headhunter, die für diese Stelle suchen.`, `Your answer goes to all ${jobActs.length} headhunters searching for this role.`, `Ditt svar går till alla ${jobActs.length} headhunters som söker för tjänsten.`, `Svaret ditt går til alle ${jobActs.length} headhuntere som søker til stillingen.`)
        : T(m`Ihre Antwort geht an ${senderName}.`, m`Your answer goes to ${senderName}.`, m`Ditt svar går till ${senderName}.`, m`Svaret ditt går til ${senderName}.`),
    });
    tasks.push({
      key, kind: 'recruiter_question', submissionId: null, jobId: job?.id ?? q.related_id ?? null, jobTitle: job?.title ?? null,
      who: job?.title ?? T('Stelle', 'Role', 'Tjänst', 'Stilling'),
      title: nq > 1 ? T(`${nq} Fragen vom Headhunter beantworten`, `Answer ${nq} questions from the headhunter`, `Svara på ${nq} frågor från headhuntern`, `Svar på ${nq} spørsmål fra headhunteren`) : T('Frage vom Headhunter beantworten', 'Answer the headhunter’s question', 'Svara på headhunterns fråga', 'Svar på spørsmålet fra headhunteren'),
      detail: questions[0] ? `${T(m`„${questions[0]}“`, m`“${questions[0]}”`, m`”${questions[0]}”`, m`«${questions[0]}»`)}${nq > 1 ? T(` und ${nq - 1} weitere`, ` and ${nq - 1} more`, ` och ${nq - 1} till`, ` og ${nq - 1} til`) : ''}` : String(q.title ?? ''),
      since: q.created_at, urgent: now - t(q.created_at) > 2 * DAY, waitingWho: senderName, ref: { notificationId: q.id, questions }, note: null, context: questionCtx,
    });
  }

  // ---------------------------------------------------------------- Stelle ruht (F3 Stufe 4)
  for (const job of input.jobs) {
    if (!job.cooperation_paused_at) continue;
    const key = `job-paused:${job.id}:${String(job.cooperation_paused_at).slice(0, 10)}`;
    if (doneKeys.has(key)) continue;
    const open = tasks.filter((x) => x.kind === 'review' && x.jobId === job.id).length;
    const why = T('Wir haben die Suche angehalten, bis Sie die offenen Rückmeldungen gegeben haben. Danach geht es sofort weiter.', 'We have paused the search until you have given the open feedback. Then it continues right away.', 'Vi har pausat sökningen tills du har gett den återkoppling som saknas. Sedan fortsätter den direkt.', 'Vi har satt søket på pause til du har gitt tilbakemeldingene som mangler. Deretter fortsetter det med en gang.');
    const paused = T(m`Ihre Stelle ${job.title ?? ''} ruht`, m`Your role ${job.title ?? ''} is paused`, m`Din tjänst ${job.title ?? ''} vilar`, m`Stillingen din ${job.title ?? ''} står på pause`).replace(/\s+/g, ' ');
    tasks.push({
      key, kind: 'job_paused', submissionId: null, jobId: job.id, jobTitle: job.title ?? null, who: job.title ?? T('Stelle', 'Role', 'Tjänst', 'Stilling'),
      title: paused, detail: why, since: job.cooperation_paused_at, urgent: true, waitingWho: null,
      ref: {}, note: null,
      context: ctxOf({
        ask: paused,
        facts: [...fact(T('Ruht seit', 'Paused since', 'Vilar sedan', 'På pause siden'), short(job.cooperation_paused_at), null, 'paused_since'), ...fact(T('Offene Rückmeldungen', 'Open feedback', 'Återkoppling som saknas', 'Tilbakemeldinger som mangler'), open ? String(open) : null, null, 'open_feedback')],
        line: [open ? T(`${open} ${open === 1 ? 'Rückmeldung' : 'Rückmeldungen'} offen`, `${open} feedback ${open === 1 ? 'item' : 'items'} open`, `${open} ${open === 1 ? 'återkoppling saknas' : 'återkopplingar saknas'}`, `${open} ${open === 1 ? 'tilbakemelding mangler' : 'tilbakemeldinger mangler'}`) : T('Rückmeldungen offen', 'Feedback open', 'Återkoppling saknas', 'Tilbakemeldinger mangler')],
        why,
      }),
    });
  }

  // F3 Stufe 1: „n Vorstellungen warten auf Ihre Rückmeldung“ (für eine Sammelzeile)
  const oldest = lateReviews.length ? Math.max(...lateReviews) : 0;
  const nl = lateReviews.length;
  const reminder: ReviewReminder | null = nl ? {
    count: nl, oldestWorkdays: oldest,
    text: T(`${nl === 1 ? '1 Vorstellung wartet' : `${nl} Vorstellungen warten`} auf Ihre Rückmeldung · die älteste seit ${oldest} Werktagen`,
      `${nl === 1 ? '1 candidate is' : `${nl} candidates are`} waiting for your feedback · the oldest for ${oldest} working days`,
      `${nl === 1 ? '1 kandidat väntar' : `${nl} kandidater väntar`} på din återkoppling · den äldsta sedan ${oldest} arbetsdagar`,
      `${nl === 1 ? '1 kandidat venter' : `${nl} kandidater venter`} på tilbakemeldingen din · den eldste i ${oldest} arbeidsdager`),
  } : null;

  // Jemand wartet zuerst, dann nach Alter
  tasks.sort((a, b) => (a.urgent === b.urgent ? t(a.since) - t(b.since) : a.urgent ? -1 : 1));
  return { tasks, waiting, news: deriveNews(input, tasks), reminder };
}

/** Meilensteine für die Dashboard-Leiste; wer handeln muss, zuerst. */
function deriveNews(input: ClientTaskInput, tasks: ClientTask[]): NewsItem[] {
  const { now } = input;
  const lang = input.lang ?? null;
  const T = (de: Msg | string, en: Msg | string, sv: Msg | string, nb: Msg | string) => tx(lang, de, en, sv, nb);
  const dateDe = (key: string | null | undefined) => dateIn(key, lang);
  const euro = (n: number | null | undefined) => euroIn(n, lang);
  const START = T('Start', 'Start', 'Start', 'Oppstart');
  const look = T('Ansehen', 'View', 'Visa', 'Vis');
  const jobById = new Map(input.jobs.map((j) => [j.id, j]));
  const candById = new Map(input.candidates.map((c) => [c.id, c]));
  const recName = new Map(input.recruiters.map((r) => [r.user_id, r.full_name as string]));
  const open = new Set(tasks.map((x) => x.key));
  const recent = (iso: unknown) => !Number.isNaN(t(iso)) && now - t(iso) <= 3 * DAY;
  const out: NewsItem[] = [];
  for (const s of input.submissions) {
    const job = jobById.get(s.job_id);
    if (!job) continue;
    const cand = candById.get(s.candidate_id);
    const unlocked = !!(s.identity_unlocked || s.identity_revealed);
    const who = unlocked && cand?.full_name ? cand.full_name : `PR-${String(s.candidate_id ?? '').slice(0, 6).toUpperCase()}`;
    const name = unlocked && cand?.full_name ? first(cand.full_name) : T('der Kandidat', 'the candidate', 'kandidaten', 'kandidaten');
    const hhFirst = first(recName.get(s.recruiter_id) ?? T('Ihr Headhunter', 'Your headhunter', 'Din headhunter', 'Din headhunter'));
    const offers = input.offers.filter((o: any) => o.submission_id === s.id).sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
    const c = input.contracts.filter((x: any) => x.submission_id === s.id).sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
    const accepted = offers.find((o: any) => o.status === 'accepted');
    const terms = (o: any) => [`${euro(o.salary_offered)}${o.variable_salary ? ` + ${euro(o.variable_salary)}` : ''}`, o.start_date ? `${START} ${dateDe(o.start_date)}` : null].filter(Boolean).join(' · ');
    if (c?.status === 'preparing' && accepted && open.has(`contract-send:${c.id}`)) {
      out.push({ key: `news-accepted:${c.id}`, kind: 'accepted', submissionId: s.id, title: T(m`${who} hat zugesagt`, m`${who} has accepted`, m`${who} har tackat ja`, m`${who} har takket ja`), detail: [job.title, terms(accepted)].join(' · '),
        hint: T(m`Schicken Sie ${name} jetzt den Arbeitsvertrag. ${hhFirst} hält bis dahin Kontakt.`, m`Send ${name} the employment contract now. ${hhFirst} stays in touch until then.`, m`Skicka anställningsavtalet till ${name} nu. ${hhFirst} håller kontakten till dess.`, m`Send arbeidskontrakten til ${name} nå. ${hhFirst} holder kontakten til da.`),
        cta: T('Vertrag schicken', 'Send contract', 'Skicka avtal', 'Send kontrakt'), taskKey: `contract-send:${c.id}`, at: accepted.decision_at ?? accepted.updated_at ?? c.created_at });
    }
    const countered = offers.find((o: any) => o.status === 'countered');
    if (countered && open.has(`counter:${countered.id}`)) {
      const wish = countered.candidate_response?.wish ?? {};
      out.push({ key: `news-counter:${countered.id}`, kind: 'counter', submissionId: s.id, title: T(m`${who} hat einen Gegenwunsch`, m`${who} has a counter-request`, m`${who} har ett motförslag`, m`${who} har et motforslag`),
        detail: [wish.salary ? T(`${euro(wish.salary)} statt ${euro(countered.salary_offered)}`, `${euro(wish.salary)} instead of ${euro(countered.salary_offered)}`, `${euro(wish.salary)} i stället för ${euro(countered.salary_offered)}`, `${euro(wish.salary)} i stedet for ${euro(countered.salary_offered)}`) : null, wish.startDate ? `${START} ${dateDe(wish.startDate)}` : null, wish.other ?? null].filter(Boolean).join(' · ') || job.title,
        hint: T(m`${hhFirst} hat den Wunsch aufgenommen. Antworten Sie, damit ${name} nicht abspringt.`, m`${hhFirst} has noted the request. Reply so that ${name} doesn’t drop out.`, m`${hhFirst} har tagit emot önskemålet. Svara så att ${name} inte hoppar av.`, m`${hhFirst} har notert ønsket. Svar, så ${name} ikke hopper av.`),
        cta: T('Gegenwunsch beantworten', 'Respond to the counter-request', 'Svara på motförslaget', 'Svar på motforslaget'), taskKey: `counter:${countered.id}`, at: countered.counter_offer_at ?? countered.updated_at });
    }
    const latest = offers[0];
    if (latest?.status === 'declined' && recent(latest.decision_at ?? latest.updated_at)) {
      out.push({ key: `news-declined:${latest.id}`, kind: 'declined', submissionId: s.id, title: T(m`${who} hat abgesagt`, m`${who} has declined`, m`${who} har tackat nej`, m`${who} har takket nei`), detail: [job.title, latest.rejection_reason ?? null].filter(Boolean).join(' · '),
        hint: T(m`${hhFirst} sucht weiter für Sie.`, m`${hhFirst} keeps searching for you.`, m`${hhFirst} fortsätter att söka åt dig.`, m`${hhFirst} fortsetter å søke for deg.`), cta: look, taskKey: null, at: latest.decision_at ?? latest.updated_at });
    }
    if (c?.status === 'final' && recent(c.final_at)) {
      out.push({ key: `news-signed:${c.id}`, kind: 'signed', submissionId: s.id, title: T(m`Arbeitsvertrag mit ${who} unterschrieben`, m`Employment contract with ${who} signed`, m`Anställningsavtal med ${who} underskrivet`, m`Arbeidskontrakt med ${who} signert`), detail: [job.title, c.start_date ? `${START} ${dateDe(c.start_date)}` : null].filter(Boolean).join(' · '),
        hint: T(m`${hhFirst} begleitet ${name} bis zum ersten Tag.`, m`${hhFirst} stays with ${name} until the first day.`, m`${hhFirst} följer ${name} fram till första dagen.`, m`${hhFirst} følger ${name} fram til første dag.`), cta: look, taskKey: null, at: c.final_at });
    }
    const pl = input.placements.find((p: any) => p.submission_id === s.id);
    const day = pl?.first_working_day ?? pl?.start_date;
    if (pl && day && String(day).slice(0, 10) === berlinDateKey(now)) {
      const g = unlocked && cand?.full_name ? genitiveIn(first(cand.full_name), lang) : '';
      out.push({ key: `news-start:${pl.id}`, kind: 'start', submissionId: s.id,
        title: g ? T(m`Heute ist ${g} erster Arbeitstag`, m`Today is ${g} first working day`, m`I dag är ${g} första arbetsdag`, m`I dag er ${g} første arbeidsdag`)
          : T(m`Heute ist der erste Arbeitstag von ${who}`, m`Today is the first working day of ${who}`, m`I dag är första arbetsdagen för ${who}`, m`I dag er første arbeidsdag for ${who}`), detail: job.title,
        hint: null, cta: look, taskKey: null, at: new Date(now).toISOString() });
    }
  }
  const act = (n: NewsItem) => (n.taskKey ? 0 : 1);
  return out.sort((a, b) => act(a) - act(b) || t(b.at) - t(a.at));
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

const chunk = <T,>(xs: T[], n = 200) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function rowsIn(db: SupabaseClient, table: string, select: string, column: string, ids: string[]) {
  const out: any[] = [];
  for (const part of chunk([...new Set(ids.filter(Boolean))])) {
    if (!part.length) continue;
    const { data, error } = await db.from(table).select(select).in(column, part);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

/** Alles, was die Ableitung braucht – nur für Stellen, die der Nutzer sehen darf. */
export async function loadClientTaskInput(db: SupabaseClient, userId: string, jobIds: string[], now: number): Promise<ClientTaskInput & { doneRecent: any[] }> {
  const jobs = await rowsIn(db, 'jobs', 'id, title, status, client_id, organization_id, salary_min, salary_max, fee_percentage, mandate_id, research_for_placement_id, research_since, cooperation_paused_at', 'id', jobIds);
  const submissions = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id, stage, status, submitted_at, identity_unlocked, identity_revealed, recruiter_notes', 'job_id', jobIds);
  const subIds = submissions.map((s) => s.id);
  // Kandidatenfelder wie im Bewerberprofil (client_candidate_view); Bänder bildet die Ableitung
  const candCols = 'id, full_name, job_title, seniority, experience_years, city, expected_salary, salary_expectation_max, notice_period, availability_date, skills, remote_preference';
  const [candidates, interviews, offers, recommendations, contracts, placements, invoices, activations, mandates] = await Promise.all([
    rowsIn(db, 'candidates', candCols, 'id', submissions.map((s) => s.candidate_id)),
    rowsIn(db, 'interviews', 'id, submission_id, status, round, scheduled_at, duration_minutes, feedback, created_at, updated_at, proposed_slots, counter_slots, response_token_expires_at, reschedules_interview_id, meeting_format, onsite_address, candidate_message', 'submission_id', subIds),
    rowsIn(db, 'offers', 'id, submission_id, status, created_at, updated_at, response_due, candidate_response, counter_offer_at, candidate_mail_due_at, candidate_mail_sent_at, callback_requested_at, callback_done_at, salary_offered, variable_salary, start_date, contract_type, probation_months, work_model, extras, decision_at, sent_at, version, rejection_reason', 'submission_id', subIds),
    rowsIn(db, 'offer_recommendations', 'id, submission_id, created_at, intro, items', 'submission_id', subIds),
    rowsIn(db, 'employment_contracts', 'id, submission_id, status, way, sent_at, created_at, updated_at, company_signed_at, company_signer_name, company_signer_email, candidate_email, reported_at, reported_role, report_note, signed_on, salary, variable_salary, start_date, undo_until, fixed_term, non_compete, decline_reason, signing_mode, company_signer_user_id, final_at, candidate_status, candidate_status_at', 'submission_id', subIds),
    rowsIn(db, 'placements', '*', 'submission_id', subIds),
    rowsIn(db, 'invoices', '*', 'job_id', jobIds),
    rowsIn(db, 'recruiter_job_activations', 'job_id, recruiter_id, status, activated_at', 'job_id', jobIds).catch(() => []),
    rowsIn(db, 'commercial_mandates', 'id, pricing_snapshot', 'id', jobs.map((j) => j.mandate_id)).catch(() => []),
  ]);
  const recruiterIds = [...submissions.map((s) => s.recruiter_id), ...activations.map((a: any) => a.recruiter_id), ...placements.map((p: any) => p.start_reported_by)];
  const placementIds = placements.map((p: any) => p.id);
  const [claims, researchOffers] = await Promise.all([
    rowsIn(db, 'continuity_claims', 'id, placement_id, status, kind, reported_at, decided_at, client_sphere', 'placement_id', placementIds).catch(() => []),
    rowsIn(db, 'research_offers', 'id, placement_id, decision, status, price_cents, valid_until, decided_at, answered_at', 'placement_id', placementIds).catch(() => []),
  ]);
  const signLinks = await rowsIn(db, 'employment_sign_links', 'contract_id, signer_role, sent_at, opened_at, signed_at, revoked_at, created_at', 'contract_id',
    contracts.filter((c: any) => c.signing_mode === 'embedded').map((c: any) => c.id)).catch(() => []);
  const [recruiters, partners, comments] = await Promise.all([
    rowsIn(db, 'profiles', 'user_id, full_name, company_name', 'user_id', recruiterIds),
    rowsIn(db, 'recruiter_partner_status', 'user_id, tier, ended_at', 'user_id', recruiterIds).catch(() => []),
    // nur eigene Notizen des Nutzers
    (async () => (await rowsIn(db, 'candidate_comments', 'submission_id, user_id, content, created_at', 'submission_id', subIds)).filter((c: any) => c.user_id === userId))().catch(() => []),
  ]);
  // Honorarsatz laut Rahmenvertrag (Mandat), sonst der Satz der Stelle – wie offer-service
  const feePct: Record<string, number> = {};
  for (const j of jobs) {
    const fromMandate = Number(mandates.find((m: any) => m.id === j.mandate_id)?.pricing_snapshot?.clientFeePct);
    const pct = Number.isFinite(fromMandate) && fromMandate > 0 ? fromMandate : Number(j.fee_percentage);
    if (Number.isFinite(pct) && pct > 0) feePct[j.id] = pct;
  }
  const { data: questions } = await db.from('notifications').select('id, title, message, related_id, created_at, type')
    .eq('user_id', userId).eq('related_type', 'job').in('type', ['recruiter_job_questions', 'recruiter_nudge'])
    .gte('created_at', new Date(now - 60 * DAY).toISOString()).order('created_at', { ascending: false }).limit(50);
  // Alte Glocken-Einträge „recruiter_nudge“ sind teils Erinnerungen, keine Fragen: nur die mit Fragenliste
  const qs = (questions ?? []).filter((q: any) => q.type === 'recruiter_job_questions' || (/Frage/.test(String(q.title ?? '')) && String(q.message ?? '').includes('\n– ')));
  // Wer hat gefragt? Die Glocke kennt den Absender nicht, die Mail-Protokolle schon (gleiche Stelle, ±15 Min.)
  const questionSenders: Record<string, string> = {};
  if (qs.length) {
    const { data: ev } = await db.from('email_events').select('metadata, created_at').eq('template_name', 'recruiter_job_questions')
      .gte('created_at', new Date(now - 61 * DAY).toISOString()).limit(500);
    for (const q of qs) {
      const hit = (ev ?? []).find((e: any) => e.metadata?.job_id === q.related_id && e.metadata?.recruiter_id && Math.abs(t(e.created_at) - t(q.created_at)) < 15 * 60000);
      if (hit) questionSenders[q.id] = hit.metadata.recruiter_id;
    }
  }
  const candIds = submissions.map((s) => s.candidate_id);
  const messages = await rowsIn(db, 'messages', 'id, job_id, candidate_id, sender_id, created_at, content', 'candidate_id', candIds);
  const log = await rowsIn(db, 'client_task_log', 'task_key, kind, submission_id, job_id, label, answer, done_by, done_at', 'job_id', jobIds).catch(() => []);
  const { data: ownLog } = await db.from('client_task_log').select('task_key, kind, submission_id, job_id, label, answer, done_by, done_at').eq('done_by', userId).gte('done_at', new Date(now - 60 * DAY).toISOString());
  const allLog = [...log, ...(ownLog ?? [])];
  const doneRecent = allLog.filter((l) => Date.parse(l.done_at) >= now - 7 * DAY)
    .filter((l, i, xs) => xs.findIndex((x) => x.task_key === l.task_key) === i)
    .sort((a, b) => Date.parse(b.done_at) - Date.parse(a.done_at));
  // Rechnungsdaten je Stelle: braucht die Rechnung eine Bestellnummer? (Firmenprofil des Inhabers)
  const poRequiredJobs: string[] = [];
  const defaultCostCenter: Record<string, string> = {};
  if (placements.length) {
    const owners = new Map<string, string>();
    for (const j of jobs) owners.set(j.id, await billingOwnerOfJob(db, j));
    const profiles = await rowsIn(db, 'company_profiles', 'user_id, purchase_order_required, default_cost_center', 'user_id', [...owners.values()]).catch(() => []);
    for (const j of jobs) {
      const cp = profiles.find((x: any) => x.user_id === owners.get(j.id));
      if (cp?.purchase_order_required) poRequiredJobs.push(j.id);
      if (cp?.default_cost_center) defaultCostCenter[j.id] = cp.default_cost_center;
    }
  }
  return {
    now, jobs, submissions, candidates, recruiters, interviews, offers, recommendations, contracts, placements,
    invoices: invoices.filter((i: any) => i.status !== 'draft'), questions: qs, messages: messages.filter((m: any) => jobIds.includes(m.job_id)),
    log: allLog, doneRecent, comments, activations, partners, questionSenders, feePct, userId, signLinks, poRequiredJobs, defaultCostCenter,
    claims, researchOffers,
  };
}

// ---------------------------------------------------------------------------
// Aktionen des Kunden (Function client-tasks)
// ---------------------------------------------------------------------------


const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const NON_START_REASONS: Record<string, string> = {
  not_started: 'nicht erschienen',
  counter_offer: 'Gegenangebot angenommen',
  other_job: 'andere Stelle angetreten',
  personal: 'persönliche Gründe',
  other: 'anderer Grund',
};
const NON_START_OTHER: Record<string, [string, string, string]> = {
  not_started: ['did not show up', 'dök inte upp', 'møtte ikke opp'],
  counter_offer: ['accepted a counter-offer', 'tackade ja till ett motbud', 'takket ja til et motbud'],
  other_job: ['started another job', 'började en annan tjänst', 'begynte i en annen stilling'],
  personal: ['personal reasons', 'personliga skäl', 'personlige grunner'],
  other: ['other reason', 'annat skäl', 'annen grunn'],
};
/** Grund des Nichtantritts in der Sprache des Lesers */
export const nonStartReason = (reason: string, lang?: Lang | null) => {
  const o = NON_START_OTHER[reason];
  return o ? tx(lang, NON_START_REASONS[reason], o[0], o[1], o[2]) : (NON_START_REASONS[reason] ?? reason);
};

/** Sprache aus dem Aufruf (die Web-App schickt body.lang); für Fehlermeldungen und Texte an den Kunden. */
const bodyLang = (body: any): Lang | null => normLang(body?.lang);
/** Empfänger einer Glocke oder Mail: Profilsprache, sonst Deutsch. */
const userLang = async (db: SupabaseClient, userId: string | null | undefined): Promise<Lang> => (await languageOfUser(db, userId)) ?? 'de';

async function profileOf(db: SupabaseClient, userId: string) {
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return { name: (data?.full_name as string) || 'Kunde', email: data?.email ? String(data.email).toLowerCase() : null };
}

async function adminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('user_roles').select('user_id').eq('role', 'admin');
  return (data ?? []).map((r: any) => r.user_id);
}

/** Glocke; Titel und Text dürfen je nach Sprache des Empfängers entstehen (Funktion bekommt sie). */
async function notify(db: SupabaseClient, userId: string | null | undefined, type: string, title: string | ((lang: Lang) => string), message: string | ((lang: Lang) => string), relatedType: string, relatedId: string | null) {
  if (!userId) return;
  if (typeof title === 'function' || typeof message === 'function') {
    const lang = await userLang(db, userId);
    if (typeof title === 'function') title = title(lang);
    if (typeof message === 'function') message = message(lang);
  }
  const { error } = await db.from('notifications').insert({ user_id: userId, type, title, message, related_type: relatedType, related_id: relatedId });
  if (error) console.warn('[client-tasks] Glocke nicht gespeichert', error.code, error.message);
}

/** Kundenteam einer Stelle (ohne Finanzrolle), für „an Kollegen geben“. */
export async function clientTeamOf(db: SupabaseClient, jobId: string): Promise<{ userId: string; email: string | null; name: string }[]> {
  const { data: job } = await db.from('jobs').select('id, client_id, organization_id').eq('id', jobId).maybeSingle();
  if (!job) return [];
  const ids = new Set<string>();
  if (job.client_id) ids.add(job.client_id);
  if (job.organization_id) {
    const { data: org } = await db.from('organizations').select('owner_id').eq('id', job.organization_id).maybeSingle();
    if (org?.owner_id) ids.add(org.owner_id);
    const { data: members } = await db.from('organization_members').select('user_id, role').eq('organization_id', job.organization_id).eq('status', 'active');
    for (const m of members ?? []) if (m.role !== 'finance') ids.add(m.user_id);
  }
  if (!ids.size) return [];
  const { data: profiles } = await db.from('profiles').select('user_id, full_name, email').in('user_id', [...ids]);
  return (profiles ?? []).map((p: any) => ({ userId: p.user_id, email: p.email ? String(p.email).toLowerCase() : null, name: p.full_name || 'Kunde' }));
}

export async function listClientTasks(ctx: ServiceCtx, user: User, body: any) {
  const jobIds = await getAccessibleJobIds(ctx.db as any, user.id);
  const [input, scope] = await Promise.all([loadClientTaskInput(ctx.db, user.id, jobIds, ctx.now()), billingScope(ctx.db, user.id)]);
  // Rechnungen sehen nur Inhaber, Admin, HR und die Buchhaltung (nicht Hiring Manager und Viewer)
  input.invoices = input.invoices.filter((i: any) => canSeeInvoice(scope, i));
  input.lang = bodyLang(body);
  const derived = deriveClientTasks(input);
  const tasks = derived.tasks.filter((x) => x.kind !== 'purchase_order' || scope.isAdmin || (!!x.jobId && scope.jobIds.includes(x.jobId)));
  const waiting = derived.waiting.filter((w) => !w.key.startsWith('inv-paid:') || !w.jobId || scope.isAdmin || scope.jobIds.includes(w.jobId));
  const news = derived.news;
  const sub = typeof body?.submissionId === 'string' && UUID.test(body.submissionId) ? body.submissionId : null;
  const pick = <T extends { submissionId: string | null }>(xs: T[]) => (sub ? xs.filter((x) => x.submissionId === sub) : xs);
  return {
    tasks: pick(tasks),
    waiting: pick(waiting),
    done: pick(input.doneRecent.map((l: any) => ({ key: l.task_key, kind: l.kind, submissionId: l.submission_id, jobId: l.job_id, label: l.label, answer: l.answer, doneAt: l.done_at, doneBy: l.done_by }))),
    counts: { urgent: tasks.filter((x) => x.urgent).length, total: tasks.length },
    news: sub ? news.filter((n) => n.submissionId === sub) : news,
    reminder: sub ? null : derived.reminder,
    // HR sieht Rechnungen nur lesend (K9); „Überwiesen melden“ nur mit Verwaltungsrecht
    billing: { canManage: scope.canManage, financeOnly: scope.financeOnly },
  };
}

const NOT_ALLOWED = (lang: Lang | null) => tx(lang, 'Dafür fehlt Ihnen die Berechtigung.', 'You don’t have permission for this.', 'Du saknar behörighet för detta.', 'Du har ikke tilgang til dette.');

async function requireJob(ctx: ServiceCtx, user: User, jobId: unknown, lang: Lang | null = null) {
  must(typeof jobId === 'string' && UUID.test(jobId), tx(lang, 'Ungültige Stelle.', 'Invalid role.', 'Ogiltig tjänst.', 'Ugyldig stilling.'));
  must(await canUserActOnJob(ctx.db as any, user.id, jobId as string), NOT_ALLOWED(lang), 'not_allowed');
  return jobId as string;
}

async function writeLog(ctx: ServiceCtx, row: { task_key: string; kind: string; submission_id: string | null; job_id: string | null; label: string; answer?: string | null; note?: string | null; done_by: string }) {
  const { error } = await ctx.db.from('client_task_log').insert({ ...row, done_at: new Date(ctx.now()).toISOString() });
  dbFail(error, 'Das Protokoll');
}

/** Aufgaben-Fenster meldet: erledigt (für „Erledigt · 7 Tage“). Die Aufgabe selbst verschwindet über den Stand. */
export async function logDone(ctx: ServiceCtx, user: User, body: any) {
  const lang = bodyLang(body);
  const key = text(body?.key, 200);
  must(key, tx(lang, 'Welche Aufgabe?', 'Which task?', 'Vilken uppgift?', 'Hvilken oppgave?'));
  const jobId = body?.jobId ? await requireJob(ctx, user, body.jobId, lang) : null;
  await writeLog(ctx, {
    task_key: key, kind: text(body?.kind, 40) || 'other', submission_id: typeof body?.submissionId === 'string' && UUID.test(body.submissionId) ? body.submissionId : null,
    job_id: jobId, label: text(body?.label, 200) || 'Aufgabe erledigt', answer: text(body?.answer, 200) || null, done_by: user.id,
  });
  return { ok: true };
}

async function loadQuestion(ctx: ServiceCtx, user: User, id: unknown, lang: Lang | null = null) {
  must(typeof id === 'string' && UUID.test(id), tx(lang, 'Ungültige Frage.', 'Invalid question.', 'Ogiltig fråga.', 'Ugyldig spørsmål.'));
  const { data: q, error } = await ctx.db.from('notifications').select('id, user_id, title, message, related_id, related_type, created_at').eq('id', id).maybeSingle();
  dbFail(error, 'Die Frage');
  must(q && q.user_id === user.id && q.related_type === 'job', tx(lang, 'Diese Frage gibt es nicht.', 'This question does not exist.', 'Den här frågan finns inte.', 'Dette spørsmålet finnes ikke.'), 'not_found');
  await requireJob(ctx, user, q.related_id, lang);
  return q;
}

/** Antwort auf Fragen des Headhunters zur Stelle: Glocke + Mail an die Headhunter der Stelle. */
export async function answerQuestion(ctx: ServiceCtx, user: User, body: any) {
  const lang = bodyLang(body);
  const q = await loadQuestion(ctx, user, body?.notificationId, lang);
  const answer = text(body?.answer, 4000);
  must(answer.length >= 2, tx(lang, 'Bitte eine Antwort schreiben.', 'Please write an answer.', 'Skriv ett svar.', 'Skriv et svar.'));
  const { data: job } = await ctx.db.from('jobs').select('id, title').eq('id', q.related_id).maybeSingle();
  const { data: acts } = await ctx.db.from('recruiter_job_activations').select('recruiter_id, status').eq('job_id', q.related_id);
  const recruiters = [...new Set((acts ?? []).filter((a: any) => !['ended', 'cancelled'].includes(String(a.status ?? ''))).map((a: any) => a.recruiter_id))];
  must(recruiters.length > 0, tx(lang, 'Für diese Stelle ist gerade kein Headhunter aktiv.', 'No headhunter is currently active on this role.', 'Ingen headhunter är aktiv för tjänsten just nu.', 'Ingen headhunter er aktiv på stillingen nå.'), 'conflict');
  const me = await profileOf(ctx.db, user.id);
  const questions = String(q.message ?? '').split('\n').filter((l) => l.startsWith('– ')).map((l) => l.slice(2));
  for (const rid of recruiters) {
    // Headhunter lesen in ihrer Profilsprache (du)
    const rl = await userLang(ctx.db, rid);
    const jt = job?.title ?? tx(rl, 'der Stelle', 'the role', 'tjänsten', 'stillingen');
    const title = tx(rl, m`${me.name} hat deine Fragen zu ${jt} beantwortet`, m`${me.name} has answered your questions about ${jt}`, m`${me.name} har svarat på dina frågor om ${jt}`, m`${me.name} har svart på spørsmålene dine om ${jt}`);
    await notify(ctx.db, rid, 'client_answer', title, answer.slice(0, 400), 'job', q.related_id);
    const rp = await profileOf(ctx.db, rid);
    if (!rp.email) continue;
    const hello = tx(rl, 'Hallo', 'Hi', 'Hej', 'Hei');
    const answered = tx(rl, m`${me.name} hat geantwortet:`, m`${me.name} has replied:`, m`${me.name} har svarat:`, m`${me.name} har svart:`);
    const answeredHtml = tx(rl, m`${esc(me.name)} hat geantwortet:`, m`${esc(me.name)} has replied:`, m`${esc(me.name)} har svarat:`, m`${esc(me.name)} har svart:`);
    const yours = tx(rl, 'Deine Fragen:', 'Your questions:', 'Dina frågor:', 'Spørsmålene dine:');
    const list = questions.length ? `<ul style="margin:0 0 12px;padding-left:20px">${questions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    await ctx.mail({
      fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: rp.email, replyTo: me.email ?? undefined, subject: title,
      text: `${hello} ${first(rp.name)},\n\n${answered}\n\n${answer}\n\n${questions.length ? `${yours}\n${questions.map((x) => `– ${x}`).join('\n')}\n` : ''}`,
      html: `<div lang="${rl}" style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111"><p>${hello} ${esc(first(rp.name))},</p><p>${answeredHtml}</p><p style="white-space:pre-wrap;border-left:3px solid #ddd;padding-left:10px">${esc(answer)}</p>${questions.length ? `<p style="color:#555;margin-bottom:4px">${yours}</p>${list}` : ''}</div>`,
    }, { template: 'client_job_answer', meta: { job_id: q.related_id, notification_id: q.id } });
  }
  await ctx.db.from('notifications').update({ is_read: true }).eq('id', q.id);
  await writeLog(ctx, { task_key: `question:${q.id}`, kind: 'recruiter_question', submission_id: null, job_id: q.related_id, label: tx(lang, 'Frage vom Headhunter beantwortet', 'Answered the headhunter’s question', 'Besvarade headhunterns fråga', 'Svarte på spørsmålet fra headhunteren'), answer: answer.slice(0, 200), done_by: user.id });
  return { ok: true };
}

/** Frage an eine Kollegin oder einen Kollegen geben: dort als eigene Aufgabe, hier erledigt. */
export async function forwardQuestion(ctx: ServiceCtx, user: User, body: any) {
  const lang = bodyLang(body);
  const q = await loadQuestion(ctx, user, body?.notificationId, lang);
  const to = typeof body?.toUserId === 'string' && UUID.test(body.toUserId) ? body.toUserId : '';
  must(to && to !== user.id, tx(lang, 'Bitte eine Kollegin oder einen Kollegen wählen.', 'Please choose a colleague.', 'Välj en kollega.', 'Velg en kollega.'));
  const team = await clientTeamOf(ctx.db, q.related_id);
  const target = team.find((x) => x.userId === to);
  must(target, tx(lang, 'Diese Person gehört nicht zum Team der Stelle.', 'This person is not on the team for this role.', 'Personen ingår inte i teamet för tjänsten.', 'Personen er ikke med i teamet for stillingen.'), 'not_allowed');
  const me = await profileOf(ctx.db, user.id);
  // Titel und Fragen kommen vom Headhunter und bleiben, wie sie sind; der Zusatz in der Sprache der Kollegin
  const tl = await userLang(ctx.db, to);
  const forwarded = tx(tl, m`Weitergegeben von ${me.name}.`, m`Forwarded by ${me.name}.`, m`Vidarebefordrad av ${me.name}.`, m`Videresendt av ${me.name}.`);
  const { error } = await ctx.db.from('notifications').insert({ user_id: to, type: 'recruiter_job_questions', title: q.title, message: `${q.message}\n\n${forwarded}`, related_type: 'job', related_id: q.related_id });
  dbFail(error, 'Die Weitergabe');
  await ctx.db.from('notifications').update({ is_read: true }).eq('id', q.id);
  await writeLog(ctx, { task_key: `question:${q.id}`, kind: 'recruiter_question', submission_id: null, job_id: q.related_id, label: tx(lang, m`Frage an ${target.name} weitergegeben`, m`Question forwarded to ${target.name}`, m`Frågan vidarebefordrad till ${target.name}`, m`Spørsmålet videresendt til ${target.name}`), answer: null, done_by: user.id });
  return { ok: true, to: target.name };
}

export async function questionColleagues(ctx: ServiceCtx, user: User, body: any) {
  const q = await loadQuestion(ctx, user, body?.notificationId, bodyLang(body));
  return { colleagues: (await clientTeamOf(ctx.db, q.related_id)).filter((m) => m.userId !== user.id).map((m) => ({ userId: m.userId, name: m.name })) };
}

async function loadSubmission(ctx: ServiceCtx, user: User, id: unknown, lang: Lang | null = null) {
  must(typeof id === 'string' && UUID.test(id), tx(lang, 'Ungültige Bewerbung.', 'Invalid application.', 'Ogiltig ansökan.', 'Ugyldig søknad.'));
  const { data: s, error } = await ctx.db.from('submissions').select('id, job_id, candidate_id, recruiter_id, identity_unlocked, identity_revealed').eq('id', id).maybeSingle();
  dbFail(error, 'Die Bewerbung');
  must(s, tx(lang, 'Diese Bewerbung gibt es nicht.', 'This application does not exist.', 'Den här ansökan finns inte.', 'Denne søknaden finnes ikke.'), 'not_found');
  await requireJob(ctx, user, s.job_id, lang);
  const { data: cand } = await ctx.db.from('candidates').select('full_name').eq('id', s.candidate_id).maybeSingle();
  const { data: job } = await ctx.db.from('jobs').select('title').eq('id', s.job_id).maybeSingle();
  const unlocked = !!(s.identity_unlocked || s.identity_revealed);
  const label = unlocked && cand?.full_name ? cand.full_name : `PR-${String(s.candidate_id).slice(0, 6).toUpperCase()}`;
  // jobTitle bleibt ohne Titel leer; jeder Text setzt sein eigenes „die Stelle“ in der Sprache des Lesers
  return { s, label, jobTitle: (job?.title as string) ?? 'die Stelle', rawJobTitle: (job?.title as string) ?? null };
}

/** „Headhunter soll nachfassen“: eigene Aufgabe beim Headhunter (anrufen), Glocke. Die Kunden-Aufgabe bleibt offen. */
export async function askFollowup(ctx: ServiceCtx, user: User, body: any) {
  const { s, label, rawJobTitle } = await loadSubmission(ctx, user, body?.submissionId, bodyLang(body));
  // Aufgabe und Glocke liest der Headhunter: in seiner Sprache (du)
  const rl = await userLang(ctx.db, s.recruiter_id);
  const jobTitle = rawJobTitle ?? tx(rl, 'die Stelle', 'the role', 'tjänsten', 'stillingen');
  const why = text(body?.reason, 300) || tx(rl, 'Bitte beim Kandidaten nachfassen.', 'Please follow up with the candidate.', 'Följ upp med kandidaten.', 'Følg opp kandidaten.');
  const me = await profileOf(ctx.db, user.id);
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('recruiter_tasks').insert({
    recruiter_id: s.recruiter_id, title: tx(rl, m`Nachfassen: ${label}`, m`Follow up: ${label}`, m`Följ upp: ${label}`, m`Følg opp: ${label}`), description: `${me.name} (${jobTitle}): ${why}`,
    task_type: 'call', candidate_id: s.candidate_id, submission_id: s.id, job_id: s.job_id, due_at: nowIso, status: 'pending', priority: 'high', source: 'system',
  });
  dbFail(error, 'Die Aufgabe für den Headhunter');
  await notify(ctx.db, s.recruiter_id, 'client_followup_request', tx(rl, m`${me.name} bittet dich nachzufassen`, m`${me.name} asks you to follow up`, m`${me.name} ber dig följa upp`, m`${me.name} ber deg følge opp`), `${label} · ${jobTitle}: ${why}`, 'submission', s.id);
  return { ok: true };
}

// ---------------------------------------------------------------- 14 Antritt bestätigen

async function loadPlacement(ctx: ServiceCtx, user: User, id: unknown, lang: Lang | null = null) {
  must(typeof id === 'string' && UUID.test(id), tx(lang, 'Ungültige Einstellung.', 'Invalid hire.', 'Ogiltig anställning.', 'Ugyldig ansettelse.'));
  const { data: p, error } = await ctx.db.from('placements').select('*').eq('id', id).maybeSingle();
  dbFail(error, 'Die Einstellung');
  must(p, tx(lang, 'Diese Einstellung gibt es nicht.', 'This hire does not exist.', 'Den här anställningen finns inte.', 'Denne ansettelsen finnes ikke.'), 'not_found');
  const sub = await loadSubmission(ctx, user, p.submission_id, lang);
  return { p, ...sub };
}

export async function confirmStart(ctx: ServiceCtx, user: User, body: any) {
  const lang = bodyLang(body);
  const { p, s, label, rawJobTitle } = await loadPlacement(ctx, user, body?.placementId, lang);
  const jobIn = (l: Lang | null) => rawJobTitle ?? tx(l, 'die Stelle', 'the role', 'tjänsten', 'stillingen');
  must(p.placement_state === 'agreed' && !p.start_confirmed_at && !p.non_start_reported_at, tx(lang, 'Der Antritt ist schon gemeldet.', 'The start has already been reported.', 'Starten är redan anmäld.', 'Oppstarten er allerede meldt.'), 'conflict');
  const way = String(body?.way ?? '');
  must(['started', 'later', 'not_started'].includes(way), tx(lang, 'Bitte wählen: gestartet, später gestartet oder nicht angetreten.', 'Please choose: started, started later or did not start.', 'Välj: började, började senare eller började inte.', 'Velg: begynte, begynte senere eller begynte ikke.'));
  const nowIso = new Date(ctx.now()).toISOString();
  const today = nowIso.slice(0, 10);
  const me = await profileOf(ctx.db, user.id);
  const planned = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
  if (way === 'not_started') {
    const reason = NON_START_REASONS[body?.reason] ? body.reason : '';
    must(reason, tx(lang, 'Bitte einen Grund wählen.', 'Please choose a reason.', 'Välj ett skäl.', 'Velg en grunn.'));
    const note = text(body?.note, 1000) || null;
    const { error } = await ctx.db.from('placements').update({ non_start_reported_at: nowIso, non_start_reported_by: user.id, non_start_reason: reason, non_start_note: note }).eq('id', p.id).is('non_start_reported_at', null);
    dbFail(error, 'Die Meldung');
    const nonStartTitle = (l: Lang) => tx(l, m`Nichtantritt gemeldet: ${label}`, m`Non-start reported: ${label}`, m`Utebliven start anmäld: ${label}`, m`Manglende oppstart meldt: ${label}`);
    for (const a of await adminIds(ctx.db)) await notify(ctx.db, a, 'placement_non_start', nonStartTitle, (l) => `${jobIn(l)} · ${nonStartReason(reason, l)}${note ? ` · ${note}` : ''} · ${tx(l, m`gemeldet von ${me.name}`, m`reported by ${me.name}`, m`anmält av ${me.name}`, m`meldt av ${me.name}`)}`, 'placement', p.id);
    await notify(ctx.db, s.recruiter_id, 'placement_non_start', nonStartTitle, (l) => `${me.name}: ${nonStartReason(reason, l)}. ${tx(l, 'Matchunt prüft den Fall.', 'Matchunt is reviewing the case.', 'Matchunt granskar ärendet.', 'Matchunt vurderer saken.')}`, 'submission', s.id);
    await writeLog(ctx, { task_key: `start:${p.id}`, kind: 'confirm_start', submission_id: s.id, job_id: s.job_id, label: tx(lang, m`${label}: Nichtantritt gemeldet`, m`${label}: non-start reported`, m`${label}: utebliven start anmäld`, m`${label}: manglende oppstart meldt`), answer: nonStartReason(reason, lang), done_by: user.id });
    return { ok: true, state: 'non_start' };
  }
  const startOn = way === 'later' ? String(body?.startedOn ?? '') : planned || today;
  must(DATE.test(startOn), tx(lang, 'Bitte das Datum des ersten Arbeitstags angeben.', 'Please enter the date of the first working day.', 'Ange datumet för första arbetsdagen.', 'Oppgi datoen for første arbeidsdag.'));
  if (way === 'later') must(startOn > planned, tx(lang, 'Das Datum liegt nicht nach dem geplanten Start.', 'The date is not after the planned start.', 'Datumet ligger inte efter den planerade starten.', 'Datoen er ikke etter planlagt oppstart.'));
  const started = startOn <= today;
  const patch: Record<string, unknown> = { first_working_day: startOn };
  if (started) Object.assign(patch, { placement_state: 'started', start_confirmed_at: nowIso, start_confirmed_by: user.id });
  const { error } = await ctx.db.from('placements').update(patch).eq('id', p.id).eq('placement_state', 'agreed');
  dbFail(error, 'Der Antritt');
  const dateDeOut = `${startOn.slice(8, 10)}.${startOn.slice(5, 7)}.${startOn.slice(0, 4)}`;
  await notify(ctx.db, s.recruiter_id, 'placement_started',
    (l) => started ? tx(l, m`${label} hat angefangen`, m`${label} has started`, m`${label} har börjat`, m`${label} har begynt`) : tx(l, m`Neuer Starttermin: ${label}`, m`New start date: ${label}`, m`Nytt startdatum: ${label}`, m`Ny oppstartsdato: ${label}`),
    (l) => {
      const d = dateIn(startOn, l);
      return `${jobIn(l)} · ${started ? tx(l, `erster Arbeitstag ${d}`, `first working day ${d}`, `första arbetsdag ${d}`, `første arbeidsdag ${d}`) : tx(l, `startet am ${d}`, `starts on ${d}`, `börjar ${d}`, `begynner ${d}`)} (${tx(l, m`gemeldet von ${me.name}`, m`reported by ${me.name}`, m`anmält av ${me.name}`, m`meldt av ${me.name}`)})`;
    }, 'submission', s.id);
  await writeLog(ctx, { task_key: `start:${p.id}`, kind: 'confirm_start', submission_id: s.id, job_id: s.job_id, label: started ? tx(lang, m`${label}: Antritt bestätigt`, m`${label}: start confirmed`, m`${label}: start bekräftad`, m`${label}: oppstart bekreftet`) : tx(lang, m`${label}: neuer Starttermin`, m`${label}: new start date`, m`${label}: nytt startdatum`, m`${label}: ny oppstartsdato`), answer: dateIn(startOn, lang), done_by: user.id });
  return { ok: true, state: started ? 'started' : 'moved' };
}

// ---------------------------------------------------------------- 15 Rechnung

async function loadInvoiceForClient(ctx: ServiceCtx, user: User, id: unknown, lang: Lang | null = null) {
  must(typeof id === 'string' && UUID.test(id), tx(lang, 'Ungültige Rechnung.', 'Invalid invoice.', 'Ogiltig faktura.', 'Ugyldig faktura.'));
  const { data: inv, error } = await ctx.db.from('invoices').select('*').eq('id', id).maybeSingle();
  dbFail(error, 'Die Rechnung');
  must(inv && inv.status !== 'draft', tx(lang, 'Diese Rechnung gibt es nicht.', 'This invoice does not exist.', 'Den här fakturan finns inte.', 'Denne fakturaen finnes ikke.'), 'not_found');
  // Inhaber, Admin, HR und Buchhaltung (Etappe 1, 25.10.2026)
  must(canSeeInvoice(await billingScope(ctx.db, user.id), inv), NOT_ALLOWED(lang), 'not_allowed');
  return inv;
}

export async function invoicePaid(ctx: ServiceCtx, user: User, body: any) {
  const lang = bodyLang(body);
  const inv = await loadInvoiceForClient(ctx, user, body?.invoiceId, lang);
  const scope = await billingScope(ctx.db, user.id);
  must(scope.isAdmin || scope.canManage, tx(lang, 'Überweisungen melden Inhaber, Admins und die Buchhaltung.', 'Transfers are reported by owners, admins and accounting.', 'Överföringar anmäls av ägare, administratörer och ekonomi.', 'Overføringer meldes av eiere, administratorer og regnskap.'), 'not_allowed');
  must(['open', 'pending', 'partially_paid'].includes(inv.status), tx(lang, 'Diese Rechnung ist schon bezahlt oder storniert.', 'This invoice is already paid or cancelled.', 'Fakturan är redan betald eller makulerad.', 'Fakturaen er allerede betalt eller kreditert.'), 'conflict');
  const paidOn = String(body?.paidOn ?? '');
  must(DATE.test(paidOn), tx(lang, 'Bitte das Überweisungsdatum angeben.', 'Please enter the transfer date.', 'Ange datum för överföringen.', 'Oppgi datoen for overføringen.'));
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('invoices').update({ client_paid_reported_at: nowIso, client_paid_reported_on: paidOn, client_paid_reported_by: user.id }).eq('id', inv.id);
  dbFail(error, 'Die Meldung');
  const me = await profileOf(ctx.db, user.id);
  for (const a of await adminIds(ctx.db)) {
    await notify(ctx.db, a, 'invoice_paid_reported', (l) => tx(l, m`Kunde meldet Überweisung: ${inv.invoice_number}`, m`Client reports transfer: ${inv.invoice_number}`, m`Kund anmäler överföring: ${inv.invoice_number}`, m`Kunde melder overføring: ${inv.invoice_number}`),
      (l) => tx(l, m`${me.name}: überwiesen am ${dateIn(paidOn, l)} – bitte Zahlungseingang prüfen und buchen.`, m`${me.name}: transferred on ${dateIn(paidOn, l)} – please check the incoming payment and book it.`, m`${me.name}: överfört ${dateIn(paidOn, l)} – kontrollera inbetalningen och bokför den.`, m`${me.name}: overført ${dateIn(paidOn, l)} – kontroller innbetalingen og bokfør den.`), 'invoice', inv.id);
  }
  await writeLog(ctx, { task_key: `invoice:${inv.id}`, kind: 'invoice', submission_id: inv.submission_id ?? null, job_id: inv.job_id ?? null,
    label: tx(lang, m`Überweisung gemeldet (${inv.invoice_number})`, m`Transfer reported (${inv.invoice_number})`, m`Överföring anmäld (${inv.invoice_number})`, m`Overføring meldt (${inv.invoice_number})`),
    answer: tx(lang, `überwiesen am ${dateIn(paidOn, lang)}`, `transferred on ${dateIn(paidOn, lang)}`, `överfört ${dateIn(paidOn, lang)}`, `overført ${dateIn(paidOn, lang)}`), done_by: user.id });
  return { ok: true };
}

export async function invoiceQuestion(ctx: ServiceCtx, user: User, body: any) {
  const lang = bodyLang(body);
  const inv = await loadInvoiceForClient(ctx, user, body?.invoiceId, lang);
  const q = text(body?.question, 2000);
  must(q.length >= 3, tx(lang, 'Bitte die Frage schreiben.', 'Please write your question.', 'Skriv din fråga.', 'Skriv spørsmålet ditt.'));
  const me = await profileOf(ctx.db, user.id);
  for (const a of await adminIds(ctx.db)) await notify(ctx.db, a, 'invoice_question', (l) => tx(l, m`Frage zur Rechnung ${inv.invoice_number}`, m`Question about invoice ${inv.invoice_number}`, m`Fråga om faktura ${inv.invoice_number}`, m`Spørsmål om faktura ${inv.invoice_number}`), `${me.name}${me.email ? ` (${me.email})` : ''}: ${q}`, 'invoice', inv.id);
  return { ok: true };
}
