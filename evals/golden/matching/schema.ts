/**
 * Schema des Golden-Datasets für Matching-Evals.
 *
 * Kandidaten tragen ihr WAHRES Profil (inkl. Sprachen/Zertifikaten, wie sie in
 * candidate_languages bzw. im CV stünden). Was die jeweilige Engine davon zu
 * sehen bekommt, entscheidet der Adapter — so lässt sich dieselbe Wahrheit
 * unter verschiedenen Daten-Realitäten evaluieren (Live-Zustand vs. ideal).
 *
 * Datumslogik ist relativ zu reference_date (availability_in_days), damit das
 * Dataset deterministisch bleibt und nicht altert.
 */

import { z } from 'zod';

export const LanguageSkillSchema = z.object({
  language: z.string(),
  level: z.string(), // a1..c2 | native
});

export const GoldenCandidateSchema = z.object({
  id: z.string(),
  is_synthetic: z.boolean(),
  persona: z.string(),
  job_title: z.string().nullable(),
  skills: z.array(z.string()),
  experience_years: z.number().nullable(),
  seniority: z.string().nullable(),
  expected_salary: z.number().nullable(),
  /** Fallback-Feld der Live-DB; der Matcher liest expected_salary || salary_expectation_min. */
  salary_expectation_min: z.number().nullable(),
  availability_in_days: z.number().nullable(),
  remote_preference: z.string().nullable(),
  work_model: z.string().nullable(),
  city: z.string().nullable(),
  max_commute_minutes: z.number().nullable(),
  industry_experience: z.array(z.string()),
  languages: z.array(LanguageSkillSchema),
  certifications: z.array(z.string()),
  visa_required: z.boolean(),
});

export const RequiredLanguageSchema = z.object({
  code: z.string(),
  minLevel: z.string().optional(),
});

export const SkillRequirementSchema = z.object({
  skill_name: z.string(),
  type: z.enum(['must', 'nice']),
  weight: z.number(),
});

export const GoldenJobSchema = z.object({
  id: z.string(),
  is_synthetic: z.boolean(),
  title: z.string(),
  industry: z.string().nullable(),
  skills: z.array(z.string()),
  must_haves: z.array(z.string()),
  nice_to_haves: z.array(z.string()),
  salary_min: z.number().nullable(),
  salary_max: z.number().nullable(),
  experience_level: z.string().nullable(),
  /** Phantom-Spalten: existieren im Code, aber (Stand heute) nicht in der Live-DB. */
  experience_min: z.number().nullable(),
  experience_max: z.number().nullable(),
  visa_sponsorship: z.boolean().nullable(),
  remote_type: z.string().nullable(),
  work_model: z.string().nullable(),
  onsite_required: z.boolean(),
  required_languages: z.array(RequiredLanguageSchema),
  required_certifications: z.array(z.string()),
  location: z.string().nullable(),
  /** job_skill_requirements-Zeilen (nur bei Studio-Jobs vorhanden). */
  skill_requirements: z.array(SkillRequirementSchema),
});

export const LabelSchema = z.object({
  job_id: z.string(),
  candidate_id: z.string(),
  label: z.enum(['hired', 'interviewed', 'shortlisted', 'submitted', 'rejected']),
  /** Bei rejected: fachliche Begründung — macht Hard-Negatives nachvollziehbar. */
  reason: z.string().optional(),
});

export const GoldenDatasetSchema = z.object({
  version: z.string(),
  is_synthetic: z.boolean(),
  reference_date: z.string(),
  description: z.string(),
  jobs: z.array(GoldenJobSchema),
  candidates: z.array(GoldenCandidateSchema),
  labels: z.array(LabelSchema),
});

export type GoldenCandidate = z.infer<typeof GoldenCandidateSchema>;
export type GoldenJob = z.infer<typeof GoldenJobSchema>;
export type GoldenLabel = z.infer<typeof LabelSchema>;
export type GoldenDataset = z.infer<typeof GoldenDatasetSchema>;

/**
 * Relevanz-Grade für nDCG: hired > interviewed/shortlisted > submitted >
 * rejected/unbekannt. 'submitted' = Recruiter hat eingereicht, Kunde hat noch
 * nicht entschieden — schwaches Positiv.
 */
export const LABEL_GRADES: Record<GoldenLabel['label'], number> = {
  hired: 3,
  interviewed: 2,
  shortlisted: 2,
  submitted: 1,
  rejected: 0,
};

/** Positiv = Grade > 0; rejected sind explizite Hard-Negatives. */
export function isPositiveLabel(label: GoldenLabel['label']): boolean {
  return LABEL_GRADES[label] > 0;
}
