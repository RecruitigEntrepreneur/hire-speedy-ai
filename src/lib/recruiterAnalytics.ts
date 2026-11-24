/**
 * Auswertung des Headhunters (23.11.2026): nur Rechnung, keine Darstellung.
 * Gezählt werden die Vorstellungen eines Zeitraums (nach Tag der Vorstellung) und was aus ihnen wurde.
 * Kein Vergleich mit einem Plattform-Durchschnitt: den gibt es nicht gemessen.
 */

export type AnaPeriod = '30' | '90' | '365';

export interface AnaSubmission {
  id: string;
  job_id: string;
  status: string | null;
  stage: string | null;
  submitted_at: string;
  rejection_reason: string | null;
}
export interface AnaInterview { submission_id: string; created_at: string }
export interface AnaPlacement { submission_id: string; created_at: string; feeCents: number }
export interface AnaJob { id: string; title: string | null; industry: string | null; location: string | null }

export interface AnaJobRow {
  jobId: string;
  title: string;
  meta: string;
  submitted: number;
  interviews: number;
  hired: number;
  daysToInvite: number | null;
}

export interface RecruiterAnalytics {
  submitted: number;
  interviews: number;
  offers: number;
  hired: number;
  rejected: number;
  withdrawn: number;
  /** Anteil der Vorstellungen mit Einladung, in Prozent; null unter MIN_FOR_RATE Vorstellungen. */
  inviteRate: number | null;
  /** Anteil der Interviews, die zur Einstellung führten; null unter MIN_FOR_RATE Interviews. */
  hireRate: number | null;
  /** Median in Tagen von der Vorstellung bis zur Einladung. */
  daysToInvite: number | null;
  /** Median in Tagen von der Vorstellung bis zur Einstellung. */
  daysToHire: number | null;
  /** Offene Vorstellungen ohne Antwort des Kunden und wie lange die älteste wartet. */
  waiting: number;
  waitingMaxDays: number | null;
  feeCents: number;
  /** Gründe der Kunden, neueste zuerst, höchstens drei. */
  reasons: string[];
  /** Vorstellungen je Woche, älteste zuerst. */
  weeks: number[];
  weeksInterviews: number[];
  weeksHired: number[];
  jobs: AnaJobRow[];
}

/** Darunter ist eine Quote Zufall; dann zeigen wir nur die Zahlen. */
export const MIN_FOR_RATE = 5;
const DAY = 86_400_000;

const INTERVIEW = new Set(['interview', 'offer', 'hired', 'placed']);
const OFFER = new Set(['offer', 'hired', 'placed']);
const HIRED = new Set(['hired', 'placed']);
const REJECTED = new Set(['rejected', 'client_rejected']);
const WAITING = new Set(['submitted', 'pending', 'in_review']);

const hat = (set: Set<string>, s: AnaSubmission) => set.has(s.status ?? '') || set.has(s.stage ?? '');

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2);
}

const tage = (von: string, bis: string | number) =>
  Math.max(0, Math.round(((typeof bis === 'number' ? bis : new Date(bis).getTime()) - new Date(von).getTime()) / DAY));

export function computeRecruiterAnalytics(
  input: { submissions: AnaSubmission[]; interviews: AnaInterview[]; placements: AnaPlacement[]; jobs: AnaJob[] },
  period: AnaPeriod,
  now: Date = new Date(),
): RecruiterAnalytics {
  const days = Number(period);
  const from = now.getTime() - days * DAY;
  const subs = input.submissions.filter((s) => new Date(s.submitted_at).getTime() >= from);
  const ids = new Set(subs.map((s) => s.id));

  // Erste Einladung je Vorstellung
  const firstInvite = new Map<string, string>();
  for (const iv of input.interviews) {
    if (!ids.has(iv.submission_id)) continue;
    const cur = firstInvite.get(iv.submission_id);
    if (!cur || iv.created_at < cur) firstInvite.set(iv.submission_id, iv.created_at);
  }
  const placement = new Map(input.placements.filter((p) => ids.has(p.submission_id)).map((p) => [p.submission_id, p]));

  const zurueck = (s: AnaSubmission) => (s.status === 'withdrawn' || s.stage === 'withdrawn');
  const warInterview = (s: AnaSubmission) => firstInvite.has(s.id) || hat(INTERVIEW, s) || placement.has(s.id);
  const warEingestellt = (s: AnaSubmission) => placement.has(s.id) || HIRED.has(s.status ?? '');
  const abgelehnt = (s: AnaSubmission) => !zurueck(s) && hat(REJECTED, s);
  const wartet = (s: AnaSubmission) => WAITING.has(s.status ?? '') && !warInterview(s) && !abgelehnt(s) && !zurueck(s);

  const weekCount = Math.max(4, Math.ceil(days / 7) > 26 ? 26 : Math.ceil(days / 7));
  const span = (days * DAY) / weekCount;
  const slot = (iso: string) => Math.min(weekCount - 1, Math.max(0, Math.floor((new Date(iso).getTime() - from) / span)));
  const weeks = Array<number>(weekCount).fill(0);
  const weeksInterviews = Array<number>(weekCount).fill(0);
  const weeksHired = Array<number>(weekCount).fill(0);

  const inviteDays: number[] = [];
  const hireDays: number[] = [];
  const waitDays: number[] = [];
  let feeCents = 0;
  const jobAgg = new Map<string, { submitted: number; interviews: number; hired: number; invite: number[] }>();

  for (const s of subs) {
    const j = jobAgg.get(s.job_id) ?? { submitted: 0, interviews: 0, hired: 0, invite: [] };
    j.submitted++;
    weeks[slot(s.submitted_at)]++;
    if (warInterview(s)) {
      j.interviews++;
      weeksInterviews[slot(s.submitted_at)]++;
      const inv = firstInvite.get(s.id);
      if (inv) { const d = tage(s.submitted_at, inv); inviteDays.push(d); j.invite.push(d); }
    }
    if (warEingestellt(s)) {
      j.hired++;
      weeksHired[slot(s.submitted_at)]++;
      const p = placement.get(s.id);
      if (p) { hireDays.push(tage(s.submitted_at, p.created_at)); feeCents += p.feeCents; }
    }
    if (wartet(s)) waitDays.push(tage(s.submitted_at, now.getTime()));
    jobAgg.set(s.job_id, j);
  }

  const interviews = subs.filter(warInterview).length;
  const hired = subs.filter(warEingestellt).length;
  const jobById = new Map(input.jobs.map((j) => [j.id, j]));

  return {
    submitted: subs.length,
    interviews,
    offers: subs.filter((s) => hat(OFFER, s) || warEingestellt(s)).length,
    hired,
    rejected: subs.filter(abgelehnt).length,
    withdrawn: subs.filter(zurueck).length,
    inviteRate: subs.length >= MIN_FOR_RATE ? Math.round((interviews / subs.length) * 100) : null,
    hireRate: interviews >= MIN_FOR_RATE ? Math.round((hired / interviews) * 100) : null,
    daysToInvite: median(inviteDays),
    daysToHire: median(hireDays),
    waiting: waitDays.length,
    waitingMaxDays: waitDays.length ? Math.max(...waitDays) : null,
    feeCents,
    reasons: subs
      .filter((s) => abgelehnt(s) && (s.rejection_reason ?? '').trim())
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
      .slice(0, 3)
      .map((s) => s.rejection_reason!.trim()),
    weeks,
    weeksInterviews,
    weeksHired,
    jobs: [...jobAgg.entries()]
      .map(([jobId, a]) => {
        const job = jobById.get(jobId);
        return {
          jobId,
          title: job?.title ?? '',
          meta: [job?.industry, job?.location].filter(Boolean).join(' · '),
          submitted: a.submitted,
          interviews: a.interviews,
          hired: a.hired,
          daysToInvite: median(a.invite),
        };
      })
      .sort((a, b) => b.hired - a.hired || b.interviews - a.interviews || b.submitted - a.submitted),
  };
}
