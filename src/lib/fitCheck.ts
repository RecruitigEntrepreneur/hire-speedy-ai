// Passungs-Check vor dem Einreichen: harte Fakten aus Kandidatenakte und
// Stelle, kein KI-Score. Rechtliche Leitplanke (DSGVO Art. 22): Eine Regel
// sperrt nie allein. Klare Ausschlüsse aus Fakten sind Warnungen, die der
// Headhunter mit Begründung übergehen kann (wird mit der Einreichung
// gespeichert). Hart gesperrt wird nur, was der Headhunter selbst als
// "nicht erfüllt" einschätzt. Jedes Muss-Kriterium schätzt er selbst ein.

import { formatEuro } from './candidateDossier';
import i18n from '@/i18n';

// Texte werden beim Aufruf gelesen (Namespace recruiterJobs, fitCheck.*), nie beim Laden des Moduls.
// Sicherheitsnetz: den Namespace schon beim Import anfordern, falls eine Seite ihn nicht selbst lädt.
void i18n.loadNamespaces('recruiterJobs');
const tr = (key: string, options?: Record<string, unknown>) => i18n.t(`recruiterJobs:fitCheck.${key}`, options) as string;

export type CriterionRating = 'met' | 'partial' | 'not_met';

export const CRITERION_RATING_OPTIONS: Array<{ value: CriterionRating; readonly label: string }> = (['met', 'partial', 'not_met'] as CriterionRating[]).map((value) => ({
  value,
  get label() { return tr(`rating.${value}`); },
}));

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
  /** Nur bei Warnungen: der deutsche Wortlaut fürs Protokoll der Einreichung (wird gespeichert). */
  stored?: string;
}

export interface FitWarning {
  /** Regel-Schlüssel, z. B. "gehalt" oder "arbeitsmodell" */
  rule: string;
  /** In der Sprache der Oberfläche */
  message: string;
  /** Deutscher Wortlaut, der mit der Einreichung gespeichert wird (unabhängig von der Sprache der Oberfläche) */
  stored?: string;
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

const WORK_KEYS = ['onsite', 'hybrid', 'remote', 'flexible'];
const workLabel = (value: string) => (WORK_KEYS.includes(value) ? tr(`work.${value}`) : value);

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
    ? job.salary_min ? `${Math.round(job.salary_min / 1000)}–${Math.round(job.salary_max / 1000)}k` : tr('salary.upToK', { k: Math.round(job.salary_max / 1000) })
    : null;
  const label = tr('salary.label');
  const detail = [c.expected_salary ? tr('salary.wish', { amount: formatEuro(c.expected_salary) }) : tr('salary.wishOpen'), budget ? tr('salary.budget', { budget }) : tr('salary.noBudget')].join(' · ');
  if (!job.salary_max) return { key: 'gehalt', label, detail, status: 'ok', message: tr('salary.noBudget') };
  if (c.salary_minimum && c.salary_minimum > job.salary_max) {
    const minimum = formatEuro(c.salary_minimum);
    const max = formatEuro(job.salary_max);
    return {
      key: 'gehalt', label, detail: tr('salary.painDetail', { minimum, max }), status: 'warn',
      message: tr('salary.painOverBudget', { minimum, max }),
      stored: `Die Schmerzgrenze (${minimum}) liegt über dem Budget (bis ${max}).`,
    };
  }
  if (!c.expected_salary) return { key: 'gehalt', label, detail, status: 'hint', message: tr('salary.wishMissing') };
  if (c.expected_salary > job.salary_max) {
    return { key: 'gehalt', label, detail, status: 'hint', message: c.salary_minimum ? tr('salary.wishOverBudget') : tr('salary.wishOverBudgetUnknown') };
  }
  // Weit unter dem Budget deutet eher auf eine andere Seniorität als auf ein Schnäppchen
  if (job.salary_min && c.expected_salary < job.salary_min * 0.8) {
    return { key: 'gehalt', label, detail, status: 'hint', message: tr('salary.wishFarBelow') };
  }
  return { key: 'gehalt', label, detail, status: 'ok', message: tr('salary.inBudget') };
}

function workModelItem(c: FitCandidate, job: FitJob): FitItem {
  const jobModel = effectiveJobModel(job);
  const jobText = jobModel === 'onsite' && job.onsite_days_required ? tr('work.onsiteDays', { days: job.onsite_days_required }) : jobModel ? workLabel(jobModel) : tr('open');
  const cand = c.remote_preference;
  const label = tr('work.label');
  const detail = tr('jobVsCandidate', { job: jobText, candidate: cand ? workLabel(cand) : tr('notSpecified') });
  if (!jobModel || jobModel === 'remote' || cand === 'flexible') return { key: 'arbeitsmodell', label, detail, status: 'ok', message: tr('fits') };
  if (!cand) return { key: 'arbeitsmodell', label, detail, status: 'hint', message: tr('work.missing') };
  if (jobModel === 'onsite' && cand === 'remote') return { key: 'arbeitsmodell', label, detail, status: 'warn', message: tr('work.onsiteVsRemote'), stored: 'Die Stelle ist nur vor Ort, gewünscht ist nur Remote.' };
  if ((jobModel === 'onsite' && cand === 'hybrid') || (jobModel === 'hybrid' && cand === 'remote')) {
    return { key: 'arbeitsmodell', label, detail, status: 'hint', message: tr('work.differs') };
  }
  return { key: 'arbeitsmodell', label, detail, status: 'ok', message: tr('fits') };
}

function locationItem(c: FitCandidate, job: FitJob): FitItem {
  const label = tr('location.label');
  const detail = tr('jobVsCandidate', { job: job.location || tr('open'), candidate: c.city || tr('open') });
  if (effectiveJobModel(job) === 'remote' || !job.location) return { key: 'ort', label, detail, status: 'ok', message: tr('fits') };
  if (!c.city) return { key: 'ort', label, detail, status: 'hint', message: tr('location.missing') };
  const a = norm(job.location);
  const b = norm(c.city);
  if (a.includes(b) || b.includes(a)) return { key: 'ort', label, detail, status: 'ok', message: tr('fits') };
  if (c.relocation_willing) return { key: 'ort', label, detail, status: 'ok', message: tr('location.relocation') };
  return { key: 'ort', label, detail, status: 'hint', message: tr('location.other', { city: c.city }) };
}

function languageItem(c: FitCandidate, job: FitJob): FitItem | null {
  const required = languageList(job.required_languages);
  if (!required.length) return null;
  const has = c.languages.map((l) => norm(l.language));
  const missing = required.filter((r) => !has.some((h) => h.startsWith(norm(r)) || norm(r).startsWith(h)));
  const label = tr('languages.label');
  const detail = tr('languages.detail', { job: required.join(', '), candidate: c.languages.map((l) => l.language).join(', ') || tr('languages.none') });
  if (missing.length) return { key: 'sprachen', label, detail, status: 'hint', message: tr('languages.missing', { list: missing.join(', ') }) };
  return { key: 'sprachen', label, detail, status: 'ok', message: tr('fits') };
}

function permitItem(c: FitCandidate): FitItem {
  const known = ['citizen', 'permit', 'needs_visa', 'pending'];
  const label = tr('permit.label');
  const detail = c.work_permit ? (known.includes(c.work_permit) ? tr(`permit.status.${c.work_permit}`) : c.work_permit) : tr('notSpecified');
  if (c.work_permit === 'citizen' || c.work_permit === 'permit') return { key: 'arbeitserlaubnis', label, detail, status: 'ok', message: tr('fits') };
  if (c.work_permit === 'needs_visa') return { key: 'arbeitserlaubnis', label, detail, status: 'hint', message: tr('permit.visaNeeded') };
  if (c.work_permit === 'pending') return { key: 'arbeitserlaubnis', label, detail, status: 'hint', message: tr('permit.pending') };
  return { key: 'arbeitserlaubnis', label, detail, status: 'hint', message: tr('permit.missing') };
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
    .map((i) => ({ rule: i.key, message: i.message, stored: i.stored, reason: (overrides[i.key] ?? '').trim() }));
  const hints = items.filter((i) => i.status === 'hint').map((i) => i.message);
  const blocking = criteria
    .filter((cr) => cr.rating === 'not_met')
    .map((cr) => tr('blocking', { criterion: cr.criterion }));
  const criteriaMissing = criteria.filter((cr) => !cr.rating).map((cr) => cr.criterion);
  const warningsResolved = warnings.every((w) => w.reason.length >= OVERRIDE_MIN_LENGTH);
  return { items, blocking, warnings, hints, criteriaMissing, canSubmit: blocking.length === 0 && criteriaMissing.length === 0 && warningsResolved };
}

/** Für die Einreichung: übergangene Warnungen mit Begründung (Protokoll). Gespeichert wird der deutsche Wortlaut. */
export function toOverridesPayload(result: FitCheckResult): Array<{ rule: string; message: string; reason: string }> {
  return result.warnings.filter((w) => w.reason.length >= OVERRIDE_MIN_LENGTH).map((w) => ({ rule: w.rule, message: w.stored ?? w.message, reason: w.reason }));
}

/** Für die Einreichung: nur eingeschätzte Kriterien, Beleg ohne Name und Arbeitgeber. */
export function toCriteriaPayload(criteria: CriterionAssessment[], redact: (text: string) => string): Array<{ criterion: string; rating: CriterionRating; evidence: string | null }> {
  return criteria
    .filter((c): c is CriterionAssessment & { rating: CriterionRating } => !!c.rating)
    .map((c) => ({ criterion: c.criterion, rating: c.rating, evidence: c.evidence.trim() ? redact(c.evidence) : null }));
}
