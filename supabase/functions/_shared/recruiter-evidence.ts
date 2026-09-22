/**
 * Nachweise des Headhunters (Profil Etappe 2, freigegeben 22.09.2026).
 *
 * Welche Nachweise der Vertrag verlangt: Register- oder Tätigkeitsnachweis für
 * alle, Versicherung und Vertretungsnachweis für Agenturen (für Einzelrecruiter
 * ist die Versicherung freiwillig, die Vertretung entfällt), dazu die Erklärung
 * zu den Einkünften. Dateien prüft Matchunt; die Erklärung ist eine eigene
 * Angabe und gilt sofort. Der Partnerstatus ist unbefristet, deshalb gibt es
 * keine jährliche Prüfung: Nachweise mit Ablaufdatum werden vorher erinnert.
 *
 * Reine Funktionen ohne Deno-Bezug, damit Profilseite und Server dieselben Regeln nutzen.
 */
export type EvidenceKind = 'business' | 'insurance' | 'authority' | 'income';
export type EvidenceStatus = 'pending' | 'approved' | 'rejected';
export interface EvidenceRow {
  id: string; recruiter_id?: string; kind: EvidenceKind; file_path: string | null; file_name: string | null; declaration: string | null;
  valid_until: string | null; status: EvidenceStatus; reason: string | null; uploaded_at: string; reviewed_at: string | null; reminded_at?: string | null;
}

export const EVIDENCE: Record<EvidenceKind, { label: string; hint: string; upload: boolean; expires: boolean }> = {
  business: { label: 'Register- oder Tätigkeitsnachweis', hint: 'Handelsregister oder Gewerbeanmeldung', upload: true, expires: false },
  insurance: { label: 'Versicherungsnachweis', hint: 'Berufshaftpflicht', upload: true, expires: true },
  authority: { label: 'Vertretungsnachweis', hint: 'Wer die Agentur vertreten darf, etwa Registerauszug oder Vollmacht', upload: true, expires: false },
  income: { label: 'Erklärung zu deinen Einkünften', hint: 'Ob mehr als die Hälfte deiner Einkünfte über Matchunt läuft', upload: false, expires: false },
};
export const UPLOAD_KINDS: EvidenceKind[] = ['business', 'insurance', 'authority'];
export const INCOME_OPTIONS = { below: 'Weniger als die Hälfte über Matchunt', above: 'Mehr als die Hälfte über Matchunt' } as const;
export type IncomeDeclaration = keyof typeof INCOME_OPTIONS;

export const EVIDENCE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const REMIND_DAYS = 30;
const DAY = 86_400_000;

export interface PlanItem { kind: EvidenceKind; required: boolean; applies: boolean }
/** Was der Vertrag für diese Art Partner verlangt. */
export function evidencePlan(partnerKind: string | null | undefined): PlanItem[] {
  const agency = partnerKind === 'agency';
  return [
    { kind: 'business', required: true, applies: true },
    { kind: 'insurance', required: agency, applies: true },
    { kind: 'authority', required: agency, applies: agency },
    { kind: 'income', required: true, applies: true },
  ];
}

/** Neuester Eintrag je Art. */
export function latestByKind(rows: EvidenceRow[]): Partial<Record<EvidenceKind, EvidenceRow>> {
  const out: Partial<Record<EvidenceKind, EvidenceRow>> = {};
  for (const row of rows) {
    const seen = out[row.kind];
    if (!seen || Date.parse(row.uploaded_at) > Date.parse(seen.uploaded_at)) out[row.kind] = row;
  }
  return out;
}

export type EvidenceState = 'missing' | 'pending' | 'approved' | 'rejected' | 'expiring' | 'expired';
const endOfDay = (date: string) => Date.parse(`${date}T23:59:59Z`);

export function evidenceState(row: EvidenceRow | undefined, now = Date.now()): EvidenceState {
  if (!row) return 'missing';
  if (row.status === 'approved' && row.valid_until) {
    const until = endOfDay(row.valid_until);
    if (until < now) return 'expired';
    if (until - now <= REMIND_DAYS * DAY) return 'expiring';
  }
  return row.status;
}

/** Offene Pflichten: fehlt, abgelehnt, abgelaufen oder läuft bald ab. Die Erklärung aus dem Vertrag zählt. */
export function openEvidence(partnerKind: string | null | undefined, rows: EvidenceRow[], contractIncome?: string, now = Date.now()): EvidenceKind[] {
  const latest = latestByKind(rows);
  return evidencePlan(partnerKind).filter(item => {
    if (!item.required || !item.applies) return false;
    if (item.kind === 'income') return !latest.income && !contractIncome?.trim();
    return ['missing', 'rejected', 'expired', 'expiring'].includes(evidenceState(latest[item.kind], now));
  }).map(item => item.kind);
}

const SAFE_NAME = /[^A-Za-z0-9._-]+/g;
/** Ablageort: eigener Ordner je Headhunter und Art, damit die Speicherregeln greifen. */
export const evidencePath = (userId: string, kind: EvidenceKind, fileName: string, stamp = Date.now()) =>
  `${userId}/${kind}/${stamp}-${fileName.replace(SAFE_NAME, '_').replace(/^[._]+/, '').slice(-80) || 'nachweis'}`;
export const EVIDENCE_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(business|insurance|authority)\/[A-Za-z0-9._-]{1,120}$/;

/** Gültig-bis als Datum JJJJ-MM-TT und nicht in der Vergangenheit. */
export function validUntilOk(value: unknown, now = Date.now()): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && endOfDay(value) >= now;
}

/** Fällige Erinnerungen: geprüft, mit Ablaufdatum in den nächsten 30 Tagen, noch nicht erinnert, kein neuerer Nachweis. */
export function dueReminders(rows: EvidenceRow[], now = Date.now()): EvidenceRow[] {
  const byRecruiter = new Map<string, EvidenceRow[]>();
  for (const row of rows) byRecruiter.set(row.recruiter_id ?? '', [...(byRecruiter.get(row.recruiter_id ?? '') ?? []), row]);
  return [...byRecruiter.values()].flatMap(list => Object.values(latestByKind(list)))
    .filter((row): row is EvidenceRow => !!row && row.status === 'approved' && !!row.valid_until && !row.reminded_at
      && endOfDay(row.valid_until) >= now && endOfDay(row.valid_until) - now <= REMIND_DAYS * DAY);
}
