/**
 * Baut dataset.real.v1.json aus dem Lovable-DB-Export (2026-07-18).
 *
 * Eingabe: candidates.json, jobs.json, submissions.json, lang.json
 * (Standard: ~/Downloads, überschreibbar mit --in <dir>). Die Rohdateien
 * werden NICHT committet — nur das pseudonymisierte Ergebnis.
 *
 * Klassifikation (Datenhygiene, siehe _meta.exclusions im Output):
 * - Demo-Seeds: IDs mit Mustern aaaa…/bbbb… (Kandidaten/Submissions) bzw.
 *   11111111-…–66666666-… (Jobs) sind handgemachte Testdaten → raus.
 * - Test-Artefakte: Job „teststadt", Job mit 600k–5M-Gehalt („top hunter") → raus.
 * - Ein Label zählt nur, wenn Kandidat UND Job produktiv sind.
 *
 * Pseudonymisierung:
 * - IDs → sha256-Kürzel (real-c-… / real-j-…), ohne DB-Kenntnis nicht rückführbar.
 * - candidates.city → null (Datenminimierung; V3.1 nutzt es nicht fürs Scoring).
 * - Es werden nur Matching-Felder übernommen, keine Freitexte/Namen (bereits
 *   im Export so beschränkt).
 *
 * Aufruf: npx tsx evals/golden/matching/build-real-dataset.ts [--in <dir>]
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GoldenCandidate,
  GoldenDataset,
  GoldenDatasetSchema,
  GoldenJob,
  GoldenLabel,
} from './schema';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'dataset.real.v1.json');
const REFERENCE_DATE = '2026-07-18T12:00:00.000Z';
const REFERENCE_MS = Date.parse(REFERENCE_DATE);

// ---------------------------------------------------------------------------
// Roh-Formate des Exports
// ---------------------------------------------------------------------------

interface RawCandidate {
  id: string;
  job_title: string | null;
  skills: string[] | null;
  experience_years: number | null;
  seniority: string | null;
  expected_salary: number | null;
  salary_expectation_min: number | null;
  availability_date: string | null;
  remote_preference: string | null;
  work_model: string | null;
  city: string | null;
  max_commute_minutes: number | null;
  industry_experience: string[] | null;
  visa_required: boolean;
}

interface RawJob {
  id: string;
  title: string;
  industry: string | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  experience_level: string | null;
  remote_type: string | null;
  onsite_required: boolean;
  location: string | null;
  required_languages: { code: string; minLevel?: string }[];
  required_certifications: string[];
}

interface RawSubmission {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  submitted_on: string;
}

interface RawLanguage {
  candidate_id: string;
  language: string;
  level: string;
}

// ---------------------------------------------------------------------------
// Klassifikation
// ---------------------------------------------------------------------------

const SEED_CANDIDATE_RE = /^aaaa/;
const SEED_JOB_RE = /^(11111111|22222222|33333333|44444444|55555555|66666666)-/;

/** Manuell identifizierte Test-Artefakte mit Begründung. */
const TEST_ARTIFACT_JOBS: Record<string, string> = {
  '2c4c9f21-aa8d-43ad-95a2-12d7ad98bee7': 'location="teststadt"',
  '6490d139-e7ad-49a3-a1df-449cf0da4631': 'Gehalt 600k-5M, must_have "top hunter"',
};

const STATUS_TO_LABEL: Record<string, GoldenLabel['label']> = {
  hired: 'hired',
  interview: 'interviewed',
  submitted: 'submitted',
  rejected: 'rejected',
};

function pseudo(prefix: string, uuid: string): string {
  return `${prefix}-${createHash('sha256').update(uuid).digest('hex').slice(0, 10)}`;
}

function daysFromReference(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((Date.parse(`${dateStr}T12:00:00.000Z`) - REFERENCE_MS) / 86_400_000);
}

function main(): void {
  const args = process.argv.slice(2);
  const inDir = args.includes('--in') ? args[args.indexOf('--in') + 1] : resolve(homedir(), 'Downloads');
  const load = <T>(name: string): T => JSON.parse(readFileSync(resolve(inDir, name), 'utf8')) as T;

  const rawCandidates = load<RawCandidate[]>('candidates.json');
  const rawJobs = load<RawJob[]>('jobs.json');
  const rawSubmissions = load<RawSubmission[]>('submissions.json');
  const rawLanguages = load<RawLanguage[]>('lang.json');

  const langByCandidate = new Map<string, { language: string; level: string }[]>();
  for (const l of rawLanguages) {
    const list = langByCandidate.get(l.candidate_id) ?? [];
    list.push({ language: l.language, level: l.level });
    langByCandidate.set(l.candidate_id, list);
  }

  // Klassifizieren
  const prodCandidates = rawCandidates.filter((c) => !SEED_CANDIDATE_RE.test(c.id));
  const prodJobs = rawJobs.filter((j) => !SEED_JOB_RE.test(j.id) && !(j.id in TEST_ARTIFACT_JOBS));
  const prodCandidateIds = new Set(prodCandidates.map((c) => c.id));
  const prodJobIds = new Set(prodJobs.map((j) => j.id));

  const droppedSubmissions: { id: string; reason: string }[] = [];
  const prodSubmissions = rawSubmissions.filter((s) => {
    if (!prodCandidateIds.has(s.candidate_id)) {
      droppedSubmissions.push({ id: s.id, reason: 'Demo-Seed-Kandidat' });
      return false;
    }
    if (!prodJobIds.has(s.job_id)) {
      droppedSubmissions.push({ id: s.id, reason: SEED_JOB_RE.test(s.job_id) ? 'Demo-Seed-Job' : 'Test-Artefakt-Job' });
      return false;
    }
    if (!(s.status in STATUS_TO_LABEL)) {
      droppedSubmissions.push({ id: s.id, reason: `unbekannter Status: ${s.status}` });
      return false;
    }
    return true;
  });

  // Konvertieren + pseudonymisieren
  const candidates: GoldenCandidate[] = prodCandidates.map((c) => ({
    id: pseudo('real-c', c.id),
    is_synthetic: false,
    persona: `Echt: ${c.job_title ?? 'ohne Titel'}`,
    job_title: c.job_title,
    skills: c.skills ?? [],
    experience_years: c.experience_years,
    seniority: c.seniority,
    expected_salary: c.expected_salary,
    salary_expectation_min: c.salary_expectation_min,
    availability_in_days: daysFromReference(c.availability_date),
    remote_preference: c.remote_preference,
    work_model: c.work_model,
    city: null, // Datenminimierung; V3.1 nutzt city nicht fürs Scoring
    max_commute_minutes: c.max_commute_minutes,
    industry_experience: c.industry_experience ?? [],
    languages: langByCandidate.get(c.id) ?? [],
    certifications: [], // Spalte existiert, wird nie beschrieben (DB-verifiziert)
    visa_required: c.visa_required,
  }));

  const jobs: GoldenJob[] = prodJobs.map((j) => ({
    id: pseudo('real-j', j.id),
    is_synthetic: false,
    title: j.title,
    industry: j.industry,
    skills: j.skills ?? [],
    must_haves: j.must_haves ?? [],
    nice_to_haves: j.nice_to_haves ?? [],
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    experience_level: j.experience_level,
    experience_min: null, // Phantom-Spalten: existieren in der Live-DB nicht
    experience_max: null,
    visa_sponsorship: null,
    remote_type: j.remote_type,
    work_model: null, // Spalte existiert auf jobs nicht (Export-Hinweis)
    onsite_required: j.onsite_required,
    required_languages: j.required_languages ?? [],
    required_certifications: j.required_certifications ?? [],
    location: j.location,
    skill_requirements: [], // job_skill_requirements ist leer (Export: 0 Zeilen)
  }));

  const labels: GoldenLabel[] = prodSubmissions.map((s) => ({
    job_id: pseudo('real-j', s.job_id),
    candidate_id: pseudo('real-c', s.candidate_id),
    label: STATUS_TO_LABEL[s.status],
  }));

  const counts = {
    hired: labels.filter((l) => l.label === 'hired').length,
    interviewed: labels.filter((l) => l.label === 'interviewed').length,
    submitted: labels.filter((l) => l.label === 'submitted').length,
    rejected: labels.filter((l) => l.label === 'rejected').length,
  };

  const dataset: GoldenDataset & { _meta: Record<string, unknown> } = {
    _meta: {
      source: 'Lovable-DB-Export 2026-07-18 (read-only, PII-minimiert)',
      pseudonymized: 'IDs sha256-gekürzt; candidates.city entfernt',
      exclusions: {
        seed_candidates: rawCandidates.length - prodCandidates.length,
        seed_and_test_jobs: rawJobs.length - prodJobs.length,
        test_artifact_jobs: TEST_ARTIFACT_JOBS,
        dropped_submissions: droppedSubmissions,
      },
      label_counts: counts,
      note:
        'Echte Produktionsdaten. Keine hired-Labels im produktiven Anteil ' +
        '(beide hired-Outcomes waren Demo-Seeds). Sprach-Level nutzen die ' +
        'DB-Werte (native/fluent/…), NICHT die a1–c2-Skala des Matchers.',
    },
    version: 'real-v1',
    is_synthetic: false,
    reference_date: REFERENCE_DATE,
    description:
      'Echtes Golden-Dataset aus Submission-Outcomes (pseudonymisiert). ' +
      'Labels: interviewed=2, submitted=1 (Positives), rejected=0 (Hard-Negatives). ' +
      'Demo-Seeds und Test-Artefakte ausgeschlossen (siehe _meta).',
    jobs,
    candidates,
    labels,
  };

  GoldenDatasetSchema.parse(dataset);
  writeFileSync(OUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  console.log(
    `dataset.real.v1.json geschrieben: ${jobs.length} Jobs, ${candidates.length} Kandidaten, ` +
      `${labels.length} Labels (${counts.interviewed} interviewed, ${counts.submitted} submitted, ` +
      `${counts.rejected} rejected, ${counts.hired} hired); ` +
      `ausgeschlossen: ${rawCandidates.length - prodCandidates.length} Seed-Kandidaten, ` +
      `${rawJobs.length - prodJobs.length} Seed-/Test-Jobs, ${droppedSubmissions.length} Submissions`,
  );
}

main();
