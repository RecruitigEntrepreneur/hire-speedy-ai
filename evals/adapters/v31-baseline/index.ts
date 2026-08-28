/**
 * Baseline-Adapter: eingefrorene V3.1-Replika in drei Varianten.
 *
 * Die Varianten unterscheiden sich in (a) der matching_config und (b) der
 * Daten-Realität, die die Engine zu sehen bekommt — die Golden-Wahrheit ist
 * identisch. So lässt sich beziffern, wie viel Qualität heute an Config- und
 * Datendefekten verloren geht (Phase-0-Befunde K/D-Serie):
 *
 * 1. v31-live-config   — Live-Zustand BIS 2026-07-18: die aktive v3.0-Config-
 *    Zeile (Seed 20251213) + Spalten-Defaults aus 20260114. Deren
 *    fit_breakdown hatte KEINEN seniority-Key → totalWeight NaN → der
 *    NaN-Fallback in calculateFitScore setzte Fit=50 und Coverage=1.0 für
 *    alle. Am 2026-07-17/18 per DB-Abfrage VERIFIZIERT (Zeile e55ba13d…) und
 *    per Config-Update auf Code-Defaults GEFIXT (Backup-Zeile 859a697e…,
 *    profile='backup-20260718'). Bleibt als historische Referenz und
 *    Impact-Nachweis erhalten.
 * 2. v31-code-defaults — configData=null → die im Code hinterlegten Defaults.
 *    Seit dem Config-Fix ist DAS der Live-Zustand → CI-Baseline.
 *    Datenrealität weiterhin "as-deployed" (s. u.), per DB verifiziert:
 *    0/54 Kandidaten mit language_skills/certifications, 0/27 Jobs mit
 *    required_languages/required_certifications, Phantom-Spalten fehlen.
 * 3. v31-ideal-inputs  — Code-Defaults + vollständige Inputs: Phantom-Spalten
 *    (visa_sponsorship, experience_min/max) vorhanden, language_skills und
 *    certifications befüllt, job_skill_requirements durchgereicht.
 *
 * Live-Datenrealität (Varianten 1+2):
 * - jobs.visa_sponsorship / experience_min / experience_max: undefined
 *   (Migration 20260619 nicht deployed) → Visa-Kill feuert für JEDEN
 *   visa_required-Kandidaten; Erfahrungs-Score läuft auf 0/20-Defaults.
 * - candidates.language_skills = [] und certifications = [] (Spalten
 *   existieren seit 20260114 mit Default, werden aber nirgends beschrieben)
 *   → Jobs mit required_languages/required_certifications killen ALLE.
 * - job_skill_requirements: leer (nur Studio-Jobs hätten Zeilen).
 * - candidates.visa_required: als befüllt angenommen (Submit-Formular).
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AdapterContext, MatcherAdapter, PairScore } from '../types';
import type { GoldenCandidate, GoldenJob } from '../../golden/matching/schema';
import { buildConfig, buildSynonymMap, calculateMatch, setSynonymMap } from './matcher';

const HERE = dirname(fileURLToPath(import.meta.url));

interface TaxonomyFixture {
  taxonomy: unknown[];
  synonyms: { canonical_name: string; synonym: string; confidence: number; bidirectional: boolean }[];
}

const FIXTURE: TaxonomyFixture = JSON.parse(
  readFileSync(resolve(HERE, '../../golden/matching/taxonomy.fixture.json'), 'utf8'),
);

/**
 * Wahrscheinlichste Live-Config: Seed-Zeile v3.0 (20251213030355, Zeilen
 * 152-155) + Spalten-Defaults aus 20260114011942 für die dort neu
 * hinzugefügten Spalten. Zu verifizieren per DB-Export, sobald Zugang besteht.
 */
const LIVE_CONFIG_ROW = {
  weights: {
    fit: 0.6,
    constraints: 0.4,
    fit_breakdown: { skills: 0.5, experience: 0.3, industry: 0.2 }, // seniority fehlt → NaN-Fallback!
    constraint_breakdown: { salary: 0.4, commute: 0.35, startDate: 0.25 },
  },
  gate_thresholds: {
    salary_warn_percent: 15,
    salary_fail_percent: 35,
    commute_warn_minutes: 45,
    commute_fail_minutes: 75,
    availability_warn_days: 60,
    availability_fail_days: 120,
    min_skill_match_percent: 30,
  },
  hard_kill_defaults: {
    visa_required: true,
    language_required: true,
    onsite_required: true,
    license_required: true,
  },
  dealbreaker_multipliers: {
    salary: [
      { min: 0, max: 10, multiplier: 0.6 },
      { min: 10, max: 20, multiplier: 0.3 },
      { min: 20, max: 30, multiplier: 0.15 },
      { min: 30, max: 999, multiplier: 0.05 },
    ],
    start_date: [
      { min: 14, max: 30, multiplier: 0.7 },
      { min: 30, max: 60, multiplier: 0.4 },
      { min: 60, max: 999, multiplier: 0.2 },
    ],
    seniority: [
      { gap: 1, multiplier: 0.6 },
      { gap: 2, multiplier: 0.25 },
      { gap: 3, multiplier: 0.1 },
    ],
  },
  display_policies: {
    hot: { minScore: 85, minCoverage: 0.85, maxBlockers: 0, requiresMultiplier1: true },
    standard: { minScore: 75, minCoverage: 0.7, maxBlockers: 0, requiresMultiplier1: false },
    maybe: { minScore: 65, minCoverage: 0.6, maxBlockers: 1, requiresMultiplier1: false },
  },
};

type DataReality = 'as-deployed' | 'ideal';

function toDbCandidate(c: GoldenCandidate, reality: DataReality, referenceNowMs: number) {
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
    // Live: Spalten existieren (Defaults), werden aber nie beschrieben.
    language_skills: reality === 'ideal' ? c.languages : [],
    certifications: reality === 'ideal' ? c.certifications : [],
  };
}

function toDbJob(j: GoldenJob, reality: DataReality) {
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
    return {
      ...base,
      visa_sponsorship: j.visa_sponsorship,
      experience_min: j.experience_min,
      experience_max: j.experience_max,
    };
  }
  // Live: Phantom-Spalten fehlen in der DB → select * liefert sie nicht.
  return base;
}

/** Minimale strukturelle Sicht auf V31MatchResult (Replika ist @ts-nocheck). */
interface V31RawResult {
  overall: number;
  killed: boolean;
  excluded: boolean;
  policy: string;
  gates?: { hardKills?: Record<string, boolean> };
}

function killReason(raw: V31RawResult): string | undefined {
  if (raw.killed) {
    const kills = raw.gates?.hardKills ?? {};
    const category = Object.keys(kills).find((k) => kills[k]);
    return category ? `kill:${category}` : 'kill:unknown';
  }
  if (raw.excluded) return 'excluded';
  return undefined;
}

interface NormalizedReqsFixture {
  [jobId: string]: { skill_name: string; type: 'must' | 'nice'; weight: number }[];
}

function makeVariant(opts: {
  name: string;
  description: string;
  configRow: unknown | null;
  reality: DataReality;
  /** Simulierter Phase-2.1-Normalizer: kuratierte skill_requirements pro Job-ID. */
  normalizedReqs?: NormalizedReqsFixture;
}): MatcherAdapter {
  const config = buildConfig(opts.configRow);
  return {
    name: opts.name,
    description: opts.description,
    prepare() {
      setSynonymMap(buildSynonymMap(FIXTURE.synonyms as never));
    },
    scorePair(candidate: GoldenCandidate, jobEntity: GoldenJob, ctx: AdapterContext): PairScore {
      const dbCandidate = toDbCandidate(candidate, opts.reality, ctx.referenceNowMs);
      const dbJob = toDbJob(jobEntity, opts.reality);
      const skillReqs =
        opts.normalizedReqs?.[jobEntity.id] ??
        (opts.reality === 'ideal' ? jobEntity.skill_requirements : []);

      // Determinismus: die Replika nutzt Date.now() für Startdatum-Logik.
      const realNow = Date.now;
      Date.now = () => ctx.referenceNowMs;
      let raw: V31RawResult;
      try {
        raw = calculateMatch(dbCandidate, dbJob, skillReqs, FIXTURE.taxonomy as never, config, 'preview');
      } finally {
        Date.now = realNow;
      }

      return {
        score: raw.overall,
        killed: raw.killed,
        excluded: raw.excluded,
        reason: killReason(raw),
        policy: raw.policy,
        raw,
      };
    },
  };
}

export const v31LiveConfig = makeVariant({
  name: 'v31-live-config',
  description:
    'HISTORISCH: Live-Zustand bis zum Config-Fix am 2026-07-18 (v3.0-Config ohne seniority-Key → ' +
    'NaN-Fallback, Fit=50 für alle) + Live-Datenrealität. Verifiziert per DB-Abfrage, dann gefixt.',
  configRow: LIVE_CONFIG_ROW,
  reality: 'as-deployed',
});

export const v31CodeDefaults = makeVariant({
  name: 'v31-code-defaults',
  description:
    'AKTUELLER LIVE-ZUSTAND (seit Config-Fix 2026-07-18) und CI-Baseline: Code-Default-Config + ' +
    'Live-Datenrealität (Phantom-Spalten fehlen, language_skills/certifications leer — DB-verifiziert).',
  configRow: null,
  reality: 'as-deployed',
});

export const v31IdealInputs = makeVariant({
  name: 'v31-ideal-inputs',
  description: 'V3.1-Replika mit Code-Default-Config und vollständigen Inputs (Obergrenze der heutigen Engine bei reparierten Daten).',
  configRow: null,
  reality: 'ideal',
});

const NORMALIZED_REQS: NormalizedReqsFixture = (() => {
  const raw = JSON.parse(
    readFileSync(resolve(HERE, 'normalized-reqs.real-v1.fixture.json'), 'utf8'),
  ) as NormalizedReqsFixture & { _meta?: unknown };
  delete raw._meta;
  return raw;
})();

export const v31NormalizedReqs = makeVariant({
  name: 'v31-normalized-reqs',
  description:
    'WHAT-IF für Phase 2.1: wie v31-code-defaults (aktueller Live-Zustand), aber mit kuratiert ' +
    'normalisierten Anforderungen (Satzfragmente → kanonische Skills) statt roher must_haves. ' +
    'Misst den Hebel der Anforderungs-Normalisierung, bevor der LLM-Normalizer gebaut wird.',
  configRow: null,
  reality: 'as-deployed',
  normalizedReqs: NORMALIZED_REQS,
});

export const ALL_V31_ADAPTERS: MatcherAdapter[] = [
  v31LiveConfig,
  v31CodeDefaults,
  v31IdealInputs,
  v31NormalizedReqs,
];
