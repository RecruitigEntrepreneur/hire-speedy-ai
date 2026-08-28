import { describe, expect, it } from 'vitest';
import {
  BLEND_JUDGE_WEIGHT,
  blendOverall,
  buildJudgeUserPrompt,
  enforceEvidence,
  JUDGE_DIMENSION_WEIGHTS,
  JudgeResult,
  judgeWeightedScore,
  sanitizeSkillRequirements,
} from '../../supabase/functions/_shared/match-v4';

const dim = (score: number, evidence = 'Beleg aus den Daten') => ({ score, evidence });

const judge = (overrides: Partial<JudgeResult> = {}): JudgeResult => ({
  skill_fit: dim(80),
  seniority_fit: dim(70),
  domain_fit: dim(90),
  trajectory_fit: dim(60),
  logistics_fit: dim(100),
  summary: 'Passt gut.',
  red_flags: [],
  ...overrides,
});

describe('enforceEvidence', () => {
  it('Dimension ohne Evidenz wird auf 0 erzwungen', () => {
    const result = enforceEvidence(judge({ skill_fit: { score: 95, evidence: '' } }));
    expect(result.skill_fit.score).toBe(0);
    expect(result.domain_fit.score).toBe(90);
  });
  it('Whitespace-Evidenz zählt nicht als Beleg', () => {
    const result = enforceEvidence(judge({ domain_fit: { score: 88, evidence: '   ' } }));
    expect(result.domain_fit.score).toBe(0);
  });
  it('Scores werden auf [0,100] geklemmt und gerundet', () => {
    const result = enforceEvidence(judge({ skill_fit: dim(150), seniority_fit: dim(-20), trajectory_fit: dim(59.6) }));
    expect(result.skill_fit.score).toBe(100);
    expect(result.seniority_fit.score).toBe(0);
    expect(result.trajectory_fit.score).toBe(60);
  });
});

describe('judgeWeightedScore', () => {
  it('Gewichte summieren zu 1', () => {
    const sum = Object.values(JUDGE_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
  it('gewichtete Summe stimmt (handgerechnet)', () => {
    // 80*.35 + 70*.15 + 90*.2 + 60*.15 + 100*.15 = 28+10.5+18+9+15 = 80.5 → 81
    expect(judgeWeightedScore(judge())).toBe(81);
  });
  it('alle Dimensionen ohne Evidenz ⇒ 0', () => {
    const noEvidence = enforceEvidence(
      judge({
        skill_fit: { score: 90, evidence: '' },
        seniority_fit: { score: 90, evidence: '' },
        domain_fit: { score: 90, evidence: '' },
        trajectory_fit: { score: 90, evidence: '' },
        logistics_fit: { score: 90, evidence: '' },
      }),
    );
    expect(judgeWeightedScore(noEvidence)).toBe(0);
  });
});

describe('blendOverall', () => {
  it('kombiniert V3.1 und Judge mit dem gepinnten Gewicht', () => {
    expect(blendOverall(60, 100)).toBe(Math.round(60 * (1 - BLEND_JUDGE_WEIGHT) + 100 * BLEND_JUDGE_WEIGHT));
  });
  it('klemmt Eingaben auf [0,100]', () => {
    expect(blendOverall(150, -10)).toBe(Math.round(100 * (1 - BLEND_JUDGE_WEIGHT)));
  });
});

describe('sanitizeSkillRequirements', () => {
  it('lowercased, dedupliziert, gewichtet must=1.0 / nice=0.5', () => {
    const out = sanitizeSkillRequirements([
      { skill_name: 'DATEV', type: 'must' },
      { skill_name: 'datev', type: 'nice' },
      { skill_name: 'Buchhaltung', type: 'nice' },
    ]);
    expect(out).toEqual([
      { skill_name: 'datev', type: 'must', weight: 1.0 },
      { skill_name: 'buchhaltung', type: 'nice', weight: 0.5 },
    ]);
  });
  it('verwirft Leer-/Mini-Namen und unbekannte Typen werden nice', () => {
    const out = sanitizeSkillRequirements([
      { skill_name: '', type: 'must' },
      { skill_name: 'x', type: 'must' },
      { skill_name: 'python', type: 'weird' },
    ]);
    expect(out).toEqual([{ skill_name: 'python', type: 'nice', weight: 0.5 }]);
  });
  it('begrenzt auf max. 8 musts / 20 gesamt', () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ skill_name: `skill-${i}`, type: i < 15 ? 'must' : 'nice' }));
    const out = sanitizeSkillRequirements(raw);
    expect(out.filter((r) => r.type === 'must')).toHaveLength(8);
    expect(out.length).toBeLessThanOrEqual(20);
  });
  it('null/undefined ⇒ leer', () => {
    expect(sanitizeSkillRequirements(null)).toEqual([]);
    expect(sanitizeSkillRequirements(undefined)).toEqual([]);
  });
});

describe('buildJudgeUserPrompt', () => {
  it('trennt Daten-Sektionen klar (Prompt-Injection-Hygiene)', () => {
    const prompt = buildJudgeUserPrompt('{"skills":["java"]}', 'Titel: Backend', 'Score: 70');
    expect(prompt).toContain('=== KANDIDATENPROFIL (Daten) ===');
    expect(prompt).toContain('=== STELLE (Daten) ===');
    expect(prompt).toContain('=== VORBEWERTUNG REGELBASIERTE ENGINE V3.1 (Daten) ===');
    expect(prompt.indexOf('KANDIDATENPROFIL')).toBeLessThan(prompt.indexOf('STELLE'));
  });
});
