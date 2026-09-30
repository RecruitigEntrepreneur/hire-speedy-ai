/**
 * Headhunter-Fälle (golden/matching/headhunter-cases.v1.json) → Eingaben der
 * V4.1-Pipeline. Geteilt vom Test mit Musterurteil (pipeline.test.ts) und vom
 * Lauf mit echter KI (run-v41-catalogue.ts).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CandidateInput, JobInput } from '../../supabase/functions/_shared/match-v41/understand';
import type { PrivateMatchContext } from '../../supabase/functions/_shared/match-v41/profiles';
import type { Tier } from '../../supabase/functions/_shared/match-v41/policy';

export interface GoldenCase {
  id: string;
  tags: string[];
  candidate: Record<string, any>;
  job: Record<string, any>;
  expected_tier: string;
  acceptable_tiers: string[];
  reasons: string[];
  must_not_claim?: string[];
}

const here = dirname(fileURLToPath(import.meta.url));

export function loadGoldenCases(): GoldenCase[] {
  return JSON.parse(readFileSync(join(here, '../golden/matching/headhunter-cases.v1.json'), 'utf8'));
}

export const TIER_BY_LABEL: Record<string, Tier> = {
  'Sehr passend': 'sehr_passend',
  Passend: 'passend',
  'Prüfen': 'pruefen',
  Ausgeschlossen: 'ausgeschlossen',
};

/** „OTE (Fixum 70–85k)" → Fixum-Spanne, damit Fixum mit Fixum verglichen wird. */
function fixedRangeFromOte(basis: unknown): { min: number; max: number } | null {
  const m = String(basis ?? '').match(/Fixum\s*(\d+)\s*[–-]\s*(\d+)\s*k/i);
  return m ? { min: Number(m[1]) * 1000, max: Number(m[2]) * 1000 } : null;
}

export function toJobInput(c: GoldenCase): JobInput {
  const j = c.job;
  const fixed = fixedRangeFromOte(j.salary_basis);
  const description = [j.note, j.travel ? `Reisetätigkeit: ${j.travel}` : null].filter(Boolean).join('\n');
  return {
    title: j.title,
    description: description || null,
    must_haves: j.must_haves_raw ?? null,
    nice_to_haves: j.nice_to_haves_raw ?? null,
    client_must: j.unverzichtbar ?? null,
    client_nice: j.verhandelbar ?? null,
    client_trainable: j.lernbar ?? null,
    experience_level: j.seniority ?? null,
    required_languages: (j.required_languages ?? []).map((l: any) => ({ language: l.language, min_level: l.min_level, source: l.source })),
    salary_min: fixed?.min ?? j.salary_min ?? null,
    salary_max: fixed?.max ?? j.salary_max ?? null,
    salary_basis: fixed ? 'fixed' : null,
    location: j.location ?? null,
    remote_type: j.remote_type ?? null,
    onsite_days_required: j.onsite_days ?? null,
    employment_type: j.employment_type ?? null,
    visa_sponsorship: typeof j.visa_sponsorship === 'boolean' ? j.visa_sponsorship : null,
    urgent_within_days: j.urgent ? (j.fill_by_days ?? 60) : null,
  };
}

export function toCandidateInput(c: GoldenCase): CandidateInput {
  const k = c.candidate;
  const free = [
    k.note,
    k.leadership ? `Führung: ${k.leadership.scope === 'disciplinary' ? 'disziplinarisch' : 'fachlich'}, ${k.leadership.team_size} Mitarbeitende` : null,
    k.target_roles?.length ? `Zielrollen: ${k.target_roles.join(', ')}` : null,
  ].filter(Boolean).join('\n');
  return {
    job_title: k.title ?? null,
    experience_years: k.years ?? null,
    seniority: k.seniority ?? null,
    skills: k.skills ?? [],
    certificates: k.certificates ?? [],
    industries: k.industries ?? [],
    languages: (k.languages ?? []).map((l: any) => ({ language: l.language, proficiency: l.level })),
    city: k.city ?? null,
    remote_preference: k.work_model ?? null,
    max_commute_minutes: k.max_commute_min ?? null,
    relocation_willing: typeof k.relocation === 'boolean' ? k.relocation : null,
    target_locations: k.target_locations ?? [],
    expected_salary: k.salary_wish ?? null,
    salary_minimum: k.salary_min ?? null,
    salary_basis: /Fixum/i.test(String(k.salary_note ?? '')) ? 'fixed' : null,
    notice_period: k.notice ?? null,
    employment_type: k.employment_type ?? null,
    needs_visa: k.work_permit === 'needs_visa' ? true : k.work_permit ? false : null,
    redacted_text: free || null,
  };
}

export function toPrivate(c: GoldenCase): PrivateMatchContext {
  return { candidate_blocked_companies: c.candidate.blocked_companies ?? [], job_company_name: c.job.company ?? null };
}

/** Fester Stichtag, damit Kündigungsfristen reproduzierbar gerechnet werden. */
export const EVAL_NOW_MS = Date.UTC(2026, 8, 30);
