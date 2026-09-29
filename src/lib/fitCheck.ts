// Passungs-Check vor dem Einreichen: harte Fakten aus Kandidatenakte und
// Stelle, kein KI-Score. Rechtliche Leitplanke (DSGVO Art. 22): Eine Regel
// sperrt nie allein. Klare Ausschlüsse aus Fakten sind Warnungen, die der
// Headhunter mit Begründung übergehen kann (wird mit der Einreichung
// gespeichert). Hart gesperrt wird nur, was der Headhunter selbst als
// "nicht erfüllt" einschätzt. Jedes Muss-Kriterium schätzt er selbst ein.

import { formatEuro } from './candidateDossier';

export type CriterionRating = 'met' | 'partial' | 'not_met';

export const CRITERION_RATING_OPTIONS: Array<{ value: CriterionRating; label: string }> = [
  { value: 'met', label: 'erfüllt' },
  { value: 'partial', label: 'teilweise' },
  { value: 'not_met', label: 'nicht erfüllt' },
];

export interface CriterionAssessment {
  criterion: string;
  rating: CriterionRating | null;
  evidence: string;
}

export interface FitCandidate {
  expected_salary: number | null;
  salary_minimum: number | null;
  remote_preference: string | null;
  city: string | null;
  relocation_willing: boolean | null;
  languages: Array<{ language: string; proficiency?: string | null }>;
  work_permit: string | null;
}

export interface FitJob {
  salary_min?: number | null;
  salary_max?: number | null;
  remote_type?: string | null;
  onsite_days_required?: number | null;
  location?: string | null;
  required_languages?: unknown;
}

export type FitStatus = 'ok' | 'hint' | 'warn';

export interface FitItem {
  key: string;
  label: string;
  detail: string;
  status: FitStatus;
  message: string;
}

export interface FitWarning {
  /** Regel-Schlüssel, z. B. "gehalt" oder "arbeitsmodell" */
  rule: string;
  message: string;
  /** Begründung des Headhunters zum Übergehen (leer = nicht übergangen) */
  reason: string;
}

export interface FitCheckResult {
  items: FitItem[];
  /** Sperren durch die eigene Einschätzung des Headhunters (nicht übergehbar) */
  blocking: string[];
  /** Ausschlüsse aus Fakten, mit Begründung übergehbar */
  warnings: FitWarning[];
  hints: string[];
  criteriaMissing: string[];
  canSubmit: boolean;
}

/** Mindestlänge einer Begründung zum Übergehen einer Warnung. */
export const OVERRIDE_MIN_LENGTH = 10;

const WORK_LABEL: Record<string, string> = { onsite: 'vor Ort', hybrid: 'hybrid', remote: 'remote', flexible: 'flexibel' };

/** Hybrid mit 5 Präsenztagen ist faktisch vor Ort. */
export function effectiveJobModel(job: FitJob): 'onsite' | 'hybrid' | 'remote' | null {
  const t = job.remote_type;
  if (t === 'remote') return 'remote';
  if (t === 'onsite' || (job.onsite_days_required ?? 0) >= 5) return 'onsite';
  if (t === 'hybrid') return 'hybrid';
  return null;
}

function languageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v : v && typeof v === 'object' && 'language' in v ? String((v as { language: unknown }).language) : ''))
    .map((v) => v.trim())
    .filter(Boolean);
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function salaryItem(c: FitCandidate, job: FitJob): FitItem {
  const budget = job.salary_max
    ? job.salary_min ? `${Math.round(job.salary_min / 1000)}–${Math.round(job.salary_max / 1000)}k` : `bis ${Math.round(job.salary_max / 1000)}k`
    : null;
  const detail = [c.expected_salary ? `Wunsch ${formatEuro(c.expected_salary)}` : 'Wunsch offen', budget ? `Budget ${budget}` : 'kein Budget angegeben'].join(' · ');
  if (!job.salary_max) return { key: 'gehalt', label: 'Gehalt', detail, status: 'ok', message: 'kein Budget angegeben' };
  if (c.salary_minimum && c.salary_minimum > job.salary_max) {
    return { key: 'gehalt', label: 'Gehalt', detail: `Schmerzgrenze ${formatEuro(c.salary_minimum)} · Budget bis ${formatEuro(job.salary_max)}`, status: 'warn', message: `Die Schmerzgrenze (${formatEuro(c.salary_minimum)}) liegt über dem Budget (bis ${formatEuro(job.salary_max)}).` };
  }
  if (!c.expected_salary) return { key: 'gehalt', label: 'Gehalt', detail, status: 'hint', message: 'Wunschgehalt fehlt, Budget lässt sich nicht abgleichen.' };
  if (c.expected_salary > job.salary_max) {
    return { key: 'gehalt', label: 'Gehalt', detail, status: 'hint', message: `Wunschgehalt über dem Budget${c.salary_minimum ? '' : ', Schmerzgrenze unbekannt'}.` };
  }
  // Weit unter dem Budget deutet eher auf eine andere Seniorität als auf ein Schnäppchen
  if (job.salary_min && c.expected_salary < job.salary_min * 0.8) {
    return { key: 'gehalt', label: 'Gehalt', detail, status: 'hint', message: 'Wunschgehalt deutlich unter dem Budget, Seniorität prüfen.' };
  }
  return { key: 'gehalt', label: 'Gehalt', detail, status: 'ok', message: 'im Budget' };
}

function workModelItem(c: FitCandidate, job: FitJob): FitItem {
  const jobModel = effectiveJobModel(job);
  const jobText = jobModel === 'onsite' && job.onsite_days_required ? `vor Ort, ${job.onsite_days_required} Tage` : jobModel ? WORK_LABEL[jobModel] : 'offen';
  const cand = c.remote_preference;
  const detail = `Stelle ${jobText} · Kandidat ${cand ? WORK_LABEL[cand] ?? cand : 'keine Angabe'}`;
  if (!jobModel || jobModel === 'remote' || cand === 'flexible') return { key: 'arbeitsmodell', label: 'Arbeitsmodell', detail, status: 'ok', message: 'passt' };
  if (!cand) return { key: 'arbeitsmodell', label: 'Arbeitsmodell', detail, status: 'hint', message: 'Arbeitsmodell der Kandidatin oder des Kandidaten nicht eingetragen.' };
  if (jobModel === 'onsite' && cand === 'remote') return { key: 'arbeitsmodell', label: 'Arbeitsmodell', detail, status: 'warn', message: 'Die Stelle ist nur vor Ort, gewünscht ist nur Remote.' };
  if ((jobModel === 'onsite' && cand === 'hybrid') || (jobModel === 'hybrid' && cand === 'remote')) {
    return { key: 'arbeitsmodell', label: 'Arbeitsmodell', detail, status: 'hint', message: 'Das gewünschte Arbeitsmodell weicht von der Stelle ab.' };
  }
  return { key: 'arbeitsmodell', label: 'Arbeitsmodell', detail, status: 'ok', message: 'passt' };
}

function locationItem(c: FitCandidate, job: FitJob): FitItem {
  const detail = `Stelle ${job.location || 'offen'} · Kandidat ${c.city || 'offen'}`;
  if (effectiveJobModel(job) === 'remote' || !job.location) return { key: 'ort', label: 'Ort', detail, status: 'ok', message: 'passt' };
  if (!c.city) return { key: 'ort', label: 'Ort', detail, status: 'hint', message: 'Wohnort nicht eingetragen.' };
  const a = norm(job.location);
  const b = norm(c.city);
  if (a.includes(b) || b.includes(a)) return { key: 'ort', label: 'Ort', detail, status: 'ok', message: 'passt' };
  if (c.relocation_willing) return { key: 'ort', label: 'Ort', detail, status: 'ok', message: 'umzugsbereit' };
  return { key: 'ort', label: 'Ort', detail, status: 'hint', message: `Anderer Wohnort (${c.city}), Umzug nicht bestätigt.` };
}

function languageItem(c: FitCandidate, job: FitJob): FitItem | null {
  const required = languageList(job.required_languages);
  if (!required.length) return null;
  const has = c.languages.map((l) => norm(l.language));
  const missing = required.filter((r) => !has.some((h) => h.startsWith(norm(r)) || norm(r).startsWith(h)));
  const detail = `Stelle: ${required.join(', ')} · Kandidat: ${c.languages.map((l) => l.language).join(', ') || 'keine eingetragen'}`;
  if (missing.length) return { key: 'sprachen', label: 'Sprachen', detail, status: 'hint', message: `Pflichtsprache nicht eingetragen: ${missing.join(', ')}.` };
  return { key: 'sprachen', label: 'Sprachen', detail, status: 'ok', message: 'passt' };
}

function permitItem(c: FitCandidate): FitItem {
  const labels: Record<string, string> = { citizen: 'EU-Bürger:in', permit: 'Erlaubnis vorhanden', needs_visa: 'braucht Visum', pending: 'in Klärung' };
  const detail = c.work_permit ? labels[c.work_permit] ?? c.work_permit : 'keine Angabe';
  if (c.work_permit === 'citizen' || c.work_permit === 'permit') return { key: 'arbeitserlaubnis', label: 'Arbeitserlaubnis', detail, status: 'ok', message: 'passt' };
  if (c.work_permit === 'needs_visa') return { key: 'arbeitserlaubnis', label: 'Arbeitserlaubnis', detail, status: 'hint', message: 'Für die Stelle wird ein Visum nötig.' };
  if (c.work_permit === 'pending') return { key: 'arbeitserlaubnis', label: 'Arbeitserlaubnis', detail, status: 'hint', message: 'Arbeitserlaubnis noch in Klärung.' };
  return { key: 'arbeitserlaubnis', label: 'Arbeitserlaubnis', detail, status: 'hint', message: 'Arbeitserlaubnis nicht eingetragen.' };
}

export function computeFitCheck(
  c: FitCandidate,
  job: FitJob,
  criteria: CriterionAssessment[],
  overrides: Record<string, string> = {},
): FitCheckResult {
  const items = [salaryItem(c, job), workModelItem(c, job), locationItem(c, job), languageItem(c, job), permitItem(c)].filter((i): i is FitItem => !!i);
  const warnings: FitWarning[] = items
    .filter((i) => i.status === 'warn')
    .map((i) => ({ rule: i.key, message: i.message, reason: (overrides[i.key] ?? '').trim() }));
  const hints = items.filter((i) => i.status === 'hint').map((i) => i.message);
  const blocking = criteria
    .filter((cr) => cr.rating === 'not_met')
    .map((cr) => `Du hast das Muss-Kriterium „${cr.criterion}“ als nicht erfüllt eingeschätzt.`);
  const criteriaMissing = criteria.filter((cr) => !cr.rating).map((cr) => cr.criterion);
  const warningsResolved = warnings.every((w) => w.reason.length >= OVERRIDE_MIN_LENGTH);
  return { items, blocking, warnings, hints, criteriaMissing, canSubmit: blocking.length === 0 && criteriaMissing.length === 0 && warningsResolved };
}

/** Für die Einreichung: übergangene Warnungen mit Begründung (Protokoll). */
export function toOverridesPayload(result: FitCheckResult): Array<{ rule: string; message: string; reason: string }> {
  return result.warnings.filter((w) => w.reason.length >= OVERRIDE_MIN_LENGTH).map((w) => ({ rule: w.rule, message: w.message, reason: w.reason }));
}

/** Für die Einreichung: nur eingeschätzte Kriterien, Beleg ohne Name und Arbeitgeber. */
export function toCriteriaPayload(criteria: CriterionAssessment[], redact: (text: string) => string): Array<{ criterion: string; rating: CriterionRating; evidence: string | null }> {
  return criteria
    .filter((c): c is CriterionAssessment & { rating: CriterionRating } => !!c.rating)
    .map((c) => ({ criterion: c.criterion, rating: c.rating, evidence: c.evidence.trim() ? redact(c.evidence) : null }));
}
