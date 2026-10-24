// Aufgaben des Kunden (Etappe A, 23.10.2026): leitet aus dem echten Stand ab, wo der Kunde
// dran ist – 15 Arten, je Bewerbung höchstens eine offene Aufgabe aus dem Ablauf. Dazu „läuft
// bei anderen“ (Kandidat, Headhunter, Matchunt sind dran). Aufgaben schließen sich mit der
// Handlung; nichts wird hier gespeichert außer dem Erledigt-Protokoll.
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

export type ClientTaskKind =
  | 'review' | 'alternative' | 'expired_request' | 'feedback' | 'decide_unsure' | 'make_offer'
  | 'counter' | 'offer_overdue' | 'send_contract' | 'contract_signed_check' | 'docusign_sign'
  | 'confirm_signature' | 'recruiter_question' | 'confirm_start' | 'invoice';

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
  ref: { interviewId?: string; offerId?: string; contractId?: string; placementId?: string; invoiceId?: string; notificationId?: string; questions?: string[]; signMode?: 'email' | 'embedded'; signerExternal?: boolean };
  /** Zusatz, z. B. „Frage an Marko gestellt“ – die Aufgabe bleibt trotzdem offen */
  note: string | null;
  /** Entscheidungshilfe: was der Kunde zum Entscheiden braucht (Fenster oben, Zeile auf der Seite) */
  context: TaskContext | null;
}

export interface TaskChip { text: string; tone: 'good' | 'warn' | 'bad' }
export interface TaskFact { label: string; value: string; chip?: TaskChip | null }
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
  compare: { heads: string[]; rows: { label: string; cells: string[]; changed: boolean }[] } | null;
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
}

const DAY = 86400000;
const CLOSED = ['placed', 'hired', 'rejected', 'client_rejected', 'withdrawn', 'expired'];
const OPEN_OFFER = ['with_recruiter', 'considering', 'countered'];
const BOOKED = ['scheduled', 'confirmed', 'completed', 'no_show'];

const t = (v: unknown) => (typeof v === 'string' && v ? Date.parse(v) : NaN);
const iso = (ms: number) => new Date(ms).toISOString();
const dateDe = (key: string | null | undefined) => {
  if (!key) return '';
  const [y, m, d] = String(key).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};
const when = (isoStr: string) => `${formatBerlinDateShort(isoStr)} ${formatBerlinTime(isoStr)}`;
const euro = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
const euroCents = (c: number | null | undefined) => (c == null ? '' : `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100)} €`);
const first = (name: string) => name.split(/\s+/)[0];

function parseFeedback(raw: unknown): { way: string | null; at: number; text: string | null; missing: string | null } {
  if (!raw) return { way: null, at: NaN, text: null, missing: null };
  let v: any = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return { way: null, at: NaN, text: null, missing: null }; }
  }
  const r = v?.recommendation;
  const way = r === 'proceed' ? 'next_round' : r === 'maybe' ? 'unsure' : typeof r === 'string' ? r : null;
  return { way, at: t(v?.submitted_at), text: typeof v?.impression === 'string' ? v.impression : (typeof v?.summary === 'string' ? v.summary : null), missing: typeof v?.concerns === 'string' && v.concerns ? v.concerns : null };
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
const fact = (label: string, value: string | null | undefined, chip?: TaskChip | null): TaskFact[] => (value ? [{ label, value, chip: chip ?? null }] : []);

const NOTICE: Record<string, string> = {
  immediate: 'sofort', immediately: 'sofort', '2_weeks': '2 Wochen', '1_month': '1 Monat', '6_weeks': '6 Wochen',
  '2_months': '2 Monate', '3_months': '3 Monate', '3_months_eoq': '3 Monate zum Quartalsende', '6_months': '6 Monate',
};
/** Kündigungsfrist lesbar, nie als Rohwert („3_months“ → „3 Monate“). */
export function noticeLabel(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
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
const noticeSentence = (n: string) => (/^\d+ \S+/.test(n) ? n.replace(/^(\d+ \S+)/, '$1 Kündigungsfrist') : `${n} Kündigungsfrist`);
const REMOTE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'vor Ort', flexible: 'flexibel' };
const FORMAT: Record<string, string> = { teams: 'Teams', video: 'Video', phone: 'Telefon', onsite: 'vor Ort' };
/** „Tessas“, „Max’“ */
const genitive = (n: string) => (/[sßxz]$/i.test(n) ? `${n}’` : `${n}s`);
const cap = (s: unknown) => (typeof s === 'string' && s ? s[0].toUpperCase() + s.slice(1) : null);
const tsd = (n: number) => `${Math.round(n / 1000)}`;

/** wie anon_region_broad */
export function regionBroad(city: unknown): string | null {
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
  return rules.find(([re]) => re.test(c))?.[1] ?? 'DACH';
}

/** wie anon_experience_band */
function experienceBand(years: unknown): string | null {
  const y = Number(years);
  if (years == null || !Number.isFinite(y)) return null;
  return y < 2 ? '0–2 Jahre' : y < 5 ? '3–5 Jahre' : y < 10 ? '6–10 Jahre' : y < 15 ? '10–15 Jahre' : '15+ Jahre';
}

/** Gehaltswunsch als 10-T€-Band wie anon_salary_band (auch nach Freigabe nur das Band). */
export function wishBand(c: any): { lo: number; hi: number } | null {
  const v = Number(c?.expected_salary ?? c?.salary_expectation_max);
  if (!Number.isFinite(v) || v <= 0) return null;
  const lo = Math.floor(v / 10000) * 10000;
  return { lo, hi: lo + 10000 };
}

/** Etikett Gehaltswunsch gegen das Budget der Stelle; ohne Obergrenze keins. */
export function budgetChip(b: { lo: number; hi: number } | null, job: any): TaskChip | null {
  const max = Number(job?.salary_max);
  if (!b || !Number.isFinite(max) || max <= 0) return null;
  if (b.hi <= max) return { text: 'im Budget', tone: 'good' };
  if (b.lo <= max) return { text: 'am oberen Rand', tone: 'warn' };
  return { text: 'über Budget', tone: 'bad' };
}

function jobRange(job: any): string | null {
  const min = Number(job?.salary_min), max = Number(job?.salary_max);
  const hasMin = Number.isFinite(min) && min > 0, hasMax = Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) return `${tsd(min)}–${tsd(max)} T€`;
  if (hasMax) return `bis ${tsd(max)} T€`;
  if (hasMin) return `ab ${tsd(min)} T€`;
  return null;
}

/** Kalendertage von heute (Berlin) bis zu einem Datum; negativ = vorbei */
function daysTo(key: string | null | undefined, now: number): number | null {
  if (!key) return null;
  const d = Date.parse(`${String(key).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d)) return null;
  return Math.round((d - Date.parse(`${berlinDateKey(now)}T12:00:00Z`)) / DAY);
}
const inDays = (n: number | null) => (n === null ? '' : n === 0 ? 'heute' : n === 1 ? 'morgen' : n > 1 ? `in ${n} Tagen` : n === -1 ? 'gestern' : `vor ${-n} Tagen`);

/** Monate addieren (Probezeit-Ende = Start + n Monate − 1 Tag) */
function plusMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d) - DAY);
  return end.toISOString().slice(0, 10);
}

function offerTerms(o: any): string {
  return [`${euro(o.salary_offered)}${o.variable_salary ? ` + ${euro(o.variable_salary)}` : ''}`, o.start_date ? `Start ${dateDe(o.start_date)}` : null].filter(Boolean).join(' · ');
}

export function deriveClientTasks(input: ClientTaskInput): { tasks: ClientTask[]; waiting: WaitingItem[]; news: NewsItem[] } {
  const { now } = input;
  const jobById = new Map(input.jobs.map((j) => [j.id, j]));
  const candById = new Map(input.candidates.map((c) => [c.id, c]));
  const recName = new Map(input.recruiters.map((r) => [r.user_id, r.full_name as string]));
  const doneKeys = new Set(input.log.map((l) => l.task_key));
  const tasks: ClientTask[] = [];
  const waiting: WaitingItem[] = [];

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
    if (!mates.length) return { text: 'Bisher der einzige Kandidat für diese Stelle', iv, off };
    const parts = [iv ? `${iv} im Interview` : null, off ? `${off} mit Angebot` : null].filter(Boolean);
    return { text: `Außerdem für diese Stelle: ${mates.length} ${mates.length === 1 ? 'Kandidat' : 'Kandidaten'}${parts.length ? ` · ${parts.join(' · ')}` : ''}`, iv, off };
  };

  /** Kurzprofil wie im Bewerberprofil (ohne Freigabe nur Bänder) */
  const profile = (s: any, cand: any, job: any) => {
    const unlocked = !!(s.identity_unlocked || s.identity_revealed);
    const exp = unlocked && cand?.experience_years != null ? `${cand.experience_years} J. Erfahrung` : experienceBand(cand?.experience_years);
    const role = [cand?.job_title, cap(cand?.seniority)].filter(Boolean).join(' · ') || null;
    const region = unlocked && cand?.city ? String(cand.city) : regionBroad(cand?.city);
    const model = REMOTE[String(cand?.remote_preference ?? '')] ?? null;
    const notice = noticeLabel(cand?.notice_period);
    const availDays = daysTo(cand?.availability_date, now);
    const avail = [cand?.availability_date ? (availDays !== null && availDays <= 0 ? 'sofort' : `ab ${dateDe(cand.availability_date)}`) : null,
      notice ? (notice === 'sofort' ? (cand?.availability_date ? null : 'sofort') : noticeSentence(notice)) : null].filter(Boolean).join(' · ') || null;
    const band = wishBand(cand);
    const chip = budgetChip(band, job);
    const range = jobRange(job);
    const wish = band ? `${tsd(band.lo)}–${tsd(band.hi)} T€` : null;
    const skills = (Array.isArray(cand?.skills) ? cand.skills : []).filter((x: unknown) => typeof x === 'string' && x.trim()).slice(0, 4) as string[];
    return {
      facts: [
        ...fact('Rolle', [role, exp].filter(Boolean).join(' · ')),
        ...fact('Gehaltswunsch', wish ? `${wish}${range ? ` · Ihre Stelle ${range}` : ''}` : null, chip),
        ...fact('Verfügbar', avail),
        ...fact('Ort · Modell', [region, model].filter(Boolean).join(' · ')),
        ...fact('Stärken', skills.join(', ')),
      ],
      line: [role, exp, wish ? `Wunsch ${wish}` : null, region, avail, skills.slice(0, 3).join(', ') || null].filter(Boolean) as string[],
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
    const name = unlocked && cand?.full_name ? first(cand.full_name) : 'Der Kandidat';
    // im Satz klein und gebeugt: „Hat der Kandidat …“, „mit dem Kandidaten“, „für den Kandidaten“
    const nameIn = unlocked && cand?.full_name ? first(cand.full_name) : 'der Kandidat';
    const nameDat = unlocked && cand?.full_name ? first(cand.full_name) : 'dem Kandidaten';
    const nameAkk = unlocked && cand?.full_name ? first(cand.full_name) : 'den Kandidaten';
    const hh = recName.get(s.recruiter_id) ?? 'Ihr Headhunter';
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
    const askNote = askedOpen ? `Frage an ${hhFirst} gestellt am ${formatBerlinDateShort(askedOpen.created_at)} – Antwort steht noch aus` : null;
    if (askedOpen) wait({ key: `question-open:${s.id}`, by: 'recruiter', title: `${hhFirst} beantwortet Ihre Frage`, detail: `gestellt am ${formatBerlinDateShort(askedOpen.created_at)}` });

    // ---------------------------------------------------------------- nach der Einstellung
    const pl = placementBySub.get(s.id);
    if (pl) {
      const startKey = pl.first_working_day ?? pl.start_date;
      const startMs = startKey ? Date.parse(`${String(startKey).slice(0, 10)}T00:00:00Z`) : NaN;
      if (pl.placement_state === 'agreed' && !pl.start_confirmed_at && !pl.non_start_reported_at && !Number.isNaN(startMs)) {
        if (startMs <= now) {
          const probation = Number(accepted?.probation_months);
          const pkg = pl.package_key ? cap(String(pl.package_key)) : null;
          push({ key: `start:${pl.id}`, kind: 'confirm_start', since: iso(startMs), urgent: now - startMs > 3 * DAY, waitingWho: hh,
            title: `Hat ${nameIn} angefangen?`, detail: `Erster Arbeitstag laut Vertrag: ${dateDe(startKey)}`, ref: { placementId: pl.id },
            context: ctxOf({
              ask: `Hat ${nameIn} angefangen?`,
              facts: [
                ...fact('Erster Tag', `${dateDe(startKey)} · ${inDays(daysTo(startKey, now))}`),
                ...fact('Probezeit', Number.isFinite(probation) && probation > 0 ? `${probation} Monate · bis ${dateDe(plusMonthsKey(String(startKey), probation))}` : null),
                ...fact('Garantie', pl.continuity_end_date ? `${pkg ? `${pkg} · ` : ''}bis ${dateDe(pl.continuity_end_date)}` : null),
              ],
              line: [`Start ${dateDe(startKey)}`, Number.isFinite(probation) && probation > 0 ? `Probezeit bis ${dateDe(plusMonthsKey(String(startKey), probation))}` : null].filter(Boolean) as string[],
              foot: `${hhFirst} erfährt Ihre Antwort sofort.`,
            }) });
        } else {
          wait({ key: `start-wait:${pl.id}`, by: 'date', title: `Start am ${dateDe(startKey)}`, detail: `${hhFirst} begleitet ${name} bis zum ersten Tag` });
        }
      } else if (pl.non_start_reported_at) {
        wait({ key: `nonstart:${pl.id}`, by: 'matchunt', title: 'Nichtantritt gemeldet', detail: 'Matchunt prüft den Fall und meldet sich' });
      }
      continue;
    }
    if (CLOSED.includes(String(s.stage ?? '')) || CLOSED.includes(String(s.status ?? ''))) continue;
    if (job.status && !['published', 'active', 'paused'].includes(job.status)) continue;

    // ---------------------------------------------------------------- Vertrag
    const c = contractBySub.get(s.id);
    // Vertragsdaten aus der Zusage (Fenster „Arbeitsvertrag schicken“)
    const contractCtx = (cc: any, declined: boolean) => {
      const start = cc.start_date ?? accepted?.start_date ?? null;
      const probation = accepted?.probation_months;
      const fixedTerm = cc.fixed_term ?? (accepted?.contract_type === 'fixed_term');
      const later: TaskChip = { text: 'im Vertrag festlegen', tone: 'warn' };
      const notice = noticeLabel(cand?.notice_period);
      return ctxOf({
        ask: declined ? `Arbeitsvertrag für ${nameAkk} neu schicken` : `Arbeitsvertrag für ${nameAkk} schicken`,
        facts: [
          ...fact('Start', start ? `${dateDe(start)} · ${inDays(daysTo(start, now))}` : null),
          ...fact('Gehalt', cc.salary ? `${euro(cc.salary)}${cc.variable_salary ? ` + ${euro(cc.variable_salary)} variabel` : ''}` : null),
          { label: 'Vertrag', value: fixedTerm ? 'befristet' : 'unbefristet' },
          { label: 'Probezeit', value: probation == null ? 'nicht im Angebot' : probation ? `${probation} Monate` : 'ohne Probezeit', chip: probation == null ? later : null },
          { label: 'Arbeitsmodell', value: accepted?.work_model || 'nicht im Angebot', chip: accepted?.work_model ? null : later },
          ...fact('Extras', Array.isArray(accepted?.extras) && accepted.extras.length ? accepted.extras.join(', ') : null),
          ...fact('Kündigungsfrist', notice && notice !== 'sofort' ? `${notice} laut Profil` : null),
        ],
        line: [cc.salary ? `${euro(cc.salary)}${cc.variable_salary ? ` + ${euro(cc.variable_salary)}` : ''}` : null, start ? `Start ${dateDe(start)} · ${inDays(daysTo(start, now))}` : null].filter(Boolean) as string[],
        quote: declined && cc.decline_reason ? { by: 'DocuSign', text: clip(cc.decline_reason) } : null,
        why: accepted?.decision_at ? `${name} hat am ${formatBerlinDateShort(accepted.decision_at)} zugesagt · ${hhFirst} hält Kontakt` : `${hhFirst} hält Kontakt zu ${nameDat}`,
        foot: fixedTerm || cc.non_compete ? 'Befristung oder Wettbewerbsverbot: bitte auf Papier unterschreiben lassen (Schriftform).' : null,
      });
    };
    if (c && c.status === 'declined') {
      // DocuSign abgelehnt: neu schicken (digital oder selbst)
      push({ key: `contract-send:${c.id}:declined`, kind: 'send_contract', since: c.updated_at ?? c.created_at, urgent: true, waitingWho: name,
        title: 'Arbeitsvertrag neu schicken', detail: 'Der Umschlag in DocuSign wurde abgelehnt', ref: { contractId: c.id }, context: contractCtx(c, true) });
      continue;
    }
    if (c && !['final', 'declined', 'dropped', 'voided'].includes(c.status)) {
      if (c.status === 'preparing') {
        push({ key: `contract-send:${c.id}`, kind: 'send_contract', since: c.created_at, urgent: true, waitingWho: name,
          title: 'Arbeitsvertrag schicken', detail: `Zusage${c.salary ? `: ${euro(c.salary)}${c.variable_salary ? ` + ${euro(c.variable_salary)}` : ''}` : ''}${c.start_date ? ` · Start ${dateDe(c.start_date)}` : ''}`, ref: { contractId: c.id },
          context: contractCtx(c, false) });
      } else if (c.status === 'sent_self') {
        const sent = t(c.sent_at) || t(c.updated_at);
        if (now - sent >= 7 * DAY) {
          // „Noch nicht“ gilt eine Woche: danach neue Woche, neue Frage
          const start = c.start_date ?? accepted?.start_date ?? null;
          push({ key: `contract-check:${c.id}:${Math.floor((now - sent - 7 * DAY) / (7 * DAY))}`, kind: 'contract_signed_check', since: iso(sent + 7 * DAY), urgent: false, waitingWho: null,
            title: `Hat ${nameIn} den Vertrag unterschrieben?`, detail: `Von Ihnen verschickt am ${formatBerlinDateShort(iso(sent))}`, ref: { contractId: c.id },
            context: ctxOf({
              ask: `Hat ${nameIn} den Vertrag unterschrieben?`,
              facts: [
                ...fact('Verschickt', `${formatBerlinDateShort(iso(sent))} · vor ${Math.floor((now - sent) / DAY)} Tagen`),
                ...fact('Start', start ? `${dateDe(start)} · ${inDays(daysTo(start, now))}` : null),
                ...fact('Gehalt', c.salary ? `${euro(c.salary)}${c.variable_salary ? ` + ${euro(c.variable_salary)}` : ''}` : null),
              ],
              line: [`verschickt vor ${Math.floor((now - sent) / DAY)} Tagen`, start ? `Start ${inDays(daysTo(start, now))}` : null].filter(Boolean) as string[],
              why: `${hhFirst} hält Kontakt zu ${nameDat}.`,
            }) });
        } else {
          wait({ key: `contract-self:${c.id}`, by: 'candidate', title: `Vertrag liegt bei ${name}`, detail: `verschickt am ${formatBerlinDateShort(iso(sent))} · melden Sie die Unterschrift, sobald sie da ist` });
        }
      } else if (c.status === 'sent_digital' && c.signing_mode === 'embedded' && !c.company_signed_at && c.company_signer_user_id !== input.userId) {
        // Über Matchunt, und jemand anderes unterschreibt für die Firma: läuft bei ihr bzw. ihm
        const l = (input.signLinks ?? []).filter((x: any) => x.contract_id === c.id && x.signer_role === 'company').sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
        const linkState = l ? `Link verschickt ${formatBerlinDateShort(l.sent_at)} · ${l.opened_at ? `geöffnet ${formatBerlinDateShort(l.opened_at)}` : 'noch nicht geöffnet'}` : 'Link per Mail';
        const signer = c.company_signer_name ?? 'Ihr Unterzeichner';
        if (!c.company_signer_user_id && now - (t(c.sent_at) || now) >= 2 * DAY) {
          // 2 Tage ohne Unterschrift der Firma: wird zur Aufgabe des Kunden
          push({ key: `sign-company-late:${c.id}`, kind: 'docusign_sign', since: iso(t(c.sent_at) + 2 * DAY), urgent: true, waitingWho: name,
            title: `${signer} hat noch nicht unterschrieben`, detail: linkState, ref: { contractId: c.id, signMode: 'embedded', signerExternal: true },
            context: ctxOf({
              ask: `${signer} hat noch nicht unterschrieben`,
              timeline: [
                { text: `${c.sent_at ? `${when(c.sent_at)} · ` : ''}Vertrag hochgeladen`, state: 'done' },
                { text: `${signer} unterschreibt für die Firma · ${linkState}`, state: 'now' },
                { text: `danach ${nameIn} (Link per Mail von Matchunt)`, state: 'next' },
              ],
              line: [linkState],
              foot: 'Mail nicht angekommen? Link erneut senden oder eine andere Person unterschreiben lassen, auch Sie selbst.',
            }) });
        } else {
          wait({ key: `sign-company:${c.id}`, by: 'date', title: `${signer} unterschreibt für die Firma`, detail: c.company_signer_user_id ? 'in Matchunt' : linkState });
        }
      } else if (c.status === 'sent_digital') {
        if (!c.company_signed_at) {
          const viaMatchunt = c.signing_mode === 'embedded';
          push({ key: `docusign:${c.id}`, kind: 'docusign_sign', since: c.sent_at ?? c.updated_at, urgent: true, waitingWho: name,
            title: viaMatchunt ? 'Arbeitsvertrag unterschreiben' : 'In DocuSign unterschreiben',
            detail: viaMatchunt ? `Sie unterschreiben zuerst, hier in Matchunt; danach ${nameIn}` : `${c.company_signer_name ?? 'Ihr Unterzeichner'} unterschreibt zuerst${c.company_signer_email ? ` (${c.company_signer_email})` : ''}, danach ${nameIn}`,
            ref: { contractId: c.id, signMode: viaMatchunt ? 'embedded' : 'email' },
            context: viaMatchunt ? ctxOf({
              ask: 'Sie unterschreiben zuerst',
              timeline: [
                { text: `${c.sent_at ? `${when(c.sent_at)} · ` : ''}Vertrag hochgeladen`, state: 'done' },
                { text: 'Ihre Unterschrift, hier in Matchunt', state: 'now' },
                { text: `danach ${nameIn} (Link per Mail von Matchunt)`, state: 'next' },
              ],
              line: ['Sie zuerst, in Matchunt', c.sent_at ? `hochgeladen ${formatBerlinDateShort(c.sent_at)}` : null].filter(Boolean) as string[],
            }) : ctxOf({
              ask: 'Sie unterschreiben zuerst',
              timeline: [
                { text: `${c.sent_at ? `${when(c.sent_at)} · ` : ''}an DocuSign übergeben`, state: 'done' },
                { text: `Unterschrift ${c.company_signer_name ?? 'Ihres Unterzeichners'}${c.company_signer_email ? ` · DocuSign-Mail an ${c.company_signer_email}` : ''}`, state: 'now' },
                { text: `danach ${nameIn}${unlocked && c.candidate_email ? ` (${c.candidate_email})` : ''}`, state: 'next' },
              ],
              line: [`${c.company_signer_name ?? 'Ihr Unterzeichner'} zuerst`, c.sent_at ? `verschickt ${formatBerlinDateShort(c.sent_at)}` : null].filter(Boolean) as string[],
              foot: 'Mail nicht gefunden? „Anderer Unterzeichner“ stellt auf die Unterschrift über Matchunt um, ohne neues Hochladen.',
            }) });
        } else {
          wait({ key: `docusign-cand:${c.id}`, by: 'candidate', title: `${name} unterschreibt in DocuSign`, detail: `Ihre Unterschrift ist da (${formatBerlinDateShort(c.company_signed_at)})` });
        }
      } else if (c.status === 'company_signed' && c.signing_mode === 'embedded') {
        const l = (input.signLinks ?? []).filter((x: any) => x.contract_id === c.id && x.signer_role === 'candidate').sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
        wait({ key: `docusign-cand:${c.id}`, by: 'candidate', title: `${name} unterschreibt`, detail: l ? `Link verschickt ${formatBerlinDateShort(l.sent_at)} · ${l.opened_at ? `geöffnet ${formatBerlinDateShort(l.opened_at)}` : 'noch nicht geöffnet'}` : 'Link per Mail von Matchunt' });
      } else if (c.status === 'reported') {
        push({ key: `confirm:${c.id}`, kind: 'confirm_signature', since: c.reported_at ?? c.updated_at, urgent: true, waitingWho: hh,
          title: 'Unterschrift bestätigen', detail: `${c.reported_role === 'admin' ? 'Matchunt' : hhFirst} meldet: unterschrieben am ${dateDe(c.signed_on)}${c.salary ? ` · ${euro(c.salary)}${c.variable_salary ? ` + ${euro(c.variable_salary)}` : ''}` : ''}${c.start_date ? ` · Start ${dateDe(c.start_date)}` : ''}`, ref: { contractId: c.id },
          context: (() => {
            const by = c.reported_role === 'admin' ? 'Matchunt' : hh;
            const row = (label: string, a: unknown, b: unknown, fmt: (v: any) => string) => {
              const x = a == null || a === '' ? '–' : fmt(a), y = b == null || b === '' ? '–' : fmt(b);
              return { label, cells: [x, y], changed: x !== '–' && y !== '–' && x !== y };
            };
            const rows = [
              { label: 'Unterschrieben', cells: [dateDe(c.signed_on) || '–', '–'], changed: false },
              row('Fixgehalt', c.salary, accepted?.salary_offered, euro),
              row('Variabel', c.variable_salary, accepted?.variable_salary, euro),
              row('Start', c.start_date, accepted?.start_date, dateDe),
            ];
            const off = rows.filter((r) => r.changed).length;
            return ctxOf({
              ask: `Stimmt das? ${by === 'Matchunt' ? 'Matchunt' : hhFirst} meldet die Unterschrift`,
              compare: { heads: ['Gemeldet', 'Zusage'], rows },
              line: [`gemeldet von ${by}`, off ? `${off} ${off === 1 ? 'Wert weicht' : 'Werte weichen'} von der Zusage ab` : 'wie zugesagt'],
              chip: off ? { text: 'weicht ab', tone: 'warn' } : null,
              quote: c.report_note ? { by, text: clip(c.report_note) } : null,
              foot: 'Mit „Stimmt“ wird die Einstellung verbindlich und die Rechnung vorbereitet.',
            });
          })() });
      } else if (c.status === 'signed') {
        wait({ key: `contract-undo:${c.id}`, by: 'date', title: 'Unterschrift gemeldet', detail: c.undo_until ? `verbindlich ab ${when(c.undo_until)} · bis dahin rücknehmbar` : 'wird verbindlich' });
      } else if (c.status === 'company_signed') {
        wait({ key: `docusign-cand:${c.id}`, by: 'candidate', title: `${name} unterschreibt`, detail: 'Ihre Unterschrift ist da' });
      }
      continue;
    }

    // ---------------------------------------------------------------- Angebot
    const offers = (offersBySub.get(s.id) ?? []).slice().sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
    const offer = offers.find((o: any) => OPEN_OFFER.includes(o.status)) ?? null;
    if (offer) {
      const due = offer.status === 'considering' ? (offer.candidate_response?.until ?? offer.response_due) : offer.response_due;
      const dueMs = due ? Date.parse(`${String(due).slice(0, 10)}T23:59:59Z`) : NaN;
      if (offer.status === 'countered') {
        const wish = offer.candidate_response?.wish ?? {};
        const parts = [wish.salary ? `${euro(wish.salary)} fix` : null, wish.variable ? `${euro(wish.variable)} variabel` : null, wish.startDate ? `Start ${dateDe(wish.startDate)}` : null, wish.other ?? null].filter(Boolean);
        const cell = (v: unknown, fmt: (x: any) => string) => (v == null || v === '' ? '–' : fmt(v));
        const rows = [
          { label: 'Fixgehalt', cells: [cell(offer.salary_offered, euro), cell(wish.salary ?? offer.salary_offered, euro), jobRange(job) ?? '–'], changed: !!wish.salary && wish.salary !== offer.salary_offered },
          { label: 'Variabel', cells: [cell(offer.variable_salary, euro), cell(wish.variable ?? offer.variable_salary, euro), '–'], changed: wish.variable != null && wish.variable !== offer.variable_salary },
          { label: 'Start', cells: [cell(offer.start_date, dateDe), cell(wish.startDate ?? offer.start_date, dateDe), '–'], changed: !!wish.startDate && wish.startDate !== offer.start_date },
          ...(offer.work_model ? [{ label: 'Arbeitsmodell', cells: [String(offer.work_model), String(offer.work_model), '–'], changed: false }] : []),
          ...(wish.other ? [{ label: 'Sonstiges', cells: ['–', String(wish.other), '–'], changed: true }] : []),
        ];
        const feeNow = fee(Number(offer.salary_offered ?? 0) + Number(offer.variable_salary ?? 0));
        const feeWish = fee(Number(wish.salary ?? offer.salary_offered ?? 0) + Number(wish.variable ?? offer.variable_salary ?? 0));
        const reason = offer.candidate_response?.reason ?? offer.candidate_response?.note ?? null;
        push({ key: `counter:${offer.id}`, kind: 'counter', since: offer.counter_offer_at ?? offer.updated_at, urgent: true, waitingWho: name,
          title: 'Gegenwunsch beantworten', detail: `${name} wünscht ${parts.join(' · ') || 'Änderungen'}`, ref: { offerId: offer.id },
          context: ctxOf({
            ask: `${name} hat einen Gegenwunsch`,
            compare: { heads: ['Ihr Angebot', unlocked && cand?.full_name ? `${genitive(name)} Wunsch` : 'Wunsch', 'Rahmen Stelle'], rows },
            line: [wish.salary ? `Wunsch ${euro(wish.salary)} statt ${euro(offer.salary_offered)}` : null, wish.startDate ? `Start ${dateDe(wish.startDate)} statt ${dateDe(offer.start_date)}` : null, wish.other ? clip(wish.other, 60) : null].filter(Boolean) as string[],
            chip: wish.salary ? budgetChip({ lo: wish.salary, hi: wish.salary }, job) : null,
            quote: reason ? { by: hh, text: clip(reason) } : null,
            why: feeNow && feeWish && feeWish !== feeNow ? `Honorar beim Wunsch: ${euro(feeWish)} statt ${euro(feeNow)} zzgl. USt. (${pct} % vom Zielgehalt)` : null,
            foot: [offer.response_due ? `Antwortfrist ${dateDe(offer.response_due)}` : null, `Version ${offer.version ?? 1}`].filter(Boolean).join(' · '),
          }) });
      } else if (!Number.isNaN(dueMs) && dueMs < now) {
        push({ key: `overdue:${offer.id}:${String(due).slice(0, 10)}`, kind: 'offer_overdue', since: iso(dueMs), urgent: false, waitingWho: null,
          title: `${name} hat noch nicht geantwortet`, detail: `Antwortfrist ${dateDe(due)} ist vorbei`, ref: { offerId: offer.id },
          context: ctxOf({
            ask: `${name} hat auf Ihr Angebot nicht geantwortet`,
            facts: [
              ...fact('Angebot', offerTerms(offer)),
              ...fact('Verschickt', offer.sent_at ? `${formatBerlinDateShort(offer.sent_at)} · Version ${offer.version ?? 1}` : null),
              ...fact('Frist', `${dateDe(due)} · ${inDays(daysTo(due, now))}`),
              ...fact('Zuletzt', offer.status === 'considering' ? `${name} überlegt noch (laut ${hhFirst})` : `${hhFirst} hat das Angebot überbracht`),
            ],
            line: [offerTerms(offer), `Frist war ${dateDe(due)}`],
            why: others(job.id, s.id).text,
          }) });
      } else {
        wait({ key: `offer-wait:${offer.id}`, by: 'recruiter', title: `${hhFirst} bespricht Ihr Angebot mit ${name}`, detail: due ? `Antwort bis ${dateDe(due)}` : 'Antwort folgt' });
      }
      continue;
    }
    // Ein Angebot gab es schon (abgelehnt, zurückgezogen, ersetzt): keine neue „Angebot machen“-Aufgabe
    if (offers.length > 0) continue;

    // ---------------------------------------------------------------- Interviews
    const ivs = (ivBySub.get(s.id) ?? []).filter((i: any) => i.status !== 'superseded').sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
    const latest = ivs[0] ?? null;
    if (!latest) {
      // 1 Kandidat prüfen
      const sub = t(s.submitted_at);
      push({ key: `review:${s.id}`, kind: 'review', since: s.submitted_at, urgent: now - sub > 2 * DAY, waitingWho: hh,
        title: 'Kandidat prüfen', detail: `eingereicht von ${hh} am ${formatBerlinDateShort(s.submitted_at)}`, ref: {}, note: askNote,
        context: (() => {
          const pf = profile(s, cand, job);
          const o = others(job.id, s.id);
          const note = clip(s.recruiter_notes);
          return ctxOf({
            ask: `Wollen Sie ${unlocked && cand?.full_name ? first(cand.full_name) : who} kennenlernen?`,
            facts: [...fact('Eingereicht', `${formatBerlinDateShort(s.submitted_at)} von ${hh}`), ...pf.facts], line: pf.line, chip: pf.chip,
            quote: note ? { by: hh, text: note } : null,
            why: o.iv || o.off ? `${o.text} – andere sind schon weiter` : o.text,
          });
        })() });
      continue;
    }
    if (latest.status === 'counter_proposed') {
      const want = slotStarts(latest.counter_slots)[0];
      push({ key: `alt:${latest.id}`, kind: 'alternative', since: latest.updated_at ?? latest.created_at, urgent: true, waitingWho: name,
        title: 'Andere Zeit bestätigen', detail: `${name} fragt ${want ? when(iso(want)) : 'eine andere Zeit'} an`, ref: { interviewId: latest.id },
        context: ctxOf({
          ask: want ? `Passt Ihnen ${when(iso(want))}?` : `${name} bittet um eine andere Zeit`,
          facts: [
            ...fact('Gewünscht', want ? formatBerlinRange(want, latest.duration_minutes ?? 60) : null),
            ...fact('Ihre Vorschläge', slotStarts(latest.proposed_slots).slice(0, 3).map((x) => when(iso(x))).join(' · ')),
            ...fact('Gespräch', [`Runde ${latest.round ?? 1}`, FORMAT[String(latest.meeting_format ?? '')] ?? null, `${latest.duration_minutes ?? 60} Min.`].filter(Boolean).join(' · ')),
          ],
          line: [want ? `wünscht ${when(iso(want))}` : null, `Runde ${latest.round ?? 1}`, FORMAT[String(latest.meeting_format ?? '')] ?? null].filter(Boolean) as string[],
          quote: latest.candidate_message ? { by: name, text: clip(latest.candidate_message) } : null,
        }) });
      continue;
    }
    if (latest.status === 'pending_response') {
      if (requestExpired(latest, now)) {
        const lastSlot = Math.max(...slotStarts(latest.proposed_slots), t(latest.response_token_expires_at) || 0);
        push({ key: `expired:${latest.id}`, kind: 'expired_request', since: iso(Number.isFinite(lastSlot) && lastSlot > 0 ? Math.min(lastSlot, now) : now), urgent: false, waitingWho: null,
          title: `${name} hat nicht geantwortet`, detail: `Vorschläge vom ${formatBerlinDateShort(latest.created_at)} sind abgelaufen`, ref: { interviewId: latest.id },
          context: ctxOf({
            ask: `${name} hat auf Ihre Terminvorschläge nicht reagiert`,
            facts: [
              ...fact('Angefragt', `${formatBerlinDateShort(latest.created_at)} · vor ${Math.max(0, Math.floor((now - t(latest.created_at)) / DAY))} Tagen`),
              ...fact('Vorschläge', slotStarts(latest.proposed_slots).slice(0, 4).map((x) => when(iso(x))).join(' · ')),
              ...fact('Gespräch', [`Runde ${latest.round ?? 1}`, FORMAT[String(latest.meeting_format ?? '')] ?? null].filter(Boolean).join(' · ')),
            ],
            line: [`angefragt ${formatBerlinDateShort(latest.created_at)}`, `Runde ${latest.round ?? 1}`],
            why: others(job.id, s.id).text,
            foot: `${hhFirst} kann ${nameAkk} anrufen und nachfragen.`,
          }) });
      } else {
        wait({ key: `iv-wait:${latest.id}`, by: 'candidate', title: `${name} wählt einen Termin`, detail: `angefragt am ${formatBerlinDateShort(latest.created_at)}${(latest.round ?? 1) > 1 ? ` · Runde ${latest.round}` : ''}` });
      }
      continue;
    }
    if (BOOKED.includes(latest.status) && latest.scheduled_at) {
      const start = t(latest.scheduled_at);
      const end = start + (latest.duration_minutes ?? 60) * 60000;
      const fb = parseFeedback(latest.feedback);
      if (start > now) {
        wait({ key: `iv-date:${latest.id}`, by: 'date', title: `Interview${(latest.round ?? 1) > 1 ? ` (Runde ${latest.round})` : ''} am ${when(latest.scheduled_at)}`, detail: 'Termin steht' });
        continue;
      }
      if (!fb.way) {
        // 4 Feedback geben
        push({ key: `feedback:${latest.id}`, kind: 'feedback', since: iso(Math.min(end, now)), urgent: true, waitingWho: `${name} und ${hhFirst}`,
          title: 'Feedback geben', detail: `Interview${(latest.round ?? 1) > 1 ? ` ${latest.round}` : ''} am ${when(latest.scheduled_at)}`, ref: { interviewId: latest.id },
          context: (() => {
            const prev = ivs.find((i: any) => i.id !== latest.id && parseFeedback(i.feedback).way);
            const pf = prev ? parseFeedback(prev.feedback) : null;
            const notes = (notesBySub.get(s.id) ?? []).slice().sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
            const round = latest.round ?? 1;
            return ctxOf({
              ask: `Wie war ${round > 1 ? `Interview ${round}` : 'das Interview'} mit ${nameDat}?`,
              facts: [
                ...fact('Gespräch', [formatBerlinRange(latest.scheduled_at, latest.duration_minutes ?? 60), FORMAT[String(latest.meeting_format ?? '')] ?? null].filter(Boolean).join(' · ')),
                ...fact('Ort', latest.meeting_format === 'onsite' ? latest.onsite_address : null),
                ...fact('Ihre Notizen', notes.length ? `${notes.length} im Profil · „${clip(notes[0].content, 90)}“` : null),
                ...fact(`Aus Runde ${prev?.round ?? round - 1}`, pf ? [pf.text ? `„${clip(pf.text, 120)}“` : null, pf.missing ? `offen: ${clip(pf.missing, 80)}` : null].filter(Boolean).join(' · ') : null),
              ],
              line: [`Interview ${round}`, when(latest.scheduled_at), FORMAT[String(latest.meeting_format ?? '')] ?? null].filter(Boolean) as string[],
              why: notes.length ? `Ihre Notizen: ${notes.length}` : null,
              foot: `${name} und ${hhFirst} warten auf Ihre Rückmeldung.`,
            });
          })() });
        continue;
      }
      const fbAt = Number.isNaN(fb.at) ? end : fb.at;
      if (fb.way === 'unsure') {
        if (now - fbAt >= 3 * DAY) {
          push({ key: `unsure:${latest.id}`, kind: 'decide_unsure', since: iso(fbAt + 3 * DAY), urgent: false, waitingWho: hh,
            title: `Wie geht es mit ${nameDat} weiter?`, detail: `Sie waren am ${formatBerlinDateShort(iso(fbAt))} unsicher${fb.missing ? `: „${fb.missing}“` : ''}`, ref: { interviewId: latest.id }, note: askNote,
            context: ctxOf({
              ask: `Wie geht es mit ${nameDat} weiter?`,
              facts: [
                ...fact('Ihr Eindruck', fb.text ? `„${clip(fb.text, 160)}“` : null),
                ...fact('Offen war', fb.missing ? clip(fb.missing, 160) : null),
                ...fact('Gespräch', `Runde ${latest.round ?? 1} · ${formatBerlinDateShort(latest.scheduled_at)}`),
              ],
              line: [fb.missing ? `offen: ${clip(fb.missing, 60)}` : null, `unsicher seit ${formatBerlinDateShort(iso(fbAt))}`].filter(Boolean) as string[],
              why: others(job.id, s.id).text,
            }) });
        } else {
          wait({ key: `unsure-wait:${latest.id}`, by: 'recruiter', title: `${hhFirst} klärt Ihre offenen Punkte mit ${name}`, detail: 'danach entscheiden Sie' });
        }
        continue;
      }
      if (fb.way === 'offer') {
        const offerCtx = (rec: any) => {
          const items = (Array.isArray(rec?.items) ? rec.items : []).filter((i: any) => i?.label && i?.value).slice(0, 6);
          const band = wishBand(cand);
          return ctxOf({
            ask: `Was bieten Sie ${nameDat} an?`,
            facts: [
              ...items.map((i: any) => ({ label: String(i.label), value: clip(String(i.value), 120), chip: null })),
              ...fact('Rahmen Stelle', jobRange(job)),
              ...fact('Gehaltswunsch', !items.some((i: any) => i.key === 'fix') && band ? `${tsd(band.lo)}–${tsd(band.hi)} T€ laut Profil` : null, budgetChip(band, job)),
              ...fact('Ihr Feedback', fb.text ? `„${clip(fb.text, 120)}“` : null),
            ],
            line: items.length ? items.filter((i: any) => ['fix', 'start'].includes(i.key)).map((i: any) => `${i.label} ${clip(String(i.value), 40)}`) : ['Empfehlung fehlt noch'],
            quote: rec?.intro ? { by: hh, text: clip(rec.intro) } : null,
            why: pct ? `Honorar: ${pct} % vom Zielgehalt (fix + variabel), fällig erst mit dem unterschriebenen Vertrag` : null,
            foot: rec ? null : `${hhFirst} ist erinnert. Sie können das Angebot auch ohne Empfehlung machen.`,
          });
        };
        const rec = (recBySub.get(s.id) ?? []).slice().sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
        if (rec) {
          push({ key: `offer:${s.id}:${rec.id}`, kind: 'make_offer', since: rec.created_at, urgent: true, waitingWho: name,
            title: 'Angebot machen', detail: `Empfehlung von ${hh} liegt vor`, ref: { interviewId: latest.id }, note: askNote,
            context: offerCtx(rec) });
        } else if (now - fbAt >= 2 * DAY) {
          push({ key: `offer:${s.id}:ohne`, kind: 'make_offer', since: iso(fbAt + 2 * DAY), urgent: false, waitingWho: name,
            title: 'Angebot machen', detail: `Empfehlung von ${hhFirst} fehlt noch – er ist erinnert`, ref: { interviewId: latest.id }, note: askNote,
            context: offerCtx(null) });
        } else {
          wait({ key: `rec-wait:${s.id}`, by: 'recruiter', title: `${hhFirst} schreibt die Empfehlung`, detail: `was es für ${name}s Zusage braucht` });
        }
        continue;
      }
      if (fb.way === 'next_round') {
        wait({ key: `next-round:${latest.id}`, by: 'recruiter', title: 'Nächste Runde geplant', detail: 'Interview anfragen, sobald Sie Zeiten haben' });
      }
    }
  }

  // ---------------------------------------------------------------- Rechnungen (15)
  for (const inv of input.invoices) {
    if (!['open', 'pending', 'partially_paid'].includes(inv.status) || !inv.released_at) continue;
    const job = jobById.get(inv.job_id);
    const dueMs = inv.due_date ? Date.parse(`${String(inv.due_date).slice(0, 10)}T23:59:59Z`) : NaN;
    if (inv.client_paid_reported_at) {
      waiting.push({ key: `inv-paid:${inv.id}`, submissionId: inv.submission_id ?? null, jobId: inv.job_id ?? null, jobTitle: job?.title ?? null, who: inv.invoice_number ?? 'Rechnung', by: 'matchunt',
        title: `Zahlung zu ${inv.invoice_number ?? 'der Rechnung'} wird geprüft`, detail: `überwiesen am ${dateDe(inv.client_paid_reported_on ?? inv.client_paid_reported_at)}` });
      continue;
    }
    if (doneKeys.has(`invoice:${inv.id}`)) continue;
    const isub = input.submissions.find((x) => x.id === inv.submission_id);
    const icand = isub ? candById.get(isub.candidate_id) : null;
    const iname = isub && (isub.identity_unlocked || isub.identity_revealed) && icand?.full_name ? icand.full_name : null;
    const left = daysTo(inv.due_date, now);
    const dueChip: TaskChip | null = left === null ? null : left < 0 ? { text: 'überfällig', tone: 'bad' } : left <= 3 ? { text: inDays(left), tone: 'warn' } : null;
    const bank = BANK.iban ? [BANK.holder, `IBAN ${BANK.iban}`, BANK.bic ? `BIC ${BANK.bic}` : null].filter(Boolean).join(' · ') : null;
    const invoiceCtx = ctxOf({
      ask: `Rechnung ${inv.invoice_number ?? ''}`.trim(),
      facts: [
        ...fact('Honorar', inv.amount_cents != null ? `${euroCents(inv.amount_cents)} netto` : null),
        ...fact(inv.reverse_charge ? 'USt.' : `USt. ${inv.vat_rate ?? 19} %`, inv.reverse_charge ? 'Steuerschuldnerschaft des Leistungsempfängers' : (inv.tax_amount_cents != null ? euroCents(inv.tax_amount_cents) : null)),
        ...fact('Gesamt', `${euroCents(inv.total_amount_cents)}${inv.due_date ? ` · fällig ${dateDe(inv.due_date)}` : ''}`, dueChip),
        ...fact('Überweisen an', bank ?? 'Bankverbindung steht auf der Rechnung'),
        ...fact('Verwendungszweck', inv.invoice_number ?? null),
      ],
      line: [euroCents(inv.total_amount_cents), inv.due_date ? `fällig ${dateDe(inv.due_date)}` : null].filter(Boolean) as string[],
      chip: dueChip,
      why: [iname ? `für ${iname}` : null, job?.title ?? null, inv.issued_at ? `gestellt am ${formatBerlinDateShort(inv.issued_at)}` : null].filter(Boolean).join(' · ') || null,
    });
    tasks.push({
      key: `invoice:${inv.id}`, kind: 'invoice', submissionId: inv.submission_id ?? null, jobId: inv.job_id ?? null, jobTitle: job?.title ?? null,
      who: inv.invoice_number ?? 'Rechnung', title: `Rechnung ${inv.invoice_number ?? ''} · ${euroCents(inv.total_amount_cents)}`.trim(),
      detail: inv.due_date ? `fällig am ${dateDe(inv.due_date)}` : 'Honorar', since: inv.issued_at ?? inv.released_at,
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
    const senderName = (sender?.full_name as string) || 'Ihr Headhunter';
    const act = senderId ? jobActs.find((a: any) => a.recruiter_id === senderId) : null;
    const tier = senderId ? (input.partners ?? []).find((p: any) => p.user_id === senderId && !p.ended_at)?.tier : null;
    const subCount = senderId ? input.submissions.filter((x) => x.job_id === (job?.id ?? q.related_id) && x.recruiter_id === senderId).length : 0;
    const TIER: Record<string, string> = { partner: 'Partner', silver: 'Silber Partner', gold: 'Gold Partner' };
    const questionCtx = ctxOf({
      ask: `${senderName} fragt zu ${job?.title ?? 'Ihrer Stelle'}`,
      line: [senderName, `${questions.length} ${questions.length === 1 ? 'Frage' : 'Fragen'}`],
      quote: intro ? { by: senderName, text: clip(intro) } : null,
      why: senderId ? [sender?.company_name ?? null, tier ? TIER[tier] ?? null : null, act?.activated_at ? `sucht seit ${formatBerlinDateShort(act.activated_at)}` : null,
        `${subCount} ${subCount === 1 ? 'Kandidat' : 'Kandidaten'} eingereicht`].filter(Boolean).join(' · ') : null,
      foot: `Ihre Antwort geht an ${jobActs.length > 1 ? `alle ${jobActs.length} Headhunter, die für diese Stelle suchen` : senderName}.`,
    });
    tasks.push({
      key, kind: 'recruiter_question', submissionId: null, jobId: job?.id ?? q.related_id ?? null, jobTitle: job?.title ?? null,
      who: job?.title ?? 'Stelle', title: questions.length > 1 ? `${questions.length} Fragen vom Headhunter beantworten` : 'Frage vom Headhunter beantworten',
      detail: questions[0] ? `„${questions[0]}“${questions.length > 1 ? ` und ${questions.length - 1} weitere` : ''}` : String(q.title ?? ''),
      since: q.created_at, urgent: now - t(q.created_at) > 2 * DAY, waitingWho: senderName, ref: { notificationId: q.id, questions }, note: null, context: questionCtx,
    });
  }

  // Jemand wartet zuerst, dann nach Alter
  tasks.sort((a, b) => (a.urgent === b.urgent ? t(a.since) - t(b.since) : a.urgent ? -1 : 1));
  return { tasks, waiting, news: deriveNews(input, tasks) };
}

/** Meilensteine für die Dashboard-Leiste; wer handeln muss, zuerst. */
function deriveNews(input: ClientTaskInput, tasks: ClientTask[]): NewsItem[] {
  const { now } = input;
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
    const name = unlocked && cand?.full_name ? first(cand.full_name) : 'der Kandidat';
    const hhFirst = first(recName.get(s.recruiter_id) ?? 'Ihr Headhunter');
    const offers = input.offers.filter((o: any) => o.submission_id === s.id).sort((a: any, b: any) => t(b.created_at) - t(a.created_at));
    const c = input.contracts.filter((x: any) => x.submission_id === s.id).sort((a: any, b: any) => t(b.created_at) - t(a.created_at))[0];
    const accepted = offers.find((o: any) => o.status === 'accepted');
    const terms = (o: any) => [`${euro(o.salary_offered)}${o.variable_salary ? ` + ${euro(o.variable_salary)}` : ''}`, o.start_date ? `Start ${dateDe(o.start_date)}` : null].filter(Boolean).join(' · ');
    if (c?.status === 'preparing' && accepted && open.has(`contract-send:${c.id}`)) {
      out.push({ key: `news-accepted:${c.id}`, kind: 'accepted', submissionId: s.id, title: `${who} hat zugesagt`, detail: [job.title, terms(accepted)].join(' · '),
        hint: `Schicken Sie ${name} jetzt den Arbeitsvertrag. ${hhFirst} hält bis dahin Kontakt.`, cta: 'Vertrag schicken', taskKey: `contract-send:${c.id}`, at: accepted.decision_at ?? accepted.updated_at ?? c.created_at });
    }
    const countered = offers.find((o: any) => o.status === 'countered');
    if (countered && open.has(`counter:${countered.id}`)) {
      const wish = countered.candidate_response?.wish ?? {};
      out.push({ key: `news-counter:${countered.id}`, kind: 'counter', submissionId: s.id, title: `${who} hat einen Gegenwunsch`,
        detail: [wish.salary ? `${euro(wish.salary)} statt ${euro(countered.salary_offered)}` : null, wish.startDate ? `Start ${dateDe(wish.startDate)}` : null, wish.other ?? null].filter(Boolean).join(' · ') || job.title,
        hint: `${hhFirst} hat den Wunsch aufgenommen. Antworten Sie, damit ${name} nicht abspringt.`, cta: 'Beantworten', taskKey: `counter:${countered.id}`, at: countered.counter_offer_at ?? countered.updated_at });
    }
    const latest = offers[0];
    if (latest?.status === 'declined' && recent(latest.decision_at ?? latest.updated_at)) {
      out.push({ key: `news-declined:${latest.id}`, kind: 'declined', submissionId: s.id, title: `${who} hat abgesagt`, detail: [job.title, latest.rejection_reason ?? null].filter(Boolean).join(' · '),
        hint: `${hhFirst} sucht weiter für Sie.`, cta: 'Ansehen', taskKey: null, at: latest.decision_at ?? latest.updated_at });
    }
    if (c?.status === 'final' && recent(c.final_at)) {
      out.push({ key: `news-signed:${c.id}`, kind: 'signed', submissionId: s.id, title: `Arbeitsvertrag mit ${who} unterschrieben`, detail: [job.title, c.start_date ? `Start ${dateDe(c.start_date)}` : null].filter(Boolean).join(' · '),
        hint: `${hhFirst} begleitet ${name} bis zum ersten Tag.`, cta: 'Ansehen', taskKey: null, at: c.final_at });
    }
    const pl = input.placements.find((p: any) => p.submission_id === s.id);
    const day = pl?.first_working_day ?? pl?.start_date;
    if (pl && day && String(day).slice(0, 10) === berlinDateKey(now)) {
      out.push({ key: `news-start:${pl.id}`, kind: 'start', submissionId: s.id, title: unlocked && cand?.full_name ? `Heute ist ${genitive(first(cand.full_name))} erster Arbeitstag` : `Heute ist der erste Arbeitstag von ${who}`, detail: job.title,
        hint: null, cta: 'Ansehen', taskKey: null, at: new Date(now).toISOString() });
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
  const jobs = await rowsIn(db, 'jobs', 'id, title, status, client_id, salary_min, salary_max, fee_percentage, mandate_id', 'id', jobIds);
  const submissions = await rowsIn(db, 'submissions', 'id, job_id, candidate_id, recruiter_id, stage, status, submitted_at, identity_unlocked, identity_revealed, recruiter_notes', 'job_id', jobIds);
  const subIds = submissions.map((s) => s.id);
  // Kandidatenfelder wie im Bewerberprofil (client_candidate_view); Bänder bildet die Ableitung
  const candCols = 'id, full_name, job_title, seniority, experience_years, city, expected_salary, salary_expectation_max, notice_period, availability_date, skills, remote_preference';
  const [candidates, interviews, offers, recommendations, contracts, placements, invoices, activations, mandates] = await Promise.all([
    rowsIn(db, 'candidates', candCols, 'id', submissions.map((s) => s.candidate_id)),
    rowsIn(db, 'interviews', 'id, submission_id, status, round, scheduled_at, duration_minutes, feedback, created_at, updated_at, proposed_slots, counter_slots, response_token_expires_at, reschedules_interview_id, meeting_format, onsite_address, candidate_message', 'submission_id', subIds),
    rowsIn(db, 'offers', 'id, submission_id, status, created_at, updated_at, response_due, candidate_response, counter_offer_at, salary_offered, variable_salary, start_date, contract_type, probation_months, work_model, extras, decision_at, sent_at, version, rejection_reason', 'submission_id', subIds),
    rowsIn(db, 'offer_recommendations', 'id, submission_id, created_at, intro, items', 'submission_id', subIds),
    rowsIn(db, 'employment_contracts', 'id, submission_id, status, way, sent_at, created_at, updated_at, company_signed_at, company_signer_name, company_signer_email, candidate_email, reported_at, reported_role, report_note, signed_on, salary, variable_salary, start_date, undo_until, fixed_term, non_compete, decline_reason, signing_mode, company_signer_user_id, final_at', 'submission_id', subIds),
    rowsIn(db, 'placements', '*', 'submission_id', subIds),
    rowsIn(db, 'invoices', '*', 'job_id', jobIds),
    rowsIn(db, 'recruiter_job_activations', 'job_id, recruiter_id, status, activated_at', 'job_id', jobIds).catch(() => []),
    rowsIn(db, 'commercial_mandates', 'id, pricing_snapshot', 'id', jobs.map((j) => j.mandate_id)).catch(() => []),
  ]);
  const recruiterIds = [...submissions.map((s) => s.recruiter_id), ...activations.map((a: any) => a.recruiter_id)];
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
  const messages = await rowsIn(db, 'messages', 'id, job_id, candidate_id, sender_id, created_at', 'candidate_id', candIds);
  const log = await rowsIn(db, 'client_task_log', 'task_key, kind, submission_id, job_id, label, answer, done_by, done_at', 'job_id', jobIds).catch(() => []);
  const { data: ownLog } = await db.from('client_task_log').select('task_key, kind, submission_id, job_id, label, answer, done_by, done_at').eq('done_by', userId).gte('done_at', new Date(now - 60 * DAY).toISOString());
  const allLog = [...log, ...(ownLog ?? [])];
  const doneRecent = allLog.filter((l) => Date.parse(l.done_at) >= now - 7 * DAY)
    .filter((l, i, xs) => xs.findIndex((x) => x.task_key === l.task_key) === i)
    .sort((a, b) => Date.parse(b.done_at) - Date.parse(a.done_at));
  return {
    now, jobs, submissions, candidates, recruiters, interviews, offers, recommendations, contracts, placements,
    invoices: invoices.filter((i: any) => i.status !== 'draft'), questions: qs, messages: messages.filter((m: any) => jobIds.includes(m.job_id)),
    log: allLog, doneRecent, comments, activations, partners, questionSenders, feePct, userId, signLinks,
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

async function profileOf(db: SupabaseClient, userId: string) {
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return { name: (data?.full_name as string) || 'Kunde', email: data?.email ? String(data.email).toLowerCase() : null };
}

async function adminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('user_roles').select('user_id').eq('role', 'admin');
  return (data ?? []).map((r: any) => r.user_id);
}

async function notify(db: SupabaseClient, userId: string | null | undefined, type: string, title: string, message: string, relatedType: string, relatedId: string | null) {
  if (!userId) return;
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
  const input = await loadClientTaskInput(ctx.db, user.id, jobIds, ctx.now());
  const { tasks, waiting, news } = deriveClientTasks(input);
  const sub = typeof body?.submissionId === 'string' && UUID.test(body.submissionId) ? body.submissionId : null;
  const pick = <T extends { submissionId: string | null }>(xs: T[]) => (sub ? xs.filter((x) => x.submissionId === sub) : xs);
  return {
    tasks: pick(tasks),
    waiting: pick(waiting),
    done: pick(input.doneRecent.map((l: any) => ({ key: l.task_key, kind: l.kind, submissionId: l.submission_id, jobId: l.job_id, label: l.label, answer: l.answer, doneAt: l.done_at, doneBy: l.done_by }))),
    counts: { urgent: tasks.filter((x) => x.urgent).length, total: tasks.length },
    news: sub ? news.filter((n) => n.submissionId === sub) : news,
  };
}

async function requireJob(ctx: ServiceCtx, user: User, jobId: unknown) {
  must(typeof jobId === 'string' && UUID.test(jobId), 'Ungültige Stelle.');
  must(await canUserActOnJob(ctx.db as any, user.id, jobId as string), 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  return jobId as string;
}

async function writeLog(ctx: ServiceCtx, row: { task_key: string; kind: string; submission_id: string | null; job_id: string | null; label: string; answer?: string | null; note?: string | null; done_by: string }) {
  const { error } = await ctx.db.from('client_task_log').insert({ ...row, done_at: new Date(ctx.now()).toISOString() });
  dbFail(error, 'Das Protokoll');
}

/** Aufgaben-Fenster meldet: erledigt (für „Erledigt · 7 Tage“). Die Aufgabe selbst verschwindet über den Stand. */
export async function logDone(ctx: ServiceCtx, user: User, body: any) {
  const key = text(body?.key, 200);
  must(key, 'Welche Aufgabe?');
  const jobId = body?.jobId ? await requireJob(ctx, user, body.jobId) : null;
  await writeLog(ctx, {
    task_key: key, kind: text(body?.kind, 40) || 'other', submission_id: typeof body?.submissionId === 'string' && UUID.test(body.submissionId) ? body.submissionId : null,
    job_id: jobId, label: text(body?.label, 200) || 'Aufgabe erledigt', answer: text(body?.answer, 200) || null, done_by: user.id,
  });
  return { ok: true };
}

async function loadQuestion(ctx: ServiceCtx, user: User, id: unknown) {
  must(typeof id === 'string' && UUID.test(id), 'Ungültige Frage.');
  const { data: q, error } = await ctx.db.from('notifications').select('id, user_id, title, message, related_id, related_type, created_at').eq('id', id).maybeSingle();
  dbFail(error, 'Die Frage');
  must(q && q.user_id === user.id && q.related_type === 'job', 'Diese Frage gibt es nicht.', 'not_found');
  await requireJob(ctx, user, q.related_id);
  return q;
}

/** Antwort auf Fragen des Headhunters zur Stelle: Glocke + Mail an die Headhunter der Stelle. */
export async function answerQuestion(ctx: ServiceCtx, user: User, body: any) {
  const q = await loadQuestion(ctx, user, body?.notificationId);
  const answer = text(body?.answer, 4000);
  must(answer.length >= 2, 'Bitte eine Antwort schreiben.');
  const { data: job } = await ctx.db.from('jobs').select('id, title').eq('id', q.related_id).maybeSingle();
  const { data: acts } = await ctx.db.from('recruiter_job_activations').select('recruiter_id, status').eq('job_id', q.related_id);
  const recruiters = [...new Set((acts ?? []).filter((a: any) => !['ended', 'cancelled'].includes(String(a.status ?? ''))).map((a: any) => a.recruiter_id))];
  must(recruiters.length > 0, 'Für diese Stelle ist gerade kein Headhunter aktiv.', 'conflict');
  const me = await profileOf(ctx.db, user.id);
  const questions = String(q.message ?? '').split('\n').filter((l) => l.startsWith('– ')).map((l) => l.slice(2));
  const title = `${me.name} hat deine Fragen zu ${job?.title ?? 'der Stelle'} beantwortet`;
  for (const rid of recruiters) {
    await notify(ctx.db, rid, 'client_answer', title, answer.slice(0, 400), 'job', q.related_id);
    const rp = await profileOf(ctx.db, rid);
    if (!rp.email) continue;
    const list = questions.length ? `<ul style="margin:0 0 12px;padding-left:20px">${questions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    await ctx.mail({
      fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: rp.email, replyTo: me.email ?? undefined, subject: title,
      text: `Hallo ${first(rp.name)},\n\n${me.name} hat geantwortet:\n\n${answer}\n\n${questions.length ? `Deine Fragen:\n${questions.map((x) => `– ${x}`).join('\n')}\n` : ''}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111"><p>Hallo ${esc(first(rp.name))},</p><p>${esc(me.name)} hat geantwortet:</p><p style="white-space:pre-wrap;border-left:3px solid #ddd;padding-left:10px">${esc(answer)}</p>${questions.length ? `<p style="color:#555;margin-bottom:4px">Deine Fragen:</p>${list}` : ''}</div>`,
    }, { template: 'client_job_answer', meta: { job_id: q.related_id, notification_id: q.id } });
  }
  await ctx.db.from('notifications').update({ is_read: true }).eq('id', q.id);
  await writeLog(ctx, { task_key: `question:${q.id}`, kind: 'recruiter_question', submission_id: null, job_id: q.related_id, label: 'Frage vom Headhunter beantwortet', answer: answer.slice(0, 200), done_by: user.id });
  return { ok: true };
}

/** Frage an eine Kollegin oder einen Kollegen geben: dort als eigene Aufgabe, hier erledigt. */
export async function forwardQuestion(ctx: ServiceCtx, user: User, body: any) {
  const q = await loadQuestion(ctx, user, body?.notificationId);
  const to = typeof body?.toUserId === 'string' && UUID.test(body.toUserId) ? body.toUserId : '';
  must(to && to !== user.id, 'Bitte eine Kollegin oder einen Kollegen wählen.');
  const team = await clientTeamOf(ctx.db, q.related_id);
  const target = team.find((m) => m.userId === to);
  must(target, 'Diese Person gehört nicht zum Team der Stelle.', 'not_allowed');
  const me = await profileOf(ctx.db, user.id);
  const { error } = await ctx.db.from('notifications').insert({ user_id: to, type: 'recruiter_job_questions', title: q.title, message: `${q.message}\n\nWeitergegeben von ${me.name}.`, related_type: 'job', related_id: q.related_id });
  dbFail(error, 'Die Weitergabe');
  await ctx.db.from('notifications').update({ is_read: true }).eq('id', q.id);
  await writeLog(ctx, { task_key: `question:${q.id}`, kind: 'recruiter_question', submission_id: null, job_id: q.related_id, label: `Frage an ${target.name} weitergegeben`, answer: null, done_by: user.id });
  return { ok: true, to: target.name };
}

export async function questionColleagues(ctx: ServiceCtx, user: User, body: any) {
  const q = await loadQuestion(ctx, user, body?.notificationId);
  return { colleagues: (await clientTeamOf(ctx.db, q.related_id)).filter((m) => m.userId !== user.id).map((m) => ({ userId: m.userId, name: m.name })) };
}

async function loadSubmission(ctx: ServiceCtx, user: User, id: unknown) {
  must(typeof id === 'string' && UUID.test(id), 'Ungültige Bewerbung.');
  const { data: s, error } = await ctx.db.from('submissions').select('id, job_id, candidate_id, recruiter_id, identity_unlocked, identity_revealed').eq('id', id).maybeSingle();
  dbFail(error, 'Die Bewerbung');
  must(s, 'Diese Bewerbung gibt es nicht.', 'not_found');
  await requireJob(ctx, user, s.job_id);
  const { data: cand } = await ctx.db.from('candidates').select('full_name').eq('id', s.candidate_id).maybeSingle();
  const { data: job } = await ctx.db.from('jobs').select('title').eq('id', s.job_id).maybeSingle();
  const unlocked = !!(s.identity_unlocked || s.identity_revealed);
  const label = unlocked && cand?.full_name ? cand.full_name : `PR-${String(s.candidate_id).slice(0, 6).toUpperCase()}`;
  return { s, label, jobTitle: (job?.title as string) ?? 'die Stelle' };
}

/** „Headhunter soll nachfassen“: eigene Aufgabe beim Headhunter (anrufen), Glocke. Die Kunden-Aufgabe bleibt offen. */
export async function askFollowup(ctx: ServiceCtx, user: User, body: any) {
  const { s, label, jobTitle } = await loadSubmission(ctx, user, body?.submissionId);
  const why = text(body?.reason, 300) || 'Bitte beim Kandidaten nachfassen.';
  const me = await profileOf(ctx.db, user.id);
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('recruiter_tasks').insert({
    recruiter_id: s.recruiter_id, title: `Nachfassen: ${label}`, description: `${me.name} (${jobTitle}): ${why}`,
    task_type: 'call', candidate_id: s.candidate_id, submission_id: s.id, job_id: s.job_id, due_at: nowIso, status: 'pending', priority: 'high', source: 'system',
  });
  dbFail(error, 'Die Aufgabe für den Headhunter');
  await notify(ctx.db, s.recruiter_id, 'client_followup_request', `${me.name} bittet dich nachzufassen`, `${label} · ${jobTitle}: ${why}`, 'submission', s.id);
  return { ok: true };
}

// ---------------------------------------------------------------- 14 Antritt bestätigen

async function loadPlacement(ctx: ServiceCtx, user: User, id: unknown) {
  must(typeof id === 'string' && UUID.test(id), 'Ungültige Einstellung.');
  const { data: p, error } = await ctx.db.from('placements').select('*').eq('id', id).maybeSingle();
  dbFail(error, 'Die Einstellung');
  must(p, 'Diese Einstellung gibt es nicht.', 'not_found');
  const sub = await loadSubmission(ctx, user, p.submission_id);
  return { p, ...sub };
}

export async function confirmStart(ctx: ServiceCtx, user: User, body: any) {
  const { p, s, label, jobTitle } = await loadPlacement(ctx, user, body?.placementId);
  must(p.placement_state === 'agreed' && !p.start_confirmed_at && !p.non_start_reported_at, 'Der Antritt ist schon gemeldet.', 'conflict');
  const way = String(body?.way ?? '');
  must(['started', 'later', 'not_started'].includes(way), 'Bitte wählen: gestartet, später gestartet oder nicht angetreten.');
  const nowIso = new Date(ctx.now()).toISOString();
  const today = nowIso.slice(0, 10);
  const me = await profileOf(ctx.db, user.id);
  const planned = String(p.first_working_day ?? p.start_date ?? '').slice(0, 10);
  if (way === 'not_started') {
    const reason = NON_START_REASONS[body?.reason] ? body.reason : '';
    must(reason, 'Bitte einen Grund wählen.');
    const note = text(body?.note, 1000) || null;
    const { error } = await ctx.db.from('placements').update({ non_start_reported_at: nowIso, non_start_reported_by: user.id, non_start_reason: reason, non_start_note: note }).eq('id', p.id).is('non_start_reported_at', null);
    dbFail(error, 'Die Meldung');
    for (const a of await adminIds(ctx.db)) await notify(ctx.db, a, 'placement_non_start', `Nichtantritt gemeldet: ${label}`, `${jobTitle} · ${NON_START_REASONS[reason]}${note ? ` · ${note}` : ''} · gemeldet von ${me.name}`, 'placement', p.id);
    await notify(ctx.db, s.recruiter_id, 'placement_non_start', `Nichtantritt gemeldet: ${label}`, `${me.name}: ${NON_START_REASONS[reason]}. Matchunt prüft den Fall.`, 'submission', s.id);
    await writeLog(ctx, { task_key: `start:${p.id}`, kind: 'confirm_start', submission_id: s.id, job_id: s.job_id, label: `${label}: Nichtantritt gemeldet`, answer: NON_START_REASONS[reason], done_by: user.id });
    return { ok: true, state: 'non_start' };
  }
  const startOn = way === 'later' ? String(body?.startedOn ?? '') : planned || today;
  must(DATE.test(startOn), 'Bitte das Datum des ersten Arbeitstags angeben.');
  if (way === 'later') must(startOn > planned, 'Das Datum liegt nicht nach dem geplanten Start.');
  const started = startOn <= today;
  const patch: Record<string, unknown> = { first_working_day: startOn };
  if (started) Object.assign(patch, { placement_state: 'started', start_confirmed_at: nowIso, start_confirmed_by: user.id });
  const { error } = await ctx.db.from('placements').update(patch).eq('id', p.id).eq('placement_state', 'agreed');
  dbFail(error, 'Der Antritt');
  const dateDeOut = `${startOn.slice(8, 10)}.${startOn.slice(5, 7)}.${startOn.slice(0, 4)}`;
  await notify(ctx.db, s.recruiter_id, 'placement_started', started ? `${label} hat angefangen` : `Neuer Starttermin: ${label}`, `${jobTitle} · ${started ? `erster Arbeitstag ${dateDeOut}` : `startet am ${dateDeOut}`} (gemeldet von ${me.name})`, 'submission', s.id);
  await writeLog(ctx, { task_key: `start:${p.id}`, kind: 'confirm_start', submission_id: s.id, job_id: s.job_id, label: started ? `${label}: Antritt bestätigt` : `${label}: neuer Starttermin`, answer: dateDeOut, done_by: user.id });
  return { ok: true, state: started ? 'started' : 'moved' };
}

// ---------------------------------------------------------------- 15 Rechnung

async function loadInvoiceForClient(ctx: ServiceCtx, user: User, id: unknown) {
  must(typeof id === 'string' && UUID.test(id), 'Ungültige Rechnung.');
  const { data: inv, error } = await ctx.db.from('invoices').select('*').eq('id', id).maybeSingle();
  dbFail(error, 'Die Rechnung');
  must(inv && inv.status !== 'draft', 'Diese Rechnung gibt es nicht.', 'not_found');
  must(inv.client_id === user.id || (inv.job_id && (await canUserActOnJob(ctx.db as any, user.id, inv.job_id))), 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  return inv;
}

export async function invoicePaid(ctx: ServiceCtx, user: User, body: any) {
  const inv = await loadInvoiceForClient(ctx, user, body?.invoiceId);
  must(['open', 'pending', 'partially_paid'].includes(inv.status), 'Diese Rechnung ist schon bezahlt oder storniert.', 'conflict');
  const paidOn = String(body?.paidOn ?? '');
  must(DATE.test(paidOn), 'Bitte das Überweisungsdatum angeben.');
  const nowIso = new Date(ctx.now()).toISOString();
  const { error } = await ctx.db.from('invoices').update({ client_paid_reported_at: nowIso, client_paid_reported_on: paidOn, client_paid_reported_by: user.id }).eq('id', inv.id);
  dbFail(error, 'Die Meldung');
  const me = await profileOf(ctx.db, user.id);
  for (const a of await adminIds(ctx.db)) await notify(ctx.db, a, 'invoice_paid_reported', `Kunde meldet Überweisung: ${inv.invoice_number}`, `${me.name}: überwiesen am ${paidOn.slice(8, 10)}.${paidOn.slice(5, 7)}.${paidOn.slice(0, 4)} – bitte Zahlungseingang prüfen und buchen.`, 'invoice', inv.id);
  await writeLog(ctx, { task_key: `invoice:${inv.id}`, kind: 'invoice', submission_id: inv.submission_id ?? null, job_id: inv.job_id ?? null, label: `Überweisung gemeldet (${inv.invoice_number})`, answer: `überwiesen am ${paidOn.slice(8, 10)}.${paidOn.slice(5, 7)}.${paidOn.slice(0, 4)}`, done_by: user.id });
  return { ok: true };
}

export async function invoiceQuestion(ctx: ServiceCtx, user: User, body: any) {
  const inv = await loadInvoiceForClient(ctx, user, body?.invoiceId);
  const q = text(body?.question, 2000);
  must(q.length >= 3, 'Bitte die Frage schreiben.');
  const me = await profileOf(ctx.db, user.id);
  for (const a of await adminIds(ctx.db)) await notify(ctx.db, a, 'invoice_question', `Frage zur Rechnung ${inv.invoice_number}`, `${me.name}${me.email ? ` (${me.email})` : ''}: ${q}`, 'invoice', inv.id);
  return { ok: true };
}
