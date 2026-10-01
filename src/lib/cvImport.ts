// Lebenslauf-Import im Frontend: Antwort von extract-candidate-cv → Kandidatenakte.
//
// Regeln:
// - Nur Belegtes landet in der Akte; Vorschläge (Seniorität ohne Zitat, Kurzprofil)
//   sind als solche markiert und werden auf der Prüfseite gelb gezeigt.
// - Nichts wird erfunden: kein Platzhalter für E-Mail, kein „Umzug: Nein" ohne Angabe.
// - Der aktuelle Arbeitgeber steht automatisch auf der Sperrliste.
// - Beim Aktualisieren werden nur leere Felder gefüllt; Abweichungen entscheidet der Headhunter.

import { DossierForm, fromRecords } from '@/lib/candidateDossier';

export type CvSource = 'cv' | 'notes' | 'derived' | 'suggestion';

export interface CvStation {
  job_title: string;
  company_name: string;
  location: string;
  industry: string;
  start: string | null;
  end: string | null;
  is_current: boolean;
  description: string;
}

export interface CvEducation {
  institution: string;
  degree: string;
  field_of_study: string;
  graduation_year: number | null;
  grade: string;
}

export interface CvExtraction {
  version: string;
  contact: {
    full_name: string; email: string; phone: string; city: string;
    linkedin_url: string; github_url: string; portfolio_url: string; website_url: string;
  };
  removed_sensitive: string[];
  fields: Partial<Record<string, { value: unknown; source: CvSource; quote: string }>>;
  stations: CvStation[];
  educations: CvEducation[];
  skills: { name: string; years: number | null; quote: string }[];
  languages: { language: string; level: string; quote: string }[];
  suggestions: { summary: string; highlights: string[]; career_directions: string[] };
  rejected_quotes: number;
  raw_text: string;
}

export interface FieldOrigin {
  source: CvSource;
  quote: string;
}

export type OriginMap = Partial<Record<keyof DossierForm, FieldOrigin>>;

export function emptyDossier(): DossierForm {
  return fromRecords(null, null, []);
}

const FIELD_MAP: Record<string, keyof DossierForm> = {
  job_title: 'job_title', company: 'company', seniority: 'seniority', leadership_scope: 'leadership_scope',
  leadership_team_size: 'leadership_team_size', experience_years: 'experience_years', certificates: 'certificates',
  industries: 'industries', expected_salary: 'expected_salary', salary_minimum: 'salary_minimum', current_salary: 'current_salary',
  notice_period: 'notice_period', availability_date: 'availability_date', remote_preference: 'remote_preference',
  max_commute_minutes: 'max_commute_minutes', employment_type: 'employment_type', relocation_willing: 'relocation_willing',
  work_permit: 'work_permit', target_roles: 'target_roles', target_industries: 'target_industries',
  target_locations: 'target_locations', blocked_companies: 'blocked_companies', change_motivation: 'change_motivation',
  career_3_5_year_plan: 'career_3_5_year_plan',
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

/** Ausgelesene Werte als Akte plus Herkunft je Feld (für die Prüfseite). */
export function dossierFromCv(cv: CvExtraction): { form: DossierForm; origins: OriginMap } {
  const form = emptyDossier();
  const origins: OriginMap = {};
  const put = <K extends keyof DossierForm>(key: K, value: DossierForm[K], origin: FieldOrigin) => {
    (form as unknown as Record<string, unknown>)[key] = value;
    origins[key] = origin;
  };

  const c = cv.contact;
  const contactOrigin: FieldOrigin = { source: 'cv', quote: '' };
  if (c.full_name) put('full_name', c.full_name, contactOrigin);
  if (c.email) put('email', c.email, contactOrigin);
  if (c.phone) put('phone', c.phone, contactOrigin);
  if (c.city) put('city', c.city, contactOrigin);
  if (c.linkedin_url) put('linkedin_url', c.linkedin_url, contactOrigin);
  if (c.github_url) put('github_url', c.github_url, contactOrigin);
  if (c.portfolio_url) put('portfolio_url', c.portfolio_url, contactOrigin);
  if (c.website_url) put('website_url', c.website_url, contactOrigin);

  for (const [key, f] of Object.entries(cv.fields)) {
    const target = FIELD_MAP[key];
    if (!target || !f) continue;
    put(target, f.value as never, { source: f.source, quote: f.quote });
  }
  // Rolle/Firma aus der aktuellen Station, falls die KI sie nicht eigens genannt hat
  const current = cv.stations.find((s) => s.is_current) ?? cv.stations[0];
  if (!form.job_title && current?.job_title) put('job_title', current.job_title, { source: 'derived', quote: 'aktuelle Station' });
  if (!form.company && current?.company_name) put('company', current.company_name, { source: 'derived', quote: 'aktuelle Station' });

  if (cv.skills.length) put('skills', cv.skills.map((s) => s.name), { source: 'cv', quote: cv.skills.slice(0, 3).map((s) => s.quote || s.name).join(' · ') });
  if (cv.languages.length) put('languages', cv.languages.map((l) => ({ language: l.language, proficiency: l.level })), { source: 'cv', quote: cv.languages.map((l) => l.quote).filter(Boolean).slice(0, 2).join(' · ') });

  // Sperrliste: aktueller Arbeitgeber automatisch, abwählbar
  if (form.company && !form.blocked_companies.some((b) => norm(b) === norm(form.company))) {
    form.blocked_companies = [form.company, ...form.blocked_companies];
    origins.blocked_companies = origins.blocked_companies ?? { source: 'derived', quote: 'aktueller Arbeitgeber' };
  }

  if (cv.suggestions.summary) put('expose_summary', cv.suggestions.summary, { source: 'suggestion', quote: '' });
  if (cv.suggestions.highlights.length) put('expose_highlights', cv.suggestions.highlights, { source: 'suggestion', quote: '' });
  return { form, origins };
}

// ---------------------------------------------------------------------------
// Aktualisieren: nur leere Felder füllen, Abweichungen anzeigen
// ---------------------------------------------------------------------------

export interface CvChange {
  key: keyof DossierForm;
  kind: 'new' | 'conflict';
  current: unknown;
  incoming: unknown;
}

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Felder, die ein neuer Lebenslauf nie anfasst, auch wenn sie leer sind: Einschätzung des Headhunters. */
const NEVER_FROM_CV = new Set<keyof DossierForm>(['internal_note', 'recommendation', 'recommendation_notes', 'change_readiness', 'presentation_consent', 'presentation_consent_at']);

/**
 * Neuer Lebenslauf für einen bestehenden Kandidaten. Listen werden ergänzt (nichts
 * entfernt), leere Felder gefüllt, abweichende Werte als Konflikt gemeldet und
 * zunächst NICHT übernommen. Interviewdaten bleiben damit immer erhalten.
 */
export function mergeCvIntoDossier(current: DossierForm, incoming: DossierForm, origins: OriginMap): { merged: DossierForm; changes: CvChange[] } {
  const merged: DossierForm = { ...current };
  const changes: CvChange[] = [];
  for (const key of Object.keys(origins) as (keyof DossierForm)[]) {
    if (NEVER_FROM_CV.has(key)) continue;
    const cur = current[key];
    const inc = incoming[key];
    if (isEmpty(inc) || same(cur, inc)) continue;
    if (Array.isArray(cur) && Array.isArray(inc)) {
      if (key === 'languages') {
        const langs = cur as DossierForm['languages'];
        const add = (inc as DossierForm['languages']).filter((l) => !langs.some((x) => norm(x.language) === norm(l.language)));
        if (add.length) { (merged as unknown as Record<string, unknown>)[key] = [...langs, ...add]; changes.push({ key, kind: 'new', current: cur, incoming: add }); }
        continue;
      }
      const add = (inc as string[]).filter((v) => !(cur as string[]).some((x) => norm(String(x)) === norm(String(v))));
      if (add.length) { (merged as unknown as Record<string, unknown>)[key] = [...(cur as string[]), ...add]; changes.push({ key, kind: 'new', current: cur, incoming: add }); }
      continue;
    }
    if (isEmpty(cur)) {
      (merged as unknown as Record<string, unknown>)[key] = inc;
      changes.push({ key, kind: 'new', current: cur, incoming: inc });
    } else {
      changes.push({ key, kind: 'conflict', current: cur, incoming: inc });
    }
  }
  return { merged, changes };
}

/** Stationen, die noch nicht in der Akte stehen (gleiche Firma und gleicher Start = gleiche Station). */
export function newStations(existing: { company_name: string | null; start_date: string | null }[], incoming: CvStation[]): CvStation[] {
  return incoming.filter((s) => !existing.some((e) => norm(e.company_name ?? '') === norm(s.company_name) && (e.start_date ?? '').slice(0, 7) === (s.start ?? '')));
}

/** Was im Lebenslauf fehlt und im Interview gefragt werden sollte. */
export function interviewGaps(f: DossierForm): string[] {
  const gaps: string[] = [];
  if (!f.expected_salary) gaps.push('Wunschgehalt und Schmerzgrenze');
  if (!f.notice_period && !f.availability_date) gaps.push('Kündigungsfrist');
  if (!f.change_motivation.trim() && !f.change_motivation_tags.length) gaps.push('Wechselmotivation');
  if (!f.remote_preference) gaps.push('Arbeitsmodell und Pendelzeit');
  if (f.blocked_companies.length <= 1) gaps.push('Firmen, bei denen nicht vorgestellt werden soll');
  if (f.relocation_willing == null) gaps.push('Umzugsbereitschaft');
  return gaps;
}

export interface ReviewCounts {
  taken: number;
  check: number;
  gaps: number;
}

export function reviewCounts(f: DossierForm, origins: OriginMap, cv: CvExtraction): ReviewCounts {
  const entries = Object.values(origins);
  const check = entries.filter((o) => o?.source === 'suggestion').length;
  const taken = entries.length - check + cv.stations.length + cv.educations.length;
  return { taken, check, gaps: interviewGaps(f).length };
}
