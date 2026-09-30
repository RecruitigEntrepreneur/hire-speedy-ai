/**
 * V3.2-Prototyp-Adapter: reparierter Matcher (evals/adapters/v32/matcher.ts)
 * in mehreren Varianten, damit jeder Fix einzeln messbar ist.
 *
 * Datenrealität „as-deployed+" (Standard, Vergleich gegen v31-code-defaults):
 * wie v31-code-defaults (Phantom-Spalten fehlen, language_skills/certifications
 * leer, keine job_skill_requirements) — PLUS die Quellen, die in der Live-DB
 * existieren, aber von v3.1 nicht gelesen werden:
 * - candidate_languages  ← Golden `languages` (Tabelle wird von CV-Parsing/Import befüllt)
 * - certificates         ← Golden `certifications` (parse-cv schreibt `certificates`)
 * Ist der jeweilige Fix aus (F1/F2), ignoriert der Matcher diese Quellen — dann
 * gilt exakt das v3.1-Verhalten.
 *
 * notice_period fehlt in beiden Golden-Datasets → F7-Kündigungsfrist ist hier
 * NICHT messbar (nur die weichere Startdatum-Kurve).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AdapterContext, MatcherAdapter, PairScore } from '../types';
import type { GoldenCandidate, GoldenJob } from '../../golden/matching/schema';
import { buildSynonymMap } from '../v31-baseline/matcher';
import { ALL_FIXES, NO_FIXES, type V32Flags } from '../../../supabase/functions/_shared/match-v41/rules';
import { buildConfig, calculateMatchV32 } from '../../../supabase/functions/_shared/match-fallback/engine';

const HERE = dirname(fileURLToPath(import.meta.url));

interface TaxonomyFixture {
  taxonomy: unknown[];
  synonyms: { canonical_name: string; synonym: string; confidence: number; bidirectional: boolean }[];
}

const FIXTURE: TaxonomyFixture = JSON.parse(
  readFileSync(resolve(HERE, '../../golden/matching/taxonomy.fixture.json'), 'utf8'),
);

type DataReality = 'as-deployed' | 'ideal';

export function toDbCandidateV32(c: GoldenCandidate, reality: DataReality, referenceNowMs: number) {
  const availabilityDate =
    c.availability_in_days === null
      ? null
      : new Date(referenceNowMs + c.availability_in_days * 86_400_000).toISOString().slice(0, 10);
  return {
    id: c.id,
    job_title: c.job_title,
    skills: c.skills,
    experience_years: c.experience_years,
    seniority: c.seniority,
    expected_salary: c.expected_salary,
    salary_expectation_min: c.salary_expectation_min,
    availability_date: availabilityDate,
    remote_preference: c.remote_preference,
    work_model: c.work_model,
    max_commute_minutes: c.max_commute_minutes,
    industry_experience: c.industry_experience,
    visa_required: c.visa_required,
    // wie v31: Spalten existieren, werden live aber nie beschrieben
    language_skills: reality === 'ideal' ? c.languages : [],
    certifications: reality === 'ideal' ? c.certifications : [],
    // live vorhanden, von v3.1 ungelesen (nur mit F1 bzw. F2 ausgewertet)
    candidate_languages: c.languages.map((l) => ({ language: l.language, proficiency: l.level })),
    certificates: c.certifications,
  };
}

export function toDbJobV32(j: GoldenJob, reality: DataReality) {
  const base = {
    id: j.id,
    title: j.title,
    industry: j.industry,
    skills: j.skills,
    must_haves: j.must_haves,
    nice_to_haves: j.nice_to_haves,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    experience_level: j.experience_level,
    remote_type: j.remote_type,
    work_model: j.work_model,
    onsite_required: j.onsite_required,
    required_languages: j.required_languages,
    required_certifications: j.required_certifications,
    location: j.location,
  };
  if (reality === 'ideal') {
    return { ...base, visa_sponsorship: j.visa_sponsorship, experience_min: j.experience_min, experience_max: j.experience_max };
  }
  return base;
}

interface V32Raw {
  overall: number;
  killed: boolean;
  excluded: boolean;
  policy: string;
  gates?: { hardKills?: Record<string, boolean> };
  v32?: { excludedBy?: string };
}

function reasonOf(raw: V32Raw): string | undefined {
  if (raw.killed) {
    const kills = raw.gates?.hardKills ?? {};
    const category = Object.keys(kills).find((k) => kills[k]);
    return category ? `kill:${category}` : 'kill:unknown';
  }
  if (raw.excluded) return raw.v32?.excludedBy === 'family' ? 'excluded:family' : 'excluded';
  return undefined;
}

export function makeV32Variant(opts: {
  name: string;
  description: string;
  flags: V32Flags;
  reality?: DataReality;
}): MatcherAdapter {
  const config = buildConfig(null); // Code-Defaults = Live-Config seit 2026-07-18
  const reality = opts.reality ?? 'as-deployed';
  let synonymMap = new Map<string, Set<string>>();
  return {
    name: opts.name,
    description: opts.description,
    prepare() {
      synonymMap = buildSynonymMap(FIXTURE.synonyms as never);
    },
    scorePair(candidate: GoldenCandidate, jobEntity: GoldenJob, ctx: AdapterContext): PairScore {
      const raw = calculateMatchV32(
        toDbCandidateV32(candidate, reality, ctx.referenceNowMs),
        toDbJobV32(jobEntity, reality),
        reality === 'ideal' ? jobEntity.skill_requirements : [],
        FIXTURE.taxonomy as never[],
        config,
        'preview',
        { flags: opts.flags, nowMs: ctx.referenceNowMs, synonymMap },
      ) as V32Raw;
      return {
        score: raw.overall,
        killed: raw.killed,
        excluded: raw.excluded,
        reason: reasonOf(raw),
        policy: raw.policy,
        raw,
      };
    },
  };
}

/** Schalter, die in Ablationen einzeln an/aus gehen (F4domain folgt F4). */
export const FIX_KEYS = ['F1', 'F1b', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'] as const;
type FixKey = (typeof FIX_KEYS)[number];

function withFix(base: V32Flags, key: FixKey, on: boolean): V32Flags {
  const f = { ...base, [key]: on };
  if (key === 'F4') f.F4domain = on;
  return f;
}

export const v32All = makeV32Variant({
  name: 'v32-all',
  description: 'V3.2-Prototyp mit ALLEN Fixes (F1–F8 inkl. F1b, F4domain), Code-Default-Config, as-deployed+ Daten (candidate_languages/certificates lesbar).',
  flags: ALL_FIXES,
});

export const v32AllIdeal = makeV32Variant({
  name: 'v32-all-ideal',
  description: 'Wie v32-all, aber mit idealen Inputs (Phantom-Spalten, language_skills, certifications) — Vergleich zu v31-ideal-inputs.',
  flags: ALL_FIXES,
  reality: 'ideal',
});

export const v32NoFixes = makeV32Variant({
  name: 'v32-no-fixes',
  description: 'Kontrollvariante: v3.2-Code mit allen Flags AUS — muss exakt v31-code-defaults entsprechen.',
  flags: NO_FIXES,
});

export const v32LegacyDomain = makeV32Variant({
  name: 'v32-all-legacy-domain',
  description: 'Wie v32-all, aber Tech-Domain-Erkennung mit Legacy-Substring (F4domain aus) — trennt die beiden F4-Teile.',
  flags: { ...ALL_FIXES, F4domain: false },
});

/** Leave-one-out: alle Fixes außer einem. */
export const V32_MINUS: MatcherAdapter[] = FIX_KEYS.map((k) =>
  makeV32Variant({ name: `v32-minus-${k}`, description: `v32-all ohne ${k} (Ablation).`, flags: withFix(ALL_FIXES, k, false) }),
);

/** Einzel-Fix: v3.1-Verhalten + genau ein Fix. */
export const V32_ONLY: MatcherAdapter[] = FIX_KEYS.map((k) =>
  makeV32Variant({ name: `v32-only-${k}`, description: `v3.1 + nur ${k} (Einzel-Fix).`, flags: withFix(NO_FIXES, k, true) }),
);

export const ALL_V32_ADAPTERS: MatcherAdapter[] = [
  v32All,
  v32AllIdeal,
  v32NoFixes,
  v32LegacyDomain,
  ...V32_MINUS,
  ...V32_ONLY,
];
