import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v31CodeDefaults, v31IdealInputs } from '../v31-baseline';
import { parseDataset } from '../../lib/evaluate';
import type { MatcherAdapter } from '../types';
import { buildSynonymMap } from '../v31-baseline/matcher';
import { ALL_FIXES, NO_FIXES } from '../../../supabase/functions/_shared/match-v41/rules';
import { makeV32Variant, v32NoFixes } from './index';
import { buildConfig, calculateMatchV32 } from '../../../supabase/functions/_shared/match-fallback/engine';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f: string) => parseDataset(readFileSync(resolve(HERE, '../../golden/matching', f), 'utf8'));
const FIXTURE = JSON.parse(readFileSync(resolve(HERE, '../../golden/matching/taxonomy.fixture.json'), 'utf8'));
const NOW = Date.parse('2026-07-18T12:00:00.000Z');

function silenced<T>(fn: () => T): T {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

function allScores(adapter: MatcherAdapter, dataset: ReturnType<typeof load>) {
  const ctx = { dataset, referenceNowMs: Date.parse(dataset.reference_date) };
  adapter.prepare?.(ctx);
  return silenced(() =>
    dataset.jobs.flatMap((j) =>
      dataset.candidates.map((c) => {
        const p = adapter.scorePair(c, j, ctx);
        return `${j.id}|${c.id}|${p.score}|${p.killed}|${p.excluded}|${p.policy}|${p.reason ?? ''}`;
      }),
    ),
  );
}

describe('v3.2 mit allen Flags AUS ≡ eingefrorene v3.1-Replika', () => {
  for (const file of ['dataset.v1.json', 'dataset.real.v1.json']) {
    it(`identische Scores/Kills/Policies für alle Paare (${file}, as-deployed)`, () => {
      const ds = load(file);
      expect(allScores(v32NoFixes, ds)).toEqual(allScores(v31CodeDefaults, ds));
    });
    it(`identisch auch mit idealen Inputs (${file})`, () => {
      const ds = load(file);
      const v32Ideal = makeV32Variant({ name: 'x', description: 'x', flags: NO_FIXES, reality: 'ideal' });
      expect(allScores(v32Ideal, ds)).toEqual(allScores(v31IdealInputs, ds));
    });
  }
});

describe('v3.2 Verhalten einzelner Fixes (Matcher-Ebene)', () => {
  const config = buildConfig(null);
  const synonymMap = buildSynonymMap(FIXTURE.synonyms);
  const run = (candidate: object, job: object, flags = ALL_FIXES) =>
    calculateMatchV32(
      { id: 'c', skills: ['React', 'TypeScript'], experience_years: 5, job_title: 'Frontend Developer', ...candidate },
      { id: 'j', title: 'Frontend Developer', must_haves: ['React'], skills: [], nice_to_haves: [], ...job },
      [],
      FIXTURE.taxonomy,
      config,
      'preview',
      { flags, nowMs: NOW, synonymMap },
    );

  it('F5: Stelle ohne Must-haves → Coverage unbekannt, höchstens maybe, confidence gesetzt', () => {
    const r = run({ expected_salary: 60000, availability_date: '2026-07-20' }, { must_haves: [], salary_max: 70000 });
    expect(r.v32.coverageKnown).toBe(false);
    expect(['maybe', 'hidden']).toContain(r.policy);
    expect(r.v32.confidence).toBeGreaterThan(0);
    expect(r.v32.confidence).toBeLessThan(1);
  });

  it('F6: ohne Gehalts-/Startdaten kein Positiv-Text „im Budget"/„kurzfristig verfügbar"', () => {
    const withFix = run({}, { salary_max: 70000 });
    expect(withFix.explainability.topReasons.join(' ')).not.toMatch(/Budget|verfügbar/);
    const legacy = run({}, { salary_max: 70000 }, NO_FIXES);
    expect(legacy.explainability.topReasons.join(' ')).toMatch(/Budget/);
  });

  it('F3: fehlende visa_sponsorship-Spalte killt nicht mehr, sondern erzeugt einen Hinweis', () => {
    expect(run({ visa_required: true }, {}, NO_FIXES).killed).toBe(true);
    const r = run({ visa_required: true }, {});
    expect(r.killed).toBe(false);
    expect(r.v32.risks.join(' ')).toMatch(/Sponsoring/);
    expect(run({ visa_required: true }, { visa_sponsorship: false }).killed).toBe(true);
  });

  it('F7: notice_period wird genutzt, 3 Monate kosten nicht mehr ×0.4', () => {
    const r = run({ notice_period: '3_months' }, {});
    expect(r.v32.startSource).toBe('notice_period');
    expect(r.gates.dealbreakers.startDate).toBeGreaterThanOrEqual(0.9);
  });

  it('F8: fachfremd ohne Skill-Überschneidung → hidden + Begründung', () => {
    const r = run(
      { job_title: 'Kesselwärter / Objekt Betreuer', skills: ['Qualitätsprüfung', 'Instandhaltung', 'Excel'] },
      { title: 'Frontend Developer (React/Vue)', must_haves: ['React', 'TypeScript'] },
    );
    expect(r.policy).toBe('hidden');
    expect(r.v32.excludedBy).toBe('family');
    expect(r.explainability.whyNot).toMatch(/Berufsfeld/);
    // v3.1 fand „typescript" über das Synonym „ts" in „Qualitätsprüfung"
    const legacy = run(
      { job_title: 'Kesselwärter / Objekt Betreuer', skills: ['Qualitätsprüfung', 'Instandhaltung', 'Excel'] },
      { title: 'Frontend Developer (React/Vue)', must_haves: ['React', 'TypeScript'] },
      NO_FIXES,
    );
    expect(legacy.fit.details.skills.matched).toContain('typescript');
  });

  it('F1: Sprachdaten aus candidate_languages; fehlende Daten killen nicht', () => {
    const job = { required_languages: [{ code: 'de', minLevel: 'c1' }] };
    expect(run({}, job, NO_FIXES).killed).toBe(true); // v3.1: language_skills leer → Kill
    expect(run({}, job).killed).toBe(false);
    expect(run({ candidate_languages: [{ language: 'Deutsch', proficiency: 'Muttersprache' }] }, job).v32.languageChecks[0].status).toBe('met');
    expect(run({ candidate_languages: [{ language: 'Deutsch', proficiency: 'Grundkenntnisse' }] }, job).killed).toBe(true);
  });
});
