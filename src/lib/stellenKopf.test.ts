import { describe, expect, it } from 'vitest';
import { kopfFakten, mitarbeitende } from './stellenKopf';

describe('Faktenzeile im Kopf der Stelle', () => {
  it('zeigt die Zahl des Kunden statt des Größenbands', () => {
    expect(mitarbeitende({ company_headcount: 900, company_size_band: '250–1.000' })).toBe('900 Mitarbeitende');
    expect(mitarbeitende({ company_headcount: null, company_size_band: '250–1.000' })).toBe('250–1.000 Mitarbeitende');
    expect(mitarbeitende({ company_size_band: null })).toBeNull();
  });

  it('baut die Zeile wie in einer Anzeige', () => {
    const fakten = kopfFakten({
      id: 'x', title: 'Tax Manager', employment_type: 'full-time', salary_min: 80000, salary_max: 95000, salary_months: 13,
      onsite_days_required: 3, remote_type: 'hybrid', core_hours: 'Gleitzeit ohne Kernzeit', experience_level: 'senior',
      contract_limitation: 'unbefristet', company_headcount: 900, company_size_band: '250–1.000', industry: 'Großhandel für Industriebedarf',
    } as never);
    expect(fakten.map(f => f.text)).toEqual([
      '80.000 – 95.000 € × 13', '3 Tage vor Ort', 'Vollzeit, Gleitzeit', 'Senior', 'unbefristet', '900 Mitarbeitende', 'Großhandel für Industriebedarf',
    ]);
  });
});
