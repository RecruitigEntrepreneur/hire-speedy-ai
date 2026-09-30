/**
 * Match V4.1 – Datenbankzeilen → Eingaben der Pipeline. Pure Funktionen, damit
 * die Abbildung ohne Datenbank getestet werden kann (evals/v41/db-inputs.test.ts).
 *
 * Was hier NICHT an die KI geht: Name, Kontaktdaten, Arbeitgebernamen (Aliase),
 * Wohnort, Gehalt, Kündigungsfrist, Sperrliste, Ist-Gehalt, Wechselmotivation.
 * Gehalt/Ort/Frist landen nur in den Rahmenfeldern, die frame.ts ohne KI prüft.
 */

import type { LLMView } from '../pii-redaction.ts';
import type { CandidateInput, JobInput } from './understand.ts';

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Liste aus text[] oder jsonb (Strings oder Objekte mit name/label/value/city/industry). */
export function names(v: unknown, ...keys: string[]): string[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' && v.trim().startsWith('[') ? safeJson(v) : [];
  const out: string[] = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (typeof x === 'string' && x.trim()) out.push(x.trim());
    else if (x && typeof x === 'object') {
      for (const k of [...keys, 'name', 'label', 'value']) {
        const s = str((x as Row)[k]);
        if (s) { out.push(s); break; }
      }
    }
  }
  return [...new Set(out)];
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return []; }
}

/**
 * Geldbetrag aus Freitext: „65.000", „65k", „65 T€", „ca. 70000 €", „70–75k" (nimmt den
 * ersten Wert). Werte unter 1000 ohne k gelten als Tagessatz und werden nicht umgedeutet.
 */
export function parseMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const s = String(v ?? '').toLowerCase().replace(/\s+/g, ' ');
  const m = s.match(/(\d{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)\s*(k|t€|tsd|tausend)?(?:\s*[–-]\s*\d+(?:,\d+)?\s*(k|t€|tsd|tausend))?/);
  if (!m) return null;
  let n = Number(m[1].replace(/[.\s]/g, '').replace(',', '.'));
  if (m[2] || m[3]) n *= 1000;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function yearsBetween(start: unknown, end: unknown, nowMs: number): number | null {
  const a = Date.parse(String(start ?? ''));
  if (!Number.isFinite(a)) return null;
  const b = end ? Date.parse(String(end)) : nowMs;
  if (!Number.isFinite(b) || b < a) return null;
  return Math.round(((b - a) / (365.25 * 86400000)) * 10) / 10;
}

/**
 * Freitext für die KI aus der geschwärzten Sicht: Stationen nur mit Dauer (keine
 * Daten – Altersindiz), Arbeitgeber als Alias, Beschreibungen bereits geschwärzt.
 */
export function redactedCandidateText(view: LLMView, notes: Row | null, nowMs: number): string {
  const lines: string[] = [];
  if (view.cvSummary) lines.push(`Zusammenfassung: ${view.cvSummary.slice(0, 1200)}`);
  for (const e of view.experiences.slice(0, 8)) {
    const yrs = yearsBetween(e.start_date, e.end_date, nowMs);
    const head = [e.job_title ?? 'Position', e.employer_alias ? `bei ${e.employer_alias}` : null, yrs !== null ? `${yrs} Jahre` : null, e.end_date ? null : 'aktuell']
      .filter(Boolean).join(', ');
    lines.push(`Station: ${head}${e.description ? ` – ${e.description.slice(0, 600)}` : ''}`);
  }
  const detailed = view.skillsDetailed.filter((s) => s.name && s.years);
  if (detailed.length) lines.push(`Erfahrung je Skill: ${detailed.slice(0, 20).map((s) => `${s.name} ${s.years} Jahre`).join(', ')}`);
  const scope = str(notes?.leadership_scope);
  const team = num(notes?.leadership_team_size);
  if (scope && scope !== 'none') {
    lines.push(`Führung: ${scope === 'disciplinary' ? 'disziplinarisch' : scope === 'functional' ? 'fachlich' : scope}${team ? `, ${team} Mitarbeitende` : ''}`);
  }
  return lines.join('\n');
}

export function candidateInputFromRows(
  c: Row,
  view: LLMView,
  languageRows: Row[],
  notes: Row | null,
  nowMs: number,
): CandidateInput {
  // Tabelle candidate_languages zuerst; das alte jsonb language_skills nur als Rückfall.
  const fromJson = (Array.isArray(c.language_skills) ? c.language_skills as Row[] : [])
    .map((l) => ({ language: String(l?.language ?? l?.code ?? ''), proficiency: str(l?.level) ?? str(l?.proficiency) }));
  const languages = languageRows.length
    ? languageRows.map((l) => ({ language: String(l.language ?? ''), proficiency: str(l.proficiency) }))
    : fromJson;
  return {
    job_title: str(c.job_title),
    experience_years: num(c.experience_years),
    seniority: str(c.seniority),
    skills: [...new Set([...names(c.skills), ...view.skillsDetailed.map((s) => s.name).filter(Boolean)])].slice(0, 60),
    certificates: [...new Set([...names(c.certifications), ...names(c.certificates, 'title')])].slice(0, 30),
    industries: names(c.industry_experience, 'industry').slice(0, 10),
    languages: languages.filter((l) => l.language),
    city: str(c.city),
    remote_preference: str(c.remote_preference) ?? str(c.work_model),
    max_commute_minutes: num(c.max_commute_minutes),
    relocation_willing: typeof c.relocation_willing === 'boolean' ? c.relocation_willing : null,
    target_locations: names(c.target_locations, 'city', 'location'),
    expected_salary: num(c.expected_salary) ?? num(c.salary_expectation_max) ?? parseMoney(notes?.salary_desired),
    salary_minimum: parseMoney(notes?.salary_minimum) ?? num(c.salary_expectation_min),
    salary_basis: null,
    notice_period: str(notes?.notice_period) ?? str(c.notice_period),
    employment_type: str(c.target_employment_type) ?? (names(c.target_employment_type)[0] ?? null),
    needs_visa: typeof c.visa_required === 'boolean' ? c.visa_required : null,
    redacted_text: redactedCandidateText(view, notes, nowMs) || null,
  };
}

// ---------------------------------------------------------------------------
// Stellen
// ---------------------------------------------------------------------------

const LEGAL_FORMS = /\b(gmbh|ag|se|kg|kgaa|ohg|ug|mbh|co|inc|ltd|llc|holding|group|gruppe|deutschland|germany|und|and|&)\b/gi;

/** Wörter, an denen man den Kunden erkennt: voller Name und markante Namensteile (≥ 4 Zeichen). */
export function companyMaskTokens(companyName: string | null | undefined): string[] {
  const full = str(companyName);
  if (!full) return [];
  const core = full.replace(LEGAL_FORMS, ' ').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const parts = core.split(' ').filter((p) => p.length >= 4);
  return [...new Set([full, core, ...parts].filter((t) => t && t.length >= 3))].sort((a, b) => b.length - a.length);
}

/** Kundennamen durch [Kunde] ersetzen (ganze Wörter, ohne Groß/klein). */
export function maskCompany(text: string | null | undefined, tokens: string[]): string | null {
  if (text == null) return null;
  let out = String(text);
  for (const t of tokens) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, 'giu'), (_m, pre) => `${pre}[Kunde]`);
  }
  return out;
}

const URGENT = /urgent|dringend|asap|sofort|high|hoch|kritisch|critical/i;

export function jobInputFromRow(j: Row, nowMs: number): JobInput {
  const tokens = companyMaskTokens(str(j.company_name));
  const m = (v: unknown) => maskCompany(str(v), tokens);
  const ml = (v: unknown) => names(v).map((x) => maskCompany(x, tokens) ?? x);
  const freelance = /freelanc|contract|frei/i.test(String(j.employment_type ?? ''));
  const dayRate = freelance && (num(j.day_rate_min) || num(j.day_rate_max));
  const urgentFlag = URGENT.test(String(j.hiring_urgency ?? j.urgency ?? ''));
  const deadline = Date.parse(String(j.hiring_deadline ?? j.deadline ?? ''));
  const deadlineDays = Number.isFinite(deadline) ? Math.max(0, Math.round((deadline - nowMs) / 86400000)) : null;
  return {
    title: m(j.title) ?? 'Stelle',
    description: [m(j.description), m(j.requirements)].filter(Boolean).join('\n\n') || null,
    must_haves: ml(j.must_haves),
    nice_to_haves: ml(j.nice_to_haves),
    client_must: ml(j.must_have_criteria),
    client_nice: ml(j.nice_to_have_criteria),
    client_trainable: ml(j.trainable_skills),
    experience_level: str(j.experience_level),
    required_languages: (Array.isArray(j.required_languages) ? j.required_languages as Row[] : [])
      .map((l) => ({ code: str(l.code) ?? undefined, language: str(l.language) ?? undefined, minLevel: str(l.minLevel) ?? str(l.min_level) ?? undefined, source: str(l.source) ?? undefined })),
    salary_min: dayRate ? num(j.day_rate_min) : num(j.salary_min),
    salary_max: dayRate ? num(j.day_rate_max) : num(j.salary_max),
    salary_basis: dayRate ? 'daily_rate' : null,
    location: str(j.location),
    remote_type: str(j.remote_type) ?? str(j.work_model),
    onsite_days_required: num(j.onsite_days_required),
    employment_type: str(j.employment_type),
    visa_sponsorship: typeof j.visa_sponsorship === 'boolean' ? j.visa_sponsorship : null,
    urgent_within_days: urgentFlag ? (deadlineDays ?? 45) : null,
  };
}
