import { describe, expect, it } from 'vitest';
import { careerSignals, startYearFromCvText } from './careerSignals';
import { belowLevel, detectRoleFamily, NOTICE_HINT, whyNowChips } from './roleFamily';
import { minimumChips, roundSalary, salaryWarnings, wishChips } from './salaryChips';
import { clientTextIssues } from './clientTextCheck';
import { emptyDossier } from './cvImport';

const today = new Date(2026, 9, 16);

const marko = [
  { job_title: 'Geschäftsführer & CEO', company_name: 'Global Strategy Group GmbH', start_date: null, end_date: null, is_current: null },
  { job_title: 'Managing Director', company_name: 'International Investment Holdings AG', start_date: '2000-01-01', end_date: '2008-01-01', is_current: null },
  { job_title: 'Senior Manager Corporate Development', company_name: 'European Industries Group', start_date: '1995-01-01', end_date: '2000-01-01', is_current: null },
];

describe('Werdegang', () => {
  it('liest das Startjahr der aktuellen Station aus dem Lebenslauf-Text', () => {
    const cv = 'Geschäftsführer & CEO – Global Strategy Group GmbH (2008 – heute)\nManaging Director – International Investment Holdings AG (2000 – 2008)';
    expect(startYearFromCvText(cv, 'Global Strategy Group GmbH')).toBe(2008);
    expect(startYearFromCvText('Seit 03/2019 bei Muster Software GmbH', 'Muster Software GmbH')).toBe(2019);
  });

  it('erkennt 18 Jahre im aktuellen Unternehmen und hakt bei „Warum jetzt“ nach', () => {
    const s = careerSignals(marko, { cvText: 'CEO – Global Strategy Group GmbH (2008 – heute)', today });
    expect(s.current?.company).toBe('Global Strategy Group GmbH');
    expect(s.current?.startDerived).toBe('cv_text');
    expect(s.tenureYears).toBe(18);
    expect(s.hooks.find((h) => h.key === 'tenure')?.field).toBe('why_now');
    expect(s.gaps).toHaveLength(0);
  });

  it('nimmt ohne Lebenslauf-Text das Ende der Vorstation als Start', () => {
    const s = careerSignals(marko, { today });
    expect(s.current?.startDerived).toBe('previous_end');
    expect(s.current?.start?.getFullYear()).toBe(2008);
  });

  it('findet kurze Stationen und Lücken, aber nicht Praktika', () => {
    const s = careerSignals([
      { job_title: 'Controller', company_name: 'A GmbH', start_date: '2023-06-01', end_date: null, is_current: true },
      { job_title: 'Controller', company_name: 'B AG', start_date: '2021-01-01', end_date: '2021-11-01', is_current: false },
      { job_title: 'Werkstudent', company_name: 'C GmbH', start_date: '2019-01-01', end_date: '2019-06-01', is_current: false },
      { job_title: 'Buchhalter', company_name: 'D GmbH', start_date: '2018-07-01', end_date: '2020-12-01', is_current: false },
    ], { today });
    expect(s.shortStints.map((x) => x.company)).toEqual(['B AG']);
    expect(s.gaps.length).toBe(1);
    expect(s.gaps[0].months).toBeGreaterThan(6);
    expect(s.hooks.some((h) => h.key === 'gap' && h.chips?.some((c) => c.includes('privat')))).toBe(true);
  });
});

describe('Rollenfamilie', () => {
  it('ordnet Titel richtig zu', () => {
    const f = (job_title: string) => ({ job_title, seniority: null, leadership_scope: null });
    expect(detectRoleFamily(f('Geschäftsführer & CEO'))).toBe('clevel');
    expect(detectRoleFamily(f('Key Account Manager Klinikvertrieb'))).toBe('vertrieb');
    expect(detectRoleFamily(f('Senior Software Engineer'))).toBe('it');
    expect(detectRoleFamily(f('Leiter Controlling'))).toBe('fuehrung');
    expect(detectRoleFamily(f('Pflegefachkraft'))).toBe('gewerblich');
    expect(detectRoleFamily(f('Bilanzbuchhalter'))).toBe('spezialist');
  });

  it('schlägt einem CEO keine Bereichsleitung vor', () => {
    expect(belowLevel('clevel', 'Bereichsleitung')).toBe(true);
    expect(belowLevel('fuehrung', 'Bereichsleitung')).toBe(false);
    expect(whyNowChips('clevel')).toContain('Vertrag läuft aus');
    expect(NOTICE_HINT.clevel?.duration).toBe('6_months');
  });
});

describe('Gehalt per Klick', () => {
  it('rundet und rechnet die Prozente', () => {
    expect(roundSalary(198_000)).toBe(200_000);
    expect(roundSalary(66_400)).toBe(66_000);
    expect(wishChips(180_000, 'spezialist').map((c) => c.value)).toEqual([200_000, 205_000, 215_000]);
    expect(wishChips(180_000, 'clevel')[0].label).toBe('190k (+6 %)');
    expect(minimumChips(200_000, 180_000).map((c) => c.value)).toEqual([190_000, 180_000]);
  });

  it('warnt nur bei Unstimmigem', () => {
    expect(salaryWarnings({ current_salary: 180_000, expected_salary: 200_000, salary_minimum: 185_000 })).toEqual([]);
    expect(salaryWarnings({ current_salary: 5_000, expected_salary: null, salary_minimum: null })[0]).toContain('Monatsgehalt');
    expect(salaryWarnings({ current_salary: 80_000, expected_salary: 90_000, salary_minimum: 95_000 })[0]).toContain('Vertauscht');
  });
});

describe('Kundentexte', () => {
  const base = () => ({
    ...emptyDossier(),
    full_name: 'Marko Benko',
    company: 'Global Strategy Group GmbH',
    current_salary: 180_000,
    expected_salary: 200_000,
    salary_minimum: 185_000,
    notice_period: '3_months_eoq',
    availability_date: '2027-04-01',
  });

  it('sperrt aktuelles Gehalt und Schmerzgrenze, auch von Hand geschrieben', () => {
    const f = { ...base(), summary_salary: 'Aktuell 220k all-in. Ziel: 200k fix. Minimum 185k all-in.' };
    const issues = clientTextIssues(f).filter((i) => i.field === 'summary_salary');
    expect(issues.some((i) => i.level === 'danger')).toBe(true);
  });

  it('meldet veraltete Kündigungsfrist und Starttermin gelb', () => {
    const f = { ...base(), summary_notice: '6 Monate zum Quartalsende. Frühester Start: Oktober 2026.' };
    const issues = clientTextIssues(f).filter((i) => i.field === 'summary_notice');
    expect(issues.map((i) => i.level)).toEqual(['warn', 'warn']);
  });

  it('lässt saubere Texte in Ruhe', () => {
    const f = { ...base(), summary_salary: 'Wunschgehalt um 200.000 € im Jahr', summary_notice: 'Kündigungsfrist 3 Monate zum Quartalsende, verfügbar ab 01.04.2027' };
    expect(clientTextIssues(f)).toEqual([]);
  });

  it('sperrt Name, Arbeitgeber und andere Bewerbungen', () => {
    const f = { ...base(), summary_motivation: 'Herr Benko will weg von Global Strategy Group GmbH, hat parallel ein anderes Angebot.' };
    const msgs = clientTextIssues(f).map((i) => i.message);
    expect(msgs.some((m) => m.includes('Namen'))).toBe(true);
    expect(msgs.some((m) => m.includes('Arbeitgeber'))).toBe(true);
    expect(msgs.some((m) => m.includes('Bewerbungen'))).toBe(true);
  });
});

describe('Speichern ohne fehlende Spalten', () => {
  it('lässt nur die wirklich fehlende Spalte weg, nicht alle neueren', async () => {
    const { writeDroppingMissingColumns } = await import('./candidateDossier');
    const live = new Set(['why_now', 'leadership_scope', 'blocked_companies', 'interview_type']);
    const seen: Record<string, unknown>[] = [];
    const write = async (p: Record<string, unknown>) => {
      seen.push(p);
      const missing = Object.keys(p).find((k) => !live.has(k));
      return { error: missing ? { code: 'PGRST204', message: `Could not find the '${missing}' column of 'candidate_interview_notes' in the schema cache` } : null };
    };
    const { result, dropped } = await writeDroppingMissingColumns(write, {
      why_now: 'x', leadership_scope: 'disciplinary', blocked_companies: ['A'], interview_type: 'phone', salary_basis: 'fix', non_compete: 'none',
    });
    expect(result.error).toBeNull();
    expect(dropped.sort()).toEqual(['non_compete', 'salary_basis']);
    expect(seen[seen.length - 1]).toEqual({ why_now: 'x', leadership_scope: 'disciplinary', blocked_companies: ['A'], interview_type: 'phone' });
  });
});
