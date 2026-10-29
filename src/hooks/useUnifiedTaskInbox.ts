import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { anonymizeCompanyName } from '@/lib/anonymization';
import { ERINNERUNG_AB_TAGEN, FEEDBACK_AB_WERKTAGEN, nudgeState, workdaysBetween, type WaitState } from '@/lib/kundePrueft';

export interface UnifiedTaskItem {
  itemType: 'alert' | 'task' | 'derived';
  itemId: string;
  recruiterId: string;
  title: string;
  description: string | null;
  recommendedAction: string | null;
  taskCategory: string;
  sortPriority: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  submissionId: string | null;
  candidateId: string | null;
  jobId: string | null;
  playbookId: string | null;
  createdAt: string;
  dueAt: string | null;
  isRead: boolean;
  isArchived: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  snoozedUntil: string | null;
  impactScore: number;
  feeValue: number | null;
  candidateName: string | null;
  candidatePhone: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  companyName: string | null;
  /** Älter als 21 Tage ohne Bewegung: kein Alarm mehr, sondern ein Deal ohne Bewegung. */
  isStale: boolean;
  // „Kunde prüft“ (20.10.2026), aus dem Aktivitätslog – auf jedem Gerät gleich
  /** Erinnerungen an den Kunden zu dieser Einreichung. */
  nudgeCount?: number;
  lastNudgeAt?: string | null;
  /** Ab wann die nächste Erinnerung dran ist bzw. Matchunt übernimmt. */
  nextNudgeAt?: string | null;
  /** jetzt = du bist dran · wartet = Kunde ist dran · matchunt = 2 Erinnerungen ohne Antwort */
  waitState?: WaitState;
  /** Letzter Anruf/letzte Mail an den Kandidaten (ohne Erinnerungen an den Kunden). */
  lastCandidateContactAt?: string | null;
  /** Letzter Zwischenstand an den Kandidaten. */
  lastCandidateUpdateAt?: string | null;
  /** Bitte der letzten Erinnerung (decision | question | remind) – für den Zwischenstand-Text. */
  lastNudgeIntent?: string | null;
  /** Firmenname bekannt (Reveal) – nur dann dürfen Stellen desselben Kunden gebündelt werden. */
  companyRevealed?: boolean;
  /** „Wartet auf andere“ ohne Erinnerungen (28.10.2026): Vertrag bis Tag 10, pausierte Stelle. */
  parkKind?: 'contract' | 'paused' | 'counter';
  parkNote?: string | null;
  /** Kunde gibt kein Feedback: Beginn des Interviews. */
  interviewAt?: string | null;
  /** „In Prüfung“: wie oft das Kundenteam das Profil geöffnet hat, zuletzt wann (29.10.2026) */
  clientViewCount?: number;
  clientLastViewedAt?: string | null;
}

/** Stand der Stelle zu einer eigenen Einreichung (my_submission_jobs, 28.10.2026). */
interface SubmissionJobState {
  submission_id: string;
  job_status: string | null;
  job_title: string | null;
  job_industry: string | null;
  company_name: string | null;
  closed_at: string | null;
  paused_at: string | null;
  pause_until: string | null;
  client_first_viewed_at?: string | null;
  client_last_viewed_at?: string | null;
  client_view_count?: number | null;
}

export type TaskFilter = 'all' | 'opt_in' | 'follow_up' | 'interview' | 'manual' | 'other';

const FILTER_CATEGORIES: Record<TaskFilter, string[]> = {
  all: [],
  opt_in: ['opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h'],
  follow_up: ['follow_up_needed', 'ghosting_risk', 'engagement_drop', 'no_activity', 'client_review_stalled'],
  interview: ['interview_prep_missing', 'interview_reminder', 'interview_debrief_due'],
  manual: ['call', 'email', 'follow_up', 'meeting', 'other'],
  other: ['salary_mismatch', 'salary_negotiation', 'closing_opportunity', 'culture_concern', 'document_missing', 'client_feedback_positive', 'client_feedback_negative'],
};

const ALERT_PRIORITY_MAP: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const TASK_PRIORITY_TO_ALERT: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  urgent: 'critical',
  high: 'high',
  normal: 'medium',
  low: 'low',
};

const DAY_MS = 86_400_000;
// Client-Reaktion gilt nach so vielen Tagen ohne Bewegung als überfällig
// (Treppe 20.10.2026: Tag 5 → 1. Erinnerung, siehe lib/kundePrueft.ts)
const STALLED_AFTER_DAYS = ERINNERUNG_AB_TAGEN;
const STALLED_CRITICAL_DAYS = 7;

// ---------------------------------------------------------------------------
// Suppression für abgeleitete Aufgaben.
// Abgeleitete Items existieren nicht als DB-Zeile, sondern als Zustand
// ("Submission hängt", "Debrief fehlt"). "Erledigt"/"Snooze" kann darum nur
// lokal unterdrücken — die Aufgabe kommt wieder, wenn der Zustand anhält.
// Übergangslösung, bis die influence-engine diese Regeln serverseitig erzeugt.
// ---------------------------------------------------------------------------
const SUPPRESS_KEY = 'matchunt_derived_task_suppressions';

function readSuppressions(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SUPPRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Abgelaufene Einträge bereinigen
    const now = Date.now();
    const active: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && new Date(v).getTime() > now) active[k] = v;
    }
    return active;
  } catch {
    return {};
  }
}

export function suppressDerivedItem(itemId: string, until: Date) {
  try {
    const map = readSuppressions();
    map[itemId] = until.toISOString();
    localStorage.setItem(SUPPRESS_KEY, JSON.stringify(map));
  } catch {
    // localStorage nicht verfügbar → Item taucht beim nächsten Fetch wieder auf
  }
}

const calcFee = (
  salaryMin: number | null,
  salaryMax: number | null,
  feePercentage: number | null,
): number | null => {
  if (!feePercentage || (!salaryMin && !salaryMax)) return null;
  const avgSalary = salaryMin && salaryMax ? (salaryMin + salaryMax) / 2 : salaryMin || salaryMax;
  if (!avgSalary) return null;
  return Math.round(avgSalary * (feePercentage / 100));
};

// Firma nur zeigen, wenn die Submission den Reveal bestätigt — sonst Branchen-Label
// recruiter_jobs_view liefert company_name erst nach dem Reveal (Opt-in oder „Ich
// suche“) – steht er da, darf er gezeigt werden, wie in der Jobliste.
const safeCompany = (job: any, revealed: boolean | null | undefined): string | null => {
  if (!job) return null;
  return revealed === true || job.company_name ? job.company_name || null : anonymizeCompanyName(job.industry ?? null);
};

function mapAlertToItem(alert: any): UnifiedTaskItem {
  // Handle nested joins: submissions → candidates, jobs
  const submission = alert.submissions;
  const candidate = submission?.candidates;
  const job = submission?.jobs;

  return {
    itemType: 'alert',
    itemId: alert.id,
    recruiterId: alert.recruiter_id,
    title: alert.title,
    description: alert.message || null,
    recommendedAction: alert.recommended_action || null,
    taskCategory: alert.alert_type,
    sortPriority: ALERT_PRIORITY_MAP[alert.priority] ?? 4,
    priority: alert.priority || 'medium',
    submissionId: alert.submission_id,
    candidateId: submission?.candidate_id || null,
    jobId: submission?.job_id || null,
    playbookId: alert.playbook_id || null,
    createdAt: alert.created_at,
    dueAt: alert.expires_at || null,
    isRead: alert.is_read ?? false,
    isArchived: alert.is_dismissed ?? false,
    isCompleted: alert.action_taken != null,
    completedAt: alert.action_taken_at || null,
    snoozedUntil: alert.snoozed_until || null,
    impactScore: alert.impact_score ?? 50,
    feeValue: calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null),
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, submission?.company_revealed),
    isStale: false,
  };
}

function mapTaskToItem(task: any, job: any): UnifiedTaskItem {
  const candidate = task.candidates;
  const normalizedPriority = TASK_PRIORITY_TO_ALERT[task.priority] || 'medium';

  return {
    itemType: 'task',
    itemId: task.id,
    recruiterId: task.recruiter_id,
    title: task.title,
    description: task.description || null,
    recommendedAction: null,
    taskCategory: task.task_type || 'other',
    sortPriority: ALERT_PRIORITY_MAP[normalizedPriority] ?? 3,
    priority: normalizedPriority,
    submissionId: task.submission_id || null,
    candidateId: task.candidate_id || null,
    jobId: task.job_id || null,
    playbookId: task.playbook_id || null,
    createdAt: task.created_at,
    dueAt: task.due_at || null,
    isRead: false,
    isArchived: task.status === 'cancelled',
    isCompleted: task.status === 'completed',
    completedAt: task.completed_at || null,
    snoozedUntil: null,
    impactScore: 50,
    feeValue: calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null),
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    // Reveal ist ohne Submission-Verknüpfung nicht verifizierbar → immer Branchen-Label
    companyName: safeCompany(job, false),
    isStale: false,
  };
}

// Abgeleitete Aufgabe: Einreichung liegt beim Client, ohne Reaktion
function mapStalledSubmission(sub: any, now: number): UnifiedTaskItem | null {
  const anchorIso = sub.status === 'in_review' ? sub.updated_at || sub.submitted_at : sub.submitted_at;
  if (!anchorIso) return null;
  const days = Math.floor((now - new Date(anchorIso).getTime()) / DAY_MS);
  if (days < STALLED_AFTER_DAYS) return null;

  const job = sub.jobs;
  const candidate = sub.candidates;
  const fee = calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null);
  const priority: 'critical' | 'high' = days >= STALLED_CRITICAL_DAYS ? 'critical' : 'high';

  return {
    itemType: 'derived',
    itemId: `derived-stalled-${sub.id}`,
    recruiterId: sub.recruiter_id,
    title: `Keine Client-Reaktion seit ${days} Tagen`,
    description: `${candidate?.full_name || 'Kandidat'} liegt seit ${days} Tagen unbeantwortet beim Client — der Deal kühlt ab.`,
    recommendedAction: 'Beim Client nachfassen und Feedback zur Einreichung erfragen.',
    taskCategory: 'client_review_stalled',
    sortPriority: ALERT_PRIORITY_MAP[priority],
    priority,
    submissionId: sub.id,
    candidateId: sub.candidate_id || null,
    jobId: sub.job_id || null,
    playbookId: null,
    createdAt: anchorIso,
    dueAt: new Date(new Date(anchorIso).getTime() + STALLED_AFTER_DAYS * DAY_MS).toISOString(),
    isRead: false,
    isArchived: false,
    isCompleted: false,
    completedAt: null,
    snoozedUntil: null,
    impactScore: fee ? Math.min(90, 55 + Math.round(fee / 1000)) : 60,
    feeValue: fee,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, sub.company_revealed),
    companyRevealed: !!job?.company_name,
    isStale: false,
  };
}

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// Abgeleitete Aufgabe (28.10.2026): Stelle besetzt oder geschlossen, die Einreichung lag noch beim
// Kunden. Statt den Kunden zu erinnern, informiert der Headhunter den Kandidaten.
function mapJobClosedInform(sub: any, js: SubmissionJobState): UnifiedTaskItem {
  const filled = js.job_status === 'filled';
  const name = sub.candidates?.full_name || 'Der Kandidat';
  return {
    ...derivedBase(sub, sub.jobs, sub.candidates, {
      itemId: `derived-jobclosed-${sub.id}`,
      title: filled ? 'Stelle besetzt — Kandidat informieren' : 'Stelle geschlossen — Kandidat informieren',
      description: `${name} weiß noch nicht, dass die Stelle ${filled ? 'besetzt' : 'geschlossen'} ist.`,
      taskCategory: 'job_closed_inform',
      priority: 'high',
      createdAt: js.closed_at ?? sub.submitted_at ?? sub.updated_at,
    }),
    dueAt: new Date(Date.parse(js.closed_at ?? sub.updated_at) + DAY_MS).toISOString(),
  };
}

// „Wartet auf andere“ (28.10.2026): Stelle pausiert, darum keine Erinnerung an den Kunden
function mapPausedPark(sub: any, js: SubmissionJobState): UnifiedTaskItem {
  return {
    ...derivedBase(sub, sub.jobs, sub.candidates, {
      itemId: `parked-paused-${sub.id}`, title: 'Stelle pausiert', taskCategory: 'job_paused', priority: 'medium',
      createdAt: js.paused_at ?? sub.submitted_at ?? sub.updated_at,
    }),
    parkKind: 'paused',
    parkNote: `Stelle pausiert${js.pause_until ? ` bis ${dayMonth(js.pause_until)}` : ''} · keine Erinnerung an den Kunden`,
  };
}

/**
 * Hat der Headhunter den Kandidaten wirklich erreicht? Ein Anruf mit „Erreicht“ oder eine Mail an ihn,
 * die rausging. Nachrichten an den Kunden, gescheiterte Mails und „Nicht erreicht“ zählen nicht (29.10.2026).
 */
function reachedCandidate(l: { activity_type: string; metadata?: any }): boolean {
  const kind = l.metadata?.kind;
  if (kind === 'client_nudge' || kind === 'client_message') return false;
  if (l.activity_type === 'call') return l.metadata?.reached !== false;
  return l.activity_type === 'email' && l.metadata?.sent !== false;
}

/** Feedback des Kunden zum Interview liegt vor (wie parseFeedback in client-tasks). */
function hasClientFeedback(raw: unknown): boolean {
  if (!raw) return false;
  let v: any = raw;
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw); } catch { return false; }
  }
  return typeof v?.recommendation === 'string' && v.recommendation.length > 0;
}

// Abgeleitete Aufgabe: Interview vorbei, kein Feedback erfasst
function mapDebriefDue(iv: any, now: number): UnifiedTaskItem | null {
  const sub = iv.submissions;
  if (!sub || !iv.scheduled_at) return null;
  const endsAt = new Date(iv.scheduled_at).getTime() + (iv.duration_minutes ?? 60) * 60_000;
  if (endsAt > now) return null;

  const job = sub.jobs;
  const candidate = sub.candidates;
  const fee = calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null);
  const hoursSince = Math.floor((now - endsAt) / 3_600_000);
  // Nachgespräch am Interviewtag, ab dem nächsten Tag rot (20.10.2026, vorher nach 72 h)
  const dayEnd = new Date(endsAt); dayEnd.setHours(23, 59, 59, 999);
  const priority: 'critical' | 'high' = now > dayEnd.getTime() ? 'critical' : 'high';

  return {
    itemType: 'derived',
    itemId: `derived-debrief-${iv.id}`,
    recruiterId: sub.recruiter_id,
    title: 'Nachgespräch fällig — Interview ist vorbei',
    description: `Das Interview mit ${candidate?.full_name || 'Kandidat'} war vor ${hoursSince < 48 ? `${hoursSince} Std.` : `${Math.floor(hoursSince / 24)} Tagen`} — anrufen und hören, wie es lief, solange es frisch ist.`,
    recommendedAction: 'Kandidat anrufen: Bauchgefühl, Gehalt, Angebot, Start. Danach den Kunden nach seinem Eindruck fragen.',
    taskCategory: 'interview_debrief_due',
    sortPriority: ALERT_PRIORITY_MAP[priority],
    priority,
    submissionId: iv.submission_id,
    candidateId: sub.candidate_id || null,
    jobId: sub.job_id || null,
    playbookId: null,
    createdAt: iv.scheduled_at,
    dueAt: dayEnd.toISOString(),
    isRead: false,
    isArchived: false,
    isCompleted: false,
    completedAt: null,
    snoozedUntil: null,
    impactScore: fee ? Math.min(95, 65 + Math.round(fee / 1000)) : 70,
    feeValue: fee,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, sub.company_revealed),
    isStale: false,
  };
}

/** Grundgerüst einer abgeleiteten Aufgabe zu einer Einreichung. */
function derivedBase(sub: any, job: any, candidate: any, extra: Partial<UnifiedTaskItem> & Pick<UnifiedTaskItem, 'itemId' | 'title' | 'taskCategory' | 'priority' | 'createdAt'>): UnifiedTaskItem {
  const fee = calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null);
  return {
    itemType: 'derived', recruiterId: sub.recruiter_id, description: null, recommendedAction: null,
    sortPriority: ALERT_PRIORITY_MAP[extra.priority], submissionId: sub.id, candidateId: sub.candidate_id || null, jobId: sub.job_id || null,
    playbookId: null, dueAt: null, isRead: false, isArchived: false, isCompleted: false, completedAt: null, snoozedUntil: null,
    impactScore: fee ? Math.min(98, 75 + Math.round(fee / 1000)) : 80, feeValue: fee,
    candidateName: candidate?.full_name || null, candidatePhone: candidate?.phone || null, candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null, companyName: safeCompany(job, sub.company_revealed), isStale: false,
    ...extra,
  };
}

// Abgeleitete Aufgabe: Der Kunde hat ein Angebot gemacht, der Headhunter überbringt es (22.10.2026).
// Seit G + H (25.10.2026) antwortet der Kandidat selbst; die Aufgabe zeigt, was gerade beim Headhunter liegt:
// Uhr bis zur Mail, Rückrufwunsch, nachfassen nach 24 Std. ohne Antwort bzw. ohne bestätigte Zusage.
const HOUR_MS = 3_600_000;
// Ruhezeit wie auf dem Server (20–8 Uhr Berlin → 8 Uhr); nur für die Anzeige der Rückruf-Frist
function outsideQuietHoursBerlin(ms: number): number {
  const hour = Number(new Date(ms).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }));
  if (hour >= 8 && hour < 20) return ms;
  let t = ms;
  // In Viertelstunden vor bis 8:00 Berlin (kommt höchstens 12 Std. später)
  for (let i = 0; i < 49; i++) {
    t = Math.ceil((t + 1) / (15 * 60_000)) * 15 * 60_000;
    const p = new Date(t).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
    if (p === '08:00') return t;
  }
  return ms;
}
const clock = (ms: number) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

function mapOfferDeliver(o: any, now: number): UnifiedTaskItem | null {
  const sub = o.submissions;
  if (!sub) return null;
  const due = o.response_due ? new Date(`${o.response_due}T23:59:59`).getTime() : null;
  // Kalendertage bis zur Frist (heute = 0), nicht angebrochene 24-Stunden-Blöcke
  const berlinDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const daysLeft = due ? Math.round((Date.parse(`${berlinDay(due)}T12:00:00Z`) - Date.parse(`${berlinDay(now)}T12:00:00Z`)) / DAY_MS) : null;
  const byDeadline: 'critical' | 'high' = daysLeft !== null && daysLeft <= 1 ? 'critical' : 'high';
  const base = (title: string, description: string | null, priority: 'critical' | 'high', dueAt: number | null, createdAt: string) => derivedBase(sub, sub.jobs, sub.candidates, {
    itemId: `derived-offer-${o.id}`, title, description, taskCategory: 'offer_deliver', priority, createdAt,
    dueAt: dueAt ? new Date(dueAt).toISOString() : null,
  });
  const frist = o.response_due ? `Antwort bis ${new Date(`${o.response_due}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}` : null;

  // Ältere Angebote von vor G + H: „überlegt noch“
  if (o.status === 'considering') {
    const until = o.candidate_response?.until ? new Date(`${o.candidate_response.until}T23:59:59`).getTime() : due;
    return base('Kandidat überlegt noch — nachfassen', `Antwort bis ${o.candidate_response?.until ?? o.response_due ?? ''}`, byDeadline, until, o.sent_at ?? o.created_at);
  }
  // Zusage gemeldet: Kandidat bestätigt per Mail; nach 24 Std. ohne Klick anrufen
  if (o.status === 'accept_reported') {
    const at = o.accept_reported_at ? Date.parse(o.accept_reported_at) : null;
    if (!at || now - at < 24 * HOUR_MS) return null;
    return base('Zusage noch nicht bestätigt — anrufen', 'Seit 24 Std. kein Klick auf „Ja, ich sage zu“', 'high', at + 24 * HOUR_MS, o.accept_reported_at);
  }
  // Rückrufwunsch von der Angebotsseite: binnen 2 Std. (nachts bis 8 Uhr)
  if (o.callback_requested_at && !o.callback_done_at) {
    const until = outsideQuietHoursBerlin(Date.parse(o.callback_requested_at) + 2 * HOUR_MS);
    return base('Rückruf: Kandidat möchte sprechen', [`Rückruf bis ${clock(until)}`, o.callback_topic ? `„${o.callback_topic}“` : null].filter(Boolean).join(' · '), 'critical', until, o.callback_requested_at);
  }
  const mailDue = o.candidate_mail_due_at ? Date.parse(o.candidate_mail_due_at) : null;
  const mailSent = !!o.candidate_mail_sent_at || (mailDue !== null && mailDue <= now);
  // Uhr läuft: anrufen, bevor die Mail von selbst rausgeht
  if (!mailSent && mailDue !== null) {
    return base('Angebot überbringen', `Mail an Kandidat um ${clock(mailDue)}`, 'critical', mailDue, o.sent_at ?? o.created_at);
  }
  // 24 Std. nach der Mail keine Antwort: anrufen
  const reminder = o.candidate_reminder_due_at ? Date.parse(o.candidate_reminder_due_at) : null;
  if (reminder !== null && reminder <= now) {
    return base('Keine Antwort seit 24 Std. — anrufen', frist, byDeadline, due ?? reminder, o.candidate_reminder_due_at);
  }
  // Mail ging ohne Gespräch raus: noch besprechen; nach „Gespräch geführt“ antwortet der Kandidat selbst
  if (!o.recruiter_talked_at) {
    return base('Angebot mit Kandidat besprechen', frist, byDeadline, due, o.candidate_mail_sent_at ?? o.candidate_mail_due_at ?? o.created_at);
  }
  return null;
}

// Abgeleitete Aufgabe: Gegenwunsch liegt seit zwei Tagen beim Kunden ohne Antwort
function mapCounterStalled(o: any, now: number): UnifiedTaskItem | null {
  const sub = o.submissions;
  const at = o.counter_offer_at ?? o.responded_at;
  if (!sub || !at || now - new Date(at).getTime() < 2 * DAY_MS) return null;
  const wish = o.candidate_response?.wish?.salary;
  return derivedBase(sub, sub.jobs, sub.candidates, {
    itemId: `derived-counter-${o.id}`,
    title: 'Kunde antwortet nicht auf Gegenwunsch',
    description: wish ? `Wunsch: ${new Intl.NumberFormat('de-DE').format(wish)} € statt ${new Intl.NumberFormat('de-DE').format(o.salary_offered)} €` : null,
    taskCategory: 'offer_counter_stalled',
    priority: 'high',
    createdAt: at,
  });
}

// Abgeleitete Aufgaben rund um den Arbeitsvertrag (Paket 3, 22.10.2026):
// Gegenprobe nach Kundenmeldung, Kandidat zur Unterschrift anstoßen, Tag 10 nachfassen
function mapContractTask(r: any, acceptedAt: string | null, now: number): UnifiedTaskItem | null {
  const sub = r.submissions;
  if (!sub) return null;
  const base = (extra: Partial<UnifiedTaskItem> & Pick<UnifiedTaskItem, 'itemId' | 'title' | 'taskCategory' | 'priority' | 'createdAt'>) => derivedBase(sub, sub.jobs, sub.candidates, extra);
  if (['signed', 'final'].includes(r.status) && r.reported_role === 'client' && !r.recruiter_check) {
    return base({ itemId: `derived-contract-check-${r.contract_id}`, title: 'Gegenprobe: Kunde meldet die Unterschrift', description: r.signed_on ? `Unterschrieben am ${r.signed_on}` : null, taskCategory: 'contract_check', priority: 'high', createdAt: r.reported_at ?? r.updated_at });
  }
  if (r.status === 'company_signed') {
    return base({ itemId: `derived-contract-nudge-${r.contract_id}`, title: 'Zur Unterschrift anstoßen', description: 'Die Firma hat unterschrieben, der Kandidat noch nicht.', taskCategory: 'contract_nudge', priority: 'high', createdAt: r.company_signed_at ?? r.updated_at });
  }
  const anchor = r.status === 'sent_digital' && r.sent_at ? r.sent_at : (acceptedAt ?? r.updated_at);
  const days = anchor ? Math.floor((now - new Date(anchor).getTime()) / DAY_MS) : 0;
  if (['preparing', 'sent_self', 'sent_digital'].includes(r.status) && days >= 10) {
    return base({ itemId: `derived-contract-followup-${r.contract_id}`, title: 'Vertrag nachfassen', description: `Seit ${days} Tagen keine Unterschrift gemeldet.`, taskCategory: 'contract_followup', priority: days >= 21 ? 'critical' : 'high', createdAt: anchor });
  }
  // Bis Tag 10 ruhig: Vertrag begleiten (Stand ansehen, Unterschrift melden)
  if (['preparing', 'sent_self', 'sent_digital', 'declined'].includes(r.status)) {
    const desc = r.status === 'sent_self' ? `Kunde hat den Vertrag${r.sent_at ? ` am ${new Date(r.sent_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}` : ''} selbst verschickt.`
      : r.status === 'sent_digital' ? 'Vertrag über DocuSign verschickt, die Firma unterschreibt zuerst.'
        : r.status === 'declined' ? 'In DocuSign abgelehnt. Bitte klären.' : 'Kunde bereitet den Vertrag vor.';
    return base({ itemId: `derived-contract-follow-${r.contract_id}`, title: 'Vertrag begleiten', description: desc, taskCategory: 'contract_follow', priority: r.status === 'declined' ? 'high' : 'medium', createdAt: acceptedAt ?? r.updated_at });
  }
  return null;
}

// Abgeleitete Aufgabe: Der Kunde will ein Angebot machen, die Empfehlung fehlt noch
function mapRecommendationDue(iv: any): UnifiedTaskItem | null {
  const sub = iv.submissions;
  if (!sub) return null;
  return derivedBase(sub, sub.jobs, sub.candidates, {
    itemId: `derived-recommend-${sub.id}`,
    title: 'Empfehlung an den Kunden',
    description: 'Der Kunde möchte ein Angebot machen. Schick deine Empfehlung, bevor er Zahlen schreibt.',
    taskCategory: 'recommendation_due',
    priority: 'high',
    createdAt: iv.updated_at ?? iv.scheduled_at,
  });
}

// Abgeleitete Aufgabe: Interview angefragt, Kandidat hat noch nicht reagiert
function mapOptInDue(sub: any, now: number): UnifiedTaskItem {
  const anchorIso = sub.opt_in_requested_at || sub.updated_at;
  const hours = anchorIso ? Math.floor((now - new Date(anchorIso).getTime()) / 3_600_000) : 0;
  const job = sub.jobs;
  const candidate = sub.candidates;
  const fee = calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null);
  const priority: 'critical' | 'high' | 'medium' = hours >= 48 ? 'critical' : hours >= 24 ? 'high' : 'medium';
  const since = hours < 48 ? `${hours} Std.` : `${Math.floor(hours / 24)} Tagen`;

  return {
    itemType: 'derived',
    itemId: `derived-optin-${sub.id}`,
    recruiterId: sub.recruiter_id,
    title: 'Opt-In einholen — Kunde wartet',
    description: `${candidate?.full_name || 'Kandidat'} hat die Interview-Einladung seit ${since} nicht beantwortet.`,
    recommendedAction: 'Kandidat anrufen, Termin wählen lassen oder Opt-In bestätigen.',
    taskCategory: 'opt_in_pending',
    sortPriority: ALERT_PRIORITY_MAP[priority],
    priority,
    submissionId: sub.id,
    candidateId: sub.candidate_id || null,
    jobId: sub.job_id || null,
    playbookId: null,
    createdAt: anchorIso || new Date(now).toISOString(),
    dueAt: anchorIso ? new Date(new Date(anchorIso).getTime() + 24 * 3_600_000).toISOString() : null,
    isRead: false,
    isArchived: false,
    isCompleted: false,
    completedAt: null,
    snoozedUntil: null,
    impactScore: fee ? Math.min(95, 70 + Math.round(fee / 1000)) : 75,
    feeValue: fee,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, sub.company_revealed),
    isStale: false,
  };
}

// Abgeleitete Aufgabe: Kunde hat abgesagt, Kandidat weiß es noch nicht
function mapRejectedInform(sub: any): UnifiedTaskItem {
  const job = sub.jobs;
  const candidate = sub.candidates;
  const reason = typeof sub.rejection_reason === 'string' && sub.rejection_reason ? sub.rejection_reason : null;
  return {
    itemType: 'derived',
    itemId: `derived-rejected-${sub.id}`,
    recruiterId: sub.recruiter_id,
    title: 'Kunde hat abgesagt — Kandidat informieren',
    description: `${candidate?.full_name || 'Kandidat'} weiß noch nicht, dass der Kunde abgesagt hat${reason ? ` (Grund: ${reason})` : ''}.`,
    recommendedAction: 'Kandidat informieren, Grund neutral, andere Stellen anbieten.',
    taskCategory: 'rejected_inform',
    sortPriority: ALERT_PRIORITY_MAP.high,
    priority: 'high',
    submissionId: sub.id,
    candidateId: sub.candidate_id || null,
    jobId: sub.job_id || null,
    playbookId: null,
    createdAt: sub.rejected_at || sub.updated_at,
    dueAt: new Date(new Date(sub.rejected_at || sub.updated_at).getTime() + DAY_MS).toISOString(),
    isRead: false,
    isArchived: false,
    isCompleted: false,
    completedAt: null,
    snoozedUntil: null,
    impactScore: 40,
    feeValue: null,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, sub.company_revealed),
    isStale: false,
  };
}

/** Alle Aufgaben-Listen auf der Seite neu laden (Seite, Profil-Block, Fenster). */
const TASKS_CHANGED = 'matchunt:tasks-changed';
export function notifyTasksChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TASKS_CHANGED));
}

export function useUnifiedTaskInbox(filter: TaskFilter = 'all') {
  const { user } = useAuth();
  const [items, setItems] = useState<UnifiedTaskItem[]>([]);
  const [completedItems, setCompletedItems] = useState<UnifiedTaskItem[]>([]);
  /** „Kunde prüft“, bei denen der Kunde dran ist (erinnert) oder Matchunt übernommen hat. */
  const [waitingItems, setWaitingItems] = useState<UnifiedTaskItem[]>([]);
  /** Ebenfalls „Wartet auf andere“, aber ohne Erinnerungen: Vertrag bis Tag 10, pausierte Stelle. */
  const [parkedItems, setParkedItems] = useState<UnifiedTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const now = new Date().toISOString();
      const nowMs = Date.now();

      // Query 1: influence_alerts with nested submission → candidate + job
      const alertsQuery = supabase
        .from('influence_alerts')
        .select(`
          *,
          submissions(
            candidate_id,
            job_id,
            company_revealed,
            candidates(full_name, phone, email)
          )
        `)
        .eq('recruiter_id', user.id)
        .eq('is_dismissed', false)
        .is('action_taken', null)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

      // Query 2: recruiter_tasks with nested candidate + job
      // recruiter_tasks hat keine FKs auf submissions/jobs — nur der candidates-Join
      // funktioniert; Job-Infos werden unten separat per in('id', …) nachgeladen.
      const tasksQuery = supabase
        .from('recruiter_tasks')
        .select(`
          *,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });

      // Query 3: Einreichungen, die unbeantwortet beim Client liegen (abgeleitet)
      const stalledQuery = supabase
        .from('submissions')
        .select(`
          id, recruiter_id, candidate_id, job_id, status, submitted_at, updated_at, company_revealed,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .in('status', ['submitted', 'pending', 'in_review']);

      // Query 4: vergangene Interviews ohne Feedback → Debrief fällig (abgeleitet)
      const debriefQuery = supabase
        .from('interviews')
        .select(`
          id, submission_id, scheduled_at, duration_minutes, status, feedback,
          submissions!inner(
            id, recruiter_id, candidate_id, job_id, company_revealed, status, stage,
            candidates(full_name, phone, email)
          )
        `)
        .eq('submissions.recruiter_id', user.id)
        .in('status', ['scheduled', 'confirmed', 'completed'])
        .not('scheduled_at', 'is', null)
        .lt('scheduled_at', now)
        .gte('scheduled_at', new Date(nowMs - 60 * DAY_MS).toISOString());

      // Debrief-Wahrheit: das Debrief des Recruiters liegt in interview_feedback
      // (evaluator = er selbst), nicht in interviews.feedback (Kunde).
      const myFeedbackQuery = supabase
        .from('interview_feedback')
        .select('interview_id')
        .eq('evaluator_id', user.id);
      // Nachgespräch (20.10.2026). Fehlt die Tabelle noch (Lovable Nr. 25), zählt nur das alte Debrief.
      const nachQuery = (supabase as any)
        .from('interview_nachgespraeche')
        .select('interview_id')
        .eq('recruiter_id', user.id);

      // Opt-In einholen: Kunde hat ein Interview angefragt, Kandidat hat noch
      // nicht reagiert. Aus dem Zustand (stage), nicht aus Alerts.
      const optInQuery = supabase
        .from('submissions')
        .select(`
          id, recruiter_id, candidate_id, job_id, opt_in_requested_at, updated_at, company_revealed,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .eq('stage', 'interview_requested')
        // Ab Runde 2 ist der Kandidat freigegeben: dann gibt es kein Opt-In mehr einzuholen
        .eq('identity_unlocked', false);

      // Angebote beim Headhunter (überbringen, Rückruf, nachfassen), 22.10.2026 / G + H 25.10.2026
      const offerQuery = (supabase as any)
        .from('offers')
        .select(`id, submission_id, status, sent_at, created_at, response_due, candidate_response, counter_offer_at, responded_at, decision_at, salary_offered,
          candidate_mail_due_at, candidate_mail_sent_at, candidate_reminder_due_at, recruiter_talked_at, callback_requested_at, callback_topic, callback_done_at, accept_reported_at,
          submissions!inner(id, recruiter_id, candidate_id, job_id, company_revealed,
            candidates(full_name, phone, email))`)
        .eq('recruiter_id', user.id)
        .in('status', ['with_recruiter', 'considering', 'accept_reported', 'countered', 'accepted']);
      // Empfehlung fällig: Feedback des Kunden „Angebot machen“, noch keine Empfehlung und kein Angebot
      const offerWishQuery = supabase
        .from('interviews')
        .select(`id, submission_id, scheduled_at, updated_at, feedback,
          submissions!inner(id, recruiter_id, candidate_id, job_id, company_revealed,
            candidates(full_name, phone, email))`)
        .eq('submissions.recruiter_id', user.id)
        .like('feedback', '%"recommendation":"offer"%');
      const myRecsQuery = (supabase as any).from('offer_recommendations').select('submission_id').eq('recruiter_id', user.id);
      const myOffersQuery = (supabase as any).from('offers').select('submission_id').eq('recruiter_id', user.id);
      // Arbeitsvertrag: Stand ohne Dateien (Paket 3); fehlt die Funktion noch, gibt es keine Vertragsaufgaben
      const contractTaskQuery = (supabase as any).rpc('my_contract_tasks');

      // Kunde hat abgesagt, Kandidat noch nicht informiert (abgeleitet aus
      // Benachrichtigung + Zustand + fehlendem Beleg im Aktivitätslog)
      const rejectedNotifQuery = supabase
        .from('notifications')
        .select('related_id, created_at')
        .eq('user_id', user.id)
        .eq('type', 'candidate_rejected')
        .eq('related_type', 'submission')
        .gte('created_at', new Date(nowMs - 30 * DAY_MS).toISOString())
        .order('created_at', { ascending: false });

      // Query 5+6: zuletzt Erledigtes für die Sidebar
      const completedAlertsQuery = supabase
        .from('influence_alerts')
        .select(`
          *,
          submissions(
            candidate_id, job_id, company_revealed,
            candidates(full_name, phone, email)
          )
        `)
        .eq('recruiter_id', user.id)
        .not('action_taken', 'is', null)
        .order('action_taken_at', { ascending: false })
        .limit(10);

      const completedTasksQuery = supabase
        .from('recruiter_tasks')
        .select(`
          *,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      // Deine Schritte (Erinnerungen, Zwischenstände, Anrufe): Stand je Einreichung,
      // „Wartet auf andere“ und „Erledigt“ – serverseitig statt nur im Browser.
      const logQuery = supabase
        .from('candidate_activity_log')
        .select('id, candidate_id, related_submission_id, activity_type, title, metadata, created_at')
        .eq('recruiter_id', user.id)
        .gte('created_at', new Date(nowMs - 45 * DAY_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      const [alertsResult, tasksResult, stalledResult, debriefResult, completedAlertsResult, completedTasksResult, myFeedbackResult, optInResult, rejectedNotifResult, logResult, nachResult, offerResult, offerWishResult, myRecsResult, myOffersResult, contractTaskResult] =
        await Promise.all([alertsQuery, tasksQuery, stalledQuery, debriefQuery, completedAlertsQuery, completedTasksQuery, myFeedbackQuery, optInQuery, rejectedNotifQuery, logQuery, nachQuery, offerQuery, offerWishQuery, myRecsQuery, myOffersQuery, contractTaskQuery]);
      // Fehlen die Tabellen noch (Migration nicht live), bleiben die Listen leer
      const recommended = new Set(((myRecsResult as any).data || []).map((r: any) => r.submission_id as string));
      const offered = new Set(((myOffersResult as any).data || []).map((r: any) => r.submission_id as string));
      // Verträge: Einreichung mit Kandidat dazuladen; die Stelle hängt unten über recruiter_jobs_view an
      const contractRows = (((contractTaskResult as any).data || []) as any[]);
      let contractWraps: any[] = [];
      if (contractRows.length > 0) {
        const { data: cSubs } = await supabase
          .from('submissions')
          .select('id, recruiter_id, candidate_id, job_id, company_revealed, candidates(full_name, phone, email)')
          .in('id', [...new Set(contractRows.map((r) => r.submission_id))]);
        const byId = new Map(((cSubs || []) as any[]).map((x) => [x.id, x]));
        contractWraps = contractRows.map((r) => ({ ...r, submissions: byId.get(r.submission_id) ?? null })).filter((r) => r.submissions);
      }
      const acceptedAtBySub = new Map<string, string>();
      for (const o of (((offerResult as any).data || []) as any[])) if (o.status === 'accepted' && o.decision_at) acceptedAtBySub.set(o.submission_id, o.decision_at);
      const wishBySub = new Map<string, any>();
      for (const iv of ((offerWishResult as any).data || []) as any[]) if (!wishBySub.has(iv.submission_id)) wishBySub.set(iv.submission_id, iv);
      const logRows = (logResult.data || []) as { id: string; candidate_id: string | null; related_submission_id: string | null; activity_type: string; title: string | null; metadata: any; created_at: string }[];
      const debriefed = new Set([...(myFeedbackResult.data || []), ...((nachResult as any).data || [])].map((f: any) => f.interview_id as string));

      // Absagen: Einreichung laden, Beleg (Anruf/Mail nach der Absage) prüfen
      const rejectedNotifs = (rejectedNotifResult.data || []) as { related_id: string; created_at: string }[];
      const rejectedBySub = new Map<string, string>();
      for (const n of rejectedNotifs) if (n.related_id && !rejectedBySub.has(n.related_id)) rejectedBySub.set(n.related_id, n.created_at);
      let rejectedRows: any[] = [];
      if (rejectedBySub.size > 0) {
        const ids = [...rejectedBySub.keys()];
        const [subsRes, logRes] = await Promise.all([
          supabase
            .from('submissions')
            .select('id, recruiter_id, candidate_id, job_id, stage, status, rejection_reason, updated_at, company_revealed, candidates(full_name, phone, email)')
            .in('id', ids)
            .eq('recruiter_id', user.id),
          supabase
            .from('candidate_activity_log')
            .select('related_submission_id, activity_type, metadata, created_at')
            .eq('recruiter_id', user.id)
            .in('related_submission_id', ids)
            .in('activity_type', ['call', 'email']),
        ]);
        const informed = new Set<string>();
        for (const l of (logRes.data || []) as any[]) {
          const since = rejectedBySub.get(l.related_submission_id);
          if (since && l.created_at > since && reachedCandidate(l)) informed.add(l.related_submission_id);
        }
        rejectedRows = ((subsRes.data || []) as any[])
          .filter(r => (r.stage === 'client_rejected' || r.status === 'rejected') && !informed.has(r.id))
          .map(r => ({ ...r, rejected_at: rejectedBySub.get(r.id) }));
      }

      // Für „Erledigt“: Stelle und Name zu Log-Einträgen, die zu keiner offenen Aufgabe gehören
      const DONE_KINDS = new Set(['client_nudge', 'client_message', 'candidate_message', 'nachgespraech']);
      const doneLog = logRows.filter(l =>
        l.created_at >= new Date(nowMs - 7 * DAY_MS).toISOString()
        && (DONE_KINDS.has(l.metadata?.kind) || l.activity_type === 'call' || l.activity_type === 'alert_actioned'));
      const knownSubJob = new Map<string, string>();
      for (const r of [...(stalledResult.data || []), ...(optInResult.data || []), ...rejectedRows] as any[]) if (r.id && r.job_id) knownSubJob.set(r.id, r.job_id);
      const missingSubs = [...new Set(doneLog.map(l => l.related_submission_id).filter((id): id is string => !!id && !knownSubJob.has(id)))];
      if (missingSubs.length) {
        const { data } = await supabase.from('submissions').select('id, job_id').in('id', missingSubs);
        for (const r of (data || []) as any[]) if (r.job_id) knownSubJob.set(r.id, r.job_id);
      }
      const knownNames = new Map<string, string>();
      for (const r of [...(stalledResult.data || []), ...(optInResult.data || []), ...rejectedRows] as any[]) if (r.candidate_id && r.candidates?.full_name) knownNames.set(r.candidate_id, r.candidates.full_name);
      const missingCands = [...new Set(doneLog.map(l => l.candidate_id).filter((id): id is string => !!id && !knownNames.has(id)))];
      if (missingCands.length) {
        const { data } = await supabase.from('candidates').select('id, full_name').in('id', missingCands);
        for (const r of (data || []) as any[]) if (r.full_name) knownNames.set(r.id, r.full_name);
      }

      for (const [label, res] of [
        ['alerts', alertsResult],
        ['tasks', tasksResult],
        ['stalled submissions', stalledResult],
        ['debrief interviews', debriefResult],
        ['completed alerts', completedAlertsResult],
        ['completed tasks', completedTasksResult],
        ['my feedback', myFeedbackResult],
        ['opt-in submissions', optInResult],
        ['activity log', logResult],
      ] as const) {
        if (res.error) console.error(`Error fetching ${label}:`, res.error);
      }

      // Job-Infos zentral nachladen. Recruiter duerfen public.jobs nicht mehr
      // direkt lesen, deshalb ist ein eingebetteter jobs(...)-Join in den
      // Queries oben nicht mehr moeglich — die Firmenidentitaet wird nur ueber
      // recruiter_jobs_view (reveal-gated) aufgeloest.
      const rowsWithSubmission: any[] = [
        ...(alertsResult.data || []),
        ...(completedAlertsResult.data || []),
        ...(debriefResult.data || []),
        // Angebot überbringen, Gegenwunsch, Empfehlung fällig (22.10.2026)
        ...(((offerResult as any).data || []) as any[]),
        ...(((offerWishResult as any).data || []) as any[]),
        ...contractWraps,
      ];
      const allJobIds = [
        ...new Set(
          [
            ...(tasksResult.data || []).map((t: any) => t.job_id),
            ...(completedTasksResult.data || []).map((t: any) => t.job_id),
            ...(stalledResult.data || []).map((s: any) => s.job_id),
            ...(optInResult.data || []).map((s: any) => s.job_id),
            ...rejectedRows.map((s: any) => s.job_id),
            ...rowsWithSubmission.map((r: any) => r.submissions?.job_id),
            ...knownSubJob.values(),
          ].filter(Boolean)
        ),
      ] as string[];

      let taskJobsById: Record<string, any> = {};
      if (allJobIds.length > 0) {
        const { data: jobRows, error: jobsError } = await supabase
          .from('recruiter_jobs_view')
          .select('id, title, company_name, industry, salary_min, salary_max, recruiter_fee_percentage')
          .in('id', allJobIds);
        if (jobsError) console.error('Error fetching task jobs:', jobsError);
        taskJobsById = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
      }

      // Job-Objekt dort wieder anhaengen, wo vorher der PostgREST-Join stand,
      // damit die Mapper unveraendert weiterarbeiten koennen.
      rowsWithSubmission.forEach((r: any) => {
        if (r.submissions?.job_id) r.submissions.jobs = taskJobsById[r.submissions.job_id] ?? null;
      });
      (stalledResult.data || []).forEach((s: any) => {
        if (s.job_id) s.jobs = taskJobsById[s.job_id] ?? null;
      });
      (optInResult.data || []).forEach((s: any) => {
        if (s.job_id) s.jobs = taskJobsById[s.job_id] ?? null;
      });
      rejectedRows.forEach((s: any) => {
        if (s.job_id) s.jobs = taskJobsById[s.job_id] ?? null;
      });

      // Stand der Stelle zu den eigenen Einreichungen (28.10.2026): besetzt, geschlossen, pausiert.
      // recruiter_jobs_view kennt nur veröffentlichte Stellen. Fehlt die Funktion noch (Lovable), bleibt alles wie bisher.
      const jobStateSubs = [...new Set([
        ...(stalledResult.data || []).map((s: any) => s.id),
        ...(debriefResult.data || []).map((iv: any) => iv.submission_id),
      ].filter(Boolean))] as string[];
      const jobStateBySub = new Map<string, SubmissionJobState>();
      if (jobStateSubs.length) {
        const { data: js, error: jsError } = await (supabase as any).rpc('my_submission_jobs', { p_submission_ids: jobStateSubs });
        if (jsError) console.warn('Stand der Stellen nicht geladen:', jsError.message);
        for (const r of (js || []) as SubmissionJobState[]) jobStateBySub.set(r.submission_id, r);
      }
      const jobClosed = (subId: string) => ['filled', 'closed'].includes(jobStateBySub.get(subId)?.job_status ?? '');
      // Pausiert der Kunde, bleibt der Status 'published' und paused_at ist gesetzt (bis pause_until) (29.10.2026)
      const jobPaused = (js: SubmissionJobState | undefined) => !!js && (js.job_status === 'paused'
        || (!!js.paused_at && (!js.pause_until || Date.parse(js.pause_until) > nowMs)));
      const jobOf = (subId: string, current: any) => {
        const js = jobStateBySub.get(subId);
        return current ?? (js ? { title: js.job_title, industry: js.job_industry, company_name: js.company_name } : null);
      };
      (stalledResult.data || []).forEach((s: any) => { s.jobs = jobOf(s.id, s.jobs); });
      (debriefResult.data || []).forEach((iv: any) => { if (iv.submissions) iv.submissions.jobs = jobOf(iv.submission_id, iv.submissions.jobs); });

      // Map alerts — erst jetzt, damit die Job-Infos oben schon anhaengen.
      const alertItems: UnifiedTaskItem[] = (alertsResult.data || [])
        .map(mapAlertToItem)
        .filter(item => {
          // Filter out snoozed items (if snoozed_until column exists)
          if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) {
            return false;
          }
          return true;
        });

      // Map tasks
      const taskItems: UnifiedTaskItem[] = (tasksResult.data || []).map((t: any) =>
        mapTaskToItem(t, t.job_id ? taskJobsById[t.job_id] : null)
      );

      // Abgeleitete Items: nicht doppeln, falls die Engine dieselbe Regel schon
      // als Alert erzeugt (UNIQUE submission_id+alert_type serverseitig), und
      // lokale Suppressions ("Erledigt"/Snooze auf abgeleiteten Items) beachten.
      const alertKeys = new Set(alertItems.map(a => `${a.taskCategory}:${a.submissionId}`));
      const suppressions = readSuppressions();

      // „Kunde prüft“: Stand aus den Erinnerungen im Aktivitätslog. Erinnert und noch
      // in der Frist → wartet (nicht in „Jetzt“), nach 2 Erinnerungen → Matchunt.
      const nowDate = new Date(nowMs);
      // Besetzte/geschlossene Stelle: Kandidat informieren statt Kunden erinnern; pausiert: warten (28.10.2026)
      const closedInformItems: UnifiedTaskItem[] = [];
      const parked: UnifiedTaskItem[] = [];
      const stalledAll: UnifiedTaskItem[] = (stalledResult.data || [])
        .map((s: any) => {
          const js = jobStateBySub.get(s.id);
          if (js && jobClosed(s.id)) {
            const since = js.closed_at ?? s.submitted_at ?? '';
            // Nur echte Kontakte zählen: eine gescheiterte Mail (metadata.sent === false) informiert niemanden
            const informed = logRows.some(l => (l.related_submission_id === s.id || l.candidate_id === s.candidate_id)
              && reachedCandidate(l) && l.created_at > since);
            if (!informed) closedInformItems.push(mapJobClosedInform(s, js));
            return null;
          }
          if (jobPaused(js)) {
            parked.push(mapPausedPark(s, js));
            return null;
          }
          // Nach einer Pause zählt „Kunde prüft“ wieder von vorn
          const floor = js?.pause_until && Date.parse(js.pause_until) <= nowMs ? js.pause_until : null;
          const later = (a: string | null) => (a && floor && a > floor ? a : floor ?? a);
          const item = mapStalledSubmission(floor ? { ...s, submitted_at: later(s.submitted_at), updated_at: later(s.updated_at) } : s, nowMs);
          if (!item) return null;
          const mine = logRows.filter(l => l.related_submission_id === s.id && l.created_at >= (s.submitted_at ?? ''));
          const nudgeRows = mine.filter(l => l.metadata?.kind === 'client_nudge');
          const st = nudgeState(nudgeRows.map(l => l.created_at), nowDate);
          const contact = logRows.filter(l => l.candidate_id === s.candidate_id && reachedCandidate(l));
          const updates = contact.filter(l => l.metadata?.kind === 'candidate_message');
          return {
            ...item,
            ...st,
            lastCandidateContactAt: contact[0]?.created_at ?? null,
            lastCandidateUpdateAt: updates[0]?.created_at ?? null,
            lastNudgeIntent: nudgeRows[0]?.metadata?.intent ?? null,
            clientViewCount: js?.client_view_count ?? 0,
            clientLastViewedAt: js?.client_last_viewed_at ?? null,
          } as UnifiedTaskItem;
        })
        .filter((i): i is UnifiedTaskItem => i !== null);

      // Nachgespräch und Kunden-Feedback nur zum jüngsten gelaufenen Interview je Einreichung,
      // nicht nach Einstellung, Absage, Rückzug, Zusage oder besetzter Stelle (28.10.2026)
      const CLOSED_SUB = new Set(['hired', 'placed', 'rejected', 'withdrawn', 'client_rejected', 'expired']);
      const ivEnd = (iv: any) => Date.parse(iv.scheduled_at) + (iv.duration_minutes ?? 60) * 60_000;
      const latestIv = new Map<string, any>();
      for (const iv of (debriefResult.data || []) as any[]) {
        if (!iv.scheduled_at || ivEnd(iv) > nowMs) continue;
        const cur = latestIv.get(iv.submission_id);
        if (!cur || cur.scheduled_at < iv.scheduled_at) latestIv.set(iv.submission_id, iv);
      }
      const ivOpen = (iv: any) => {
        const sub = iv.submissions;
        return latestIv.get(iv.submission_id)?.id === iv.id
          && !CLOSED_SUB.has(sub?.status) && !CLOSED_SUB.has(sub?.stage)
          && !acceptedAtBySub.has(iv.submission_id) && !jobClosed(iv.submission_id);
      };

      // Kunde gibt nach dem Interview keinen Eindruck: ab 2 Werktagen, eine Zeile je Stelle (28.10.2026)
      const feedbackAll: UnifiedTaskItem[] = ([...latestIv.values()] as any[])
        .filter(iv => ivOpen(iv) && !hasClientFeedback(iv.feedback) && !offered.has(iv.submission_id)
          && !jobPaused(jobStateBySub.get(iv.submission_id))
          && workdaysBetween(new Date(ivEnd(iv)), nowDate) >= FEEDBACK_AB_WERKTAGEN)
        .map((iv: any) => {
          const sub = iv.submissions;
          const endIso = new Date(ivEnd(iv)).toISOString();
          const days = Math.floor((nowMs - ivEnd(iv)) / DAY_MS);
          const nudgeRows = logRows.filter(l => l.related_submission_id === iv.submission_id && l.metadata?.kind === 'client_nudge'
            && l.metadata?.intent === 'interview_feedback' && l.created_at >= endIso);
          const contact = logRows.filter(l => l.candidate_id === sub.candidate_id && reachedCandidate(l));
          return {
            ...derivedBase(sub, sub.jobs, sub.candidates, {
              itemId: `derived-feedback-${iv.id}`,
              title: `Kunde ohne Feedback seit ${days} Tagen`,
              description: `Interview am ${dayMonth(iv.scheduled_at)}, seitdem kein Eindruck des Kunden.`,
              taskCategory: 'client_feedback_due',
              priority: 'high',
              createdAt: endIso,
            }),
            submissionId: iv.submission_id,
            companyRevealed: !!sub.jobs?.company_name,
            interviewAt: iv.scheduled_at,
            ...nudgeState(nudgeRows.map(l => l.created_at), nowDate),
            lastCandidateContactAt: contact[0]?.created_at ?? null,
            lastCandidateUpdateAt: contact.filter(l => l.metadata?.kind === 'candidate_message')[0]?.created_at ?? null,
            lastNudgeIntent: nudgeRows.length ? 'interview_feedback' : null,
          } as UnifiedTaskItem;
        });

      // Vertrag begleiten bis Tag 10: nichts zu tun, darum unter „Wartet auf andere“ (28.10.2026)
      const contractItems: UnifiedTaskItem[] = [];
      for (const r of contractWraps) {
        const it = mapContractTask(r, acceptedAtBySub.get(r.submission_id) ?? null, nowMs);
        if (!it) continue;
        if (it.taskCategory === 'contract_follow' && r.status !== 'declined') {
          const accepted = acceptedAtBySub.get(r.submission_id) ?? null;
          const anchor = r.status === 'sent_digital' && r.sent_at ? r.sent_at : (accepted ?? r.updated_at);
          const ab = dayMonth(new Date(Date.parse(anchor) + 10 * DAY_MS).toISOString());
          const first = (it.candidateName ?? '').split(/\s+/)[0] || 'dem Kandidaten';
          const stand = r.status === 'preparing' ? 'Kunde bereitet den Vertrag vor'
            : r.status === 'sent_self' ? `bei ${first} seit ${r.sent_at ? dayMonth(r.sent_at) : 'kurzem'}`
              : `digital verschickt${r.sent_at ? ` am ${dayMonth(r.sent_at)}` : ''}`;
          parked.push({ ...it, parkKind: 'contract', parkNote: `${stand} · nachfassen ab ${ab}` });
          continue;
        }
        // Nachgefasst (29.10.2026): Kandidat sagt „unterschreibt bis …“ oder Kunde ist gefragt → wartet
        if (it.taskCategory !== 'contract_check') {
          const mine = logRows.filter(l => l.related_submission_id === r.submission_id);
          const until = mine.find(l => l.activity_type === 'call' && typeof l.metadata?.until === 'string')?.metadata?.until as string | undefined;
          const today = new Date(nowMs).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
          const first = (it.candidateName ?? '').split(/\s+/)[0] || 'Der Kandidat';
          if (until && until >= today) {
            parked.push({ ...it, parkKind: 'contract', parkNote: `${first} unterschreibt laut Anruf bis ${dayMonth(until)} · danach wieder oben` });
            continue;
          }
          const st = nudgeState(mine.filter(l => l.metadata?.kind === 'client_nudge' && l.metadata?.anlass === 'contract').map(l => l.created_at), nowDate);
          if (st.waitState === 'wartet') {
            parked.push({ ...it, ...st, parkKind: 'contract', parkNote: `Kunde zum Vertrag gefragt am ${dayMonth(st.lastNudgeAt!)} · nachfassen ab ${dayMonth(st.nextNudgeAt!)}` });
            continue;
          }
        }
        contractItems.push(it);
      }
      // Gegenwunsch beim Kunden: erinnert und noch in der Frist → „Wartet auf andere“, auf dem Server
      // festgehalten statt nur im Browser vertagt (29.10.2026)
      const counterJetzt: UnifiedTaskItem[] = [];
      for (const o of (((offerResult as any).data || []) as any[]).filter((o) => o.status === 'countered')) {
        const it = mapCounterStalled(o, nowMs);
        if (!it) continue;
        const since = o.counter_offer_at ?? o.responded_at ?? '';
        const st = nudgeState(logRows.filter(l => l.related_submission_id === o.submission_id && l.metadata?.kind === 'client_nudge' && l.created_at >= since).map(l => l.created_at), nowDate);
        if (st.waitState === 'wartet') {
          parked.push({ ...it, ...st, parkKind: 'counter', parkNote: `Kunde erinnert am ${dayMonth(st.lastNudgeAt!)} · ${st.nudgeCount >= 2 ? 'wieder nachfassen' : '2. Erinnerung'} ab ${dayMonth(st.nextNudgeAt!)}` });
        } else counterJetzt.push({ ...it, ...st });
      }
      setParkedItems(parked);
      setWaitingItems([...stalledAll, ...feedbackAll].filter(i => i.waitState !== 'jetzt'));

      const derivedItems: UnifiedTaskItem[] = [
        ...stalledAll.filter(i => i.waitState === 'jetzt'),
        ...feedbackAll.filter(i => i.waitState === 'jetzt'),
        ...closedInformItems,
        ...(debriefResult.data || [])
          // Liegt schon ein Angebot vor, führt die Angebots-Aufgabe zum Kandidaten, nicht mehr das Nachgespräch (29.10.2026)
          .filter((iv: any) => !debriefed.has(iv.id) && ivOpen(iv) && !offered.has(iv.submission_id))
          .map((iv: any) => mapDebriefDue(iv, nowMs)),
        ...(optInResult.data || []).map((s: any) => mapOptInDue(s, nowMs)),
        ...rejectedRows.map((s: any) => mapRejectedInform(s)),
        ...(((offerResult as any).data || []) as any[]).filter((o) => o.status !== 'accepted' && o.status !== 'countered').map((o) => mapOfferDeliver(o, nowMs)),
        ...counterJetzt,
        ...contractItems,
        ...[...wishBySub.values()].filter((iv) => !recommended.has(iv.submission_id) && !offered.has(iv.submission_id)).map((iv) => mapRecommendationDue(iv)),
      ]
        .filter((i): i is UnifiedTaskItem => i !== null)
        .filter(i => !alertKeys.has(`${i.taskCategory}:${i.submissionId}`))
        .filter(i => !suppressions[i.itemId]);

      // Merge + sort: by sortPriority ASC, then impact DESC, then createdAt DESC
      const staleBefore = nowMs - 21 * DAY_MS;
      const merged = [...alertItems, ...taskItems, ...derivedItems].map(i => ({
        ...i,
        isStale: i.itemType !== 'task' && new Date(i.dueAt ?? i.createdAt).getTime() < staleBefore,
      })).sort((a, b) => {
        if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
        if (a.impactScore !== b.impactScore) return b.impactScore - a.impactScore;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setItems(merged);

      // „Erledigt“: deine Schritte der letzten 7 Tage aus dem Aktivitätslog plus eigene
      // Erinnerungen. Alte Engine-Hinweise („Ghosting-Risiko!“) zählen nicht mehr.
      const doneFromLog: UnifiedTaskItem[] = doneLog.map(l => {
        const jobId = l.related_submission_id ? knownSubJob.get(l.related_submission_id) ?? null : null;
        return {
          itemType: 'derived', itemId: `log-${l.id}`, recruiterId: user.id, title: l.title || 'Erledigt', description: null,
          recommendedAction: null, taskCategory: l.metadata?.kind || l.activity_type, sortPriority: 9, priority: 'low',
          submissionId: l.related_submission_id, candidateId: l.candidate_id, jobId, playbookId: null, createdAt: l.created_at,
          dueAt: null, isRead: true, isArchived: false, isCompleted: true, completedAt: l.created_at, snoozedUntil: null,
          impactScore: 0, feeValue: null, candidateName: l.candidate_id ? knownNames.get(l.candidate_id) ?? null : null,
          candidatePhone: null, candidateEmail: null, jobTitle: jobId ? taskJobsById[jobId]?.title ?? null : null,
          companyName: null, isStale: false,
        } satisfies UnifiedTaskItem;
      });
      void completedAlertsResult;
      const completedMerged = [
        ...doneFromLog,
        ...(completedTasksResult.data || []).map((t: any) =>
          mapTaskToItem(t, t.job_id ? taskJobsById[t.job_id] : null)
        ),
      ]
        .filter(i => i.isCompleted)
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
        .slice(0, 30);

      setCompletedItems(completedMerged);
    } catch (err) {
      console.error('Unified inbox fetch error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Aufgaben');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Ein Handgriff in einem Fenster lädt jede Liste neu, nicht nur die eigene.
  useEffect(() => {
    const onChange = () => { void fetchItems(); };
    window.addEventListener(TASKS_CHANGED, onChange);
    return () => window.removeEventListener(TASKS_CHANGED, onChange);
  }, [fetchItems]);

  useEffect(() => {
    fetchItems();

    if (user) {
      // Subscribe to both source tables for realtime updates
      const alertChannel = supabase
        .channel('unified-inbox-alerts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'influence_alerts',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => { fetchItems(); }
        )
        .subscribe();

      const taskChannel = supabase
        .channel('unified-inbox-tasks')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recruiter_tasks',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => { fetchItems(); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(alertChannel);
        supabase.removeChannel(taskChannel);
      };
    }
  }, [user?.id, fetchItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;

    const categories = FILTER_CATEGORIES[filter];
    if (!categories.length) return items;

    // For 'manual' filter: show only tasks (not alerts)
    if (filter === 'manual') {
      return items.filter(i => i.itemType === 'task');
    }

    return items.filter(i => categories.includes(i.taskCategory));
  }, [items, filter]);

  // Counts per filter
  const filterCounts = useMemo(() => {
    const counts: Record<TaskFilter, number> = {
      all: items.length,
      opt_in: 0,
      follow_up: 0,
      interview: 0,
      manual: 0,
      other: 0,
    };

    items.forEach(item => {
      if (item.itemType === 'task') {
        counts.manual++;
      } else if (FILTER_CATEGORIES.opt_in.includes(item.taskCategory)) {
        counts.opt_in++;
      } else if (FILTER_CATEGORIES.follow_up.includes(item.taskCategory)) {
        counts.follow_up++;
      } else if (FILTER_CATEGORIES.interview.includes(item.taskCategory)) {
        counts.interview++;
      } else {
        counts.other++;
      }
    });

    return counts;
  }, [items]);

  const urgentItems = useMemo(
    () => filteredItems.filter(i => i.priority === 'critical'),
    [filteredItems]
  );
  const openItems = useMemo(
    () => filteredItems.filter(i => i.priority !== 'critical'),
    [filteredItems]
  );

  // Actions — geben { error } zurück; die Oberfläche toastet nur bei Erfolg.
  const markDone = async (itemType: 'alert' | 'task' | 'derived', itemId: string): Promise<{ error: string | null }> => {
    let error: string | null = null;
    if (itemType === 'alert') {
      const res = await supabase
        .from('influence_alerts')
        .update({
          action_taken: 'completed',
          action_taken_at: new Date().toISOString(),
          is_read: true,
        })
        .eq('id', itemId);
      error = res.error?.message ?? null;
    } else if (itemType === 'task') {
      const res = await supabase
        .from('recruiter_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', itemId);
      error = res.error?.message ?? null;
    } else {
      // Abgeleitet: 3 Tage unterdrücken — kommt wieder, wenn der Zustand anhält
      suppressDerivedItem(itemId, new Date(Date.now() + 3 * DAY_MS));
    }

    if (!error) setItems(prev => prev.filter(i => i.itemId !== itemId));
    return { error };
  };

  const snooze = async (itemType: 'alert' | 'task' | 'derived', itemId: string, until: Date): Promise<{ error: string | null }> => {
    let error: string | null = null;
    if (itemType === 'alert') {
      // snoozed_until existiert live nicht (Migration 20260225 nie angewendet);
      // expires_at wird von der Lese-Query bereits beachtet und trägt den Snooze.
      const res = await supabase
        .from('influence_alerts')
        .update({ expires_at: until.toISOString() })
        .eq('id', itemId);
      error = res.error?.message ?? null;
    } else if (itemType === 'task') {
      // Eigene Aufgabe: Fälligkeit verschieben; sie bleibt sichtbar und rückt in
      // die spätere Zeitgruppe (statt kurz zu verschwinden und wiederzukommen).
      const res = await supabase
        .from('recruiter_tasks')
        .update({ due_at: until.toISOString() })
        .eq('id', itemId);
      error = res.error?.message ?? null;
      if (!error) await fetchItems();
      return { error };
    } else {
      suppressDerivedItem(itemId, until);
    }

    if (!error) setItems(prev => prev.filter(i => i.itemId !== itemId));
    return { error };
  };

  const dismiss = async (itemType: 'alert' | 'task' | 'derived', itemId: string): Promise<{ error: string | null }> => {
    let error: string | null = null;
    if (itemType === 'alert') {
      const res = await supabase
        .from('influence_alerts')
        .update({ is_dismissed: true })
        .eq('id', itemId);
      error = res.error?.message ?? null;
    } else if (itemType === 'task') {
      const res = await supabase
        .from('recruiter_tasks')
        .update({ status: 'cancelled' })
        .eq('id', itemId);
      error = res.error?.message ?? null;
    } else {
      suppressDerivedItem(itemId, new Date(Date.now() + 30 * DAY_MS));
    }

    if (!error) setItems(prev => prev.filter(i => i.itemId !== itemId));
    return { error };
  };

  return {
    items: filteredItems,
    allItems: items,
    waitingItems,
    parkedItems,
    urgentItems,
    openItems,
    completedItems,
    loading,
    error,
    refetch: fetchItems,
    markDone,
    snooze,
    dismiss,
    filterCounts,
    pendingCount: items.length,
    urgentCount: items.filter(i => i.priority === 'critical').length,
  };
}
