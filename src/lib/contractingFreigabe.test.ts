import { describe, expect, it } from 'vitest';
import {
  einsatzZeile, euroSpanne, kundenBudget, modellDesAuftrags, recruiterJeTag, recruiterTagessatz, spanne, vertragsabweichung,
} from './contractingFreigabe';

const contractingAuftrag = {
  mandate_number: 'MV-2026-001020', fee_basis: 'day_rate_all_in', fee_percentage: 22,
  pricing_snapshot: { model: 'contracting', dayRateMin: 400, dayRateMax: 1000 },
};
const festAuftrag = { mandate_number: 'MV-2026-001009', fee_basis: 'annual_target_salary', fee_percentage: 23 };

describe('Freigabe: Stelle und Auftrag', () => {
  it('erkennt das Modell am Auftrag', () => {
    expect(modellDesAuftrags(contractingAuftrag)).toBe('contracting');
    expect(modellDesAuftrags(festAuftrag)).toBe('festanstellung');
    expect(modellDesAuftrags(null)).toBeNull();
  });

  it('warnt bei Contracting-Stelle mit Festanstellungs-Auftrag (Lucas alte Stelle)', () => {
    const w = vertragsabweichung('freelance', festAuftrag);
    expect(w?.titel).toBe('Contracting-Stelle mit Festanstellungs-Auftrag');
    expect(w?.text).toContain('MV-2026-001009 rechnet 23 % vom Jahresgehalt');
  });

  it('warnt auch umgekehrt, aber nicht bei passendem oder fehlendem Auftrag', () => {
    expect(vertragsabweichung('full-time', contractingAuftrag)?.titel).toBe('Festanstellung mit Contracting-Auftrag');
    expect(vertragsabweichung('freelance', contractingAuftrag)).toBeNull();
    expect(vertragsabweichung('full-time', festAuftrag)).toBeNull();
    expect(vertragsabweichung('freelance', null)).toBeNull();
  });
});

describe('Freigabe: Zahlen', () => {
  it('nimmt das Budget aus dem Auftrag, ohne Auftrag aus der Stelle', () => {
    expect(kundenBudget(contractingAuftrag, { day_rate_min: 500, day_rate_max: 600 })).toEqual([400, 1000]);
    expect(kundenBudget(null, { day_rate_min: 500, day_rate_max: 600 })).toEqual([500, 600]);
  });

  it('erfindet kein Budget, wenn der Kunde ohne bestätigt hat', () => {
    const ohne = { ...contractingAuftrag, pricing_snapshot: { dayRateMin: null, dayRateMax: null } };
    expect(kundenBudget(ohne, { day_rate_min: 500, day_rate_max: 600 })).toBeNull();
  });

  it('rechnet den Recruiter-Anteil je Einsatztag', () => {
    expect(recruiterJeTag([400, 1000], 11)).toBe('44–110 €');
    expect(recruiterJeTag([750, 750], 11)).toBe('83 €');
    expect(recruiterJeTag(null, 11)).toBeNull();
  });

  it('ordnet Spannen und schreibt sie deutsch', () => {
    expect(spanne(1000, 400)).toEqual([400, 1000]);
    expect(spanne(null, 800)).toEqual([800, 800]);
    expect(euroSpanne([1000, 1200])).toBe('1.000–1.200 €');
  });

  it('beschreibt den Einsatz nur mit bekannten Angaben', () => {
    expect(einsatzZeile({ utilization_days_per_week: 3, contract_duration_months: 12, extension_possible: true }))
      .toBe('3 Tage/Woche · 12 Monate · Verlängerung möglich');
    expect(einsatzZeile({ contract_duration_months: 6 })).toBe('6 Monate');
    expect(einsatzZeile({})).toBeNull();
  });
});

describe('Freigabe: was Recruiter sehen', () => {
  it('zeigt den Satz des Spezialisten wie recruiter_jobs_view', () => {
    expect(recruiterTagessatz([400, 1000], contractingAuftrag)).toEqual([310, 780]);
    expect(recruiterTagessatz([1000, 1200], { fee_basis: 'day_rate_all_in', pricing_snapshot: { specialistPct: 80 } })).toEqual([800, 960]);
    expect(recruiterTagessatz([400, 1000], festAuftrag)).toEqual([310, 780]);
    expect(recruiterTagessatz(null, contractingAuftrag)).toBeNull();
  });
});
