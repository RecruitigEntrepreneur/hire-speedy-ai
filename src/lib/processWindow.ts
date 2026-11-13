// Prozess-Fenster des Headhunters (SubmissionDetailDialog, 14.10.2026):
// nur was den Ablauf betrifft – Phase, wer am Zug ist, Frist, Stufen mit Datum,
// Terminvorschläge. Reine Funktionen, damit Fenster und Tests dasselbe rechnen.
import { normalizeStage, type CanonicalStage } from './submissionStage';
import i18n from '@/i18n';
import { fmtDate, fmtDayMonth, fmtMoney, isGerman } from '@/lib/localeFormat';

// Texte in der Sprache der Oberfläche (processWindow), gelesen beim Aufruf (README Regel 7).
// Auf Deutsch unverändert wie bisher („Mi 15.10. · 09:00“).
const tp = (key: string, options?: Record<string, unknown>): string => i18n.t(`processWindow:${key}`, options);

export interface ProcessInterview {
  status: string | null;
  round?: number | null;
  created_at?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  response_token_expires_at?: string | null;
  proposed_slots?: unknown;
  counter_slots?: unknown;
  decline_reason?: string | null;
  cancellation_reason?: string | null;
  consent_given_at?: string | null;
}

export interface ProcessSubmission {
  stage: string | null;
  status?: string | null;
  submitted_at: string;
  opt_in_requested_at?: string | null;
  consent_confirmed_at?: string | null;
  unlocked_at?: string | null;
  identity_unlocked?: boolean | null;
  rejection_reason?: string | null;
}

/**
 * Wann hat der Kandidat zugesagt? Die Einwilligung zur aktuellen Einladung
 * zählt, oder die der Einreichung – aber nur, wenn die Identität wirklich frei
 * ist. Ein consent_confirmed_at ohne Freigabe ist ein Rest aus einem früheren
 * Durchlauf und keine Zusage.
 */
export function consentAt(sub: ProcessSubmission, iv: ProcessInterview | null): string | null {
  if (iv?.consent_given_at) return iv.consent_given_at;
  if (sub.identity_unlocked) return sub.consent_confirmed_at ?? sub.unlocked_at ?? null;
  return null;
}

export type Tone = 'wait' | 'ok' | 'closed' | 'client';

export interface ProcessState {
  stage: CanonicalStage;
  /** „Interview angefragt · Runde 1“ */
  phase: string;
  /** „Marko (Terminwahl)“, „Kunde (Prüfung)“ oder null, wenn niemand etwas tun muss */
  turn: string | null;
  /** Wer handeln muss: Kandidat, Kunde, niemand */
  turnOf: 'candidate' | 'client' | null;
  /** Kopfzeile des Hinweises */
  headline: string;
  /** zweite Zeile, z. B. Ablauf des Links */
  detail: string | null;
  deadline: string | null;
  tone: Tone;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const daysBetween = (fromIso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / DAY_MS));

export function sinceLabel(fromIso: string | null | undefined, now: number): string {
  if (!fromIso) return '';
  const ms = Math.max(0, now - new Date(fromIso).getTime());
  if (ms < DAY_MS) {
    const h = Math.floor(ms / HOUR_MS);
    return h < 1 ? tp('since.justNow') : tp('since.hours', { count: h });
  }
  const d = Math.floor(ms / DAY_MS);
  return tp('since.days', { count: d });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** „27.09.“ */
export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isGerman() ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.` : fmtDayMonth(d);
};

/** Tag eines Termins: „Mi 15.10.“ */
const slotDay = (iso: string) => `${tp(`weekday.${new Date(iso).getDay()}`)} ${shortDate(iso)}`;
/** Uhrzeit eines Termins: „09:00“ */
const slotTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** „Mi 15.10. · 09:00“ */
export function slotLabel(iso: string): string {
  return tp('slot', { day: slotDay(iso), time: slotTime(iso) });
}

/** „27.09.2026“ */
export const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return isGerman() ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : fmtDate(d);
};

export interface Slot {
  iso: string;
  /** vergeben, abgelaufen oder vom Kunden gestrichen */
  gone: boolean;
}

/** proposed_slots / counter_slots: [{ datetime, status }] oder ['2026-…'] */
export function slotsFrom(raw: unknown, now: number): Slot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const iso = typeof s === 'string' ? s : (s as { datetime?: unknown })?.datetime;
      if (typeof iso !== 'string' || Number.isNaN(Date.parse(iso))) return null;
      const status = typeof s === 'object' && s ? (s as { status?: unknown }).status : null;
      return { iso, gone: Date.parse(iso) < now || (typeof status === 'string' && status !== 'available') };
    })
    .filter((s): s is Slot => s !== null)
    .sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));
}

/** Stufen im Fenster; Datum nur, wo es sicher bekannt ist. Angezeigt wird processWindow:steps.<key>. */
export const STEPS: { key: string; label: string }[] = [
  { key: 'submitted', label: 'Eingereicht' },
  { key: 'in_review', label: 'Prüfung' },
  { key: 'interview_requested', label: 'Angefragt' },
  { key: 'candidate_opted_in', label: 'Zusage' },
  { key: 'interview_scheduled', label: 'Gespräch' },
  { key: 'offer', label: 'Angebot' },
  { key: 'placed', label: 'Eingestellt' },
];

const STEP_INDEX: Partial<Record<CanonicalStage, number>> = {
  submitted: 0,
  in_review: 1,
  interview_requested: 2,
  interview_declined: 2,
  interview_counter_proposed: 3,
  candidate_opted_in: 3,
  interview_scheduled: 4,
  interview_completed: 4,
  offer: 5,
  placed: 6,
};

export interface Step {
  label: string;
  state: 'done' | 'current' | 'todo';
  date: string | null;
}

export function processSteps(sub: ProcessSubmission, iv: ProcessInterview | null): Step[] {
  const stage = normalizeStage(sub.stage, sub.status);
  // Abgesagt/zurückgezogen: die Leiste bleibt dort stehen, wo der Vorgang endete
  const reached = STEP_INDEX[stage] ?? (iv ? 2 : sub.stage === 'in_review' ? 1 : 0);
  const dates: (string | null)[] = [
    sub.submitted_at,
    null,
    sub.opt_in_requested_at ?? iv?.created_at ?? null,
    consentAt(sub, iv),
    iv?.scheduled_at ?? null,
    null,
    null,
  ];
  return STEPS.map((s, i) => ({
    label: tp(`steps.${s.key}`),
    state: i < reached ? 'done' : i === reached ? 'current' : 'todo',
    date: i <= reached && dates[i] ? shortDate(dates[i] as string) : null,
  }));
}

export function processState(
  sub: ProcessSubmission,
  iv: ProcessInterview | null,
  firstName: string,
  now: number,
): ProcessState {
  const stage = normalizeStage(sub.stage, sub.status);
  const round = iv?.round ?? 1;
  const base = { stage, deadline: null as string | null, detail: null as string | null };

  if (stage === 'interview_requested' && (!iv || iv.status === 'pending_response')) {
    const since = sinceLabel(sub.opt_in_requested_at ?? iv?.created_at, now);
    const expires = iv?.response_token_expires_at ?? null;
    const expired = !!expires && Date.parse(expires) < now;
    return {
      ...base,
      phase: tp('state.requestedPhase', { round }),
      turn: tp('state.requestedTurn', { first: firstName }),
      turnOf: 'candidate',
      headline: tp('state.requestedHeadline', { first: firstName, since }).trim(),
      detail: expires
        ? expired
          ? tp('state.linkExpired', { slot: slotLabel(expires) })
          : tp('state.linkExpires', { day: slotDay(expires), time: slotTime(expires) })
        : null,
      deadline: expires,
      tone: 'wait',
    };
  }
  if (stage === 'interview_counter_proposed' || iv?.status === 'counter_proposed') {
    return {
      ...base,
      phase: tp('state.counterPhase', { round }),
      turn: tp('state.counterTurn'),
      turnOf: 'client',
      headline: tp('state.counterHeadline', { first: firstName }),
      tone: 'client',
    };
  }
  if (stage === 'candidate_opted_in') {
    return {
      ...base,
      phase: tp('state.optedInPhase', { round }),
      turn: tp('state.optedInTurn'),
      turnOf: 'client',
      headline: tp('state.optedInHeadline', { first: firstName }),
      tone: 'client',
    };
  }
  if (stage === 'interview_scheduled') {
    const at = iv?.scheduled_at ?? null;
    const past = !!at && Date.parse(at) + (iv?.duration_minutes ?? 60) * 60_000 < now;
    return {
      ...base,
      phase: tp('state.scheduledPhase', { round }),
      turn: past ? tp('state.feedbackTurn') : null,
      turnOf: past ? 'client' : null,
      headline: at ? (past ? tp('state.scheduledPast', { slot: slotLabel(at) }) : tp('state.scheduledAt', { slot: slotLabel(at) })) : tp('state.scheduledNoTime'),
      detail: past ? null : tp('state.scheduledDetail', { first: firstName }),
      deadline: at,
      tone: past ? 'client' : 'ok',
    };
  }
  if (stage === 'interview_completed') {
    return {
      ...base,
      phase: tp('state.completedPhase', { round }),
      turn: tp('state.feedbackTurn'),
      turnOf: 'client',
      headline: tp('state.completedHeadline', { since: sinceLabel(iv?.scheduled_at, now) }).trim(),
      tone: 'client',
    };
  }
  if (stage === 'offer') {
    return { ...base, phase: tp('state.offerPhase'), turn: firstName, turnOf: 'candidate', headline: tp('state.offerHeadline', { first: firstName }), tone: 'wait' };
  }
  if (stage === 'placed') {
    return { ...base, phase: tp('state.placedPhase'), turn: null, turnOf: null, headline: tp('state.placedHeadline', { first: firstName }), tone: 'ok' };
  }
  if (stage === 'interview_declined') {
    return {
      ...base,
      phase: tp('state.declinedPhase'),
      turn: null,
      turnOf: null,
      headline: tp('state.declinedHeadline', { first: firstName }),
      detail: iv?.decline_reason ? tp('state.reason', { reason: iv.decline_reason }) : null,
      tone: 'closed',
    };
  }
  if (stage === 'client_rejected' || stage === 'rejected') {
    return {
      ...base,
      phase: tp('state.rejectedPhase'),
      turn: null,
      turnOf: null,
      headline: tp('state.rejectedHeadline'),
      detail: sub.rejection_reason ? tp('state.reason', { reason: sub.rejection_reason }) : null,
      tone: 'closed',
    };
  }
  if (stage === 'withdrawn') {
    return { ...base, phase: tp('state.withdrawnPhase'), turn: null, turnOf: null, headline: tp('state.withdrawnHeadline'), tone: 'closed' };
  }
  // submitted / in_review: der Kunde prüft
  return {
    ...base,
    phase: stage === 'in_review' ? tp('state.reviewPhase') : tp('state.submittedPhase'),
    turn: tp('state.reviewTurn'),
    turnOf: 'client',
    headline: tp('state.reviewHeadline', { since: sinceLabel(sub.submitted_at, now) }).trim(),
    tone: 'client',
  };
}

// Format → Schlüssel processWindow:kind.<…>
const FORMAT: Record<string, 'video' | 'phone' | 'onsite'> = { video: 'video', phone: 'phone', onsite: 'onsite', in_person: 'onsite' };
const PROVIDER: Record<string, string> = { teams: 'Teams', microsoft: 'Teams', google: 'Google Meet', zoom: 'Zoom' };

/** „Runde 1 · Video (Teams) · 60 Min“ */
export function interviewKind(iv: { round?: number | null; meeting_format?: string | null; meeting_type?: string | null; meeting_provider?: string | null; duration_minutes?: number | null }): string {
  const kind = FORMAT[iv.meeting_format ?? ''] ?? FORMAT[iv.meeting_type ?? ''] ?? null;
  const format = kind ? tp(`kind.${kind}`) : null;
  const provider = PROVIDER[(iv.meeting_provider ?? '').toLowerCase()] ?? null;
  return [
    tp('kind.round', { round: iv.round ?? 1 }),
    format ? (provider && kind === 'video' ? `${format} (${provider})` : format) : null,
    iv.duration_minutes ? tp('kind.minutes', { minutes: iv.duration_minutes }) : null,
  ].filter(Boolean).join(' · ');
}

const BADGES = ['pending_response', 'counter_proposed', 'scheduled', 'completed', 'cancelled', 'declined'];
/** Status-Etikett eines Interviews; unbekannter Status bleibt, wie er ist. */
export const interviewBadge = (status: string): string => (BADGES.includes(status) ? tp(`badge.${status}`) : status);

const REMOTE: Record<string, 'remote' | 'hybrid' | 'onsite'> = { remote: 'remote', hybrid: 'hybrid', onsite: 'onsite', on_site: 'onsite', office: 'onsite' };
export const remoteLabel = (v: string | null | undefined) => (v ? (REMOTE[v] ? tp(`remote.${REMOTE[v]}`) : v) : null);

export const euro = (n: number) => (isGerman() ? `${Math.round(n).toLocaleString('de-DE')} €` : fmtMoney(Math.round(n)));

/** Aktivitäten, die nur Aufgaben-Verwaltung sind, nicht Prozess */
export const HOUSEKEEPING = ['alert_actioned', 'task_completed', 'playbook_used'];
