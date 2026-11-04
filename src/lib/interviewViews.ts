// Live-Interview in fünf Punkten und dem Abschluss (02.11.2026: „13 Fragen links
// sind zu viele“). Gleicher Wortlaut der Fragen; Wunschrollen, Zielbranchen,
// Unternehmen und Top 3 fragt das Interview nicht mehr. Dazu der Termin aus der
// Buchung und der Merkzettel für die Rückkehr: Stelle und Uhr (ohne Inhalte),
// und nur bei einem Speicherfehler eine Kopie im Tab.

import { rahmenGaps, type DossierForm } from '@/lib/candidateDossier';

export type InterviewViewKey = 'ziel' | 'rolle' | 'motivation' | 'rahmen' | 'markt' | 'abschluss';

export interface InterviewView {
  key: InterviewViewKey;
  label: string;
  /** Felder des Punkts, damit „fehlt“ zur richtigen Frage springt. */
  fields: string[];
}

export const INTERVIEW_VIEWS: InterviewView[] = [
  { key: 'ziel', label: 'Karriereziel', fields: ['career_ultimate_goal', 'career_actions_taken', 'career_what_worked', 'career_what_didnt_work'] },
  { key: 'rolle', label: 'Rolle heute', fields: ['job_title', 'company', 'experience_years', 'leadership_scope', 'leadership_team_size', 'current_positive', 'current_negative'] },
  { key: 'motivation', label: 'Wechselmotivation', fields: ['change_motivation', 'specific_incident', 'discussed_internally', 'would_stay'] },
  {
    key: 'rahmen', label: 'Gehalt und Rahmen', fields: [
      'current_salary', 'expected_salary', 'salary_minimum', 'salary_basis', 'notice_period', 'availability_date', 'non_compete',
      'city', 'target_locations', 'relocation_willing', 'remote_preference', 'max_commute_minutes', 'employment_type', 'languages', 'work_permit', 'work_permit_notes',
    ],
  },
  { key: 'markt', label: 'Markt', fields: ['other_applications', 'other_applications_notes', 'blocked_companies', 'previous_process_issues'] },
  { key: 'abschluss', label: 'Abschluss', fields: ['recommendation', 'recommendation_notes', 'change_readiness', 'summary_motivation'] },
];

/** Felder der Rolle: Ohne Rolle in der Akte stehen sie ganz oben in Punkt 1. */
export const ROLLE_FIELDS = ['job_title', 'company', 'experience_years'];

export const viewIndex = (key: string | null | undefined) => INTERVIEW_VIEWS.findIndex((v) => v.key === key);
/** Punkt zu einem Feld, -1 wenn es nicht im Interview steht. */
export const viewOfField = (field: string) => INTERVIEW_VIEWS.findIndex((v) => v.fields.includes(field));
/** Der Kandidat ist nicht mehr in der Leitung: Die Uhr steht. */
export const isAfterCall = (key: InterviewViewKey) => key === 'abschluss';

/** Hat der Punkt schon eine Antwort? Nur das zählt als ✓; Vorbefülltes aus der Akte und bloßes Durchblättern nicht. */
export function viewAnswered(key: InterviewViewKey, f: DossierForm): boolean {
  switch (key) {
    case 'ziel': return !!f.career_ultimate_goal.trim();
    case 'rolle': return !!(f.current_positive.trim() || f.current_negative.trim());
    // Der Kundentext füllt sich schon aus Punkt 2, deshalb zählt erst der Auslöser.
    case 'motivation': return !!(f.specific_incident.trim() || f.why_now.trim());
    case 'rahmen': return !!f.expected_salary && !!(f.notice_period || f.availability_date) && rahmenGaps(f).length === 0;
    // Die Sperrliste füllt sich mit dem aktuellen Arbeitgeber von selbst und zählt nicht.
    case 'markt': return !!(f.other_applications || f.previous_process_issues.trim());
    case 'abschluss': return !!f.recommendation;
    default: return false;
  }
}

/** Erster Punkt ohne Antwort; ist alles beantwortet, der erste. */
export function firstOpenView(f: DossierForm): number {
  const i = INTERVIEW_VIEWS.findIndex((v) => !viewAnswered(v.key, f));
  return i === -1 ? 0 : i;
}

// ---------------------------------------------------------------------------
// Termin aus der Buchung
// ---------------------------------------------------------------------------

export interface InterviewTermin {
  id: string;
  starts_at: string;
  mode: 'teams' | 'phone';
  status: string;
}

const berlinTag = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Datum des Termins als yyyy-MM-dd in deutscher Zeit (Feld interview_date). */
export const terminDatum = (t: Pick<InterviewTermin, 'starts_at'>) => berlinTag(new Date(t.starts_at));

/**
 * Der gebuchte Termin für dieses Interview: gebucht und am selben Tag wie heute,
 * bei mehreren der zeitlich nächste. Ein Termin an einem anderen Tag gehört zu
 * einem anderen Gespräch und füllt weder Datum noch Gesprächsart.
 */
export function pickTermin<T extends InterviewTermin>(termine: T[], now: number): T | null {
  const heute = berlinTag(new Date(now));
  const passend = termine.filter((t) => t.status === 'booked' && terminDatum(t) === heute);
  passend.sort((a, b) => Math.abs(Date.parse(a.starts_at) - now) - Math.abs(Date.parse(b.starts_at) - now));
  return passend[0] ?? null;
}

/** Gesprächsart aus der Buchung: Teams ist ein Video-Gespräch. */
export const terminArt = (t: Pick<InterviewTermin, 'mode'>) => (t.mode === 'teams' ? 'video' : 'phone');

// ---------------------------------------------------------------------------
// Vorschau „So sieht der Kunde …“
// ---------------------------------------------------------------------------

/**
 * Gehaltswunsch als Spanne wie beim Kunden (salary_wish_band in der Datenbank):
 * auf 5.000 gerundet, mindestens 10.000 breit, unter 10.000 nichts.
 */
export function wunschBand(expected: number | null | undefined): string | null {
  if (!expected || expected < 10000) return null;
  const lo = Math.floor(expected / 5000) * 5000;
  let hi = Math.ceil(expected / 5000) * 5000;
  if (hi - lo < 10000) hi = lo + 10000;
  return `${lo / 1000}–${hi / 1000} T€`;
}

// ---------------------------------------------------------------------------
// Merkzettel im Browser
// ---------------------------------------------------------------------------

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Speicher kann im privaten Fenster fehlen oder Fehler werfen; dann gilt der Stand ohne Merkzettel.
const local = (): StorageLike | null => { try { return window.localStorage; } catch { return null; } };
const session = (): StorageLike | null => { try { return window.sessionStorage; } catch { return null; } };

function readJson<T>(store: StorageLike | null, key: string): T | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeValue(store: StorageLike | null, key: string, value: string | null) {
  try {
    if (value == null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // Merkzettel ist Komfort, das Interview läuft auch ohne.
  }
}

export interface InterviewPosition {
  view: InterviewViewKey;
  /** Zeitpunkt des letzten Merkens in Millisekunden. */
  at: number;
  /** Stand der Uhr in Sekunden. */
  elapsed: number;
  /** Letztes erfolgreiches Speichern in Millisekunden. */
  savedAt: number | null;
}

/** Innerhalb dieser Zeit läuft die Uhr weiter, danach gilt es als neues Gespräch. */
export const CLOCK_RESUME_MS = 30 * 60 * 1000;

export const resumedElapsed = (pos: InterviewPosition | null, now: number) =>
  pos && now - pos.at < CLOCK_RESUME_MS ? pos.elapsed : 0;

const posKey = (userId: string, candidateId: string) => `interview-position:${userId}:${candidateId}`;

export function readInterviewPosition(userId: string, candidateId: string, store = local()): InterviewPosition | null {
  const pos = readJson<InterviewPosition>(store, posKey(userId, candidateId));
  return pos && viewIndex(pos.view) >= 0 ? pos : null;
}
export function writeInterviewPosition(userId: string, candidateId: string, pos: InterviewPosition, store = local()) {
  writeValue(store, posKey(userId, candidateId), JSON.stringify(pos));
}
export function clearInterviewPosition(userId: string, candidateId: string, store = local()) {
  writeValue(store, posKey(userId, candidateId), null);
}

export type InterviewLayout = 'steps' | 'all';

/** „Alle Fragen zeigen“ bleibt je Nutzer gemerkt. */
export function readInterviewLayout(userId: string, store = local()): InterviewLayout {
  try {
    return store?.getItem(`interview-layout:${userId}`) === 'all' ? 'all' : 'steps';
  } catch {
    return 'steps';
  }
}
export function writeInterviewLayout(userId: string, layout: InterviewLayout, store = local()) {
  writeValue(store, `interview-layout:${userId}`, layout);
}

/** Fenster war offen: Nach dem Neuladen öffnet es sich von selbst wieder. */
export function markInterviewOpen(candidateId: string, isOpen: boolean, store = session()) {
  writeValue(store, `interview-open:${candidateId}`, isOpen ? '1' : null);
}
export function interviewWasOpen(candidateId: string, store = session()): boolean {
  try {
    return store?.getItem(`interview-open:${candidateId}`) === '1';
  } catch {
    return false;
  }
}

export interface InterviewLocalCopy {
  at: number;
  draft: DossierForm;
}

// Kopie nur bei einem Speicherfehler und nur im Tab: Sie enthält Gehalt und
// Schmerzgrenze und verschwindet mit dem nächsten erfolgreichen Speichern.
export function readLocalCopy(candidateId: string, store = session()): InterviewLocalCopy | null {
  return readJson<InterviewLocalCopy>(store, `interview-kopie:${candidateId}`);
}
export function writeLocalCopy(candidateId: string, draft: DossierForm, at: number, store = session()) {
  writeValue(store, `interview-kopie:${candidateId}`, JSON.stringify({ at, draft }));
}
export function clearLocalCopy(candidateId: string, store = session()) {
  writeValue(store, `interview-kopie:${candidateId}`, null);
}
