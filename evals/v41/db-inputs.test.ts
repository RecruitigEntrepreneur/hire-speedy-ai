/**
 * V4.1 – Datenbankzeilen → Pipeline-Eingaben (db-inputs.ts).
 */

import { describe, expect, it } from 'vitest';
import { candidateInputFromRows, companyMaskTokens, jobInputFromRow, maskCompany, names, parseMoney, redactedCandidateText } from '../../supabase/functions/_shared/match-v41/db-inputs';
import type { LLMView } from '../../supabase/functions/_shared/pii-redaction';

const NOW = Date.UTC(2026, 8, 30);

const view = (over: Partial<LLMView> = {}): LLMView => ({
  nameLabel: '[KANDIDAT]', job_title: 'Controller', employer_alias: '[Arbeitgeber A]', seniority: 'senior', experience_years: 7,
  region: 'DACH', location_relation: '', salary_min: null, salary_max: null, remote_preference: null, skills: [], certifications: [],
  skillsDetailed: [], languages: [], cvSummary: null, experiences: [], interview: null, priorAssessment: null, ...over,
});

describe('Kundenname maskieren (Triple-Blind)', () => {
  it('ersetzt vollen Namen und markante Namensteile, nicht Wortteile', () => {
    const t = companyMaskTokens('Medtech Beta GmbH');
    expect(maskCompany('Die Medtech Beta GmbH sucht … Produkte von Medtech Beta. Betablocker bleiben.', t))
      .toBe('Die [Kunde] sucht … Produkte von [Kunde]. Betablocker bleiben.');
    expect(maskCompany('Kenntnisse im Alphabet', companyMaskTokens('Alpha AG'))).toBe('Kenntnisse im Alphabet');
  });

  it('kurze oder fehlende Namen maskieren nichts Falsches', () => {
    expect(companyMaskTokens(null)).toEqual([]);
    expect(maskCompany('SAP CO', companyMaskTokens('AB GmbH'))).toBe('SAP CO');
  });

  it('Stelle: Kundenname verschwindet aus allen Texten, die an die KI gehen', () => {
    const input = jobInputFromRow({
      title: 'Controller bei Kanna Medics', company_name: 'Kanna Medics GmbH', description: 'Kanna Medics wächst.',
      must_have_criteria: ['Erfahrung mit Kanna-Medics-Produkten'], must_haves: ['SAP CO'],
    }, NOW);
    expect(JSON.stringify(input)).not.toMatch(/Kanna Medics|Medics/);
    expect(input.client_must).toEqual(['Erfahrung mit [Kunde]-[Kunde]-Produkten']);
  });
});

describe('Geldbeträge aus Freitext', () => {
  it.each([
    ['65.000', 65000], ['65k', 65000], ['ca. 70000 €', 70000], ['70–75k', 70000], ['65 T€', 65000], ['72,5k', 72500], [80000, 80000],
  ])('%s → %s', (inp, out) => expect(parseMoney(inp)).toBe(out));
  it('Unsinn → null', () => {
    expect(parseMoney('verhandelbar')).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });
});

describe('Stelle aus der Datenbank', () => {
  it('Freelance mit Tagessatz: Basis daily_rate, sonst Jahresgehalt ohne Basis', () => {
    expect(jobInputFromRow({ title: 'SAP FI Freelancer', employment_type: 'freelance', day_rate_min: 800, day_rate_max: 1000, salary_min: 90000 }, NOW))
      .toMatchObject({ salary_min: 800, salary_max: 1000, salary_basis: 'daily_rate' });
    expect(jobInputFromRow({ title: 'Buchhalter', salary_min: 50000, salary_max: 60000 }, NOW))
      .toMatchObject({ salary_min: 50000, salary_max: 60000, salary_basis: null });
  });

  it('dringend nur mit Dringlichkeitsangabe, Frist aus dem Stichtag', () => {
    expect(jobInputFromRow({ title: 'x', hiring_urgency: 'urgent', hiring_deadline: '2026-11-29' }, NOW).urgent_within_days).toBe(60);
    expect(jobInputFromRow({ title: 'x', hiring_urgency: 'normal', hiring_deadline: '2026-10-10' }, NOW).urgent_within_days).toBeNull();
  });

  it('Kunden-Einstufung und Sprachen werden übernommen', () => {
    const j = jobInputFromRow({
      title: 'x', must_have_criteria: ['DATEV'], nice_to_have_criteria: ['IFRS'], trainable_skills: ['S/4HANA'],
      required_languages: [{ code: 'de', minLevel: 'C1' }],
    }, NOW);
    expect([j.client_must, j.client_nice, j.client_trainable]).toEqual([['DATEV'], ['IFRS'], ['S/4HANA']]);
    expect(j.required_languages).toEqual([{ code: 'de', language: undefined, minLevel: 'C1', source: undefined }]);
  });
});

describe('Kandidat aus der Datenbank', () => {
  it('Stationen nur mit Dauer, keine Daten; Arbeitgeber als Alias', () => {
    const text = redactedCandidateText(view({
      experiences: [
        { job_title: 'Controller', employer_alias: '[Arbeitgeber A]', region: 'DACH', start_date: '2020-10-01', end_date: null, description: 'Werkscontrolling, SAP CO-PA' },
        { job_title: 'Junior Controller', employer_alias: '[Arbeitgeber B]', region: 'DACH', start_date: '2017-01-01', end_date: '2020-09-30', description: null },
      ],
    }), { leadership_scope: 'disciplinary', leadership_team_size: 4 }, NOW);
    expect(text).toContain('Station: Controller, bei [Arbeitgeber A], 6 Jahre, aktuell – Werkscontrolling, SAP CO-PA');
    expect(text).toContain('Station: Junior Controller, bei [Arbeitgeber B], 3.7 Jahre');
    expect(text).toContain('Führung: disziplinarisch, 4 Mitarbeitende');
    expect(text).not.toMatch(/2017|2020/);
  });

  it('Untergrenze aus dem Interview, Sprachen aus candidate_languages, Rückfall auf jsonb', () => {
    const c = { job_title: 'Controller', skills: ['SAP CO'], certifications: ['Controller IHK'], certificates: [{ name: 'Bilanzbuchhalter IHK' }], expected_salary: 80000, city: 'Hamburg', recruiter_id: 'r', language_skills: [{ language: 'Englisch', level: 'C1' }] };
    const withRows = candidateInputFromRows(c, view(), [{ language: 'Deutsch', proficiency: 'Muttersprache' }], { salary_minimum: '72k', notice_period: '3_months' }, NOW);
    expect(withRows).toMatchObject({ salary_minimum: 72000, expected_salary: 80000, notice_period: '3_months', certificates: ['Controller IHK', 'Bilanzbuchhalter IHK'], languages: [{ language: 'Deutsch', proficiency: 'Muttersprache' }] });
    expect(candidateInputFromRows(c, view(), [], null, NOW).languages).toEqual([{ language: 'Englisch', proficiency: 'C1' }]);
  });

  it('Listen aus text[] und jsonb', () => {
    expect(names(['Hamburg', { city: 'Stuttgart' }, { name: 'Berlin' }, ''], 'city')).toEqual(['Hamburg', 'Stuttgart', 'Berlin']);
    expect(names('["Automobil"]')).toEqual(['Automobil']);
    expect(names(null)).toEqual([]);
  });
});
