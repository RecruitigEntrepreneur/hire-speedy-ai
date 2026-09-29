import { describe, expect, it } from 'vitest';
import { computeFitCheck, effectiveJobModel, toCriteriaPayload, toOverridesPayload, type FitCandidate, type FitJob } from './fitCheck';

// Stelle "Mitarbeiter:in Patientensupport", wie sie live in recruiter_jobs_view steht
const patientensupport: FitJob = { salary_min: 30000, salary_max: 48000, remote_type: 'hybrid', onsite_days_required: 5, location: 'München', required_languages: [] };

const lena: FitCandidate = {
  expected_salary: 42000,
  salary_minimum: null,
  remote_preference: 'flexible',
  city: 'München',
  relocation_willing: false,
  languages: [],
  work_permit: null,
};

const criteria = [
  { criterion: 'Empathische Patientenkommunikation', rating: 'met' as const, evidence: 'Beschwerde-Hotline' },
  { criterion: 'Deutsch', rating: 'met' as const, evidence: '' },
];

describe('Passungs-Check', () => {
  it('behandelt hybrid mit 5 Präsenztagen als vor Ort', () => {
    expect(effectiveJobModel(patientensupport)).toBe('onsite');
  });

  it('lässt Lena auf Patientensupport zu, mit Hinweis zur fehlenden Arbeitserlaubnis', () => {
    const r = computeFitCheck(lena, patientensupport, criteria);
    expect(r.canSubmit).toBe(true);
    expect(r.blocking).toEqual([]);
    expect(r.items.find((i) => i.key === 'gehalt')?.status).toBe('ok');
    expect(r.hints).toContain('Arbeitserlaubnis nicht eingetragen.');
  });

  it('warnt, wenn die Schmerzgrenze über dem Budget liegt, und lässt sich nur mit Begründung übergehen', () => {
    const cand = { ...lena, expected_salary: 58000, salary_minimum: 55000 };
    const r = computeFitCheck(cand, patientensupport, criteria);
    expect(r.canSubmit).toBe(false);
    expect(r.blocking).toEqual([]);
    expect(r.warnings[0].message).toContain('Schmerzgrenze');
    expect(computeFitCheck(cand, patientensupport, criteria, { gehalt: 'kurz' }).canSubmit).toBe(false);
    const ok = computeFitCheck(cand, patientensupport, criteria, { gehalt: 'Kunde hat Budget auf 58k erhöht' });
    expect(ok.canSubmit).toBe(true);
    expect(toOverridesPayload(ok)).toEqual([{ rule: 'gehalt', message: ok.warnings[0].message, reason: 'Kunde hat Budget auf 58k erhöht' }]);
  });

  it('gibt nur einen Hinweis, wenn der Wunsch über Budget liegt, die Schmerzgrenze aber passt', () => {
    const r = computeFitCheck({ ...lena, expected_salary: 50000, salary_minimum: 45000 }, patientensupport, criteria);
    expect(r.canSubmit).toBe(true);
    expect(r.items.find((i) => i.key === 'gehalt')?.status).toBe('hint');
  });

  it('weist auf ein Wunschgehalt weit unter dem Budget hin (Seniorität)', () => {
    const dataScientist: FitJob = { ...patientensupport, salary_min: 85000, salary_max: 110000 };
    const r = computeFitCheck(lena, dataScientist, criteria);
    expect(r.items.find((i) => i.key === 'gehalt')?.message).toBe('Wunschgehalt deutlich unter dem Budget, Seniorität prüfen.');
    expect(r.canSubmit).toBe(true);
  });

  it('warnt bei reinen Remote-Wünschen auf eine Vor-Ort-Stelle, Hybrid gibt nur einen Hinweis', () => {
    const remote = computeFitCheck({ ...lena, remote_preference: 'remote' }, patientensupport, criteria);
    expect(remote.canSubmit).toBe(false);
    expect(remote.warnings.map((w) => w.rule)).toEqual(['arbeitsmodell']);
    const hybrid = computeFitCheck({ ...lena, remote_preference: 'hybrid' }, patientensupport, criteria);
    expect(hybrid.canSubmit).toBe(true);
    expect(hybrid.items.find((i) => i.key === 'arbeitsmodell')?.status).toBe('hint');
  });

  it('sperrt, wenn ein Muss-Kriterium nicht erfüllt ist, und verlangt eine Einschätzung für jedes', () => {
    const notMet = computeFitCheck(lena, patientensupport, [criteria[0], { criterion: 'Deutsch', rating: 'not_met', evidence: '' }]);
    expect(notMet.canSubmit).toBe(false);
    expect(notMet.blocking).toContain('Du hast das Muss-Kriterium „Deutsch“ als nicht erfüllt eingeschätzt.');
    // die eigene Einschätzung lässt sich nicht per Begründung übergehen
    expect(computeFitCheck(lena, patientensupport, [criteria[0], { criterion: 'Deutsch', rating: 'not_met', evidence: '' }], { deutsch: 'egal, trotzdem einreichen' }).canSubmit).toBe(false);
    const open = computeFitCheck(lena, patientensupport, [criteria[0], { criterion: 'Deutsch', rating: null, evidence: '' }]);
    expect(open.canSubmit).toBe(false);
    expect(open.criteriaMissing).toEqual(['Deutsch']);
  });

  it('meldet einen anderen Wohnort ohne Umzugsbereitschaft als Hinweis', () => {
    const r = computeFitCheck({ ...lena, city: 'Hamburg' }, patientensupport, criteria);
    expect(r.items.find((i) => i.key === 'ort')?.status).toBe('hint');
    expect(computeFitCheck({ ...lena, city: 'Hamburg', relocation_willing: true }, patientensupport, criteria).items.find((i) => i.key === 'ort')?.status).toBe('ok');
  });

  it('prüft Pflichtsprachen der Stelle gegen die Akte', () => {
    const job = { ...patientensupport, required_languages: ['Deutsch', 'Englisch'] };
    const r = computeFitCheck({ ...lena, languages: [{ language: 'Deutsch', proficiency: 'Muttersprache' }] }, job, criteria);
    expect(r.items.find((i) => i.key === 'sprachen')?.message).toBe('Pflichtsprache nicht eingetragen: Englisch.');
  });

  it('gibt dem Kunden nur eingeschätzte Kriterien mit anonymisiertem Beleg', () => {
    const payload = toCriteriaPayload(
      [{ criterion: 'Empathie', rating: 'met', evidence: 'Hotline bei Telemedizin GmbH' }, { criterion: 'Deutsch', rating: null, evidence: '' }],
      (t) => t.replace('Telemedizin GmbH', 'aktueller Arbeitgeber'),
    );
    expect(payload).toEqual([{ criterion: 'Empathie', rating: 'met', evidence: 'Hotline bei aktueller Arbeitgeber' }]);
  });
});
