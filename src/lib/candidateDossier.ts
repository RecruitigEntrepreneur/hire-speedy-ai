// Kandidatenakte: eine Wahrheit für Bearbeiten-Panel, Interview, Profil und
// "Bereit zum Einreichen". Jede Angabe gibt es genau einmal; alte Felder
// (salary_fix, Interview-Freitexte zu Gehalt/Kündigung, Spezialisierungen,
// Soft Skills) werden beim Laden übernommen und beim Speichern gespiegelt,
// damit bestehende Leser (Exposé-PDF, Kundenansicht, Matching) weiter
// dieselben Werte sehen.

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Kündigungsfrist = Dauer + Stichtag. Gespeichert als ein Wert, z. B. "3_months_eoq"
 * (3 Monate zum Quartalsende) oder "1_month_eom" (1 Monat zum Monatsende). Alte
 * Werte ("3_months", "6_weeks", "3_months_eoq") bleiben gültig.
 */
export const NOTICE_DURATIONS: Option[] = [
  { value: 'immediate', label: 'Sofort' },
  { value: '2_weeks', label: '2 Wochen' },
  { value: '4_weeks', label: '4 Wochen' },
  { value: '1_month', label: '1 Monat' },
  { value: '6_weeks', label: '6 Wochen' },
  { value: '2_months', label: '2 Monate' },
  { value: '3_months', label: '3 Monate' },
  { value: '6_months', label: '6 Monate' },
  { value: '12_months', label: '12 Monate' },
];
export const NOTICE_ANCHORS: Option[] = [
  { value: '15_eom', label: 'zum 15. oder Monatsende' },
  { value: 'eom', label: 'zum Monatsende' },
  { value: 'eoq', label: 'zum Quartalsende' },
  { value: 'eoy', label: 'zum Jahresende' },
];
export const NOTICE_OPTIONS: Option[] = [
  { value: 'immediate', label: 'Sofort verfügbar' },
  ...NOTICE_DURATIONS.filter((d) => d.value !== 'immediate').flatMap((d) => [
    { value: d.value, label: d.label },
    ...NOTICE_ANCHORS.map((a) => ({ value: `${d.value}_${a.value}`, label: `${d.label} ${a.label}` })),
  ]),
];

/** "3_months_eoq" → { duration: "3_months", anchor: "eoq" } */
export function noticeParts(value: string | null | undefined): { duration: string | null; anchor: string | null } {
  if (!value) return { duration: null, anchor: null };
  if (value === 'immediate') return { duration: 'immediate', anchor: null };
  const anchor = NOTICE_ANCHORS.map((a) => a.value).find((a) => value.endsWith(`_${a}`)) ?? null;
  const duration = anchor ? value.slice(0, -(anchor.length + 1)) : value;
  return { duration: NOTICE_DURATIONS.some((d) => d.value === duration) ? duration : null, anchor };
}

export function composeNotice(duration: string | null, anchor: string | null): string | null {
  if (!duration) return null;
  if (duration === 'immediate' || !anchor) return duration;
  return `${duration}_${anchor}`;
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Frühester Start bei Kündigung am Stichtag `from`: Frist ablaufen lassen, dann bis zum
 * Stichtag (15./Monatsende, Monats-, Quartals-, Jahresende) und einen Tag weiter.
 */
export function earliestStart(value: string | null | undefined, from: Date): string | null {
  const { duration, anchor } = noticeParts(value);
  if (!duration) return null;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (duration === 'immediate') return isoDate(d);
  const weeks = duration.match(/^(\d+)_weeks$/);
  const months = duration.match(/^(\d+)_months?$/);
  if (weeks) d.setDate(d.getDate() + Number(weeks[1]) * 7);
  else if (months) d.setMonth(d.getMonth() + Number(months[1]));
  let end: Date;
  if (anchor === '15_eom') {
    end = d.getDate() <= 15 ? new Date(d.getFullYear(), d.getMonth(), 15) : new Date(d.getFullYear(), d.getMonth() + 1, 0);
  } else if (anchor === 'eom') end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  else if (anchor === 'eoq') end = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0);
  else if (anchor === 'eoy') end = new Date(d.getFullYear(), 11, 31);
  else return isoDate(d);
  end.setDate(end.getDate() + 1);
  return isoDate(end);
}

export const WORK_MODEL_OPTIONS: Option[] = [
  { value: 'onsite', label: 'Vor Ort' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
  { value: 'flexible', label: 'Flexibel' },
];

export const COMMUTE_OPTIONS: Option[] = [15, 30, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} Min.` }));

export const EMPLOYMENT_OPTIONS: Option[] = [
  { value: 'fulltime', label: 'Vollzeit' },
  { value: 'parttime', label: 'Teilzeit' },
  { value: 'freelance', label: 'Freiberuflich' },
  { value: 'contract', label: 'Befristet' },
];

export const RELOCATION_OPTIONS: Option[] = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nein' },
];

export const PERMIT_OPTIONS: Option[] = [
  { value: 'citizen', label: 'EU-Bürger:in' },
  { value: 'permit', label: 'Erlaubnis vorhanden' },
  { value: 'needs_visa', label: 'Braucht Visum' },
  { value: 'pending', label: 'In Klärung' },
];

export const SENIORITY_OPTIONS: Option[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'director', label: 'Leitung' },
];

export const LANGUAGE_LEVELS = ['Muttersprache', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];

export const MOTIVATION_TAGS = [
  'Gehalt', 'Arbeitszeiten', 'Work-Life-Balance', 'Karriere', 'Verantwortung', 'Führung',
  'Team', 'Unternehmenskultur', 'Standort', 'Remote', 'Projekte', 'Technologie', 'Sicherheit',
];

/**
 * Was das nächste Angebot haben muss (Top 3). „Mindestgehalt" entfällt bewusst: das will
 * jeder, und die Untergrenze steht schon als Schmerzgrenze in der Akte. Eigene Einträge
 * sind erlaubt; alte Werte bleiben lesbar.
 */
export const OFFER_GROUPS: { label: string; options: string[] }[] = [
  { label: 'Rolle', options: ['Führungsverantwortung', 'Gestaltungsspielraum', 'Entwicklungsperspektive', 'Fachliche Herausforderung', 'Weiterbildung'] },
  { label: 'Arbeitsweise', options: ['Remote oder hybrid', 'Flexible Zeiten', '4-Tage-Woche', 'Teilzeit möglich', 'Wenig Reisen'] },
  { label: 'Umfeld', options: ['Gutes Team', 'Unternehmenskultur', 'Flache Hierarchien', 'Stabiles Unternehmen', 'Moderne Arbeitsmittel'] },
  { label: 'Konditionen', options: ['Gehaltssprung', 'Bonus', 'Firmenwagen', 'Altersvorsorge', 'Mehr Urlaub'] },
  { label: 'Ort', options: ['Kurzer Arbeitsweg'] },
];
export const OFFER_OPTIONS = OFFER_GROUPS.flatMap((g) => g.options);

export const FREQUENCY_OPTIONS: Option[] = ['Einmalig', 'Gelegentlich', 'Regelmäßig', 'Dauerhaft'].map((v) => ({ value: v, label: v }));

export const DISCUSSED_OPTIONS: Option[] = ['Nein', 'Ja, ohne Ergebnis', 'Ja, Lösung in Aussicht'].map((v) => ({ value: v, label: v }));

export const WOULD_STAY_OPTIONS: Option[] = [
  { value: 'yes', label: 'Ja' },
  { value: 'maybe', label: 'Vielleicht' },
  { value: 'no', label: 'Nein' },
];

export const RECOMMENDATION_OPTIONS: Option[] = [
  { value: 'yes', label: 'Ja' },
  { value: 'rather_yes', label: 'Eher ja' },
  { value: 'rather_no', label: 'Eher nein' },
  { value: 'no', label: 'Nein' },
];

export const OTHER_APPLICATIONS_OPTIONS: Option[] = [
  { value: 'none', label: 'Nein' },
  { value: 'early', label: 'Ja, am Anfang' },
  { value: 'advanced', label: 'Ja, fortgeschritten' },
  { value: 'offer', label: 'Angebot liegt vor' },
];

export const LEADERSHIP_OPTIONS: Option[] = [
  { value: 'none', label: 'Keine' },
  { value: 'functional', label: 'Fachlich' },
  { value: 'disciplinary', label: 'Disziplinarisch' },
];

/** Setzt der Headhunter selbst; das Tool zeigt nur Belege (kein berechneter Wert über Personen). */
export const CHANGE_READINESS_OPTIONS: Option[] = [
  { value: 'active', label: 'Aktiv' },
  { value: 'open', label: 'Offen' },
  { value: 'passive', label: 'Passiv' },
];

export const INTERVIEW_TYPE_OPTIONS: Option[] = [
  { value: 'phone', label: 'Telefon' },
  { value: 'video', label: 'Video' },
  { value: 'onsite', label: 'Vor Ort' },
];

export function optionLabel(options: Option[], value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

export interface DossierLanguage {
  language: string;
  proficiency: string;
}

export interface DossierForm {
  // Stammdaten (candidates)
  full_name: string;
  email: string;
  phone: string;
  city: string;
  job_title: string;
  company: string;
  experience_years: number | null;
  seniority: string | null;
  skills: string[];
  industries: string[];
  certificates: string[];
  // Wechsel (candidates)
  current_salary: number | null;
  expected_salary: number | null;
  salary_minimum: number | null;
  notice_period: string | null;
  availability_date: string | null;
  // Arbeitsort und Präferenzen (candidates)
  remote_preference: string | null;
  max_commute_minutes: number | null;
  employment_type: string | null;
  relocation_willing: boolean | null;
  target_roles: string[];
  target_industries: string[];
  target_locations: string[];
  work_permit: string | null;
  work_permit_notes: string;
  linkedin_url: string;
  portfolio_url: string;
  github_url: string;
  website_url: string;
  expose_summary: string;
  expose_highlights: string[];
  internal_note: string;
  languages: DossierLanguage[];
  // Gemeinsam mit dem Interview (candidate_interview_notes)
  change_motivation: string;
  change_motivation_tags: string[];
  /** active | open | passive, vom Headhunter gesetzt */
  change_readiness: string | null;
  recommendation: string | null;
  recommendation_notes: string;
  // Nur im Interview
  interview_date: string | null;
  current_positive: string;
  current_negative: string;
  specific_incident: string;
  frequency_of_issues: string | null;
  why_now: string;
  discussed_internally: string | null;
  would_stay: string | null;
  career_ultimate_goal: string;
  career_3_5_year_plan: string;
  career_actions_taken: string;
  career_what_worked: string;
  career_what_didnt_work: string;
  offer_requirements: string[];
  previous_process_issues: string;
  additional_notes: string;
  summary_motivation: string;
  summary_salary: string;
  summary_notice: string;
  summary_key_requirements: string;
  summary_cultural_fit: string;
  // Neue Spalten (Migration 20260928120000)
  interview_type: string | null;
  leadership_scope: string | null;
  leadership_team_size: number | null;
  other_applications: string | null;
  other_applications_notes: string;
  blocked_companies: string[];
  presentation_consent: boolean | null;
  presentation_consent_at: string | null;
}

/** Spalten, die erst nach der Migration existieren. */
export const NEW_NOTE_COLUMNS = [
  'interview_type', 'leadership_scope', 'leadership_team_size', 'other_applications',
  'other_applications_notes', 'blocked_companies', 'presentation_consent', 'presentation_consent_at',
  'recommendation_level', 'would_stay_answer', 'change_readiness',
] as const;

type Row = Record<string, unknown> | null | undefined;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => (typeof item === 'string' ? item : item && typeof item === 'object' && 'name' in item ? String((item as { name: unknown }).name) : ''))
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

const NUM = String.raw`(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)`;

function toNumber(raw: string, suffix: string | undefined): number {
  const cleaned = /^\d{1,3}(?:[.\s]\d{3})+$/.test(raw) ? raw.replace(/[.\s]/g, '') : raw.replace(',', '.');
  const n = parseFloat(cleaned);
  return suffix ? n * 1000 : n;
}

export interface SalaryParse {
  low: number;
  high: number;
  /** Aus einer Monatsangabe hochgerechnet (x12). */
  monthly: boolean;
}

/**
 * Liest Beträge aus Freitext: "42k", "42.000 €", "40-45k", "42.000–45.000 €",
 * "3.500 monatlich" (x12), "52 T€". Spannen liefern low/high.
 */
export function parseSalary(value: unknown): SalaryParse | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? { low: Math.round(value), high: Math.round(value), monthly: false } : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const s = value.toLowerCase().replace(/€|eur(o)?/g, ' ');
  // Monatsangabe nur direkt am Betrag ("3.500 € monatlich"), nicht "Kündigung 1 Monat"
  const monthly = /\d[\d.,\s]*(k|euro)?\s*(\/\s?m(onat)?\b|mtl\.?|monatlich|pro monat|im monat|p\.\s?m\.)/.test(s);
  const range = s.match(new RegExp(`${NUM}\\s*(k|t€?|tsd\\.?)?\\s*(?:-|–|bis)\\s*${NUM}\\s*(k|t€?|tsd\\.?)?`));
  let low: number;
  let high: number;
  if (range) {
    const suffix = range[4] || range[2];
    low = toNumber(range[1], range[2] || suffix);
    high = toNumber(range[3], suffix);
  } else {
    const single = s.match(new RegExp(`${NUM}\\s*(k|t€?|tsd\\.?)?`));
    if (!single) return null;
    low = high = toNumber(single[1], single[2]);
  }
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= 0) return null;
  const factor = monthly ? 12 : 1;
  return { low: Math.round(Math.min(low, high) * factor), high: Math.round(Math.max(low, high) * factor), monthly };
}

/** Ein Betrag aus Freitext; bei Spannen der obere Wert. */
export function parseMoney(value: unknown): number | null {
  const r = parseSalary(value);
  return r ? r.high : null;
}

/** Nur Ziffern, für Eingabefelder (kein "k", keine Spannen). */
export function parseDigits(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return n > 0 ? n : null;
}

/** Freitext wie "3 Monate", "KüF 3M z. QE" oder "6 Wochen" → Auswahlwert */
export function mapNoticeText(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (NOTICE_OPTIONS.some((o) => o.value === value)) return value;
  const s = value.toLowerCase();
  if (/sofort|keine\s*(kündigung|frist)|ab sofort/.test(s)) return 'immediate';
  if (/gesetzlich/.test(s)) return '4_weeks_15_eom';
  const anchor = /15\.?\s*(oder|o\.)\s*(zum\s*)?monatsende|zum 15\./.test(s) ? '15_eom'
    : /monatsende|zum monat|z\.\s?me\b/.test(s) ? 'eom'
    : /jahresende|zum jahr/.test(s) ? 'eoy'
    : /quartalsende|zum quartal|qe\b/.test(s) ? 'eoq' : null;
  const dur = /(12|zwölf)\s*monat/.test(s) ? '12_months'
    : /(6|sechs)\s*woche/.test(s) ? '6_weeks'
    : /(4|vier)\s*woche/.test(s) ? '4_weeks'
    : /(2|zwei)\s*woche/.test(s) ? '2_weeks'
    : /(6|sechs)\s*(m\b|monat)/.test(s) ? '6_months'
    : /(3|drei)\s*(m\b|mon)/.test(s) ? '3_months'
    : /(2|zwei)\s*(m\b|monat)/.test(s) ? '2_months'
    : /(1|ein|einen|einem)\s*(m\b|monat)/.test(s) ? '1_month' : null;
  if (dur && anchor) return `${dur}_${anchor}`;
  if (/(3|drei)\s*(m\b|mon(ate?)?\.?)\s*(z(um|\.)?\s*)?(q(uartal)?(s?ende)?\b|qe\b)/.test(s) || /quartalsende|zum quartal/.test(s)) return '3_months_eoq';
  if (/(6|sechs)\s*woche/.test(s)) return '6_weeks';
  if (/(4|vier)\s*woche/.test(s)) return '4_weeks';
  if (/(2|zwei)\s*woche/.test(s)) return '2_weeks';
  if (/(12|zwölf)\s*monat/.test(s)) return '12_months';
  if (/(6|sechs)\s*(m\b|monat)/.test(s)) return '6_months';
  if (/(3|drei)\s*(m\b|monat)|quartal/.test(s)) return '3_months';
  if (/(2|zwei)\s*(m\b|monat)/.test(s)) return '2_months';
  if (/(1|ein|einen|einem)\s*(m\b|monat)/.test(s)) return '1_month';
  return null;
}

export function mapPermit(status: unknown, visaRequired: unknown): string | null {
  const s = typeof status === 'string' ? status : '';
  if (s === 'citizen') return 'citizen';
  if (s === 'needs_visa') return 'needs_visa';
  if (s === 'pending') return 'pending';
  if (s === 'permit' || s === 'permanent' || s === 'work_visa' || s === 'student_visa') return 'permit';
  if (visaRequired === true) return 'needs_visa';
  return null;
}

function recommendationFrom(notes: Row): string | null {
  const level = notes?.recommendation_level;
  if (typeof level === 'string' && RECOMMENDATION_OPTIONS.some((o) => o.value === level)) return level;
  if (notes?.would_recommend === true) return 'yes';
  if (notes?.would_recommend === false) return 'no';
  return null;
}

function wouldStayFrom(notes: Row): string | null {
  const answer = notes?.would_stay_answer;
  if (typeof answer === 'string' && WOULD_STAY_OPTIONS.some((o) => o.value === answer)) return answer;
  if (notes?.would_stay_if_matched === true) return 'yes';
  if (notes?.would_stay_if_matched === false) return 'no';
  return null;
}

export function fromRecords(candidate: Row, notes: Row, languages: Array<{ language?: string | null; proficiency?: string | null }> = []): DossierForm {
  const c = candidate ?? {};
  const n = notes ?? {};
  const relocation = c.relocation_willing;
  return {
    full_name: str(c.full_name),
    email: str(c.email),
    phone: str(c.phone),
    city: str(c.city),
    job_title: str(c.job_title),
    company: str(c.company),
    experience_years: numOrNull(c.experience_years),
    seniority: typeof c.seniority === 'string' ? c.seniority : null,
    skills: dedupe([...strArray(c.skills), ...strArray(c.specializations), ...strArray(c.soft_skills)]),
    industries: strArray(c.industry_experience),
    certificates: dedupe([...strArray(c.certificates), ...strArray(c.certifications)]),
    current_salary: numOrNull(c.current_salary) ?? parseMoney(n.salary_current),
    expected_salary: numOrNull(c.expected_salary) ?? numOrNull(c.salary_fix) ?? parseMoney(n.salary_desired),
    salary_minimum: numOrNull(c.salary_expectation_min) ?? parseMoney(n.salary_minimum),
    notice_period: mapNoticeText(c.notice_period) ?? mapNoticeText(n.notice_period),
    availability_date: str(c.availability_date) || str(n.earliest_start_date) || null,
    remote_preference: typeof c.remote_preference === 'string' && c.remote_preference ? c.remote_preference : null,
    max_commute_minutes: numOrNull(c.max_commute_minutes),
    employment_type: (typeof c.target_employment_type === 'string' && c.target_employment_type) || (typeof c.work_model === 'string' && c.work_model) || null,
    relocation_willing: relocation === true ? true : relocation === false ? false : null,
    target_roles: strArray(c.target_roles),
    target_industries: strArray(c.target_industries),
    target_locations: strArray(c.target_locations),
    work_permit: mapPermit(c.residence_status, c.visa_required),
    work_permit_notes: str(c.work_permit_notes),
    linkedin_url: str(c.linkedin_url),
    portfolio_url: str(c.portfolio_url),
    github_url: str(c.github_url),
    website_url: str(c.website_url),
    expose_summary: str(c.expose_summary),
    expose_highlights: strArray(c.expose_highlights),
    internal_note: str(c.summary),
    languages: languages
      .map((l) => ({ language: (l.language ?? '').trim(), proficiency: (l.proficiency ?? '').trim() }))
      .filter((l) => l.language),
    change_motivation: str(n.change_motivation),
    change_motivation_tags: strArray(n.change_motivation_tags),
    change_readiness: CHANGE_READINESS_OPTIONS.some((o) => o.value === n.change_readiness) ? (n.change_readiness as string) : null,
    recommendation: recommendationFrom(n),
    recommendation_notes: str(n.recommendation_notes),
    interview_date: str(n.interview_date).slice(0, 10) || null,
    current_positive: str(n.current_positive),
    current_negative: str(n.current_negative),
    specific_incident: str(n.specific_incident),
    frequency_of_issues: str(n.frequency_of_issues) || null,
    why_now: str(n.why_now),
    discussed_internally: str(n.discussed_internally) || null,
    would_stay: wouldStayFrom(n),
    career_ultimate_goal: str(n.career_ultimate_goal),
    career_3_5_year_plan: str(n.career_3_5_year_plan),
    career_actions_taken: str(n.career_actions_taken),
    career_what_worked: str(n.career_what_worked),
    career_what_didnt_work: str(n.career_what_didnt_work),
    offer_requirements: strArray(n.offer_requirements),
    previous_process_issues: str(n.previous_process_issues),
    additional_notes: str(n.additional_notes),
    summary_motivation: str(n.summary_motivation),
    summary_salary: str(n.summary_salary),
    summary_notice: str(n.summary_notice),
    summary_key_requirements: str(n.summary_key_requirements),
    summary_cultural_fit: str(n.summary_cultural_fit),
    interview_type: str(n.interview_type) || null,
    leadership_scope: str(n.leadership_scope) || null,
    leadership_team_size: numOrNull(n.leadership_team_size),
    other_applications: str(n.other_applications) || null,
    other_applications_notes: str(n.other_applications_notes),
    blocked_companies: strArray(n.blocked_companies),
    presentation_consent: n.presentation_consent === true ? true : n.presentation_consent === false ? false : null,
    presentation_consent_at: str(n.presentation_consent_at) || null,
  };
}

const isEmptyValue = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Ältere Abläufe haben je Kandidat mehrere Interview-Datensätze angelegt.
 * Zusammengeführt gewinnt je Feld der neueste gefüllte Wert (rows neueste
 * zuerst); als ersetzt markierte Datensätze zählen nicht mehr.
 */
export function mergeNoteRows(rows: Array<Record<string, unknown>>): Record<string, unknown> | null {
  const live = rows.filter((r) => r.status !== 'superseded');
  if (!live.length) return null;
  const merged: Record<string, unknown> = { ...live[0] };
  for (const row of live.slice(1)) {
    for (const [key, value] of Object.entries(row)) {
      if (isEmptyValue(merged[key]) && !isEmptyValue(value)) merged[key] = value;
    }
  }
  return merged;
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);
const arrOrNull = (a: string[]) => (a.length ? a : null);

/** Update für die Tabelle candidates. Alte Spiegelfelder bleiben synchron. */
export function toCandidatePayload(f: DossierForm): Record<string, unknown> {
  return {
    full_name: f.full_name.trim(),
    email: f.email.trim(),
    phone: orNull(f.phone),
    city: orNull(f.city),
    job_title: orNull(f.job_title),
    company: orNull(f.company),
    experience_years: f.experience_years,
    seniority: f.seniority,
    skills: arrOrNull(f.skills),
    specializations: null,
    soft_skills: null,
    industry_experience: arrOrNull(f.industries),
    certificates: arrOrNull(f.certificates),
    current_salary: f.current_salary,
    expected_salary: f.expected_salary,
    salary_fix: f.expected_salary,
    salary_expectation_min: f.salary_minimum,
    notice_period: f.notice_period,
    availability_date: f.availability_date,
    remote_preference: f.remote_preference,
    max_commute_minutes: f.max_commute_minutes,
    target_employment_type: f.employment_type,
    work_model: f.employment_type,
    relocation_willing: f.relocation_willing,
    target_roles: arrOrNull(f.target_roles),
    target_industries: arrOrNull(f.target_industries),
    target_locations: arrOrNull(f.target_locations),
    residence_status: f.work_permit,
    visa_required: f.work_permit === 'needs_visa',
    work_permit_notes: orNull(f.work_permit_notes),
    linkedin_url: orNull(f.linkedin_url),
    portfolio_url: orNull(f.portfolio_url),
    github_url: orNull(f.github_url),
    website_url: orNull(f.website_url),
    expose_summary: orNull(f.expose_summary),
    expose_highlights: arrOrNull(f.expose_highlights),
    summary: orNull(f.internal_note),
  };
}

/** Update für candidate_interview_notes, getrennt nach bestehenden und neuen Spalten. */
export function toNotesPayload(f: DossierForm): { base: Record<string, unknown>; extra: Record<string, unknown> } {
  const rec = f.recommendation;
  const base: Record<string, unknown> = {
    change_motivation: orNull(f.change_motivation),
    change_motivation_tags: f.change_motivation_tags,
    would_recommend: rec === 'yes' || rec === 'rather_yes' ? true : rec === 'no' || rec === 'rather_no' ? false : null,
    recommendation_notes: orNull(f.recommendation_notes),
    interview_date: f.interview_date,
    current_positive: orNull(f.current_positive),
    current_negative: orNull(f.current_negative),
    specific_incident: orNull(f.specific_incident),
    frequency_of_issues: f.frequency_of_issues,
    why_now: orNull(f.why_now),
    discussed_internally: f.discussed_internally,
    would_stay_if_matched: f.would_stay === 'yes' ? true : f.would_stay === 'no' ? false : null,
    career_ultimate_goal: orNull(f.career_ultimate_goal),
    career_3_5_year_plan: orNull(f.career_3_5_year_plan),
    career_actions_taken: orNull(f.career_actions_taken),
    career_what_worked: orNull(f.career_what_worked),
    career_what_didnt_work: orNull(f.career_what_didnt_work),
    offer_requirements: f.offer_requirements,
    previous_process_issues: orNull(f.previous_process_issues),
    additional_notes: orNull(f.additional_notes),
    summary_motivation: orNull(f.summary_motivation),
    summary_salary: orNull(f.summary_salary),
    summary_notice: orNull(f.summary_notice),
    summary_key_requirements: orNull(f.summary_key_requirements),
    summary_cultural_fit: orNull(f.summary_cultural_fit),
    // Spiegel für alte Leser (KI-Auswertung, Exposé-PDF)
    salary_current: f.current_salary != null ? String(f.current_salary) : null,
    salary_desired: f.expected_salary != null ? String(f.expected_salary) : null,
    salary_minimum: f.salary_minimum != null ? String(f.salary_minimum) : null,
    notice_period: optionLabel(NOTICE_OPTIONS, f.notice_period),
    earliest_start_date: f.availability_date,
  };
  const extra: Record<string, unknown> = {
    interview_type: f.interview_type,
    leadership_scope: f.leadership_scope,
    leadership_team_size: f.leadership_team_size,
    other_applications: f.other_applications,
    other_applications_notes: orNull(f.other_applications_notes),
    blocked_companies: f.blocked_companies,
    presentation_consent: f.presentation_consent,
    presentation_consent_at: f.presentation_consent_at,
    recommendation_level: f.recommendation,
    would_stay_answer: f.would_stay,
    change_readiness: f.change_readiness,
  };
  return { base, extra };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export type DossierSection =
  | 'kontakt' | 'beruf' | 'wechsel' | 'arbeitsort' | 'sprachen' | 'arbeitserlaubnis' | 'einschaetzung' | 'kunde' | 'links';

export interface ReadinessItem {
  key: string;
  label: string;
  ok: boolean;
  section: DossierSection;
  field: string;
}

export interface Readiness {
  items: ReadinessItem[];
  done: number;
  total: number;
  isReady: boolean;
  missing: ReadinessItem[];
}

export function computeReadiness(f: DossierForm): Readiness {
  const items: ReadinessItem[] = [
    { key: 'kontakt', label: 'Kontakt', ok: !!f.full_name.trim() && (isValidEmail(f.email) || !!f.phone.trim()), section: 'kontakt', field: 'email' },
    { key: 'rolle', label: 'Rolle und Erfahrung', ok: !!f.job_title.trim() && (f.experience_years ?? 0) > 0, section: 'beruf', field: 'job_title' },
    { key: 'skills', label: 'Skills (mind. 3)', ok: f.skills.length >= 3, section: 'beruf', field: 'skills' },
    { key: 'gehalt', label: 'Wunschgehalt', ok: (f.expected_salary ?? 0) > 0, section: 'wechsel', field: 'expected_salary' },
    { key: 'verfuegbarkeit', label: 'Kündigungsfrist', ok: !!(f.notice_period || f.availability_date), section: 'wechsel', field: 'notice_period' },
    { key: 'motivation', label: 'Wechselmotivation', ok: !!f.change_motivation.trim() || f.change_motivation_tags.length > 0, section: 'wechsel', field: 'change_motivation' },
    { key: 'einschaetzung', label: 'Deine Einschätzung', ok: !!f.recommendation, section: 'einschaetzung', field: 'recommendation' },
  ];
  const done = items.filter((i) => i.ok).length;
  return { items, done, total: items.length, isReady: done === items.length, missing: items.filter((i) => !i.ok) };
}

/**
 * Belege aus den Nachfragen zur Wechselmotivation. Bewusst KEIN berechneter
 * Wert: eine automatische Einstufung wäre Profiling (DSGVO Art. 21/22,
 * KI-VO Anhang III). Die Stufe setzt der Headhunter selbst (change_readiness).
 */
export function changeEvidence(f: DossierForm): string[] {
  const out: string[] = [];
  if (f.specific_incident.trim()) out.push(`Auslöser: ${f.specific_incident.trim()}`);
  if (f.frequency_of_issues) out.push(`Kommt vor: ${f.frequency_of_issues.toLowerCase()}`);
  if (f.why_now.trim()) out.push(`Warum jetzt: ${f.why_now.trim()}`);
  if (f.discussed_internally) out.push(`Intern angesprochen: ${f.discussed_internally}`);
  if (f.would_stay) out.push(`Bleibt bei Nachbesserung: ${optionLabel(WOULD_STAY_OPTIONS, f.would_stay)}`);
  if (f.other_applications) out.push(`Andere Bewerbungen: ${optionLabel(OTHER_APPLICATIONS_OPTIONS, f.other_applications)}`);
  return out;
}

export const formatEuro = (n: number) => `${n.toLocaleString('de-DE')} €`;

/** Entfernt Name und aktuellen Arbeitgeber aus Texten, die der Kunde sieht. */
export function redactIdentity(text: string, fullName: string, company: string): string {
  let out = text.trim();
  if (company.trim()) out = out.split(company.trim()).join('aktueller Arbeitgeber');
  for (const part of fullName.split(/\s+/).filter((p) => p.length > 2)) out = out.split(part).join('die Person');
  return out;
}

function neutralize(text: string, f: DossierForm): string {
  return redactIdentity(text, f.full_name, f.company);
}

/** Entwürfe für die fünf Felder des Kundenprofils, nur aus der Akte, anonym. */
export type ClientSummary = Pick<DossierForm, 'summary_motivation' | 'summary_salary' | 'summary_notice' | 'summary_key_requirements' | 'summary_cultural_fit'>;
export const CLIENT_SUMMARY_KEYS = ['summary_motivation', 'summary_salary', 'summary_notice', 'summary_key_requirements', 'summary_cultural_fit'] as const;

export function buildClientSummary(f: DossierForm, today: Date = new Date()): ClientSummary {
  const motivation = f.change_motivation.trim()
    ? neutralize(f.change_motivation, f)
    : f.change_motivation_tags.length ? `Wechselmotive: ${f.change_motivation_tags.join(', ')}` : '';
  // Nie die Schmerzgrenze und nie das aktuelle Gehalt: der Kunde verhandelt
  // sonst genau auf diese Grenze (Entgelttransparenz, Vertrauen des Kandidaten).
  const salary = f.expected_salary ? `Wunschgehalt um ${formatEuro(f.expected_salary)} im Jahr` : '';
  const noticeLabel = optionLabel(NOTICE_OPTIONS, f.notice_period);
  const start = f.availability_date ?? (f.notice_period && f.notice_period !== 'immediate' ? earliestStart(f.notice_period, today) : null);
  const notice = [
    noticeLabel ? (f.notice_period === 'immediate' ? 'Sofort verfügbar' : `Kündigungsfrist ${noticeLabel}`) : '',
    start ? `${f.availability_date ? 'verfügbar ab' : 'frühestens ab'} ${new Date(start).toLocaleDateString('de-DE')}` : '',
  ].filter(Boolean).join(', ');
  const workModel = optionLabel(WORK_MODEL_OPTIONS, f.remote_preference);
  const employment = optionLabel(EMPLOYMENT_OPTIONS, f.employment_type);
  const requirements = [
    f.offer_requirements.join(', '),
    workModel ? `Arbeitsmodell: ${workModel}${f.max_commute_minutes ? `, bis ${f.max_commute_minutes} Min. Arbeitsweg` : ''}` : '',
    employment ?? '',
  ].filter(Boolean).join(' · ');
  const cultureTags = f.change_motivation_tags.filter((t) => ['Team', 'Unternehmenskultur', 'Führung', 'Work-Life-Balance', 'Arbeitszeiten'].includes(t));
  const valued = [...cultureTags, ...f.offer_requirements.filter((o) => ['Gutes Team', 'Unternehmenskultur', 'Flache Hierarchien', 'Gestaltungsspielraum'].includes(o))];
  const culture = valued.length ? `Legt Wert auf: ${[...new Set(valued)].join(', ')}` : '';
  return {
    summary_motivation: motivation,
    summary_salary: salary,
    summary_notice: notice,
    summary_key_requirements: requirements,
    summary_cultural_fit: culture,
  };
}

/** Kurzprofil-Entwurf für den Kunden. Enthält nie Name, Arbeitgeber oder Kontakt. */
export function buildExposeDraft(f: DossierForm): string {
  const parts: string[] = [];
  const role = f.job_title.trim() || 'Fachkraft';
  parts.push(f.experience_years ? `${role} mit ${f.experience_years} Jahren Berufserfahrung.` : `${role}.`);
  if (f.skills.length) parts.push(`Schwerpunkte: ${f.skills.slice(0, 6).join(', ')}.`);
  if (f.languages.length) parts.push(`Sprachen: ${f.languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language)).join(', ')}.`);
  const s = buildClientSummary(f);
  if (s.summary_motivation) parts.push(`Wechselmotivation: ${s.summary_motivation.replace(/\.$/, '')}.`);
  if (s.summary_notice) parts.push(`${s.summary_notice.charAt(0).toUpperCase()}${s.summary_notice.slice(1)}.`);
  if (s.summary_salary) parts.push(`${s.summary_salary}.`);
  return neutralize(parts.join(' '), f);
}

export interface SummaryIssue {
  level: 'warn' | 'danger';
  message: string;
}

/**
 * Prüft das Kurzprofil gegen die Akte: nennt es interne Beträge (Schmerzgrenze,
 * aktuelles Gehalt) oder Zahlen, die seit dem Entwurf geändert wurden?
 */
export function exposeSummaryIssues(f: DossierForm): SummaryIssue[] {
  const text = f.expose_summary.trim();
  if (!text) return [];
  const issues: SummaryIssue[] = [];
  const amounts = [...text.matchAll(/\d[\d.,]*\s*(?:k\b|tsd\b\.?|€|euro\b)/gi)]
    .map((m) => parseMoney(m[0]))
    .filter((n): n is number => n != null && n >= 1000);
  const internal = (n: number | null) => n != null && n !== f.expected_salary && amounts.includes(n);
  if (internal(f.salary_minimum)) issues.push({ level: 'danger', message: 'Das Kurzprofil nennt die Schmerzgrenze. Die darf der Kunde nie sehen.' });
  if (internal(f.current_salary)) issues.push({ level: 'danger', message: 'Das Kurzprofil nennt das aktuelle Gehalt. Das darf der Kunde nie sehen.' });
  if (f.expected_salary && amounts.some((a) => a !== f.expected_salary && a !== f.salary_minimum && a !== f.current_salary)) {
    issues.push({ level: 'warn', message: `Das Gehalt im Kurzprofil passt nicht mehr zur Akte (Wunschgehalt ${formatEuro(f.expected_salary)}).` });
  }
  const current = optionLabel(NOTICE_OPTIONS, f.notice_period);
  if (current && NOTICE_OPTIONS.some((o) => o.label !== current && !current.includes(o.label) && text.includes(o.label))) {
    issues.push({ level: 'warn', message: `Die Kündigungsfrist im Kurzprofil passt nicht mehr zur Akte (jetzt ${current}).` });
  }
  return issues;
}

export interface NoteSuggestion {
  key: keyof DossierForm;
  label: string;
  display: string;
  value: DossierForm[keyof DossierForm];
  same: boolean;
}

/** Vorschläge aus der KI-Auswertung einer freien Notiz. Überschreibt nie still. */
export function suggestionsFromExtraction(extracted: Record<string, unknown> | null | undefined, summaryForClient: unknown, f: DossierForm): NoteSuggestion[] {
  if (!extracted) return [];
  const out: NoteSuggestion[] = [];
  const money: Array<[keyof DossierForm, string, unknown]> = [
    ['current_salary', 'Aktuelles Gehalt', extracted.salary_current],
    ['expected_salary', 'Wunschgehalt', extracted.salary_desired],
    ['salary_minimum', 'Schmerzgrenze', extracted.salary_minimum],
  ];
  for (const [key, label, raw] of money) {
    const v = parseMoney(raw);
    if (v) out.push({ key, label, display: formatEuro(v), value: v, same: f[key] === v });
  }
  const notice = mapNoticeText(extracted.notice_period);
  if (notice) out.push({ key: 'notice_period', label: 'Kündigungsfrist', display: optionLabel(NOTICE_OPTIONS, notice) ?? notice, value: notice, same: f.notice_period === notice });
  const tags = strArray(extracted.motivation_tags)
    .map((t) => MOTIVATION_TAGS.find((m) => m.toLowerCase() === t.toLowerCase()))
    .filter((t): t is string => !!t);
  const newTags = tags.filter((t) => !f.change_motivation_tags.includes(t));
  if (tags.length) out.push({ key: 'change_motivation_tags', label: 'Motivations-Tags', display: tags.join(', '), value: dedupe([...f.change_motivation_tags, ...tags]), same: newTags.length === 0 });
  const culture = typeof extracted.cultural_fit_notes === 'string' ? extracted.cultural_fit_notes.trim() : '';
  if (culture) out.push({ key: 'summary_cultural_fit', label: 'Cultural Fit', display: culture, value: neutralize(culture, f), same: f.summary_cultural_fit.trim() === culture });
  if (typeof summaryForClient === 'string' && summaryForClient.trim()) {
    const text = neutralize(summaryForClient, f);
    out.push({ key: 'expose_summary', label: 'Kurzprofil für den Kunden', display: text, value: text, same: f.expose_summary.trim() === text });
  }
  return out;
}

export function countChanges(a: DossierForm, b: DossierForm): number {
  return (Object.keys(a) as Array<keyof DossierForm>).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length;
}

export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || error.code === '42703' || /schema cache|column .* does not exist/i.test(error.message ?? '');
}

export function stripNewColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const out = { ...payload };
  for (const col of NEW_NOTE_COLUMNS) delete out[col];
  return out;
}

/**
 * Kundenprofil schreibt sich mit: Ein Feld gilt als Entwurf, solange es leer ist oder genau
 * dem zuletzt erzeugten Text entspricht. Solche Felder bekommen den neuen Entwurf; was der
 * Headhunter selbst geändert hat, bleibt unangetastet.
 */
export function autoClientSummary(
  current: DossierForm,
  lastGenerated: ClientSummary,
  today: Date = new Date(),
): { patch: Partial<ClientSummary>; generated: ClientSummary; edited: Set<keyof ClientSummary> } {
  const next = buildClientSummary(current, today);
  const patch: Partial<ClientSummary> = {};
  const edited = new Set<keyof ClientSummary>();
  for (const key of CLIENT_SUMMARY_KEYS) {
    const value = current[key];
    const isDraft = !value.trim() || value === lastGenerated[key] || value === next[key];
    if (!isDraft) { edited.add(key); continue; }
    if (value !== next[key]) patch[key] = next[key];
  }
  return { patch, generated: next, edited };
}
