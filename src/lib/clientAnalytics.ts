/**
 * Rechenkern der allgemeinen Analytics der Kunden-Seite (22.11.2026).
 * Alles über alle Stellen des Kunden, ehrlich aus den eigenen Daten, keine Vergleichswerte von außen.
 * Der Zeitraum zählt nach dem Tag des Vorschlags. Was eine einzelne Stelle betrifft,
 * steht in der Auswertung der Stelle (JobsAnalytics), nicht hier.
 */

export interface AnaItem {
  submissionId: string;
  jobId: string;
  submittedAt: string;
  tab: string;
  archiveKind: string | null;
  requestedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  isMyTurn: boolean;
  experienceBand: string;
  region: string;
}

export interface AnaJob {
  id: string;
  title: string;
  status: string | null;
  approved_at: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface AnaInterview {
  submission_id: string;
  scheduled_at: string | null;
  status: string | null;
}

export interface AnaOffer {
  submission_id: string;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  decision_at: string | null;
  responded_at: string | null;
}

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / DAY);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const countBy = (xs: string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** Erste Entscheidung des Kunden zu einem Vorschlag: Interview angefragt oder abgesagt. */
const decidedAt = (i: AnaItem): string | null => {
  const xs = [i.requestedAt, i.rejectedAt].filter(Boolean) as string[];
  return xs.length ? xs.sort()[0] : null;
};

const atInterview = (i: AnaItem) => i.tab === 'interview' || i.tab === 'angebot' || i.archiveKind === 'eingestellt';
const ACCEPTED = ['accepted', 'accept_reported'];
const HELD = ['completed', 'scheduled', 'confirmed'];

export interface TimeSegment {
  key: 'first' | 'review' | 'toInterview' | 'toOffer' | 'toAccept';
  days: number;
  /** Liegt beim Kunden */
  mine: boolean;
}

export function buildClientAnalytics(input: {
  items: AnaItem[];
  jobs: AnaJob[];
  interviews: AnaInterview[];
  offers: AnaOffer[];
  periodDays: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const since = now - input.periodDays * DAY;
  const jobIds = new Set(input.jobs.map((j) => j.id));
  const all = input.items.filter((i) => jobIds.has(i.jobId));
  const mine = all.filter((i) => i.submittedAt && Date.parse(i.submittedAt) >= since);
  // Alle Vorschläge zu diesen Stellen – daran hängen Interviews und Angebote.
  const allIds = new Set(all.map((i) => i.submissionId));

  // Interviews und Angebote je Vorschlag
  const firstInterview = new Map<string, string>();
  for (const iv of input.interviews) {
    if (!iv.scheduled_at || !HELD.includes(iv.status ?? '')) continue;
    const cur = firstInterview.get(iv.submission_id);
    if (!cur || iv.scheduled_at < cur) firstInterview.set(iv.submission_id, iv.scheduled_at);
  }
  const offerOf = new Map<string, AnaOffer>();
  for (const o of input.offers) {
    if (o.status === 'superseded') continue;
    const cur = offerOf.get(o.submission_id);
    if (!cur || o.created_at > cur.created_at) offerOf.set(o.submission_id, o);
  }
  const acceptedAt = (o: AnaOffer | undefined) =>
    o && ACCEPTED.includes(o.status ?? '') ? (o.decision_at ?? o.responded_at) : null;

  // Kennzahlen und Fluss
  const hired = mine.filter((i) => i.archiveKind === 'eingestellt');
  const rejected = mine.filter((i) => i.archiveKind === 'abgelehnt');
  const withdrawn = mine.filter((i) => i.archiveKind === 'zurueckgezogen');
  const expired = mine.filter((i) => i.archiveKind === 'abgelaufen');
  const closedOut = mine.filter((i) => i.archiveKind === 'stelle_besetzt' || i.archiveKind === 'stelle_geschlossen');
  const flow = {
    total: mine.length,
    hired: hired.length,
    rejected: rejected.length,
    withdrawn: withdrawn.length,
    expired: expired.length,
    closed: closedOut.length,
    active: mine.length - hired.length - rejected.length - withdrawn.length - expired.length - closedOut.length,
  };
  const reviewOf = (i: AnaItem) => {
    const d = decidedAt(i);
    return d && i.submittedAt ? days(i.submittedAt, d) : null;
  };
  const reviews = mine.map(reviewOf).filter((x): x is number => x !== null);
  const review = avg(reviews);

  // Verteilung: wie schnell entschieden wird
  const speed = { sameDay: 0, upTo3: 0, upTo7: 0, longer: 0 };
  for (const r of reviews) {
    if (r < 1) speed.sameDay += 1;
    else if (r <= 3) speed.upTo3 += 1;
    else if (r <= 7) speed.upTo7 += 1;
    else speed.longer += 1;
  }

  // Zeit je Abschnitt – nur Abschnitte, für die es belegte Zeitpunkte gibt
  const startOf = (j: AnaJob) => j.approved_at || j.created_at;
  const firstDays = avg(
    input.jobs
      .map((j) => {
        const first = all.filter((i) => i.jobId === j.id).map((i) => i.submittedAt).filter(Boolean).sort()[0];
        return first ? days(startOf(j), first) : null;
      })
      .filter((x): x is number => x !== null),
  );
  const toInterview = avg(
    mine
      .map((i) => {
        const iv = firstInterview.get(i.submissionId);
        return iv && i.requestedAt && Date.parse(iv) <= now && iv >= i.requestedAt ? days(i.requestedAt, iv) : null;
      })
      .filter((x): x is number => x !== null),
  );
  const toOffer = avg(
    mine
      .map((i) => {
        const iv = firstInterview.get(i.submissionId);
        const o = offerOf.get(i.submissionId);
        const at = o ? (o.sent_at ?? o.created_at) : null;
        return iv && at && at >= iv ? days(iv, at) : null;
      })
      .filter((x): x is number => x !== null),
  );
  const toAccept = avg(
    mine
      .map((i) => {
        const o = offerOf.get(i.submissionId);
        const acc = acceptedAt(o);
        const from = o ? (o.sent_at ?? o.created_at) : null;
        return acc && from && acc >= from ? days(from, acc) : null;
      })
      .filter((x): x is number => x !== null),
  );
  const segments: TimeSegment[] = (
    [
      { key: 'first', days: firstDays, mine: false },
      { key: 'review', days: review, mine: true },
      { key: 'toInterview', days: toInterview, mine: false },
      { key: 'toOffer', days: toOffer, mine: true },
      { key: 'toAccept', days: toAccept, mine: false },
    ] as { key: TimeSegment['key']; days: number | null; mine: boolean }[]
  ).filter((s): s is TimeSegment => s.days !== null);
  const timeTotal = segments.reduce((s, x) => s + x.days, 0);
  const timeMine = segments.filter((s) => s.mine).reduce((s, x) => s + x.days, 0);

  // Verlauf über die Zeit: Wochen, älteste zuerst
  const weekCount = Math.max(4, Math.ceil(input.periodDays / 7));
  const bucket = (iso: string | null | undefined) => {
    if (!iso) return -1;
    const t = Date.parse(iso);
    if (Number.isNaN(t) || t > now || t < since) return -1;
    return weekCount - 1 - Math.min(weekCount - 1, Math.floor((now - t) / (7 * DAY)));
  };
  const empty = () => Array.from({ length: weekCount }, () => 0);
  const trend = { proposals: empty(), interviews: empty(), hires: empty(), review: [] as number[] };
  const reviewSum = empty();
  const reviewN = empty();
  for (const i of mine) {
    const b = bucket(i.submittedAt);
    if (b >= 0) trend.proposals[b] += 1;
    const d = decidedAt(i);
    const r = reviewOf(i);
    const bd = bucket(d);
    if (bd >= 0 && r !== null) { reviewSum[bd] += r; reviewN[bd] += 1; }
  }
  for (const iv of input.interviews) {
    if (!allIds.has(iv.submission_id)) continue;
    if (!HELD.includes(iv.status ?? '')) continue;
    const b = bucket(iv.scheduled_at);
    if (b >= 0) trend.interviews[b] += 1;
  }
  for (const o of input.offers) {
    if (!allIds.has(o.submission_id)) continue;
    const b = bucket(acceptedAt(o));
    if (b >= 0) trend.hires[b] += 1;
  }
  trend.review = reviewSum.map((s, n) => (reviewN[n] ? s / reviewN[n] : NaN)).filter((x) => !Number.isNaN(x));

  // Stellen
  const rows = input.jobs.map((j) => {
    const its = mine.filter((i) => i.jobId === j.id);
    return {
      job: j,
      count: its.length,
      review: avg(its.map(reviewOf).filter((x): x is number => x !== null)),
      hired: its.filter((i) => i.archiveKind === 'eingestellt').length,
      runDays: j.status === 'published' ? days(startOf(j), new Date(now).toISOString()) : null,
    };
  });
  const filled = input.jobs.filter((j) => j.status === 'filled');
  const running = input.jobs.filter((j) => j.status === 'published');
  const fillDays = avg(filled.filter((j) => j.closed_at).map((j) => days(startOf(j), j.closed_at!)));
  const runningWithInterview = running.filter((j) =>
    all.some((i) => i.jobId === j.id && (i.tab === 'interview' || i.tab === 'angebot')),
  ).length;

  // Absagegründe und Profil der Vorschläge
  const reasons = countBy(rejected.map((i) => i.rejectReason ?? ''));
  // Bänder mit Zahl nach Jahren sortiert; „nicht angegeben“ (ohne Zahl) ans Ende.
  const years = (k: string) => { const n = parseInt(k, 10); return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n; };
  const experience = countBy(mine.map((i) => i.experienceBand).filter(Boolean)).sort((a, b) => years(a[0]) - years(b[0]));
  const regions = countBy(mine.map((i) => i.region).filter(Boolean)).slice(0, 4);

  return {
    proposals: mine.length,
    interviews: mine.filter(atInterview).length,
    hires: hired.length,
    review,
    flow,
    speed,
    segments,
    timeTotal,
    timeMine,
    trend,
    weekCount,
    rows,
    jobsTotal: input.jobs.length,
    jobsFilled: filled.length,
    jobsRunning: running.length,
    runningWithInterview,
    fillDays,
    reasons,
    reasonsMissing: rejected.filter((i) => !i.rejectReason).length,
    experience,
    regions,
    slowJobs: rows.filter((r) => r.review !== null && r.review >= 3).length,
    jobsWithReview: rows.filter((r) => r.review !== null).length,
    waiting: all.filter((i) => i.isMyTurn).length,
  };
}

export type ClientAnalyticsData = ReturnType<typeof buildClientAnalytics>;

// ---------------------------------------------------------------------------
// Auswertung einer einzelnen Stelle: was nur für diese Stelle gilt.
// ---------------------------------------------------------------------------

export interface JobExtraItem {
  submissionId: string;
  submittedAt: string;
  archiveKind: string | null;
  isMyTurn: boolean;
  hoursWaiting: number;
  salaryBand: string;
  availabilityDate: string | null;
  noticePeriod: string | null;
}

/** „€60k - €70k“ → [60000, 70000]; ohne Zahl → null. */
export function parseSalaryBand(band: string): [number, number] | null {
  const nums = (band.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => parseFloat(x.replace(',', '.')));
  if (!nums.length) return null;
  const k = /k/i.test(band) ? 1000 : 1;
  const lo = nums[0] * k;
  return [lo, (nums[1] ?? nums[0]) * k];
}

/** Monate bis zum möglichen Start: aus dem Verfügbarkeitsdatum, sonst aus der Kündigungsfrist. */
export function monthsToStart(i: Pick<JobExtraItem, 'availabilityDate' | 'noticePeriod'>, now: number): number | null {
  if (i.availabilityDate) {
    const t = Date.parse(i.availabilityDate);
    if (!Number.isNaN(t)) return Math.max(0, (t - now) / (30 * DAY));
  }
  const n = (i.noticePeriod ?? '').toLowerCase();
  if (!n) return null;
  if (/sofort|immediate|none|keine/.test(n)) return 0;
  const m = n.match(/(\d+)/);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return /week|woche/.test(n) ? v / 4 : v;
}

export function buildJobExtras(input: { items: JobExtraItem[]; budgetMin: number | null; budgetMax: number | null; now?: number }) {
  const now = input.now ?? Date.now();
  const open = input.items.filter((i) => !i.archiveKind);

  // Wer wartet: längste Wartezeit zuerst
  const waiting = input.items
    .filter((i) => i.isMyTurn)
    .map((i) => ({ submissionId: i.submissionId, days: Math.floor(i.hoursWaiting / 24) }))
    .sort((a, b) => b.days - a.days);

  // Gehaltswünsche als Bänder, aufsteigend; Markierung, welche über dem Budget liegen
  const bands = new Map<string, { lo: number; hi: number; count: number }>();
  for (const i of input.items) {
    const p = parseSalaryBand(i.salaryBand);
    if (!p) continue;
    const cur = bands.get(i.salaryBand) ?? { lo: p[0], hi: p[1], count: 0 };
    cur.count += 1;
    bands.set(i.salaryBand, cur);
  }
  const max = input.budgetMax ?? input.budgetMin;
  const min = input.budgetMin ?? input.budgetMax;
  const salary = [...bands.entries()]
    .map(([label, b]) => ({
      label, ...b,
      over: max !== null && b.lo >= max,
      inBudget: max !== null && min !== null && b.lo < max && b.hi > min,
    }))
    .sort((a, b) => a.lo - b.lo);
  const salaryKnown = salary.reduce((s, b) => s + b.count, 0);
  const salaryOver = salary.filter((b) => b.over).reduce((s, b) => s + b.count, 0);

  // Start: sofort (bis 1 Monat), 1 bis 3 Monate, später, ohne Angabe
  const start = { now: 0, soon: 0, later: 0, unknown: 0 };
  for (const i of open) {
    const m = monthsToStart(i, now);
    if (m === null) start.unknown += 1;
    else if (m < 1) start.now += 1;
    else if (m <= 3) start.soon += 1;
    else start.later += 1;
  }

  const last = input.items.map((i) => i.submittedAt).filter(Boolean).sort().pop() ?? null;
  return {
    total: input.items.length,
    waiting,
    salary,
    salaryKnown,
    salaryOver,
    start,
    startKnown: start.now + start.soon + start.later,
    daysSinceLast: last ? Math.floor((now - Date.parse(last)) / DAY) : null,
  };
}
