/**
 * Reine Abbildungen der Jobaufnahme — ohne React, ohne Supabase, ohne Auth.
 *
 * Herausgezogen aus src/components/dashboard/JobIntakeStudio.tsx, damit der
 * Dashboard-Weg und die login-freie Aufnahme über /start/:token dieselbe
 * Abbildung benutzen. Ein zweiter Mapper wäre der dritte parallele Intake-Pfad
 * gewesen — das Repo trägt schon zwei (Studio und CreateJob), die
 * unterschiedliche Feldsets in dieselbe jobs-Tabelle schreiben.
 *
 * Serverseitiges Gegenstück: supabase/functions/_shared/intake-mapping.ts.
 * Es bildet denselben Entwurf auf die jobs-Zeile ab; Deno kann nicht aus src/
 * importieren. Wer hier etwas ändert, ändert es dort mit.
 */
import type { ParsedJobData } from '@/hooks/useJobParsing';
import type { ParsedJobProfile } from '@/hooks/useJobPdfParsing';
import type { BuiltJob, FreelanceTerms, RevealSetup } from '@/components/dashboard/intake/types';
import type { Answers, BriefBuilt } from '@/components/dashboard/IntakeBriefing';
import type { DynState } from '@/components/dashboard/intake/DynamicBriefing';
import type { FlexibilityMap } from '@/components/dashboard/intake/ProfileSections';

/**
 * Leerer Entwurf für den manuellen Einstieg ("Ohne Vorlage starten").
 *
 * M1 aus INTAKE_UMSETZUNG_WELLE_A.md:52-79. Für die login-freie Aufnahme ist
 * das keine Bequemlichkeit, sondern die Rückfallebene: sind parse-job-url oder
 * intake-questions nicht erreichbar, hat ein Gast kein Dashboard, in das er
 * ausweichen könnte. Ohne manuellen Weg wäre die Aufnahme dann ein Totalausfall.
 */
export const EMPTY_BUILT: BuiltJob = {
  title: '',
  company_name: '',
  location: '',
  remote_type: 'hybrid',
  experience_level: 'mid',
  salary_min: null,
  salary_max: null,
  skills: [],
  must_haves: [],
  nice_to_haves: [],
  industry: '',
  description: '',
  requirements: '',
  vacancyReason: null,
  reportsTo: null,
  hiringUrgency: null,
  remoteDays: null,
  usps: [],
};

/** Ergebnis von parse-job-url (Text oder Link) in den Studio-Zustand. */
export function fromParsedJobData(d: ParsedJobData): BuiltJob {
  return {
    title: d.title || '',
    company_name: d.company_name || '',
    location: d.location || '',
    remote_type: d.remote_type || 'hybrid',
    experience_level: d.experience_level || 'mid',
    salary_min: d.salary_min,
    salary_max: d.salary_max,
    skills: d.skills || [],
    must_haves: d.must_haves || [],
    nice_to_haves: d.nice_to_haves || [],
    industry: d.industry || '',
    description: d.description || '',
    requirements: d.requirements || '',
    vacancyReason: d.vacancy_reason ?? null,
    reportsTo: d.reports_to ?? null,
    hiringUrgency: d.hiring_urgency ?? null,
    remoteDays: d.remote_days ?? null,
    usps: d.unique_selling_points || [],
  };
}

/** Ergebnis von parse-job-pdf in den Studio-Zustand. */
export function fromParsedJobProfile(p: ParsedJobProfile): BuiltJob {
  const level: Record<string, string> = {
    junior: 'junior', mid: 'mid', senior: 'senior',
    lead: 'lead', principal: 'lead', director: 'lead',
  };
  return {
    title: p.title || '',
    company_name: p.company || '',
    location: p.location || '',
    remote_type: p.remote_policy === 'remote' ? 'remote' : p.remote_policy === 'onsite' ? 'onsite' : 'hybrid',
    experience_level: level[p.seniority_level] || 'mid',
    salary_min: p.salary_min,
    salary_max: p.salary_max,
    skills: p.technical_skills || [],
    must_haves: p.requirements || [],
    nice_to_haves: p.nice_to_have || [],
    industry: p.industry || '',
    description: p.description || '',
    requirements: (p.requirements || []).join('\n'),
    vacancyReason: null,
    reportsTo: null,
    hiringUrgency: null,
    remoteDays: null,
    usps: [],
  };
}

/**
 * Die typisierten Felder, die der Parser bereits eingeordnet hat.
 *
 * Sie gehören nicht in BuiltJob — das ist der Formularzustand — sondern in
 * dyn.typedFields, wo sie mit dem verschmelzen, was die KI im Briefing
 * normalisiert. draftToJobRow und buildRecord lesen genau von dort.
 *
 * Ohne diesen Weg landeten Sprachanforderungen und Erfahrungsjahre wieder als
 * unerfüllbare Einträge in der Muss-Liste — der Matcher hält jeden davon für
 * einen Skillnamen (calculate-match-v3-1:1174).
 */
export function typedFieldsFromParsed(d: ParsedJobData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.required_languages?.length) out.required_languages = d.required_languages;
  if (d.required_certifications?.length) out.required_certifications = d.required_certifications;
  if (d.experience_min != null) out.experience_min = d.experience_min;
  return out;
}

/** Der Ausschnitt, den das statische Briefing zum Vorbefüllen braucht. */
export const toBriefBuilt = (j: BuiltJob): BriefBuilt => ({
  remote_type: j.remote_type,
  must_haves: j.must_haves,
  vacancyReason: j.vacancyReason,
  reportsTo: j.reportsTo,
  hiringUrgency: j.hiringUrgency,
  remoteDays: j.remoteDays,
  usps: j.usps,
});

export const remoteLabel = (r: string) => (r === 'remote' ? 'Remote' : r === 'onsite' ? 'Vor Ort' : 'Hybrid');
export const levelLabel = (l: string) =>
  l === 'junior' ? 'Junior' : l === 'senior' ? 'Senior' : l === 'lead' ? 'Lead' : 'Mid-Level';

/** Der vollständige, serialisierbare Zustand einer Aufnahme. */
export interface IntakeDraftState {
  type: 'full-time' | 'freelance';
  built: BuiltJob;
  answers: Answers;
  freelance: FreelanceTerms;
  flexibility: FlexibilityMap;
  revealSetup: RevealSetup;
  dyn: DynState;
}

/**
 * Der Job-Entwurf, den intake-questions als Kontext bekommt.
 *
 * Identisch für beide Wege — auch die Vorbelegung: Regel 8 des Systemprompts
 * behandelt alles in company_defaults als beantwortet und fragt es nie erneut.
 * Beim Dashboard kommt sie aus company_profiles, bei der login-freien Aufnahme
 * aus der Vorbelegung des Links.
 */
export function buildAiJobDraft(args: {
  type: 'full-time' | 'freelance';
  built: BuiltJob;
  freelance: FreelanceTerms;
  flexibility: FlexibilityMap;
  companyDefaults?: {
    industry?: string | null;
    size?: string | null;
    remote_policy?: string | null;
    excluded_companies?: string[] | null;
  } | null;
}): Record<string, unknown> {
  const { type, built, freelance, flexibility, companyDefaults } = args;
  const isFreelance = type === 'freelance';
  return {
    contract_type: type,
    title: built.title,
    location: built.location,
    remote_type: built.remote_type,
    experience_level: built.experience_level,
    salary_min: built.salary_min,
    salary_max: built.salary_max,
    day_rate: isFreelance ? { min: freelance.dayRateMin, max: freelance.dayRateMax } : undefined,
    // Die Listen kommen aus einem Entwurf, der noch nicht vollstaendig sein
    // muss -- waehrend des Bauens ist er es nie. Ein ungeschuetztes
    // built.skills.slice() liess die gesamte Aufnahme mit weisser Seite
    // abstuerzen, genau in dem Moment, in dem das Profil entstand.
    must_haves: built.must_haves ?? [],
    nice_to_haves: built.nice_to_haves ?? [],
    skills: (built.skills ?? []).slice(0, 15),
    industry: built.industry,
    vacancy_reason: built.vacancyReason,
    reports_to: built.reportsTo,
    usps: built.usps ?? [],
    flexibility,
    company_defaults: companyDefaults ?? undefined,
  };
}

/**
 * Das narrative Briefing für intake_payload — der Teil, der nicht in typisierte
 * Spalten passt. Ohne draft_state: der gehört bei der login-freien Aufnahme in
 * intake_drafts und wäre in jobs eine zweite Wahrheit.
 */
export function buildIntakePayload(args: {
  source: 'studio' | 'guest_intake';
  state: IntakeDraftState;
  briefingText: string | null;
  profileFacts?: string[];
}): Record<string, unknown> {
  const { source, state, briefingText, profileFacts } = args;
  const { type, built, answers, freelance, flexibility, dyn } = state;
  const typed = dyn.typedFields as Record<string, unknown>;

  return {
    source,
    captured_at: new Date().toISOString(),
    contract_type: type,
    briefing_answers: answers,
    briefing_text: briefingText || null,
    briefing_dynamic: dyn.answers.length ? dyn.answers : null,
    dynamic_payload: Object.keys(dyn.payloadPatch).length ? dyn.payloadPatch : null,
    typed_extras: {
      required_languages: typed.required_languages ?? null,
      required_certifications: typed.required_certifications ?? null,
      onsite_required: typed.onsite_required ?? null,
    },
    skill_requirements: dyn.skillRequirements.length ? dyn.skillRequirements : null,
    contracting: type === 'freelance' ? freelance : null,
    flexibility: Object.keys(flexibility).length ? flexibility : null,
    profile_prefill: profileFacts?.length ? profileFacts : null,
    usps: built.usps.length ? built.usps : null,
    vacancy_reason: built.vacancyReason,
    reports_to: built.reportsTo,
    hiring_urgency: built.hiringUrgency,
    remote_days: built.remoteDays,
  };
}

/**
 * Wie vollständig die Aufnahme ist — eine Zahl, ein Rechenweg.
 *
 * Vorher standen zwei Wege nebeneinander (Kopfzeile 42 %, Briefing-Reife
 * 65/100 auf demselben Bildschirm). Ist die KI erreichbar, gilt ihre gewichtete
 * Bewertung; sonst der Anteil beantworteter Pflichtfragen.
 */
export function intakeCompleteness(dyn: DynState, staticPct: number): number {
  return dyn.available ? dyn.completeness : staticPct;
}
