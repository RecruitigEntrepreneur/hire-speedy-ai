import { describe, expect, it } from 'vitest';
import { contractSuggestion, openSummary, startPercent, startSteps } from './recruiterStart';

const full = { company_name: 'KMB Partners GmbH', company_address: 'Hauptstraße 1, 80331 München', tax_id: 'DE123456789', bank_iban: 'DE02120300000000202051' };

describe('Dein Start bei Matchunt', () => {
  it('zählt Vertrag immer, den Rest aus echten Daten', () => {
    const steps = startSteps({}, false);
    expect(steps.map(s => [s.id, s.done])).toEqual([['contract', true], ['tour', false], ['company', false], ['bank', false]]);
    expect(startPercent(steps)).toBe(25);
    expect(startPercent(startSteps(full, true))).toBe(100);
  });

  it('Firmendaten gelten erst mit Firma, Adresse und Steuerangaben; Leerzeichen zählen nicht', () => {
    expect(startSteps({ ...full, tax_id: '  ' }, true).find(s => s.id === 'company')?.done).toBe(false);
    expect(startSteps({ ...full, company_address: null }, true).find(s => s.id === 'company')?.done).toBe(false);
    expect(startSteps({ ...full, bank_iban: '' }, true).find(s => s.id === 'bank')?.done).toBe(false);
  });

  it('sagt in einem Satz, was fehlt und wofür', () => {
    expect(openSummary(startSteps({ ...full, bank_iban: '' }, true))).toBe('Noch offen: deine Bankverbindung. Die brauchen wir, bevor wir dir deine erste Provision überweisen.');
    expect(openSummary(startSteps(full, false))).toBe('Noch offen: der Rundgang. Er zeigt dir in wenigen Minuten das Wichtigste.');
    expect(openSummary(startSteps({}, true))).toBe('Noch offen: Firmendaten und Bankverbindung. Die brauchen wir, bevor wir dir deine erste Provision überweisen.');
    expect(openSummary(startSteps({}, false))).toBe('Noch offen: Rundgang, Firmendaten und Bankverbindung. Firmendaten und Bankverbindung brauchen wir, bevor wir dir deine erste Provision überweisen.');
    expect(openSummary(startSteps({ ...full, bank_iban: '' }, false))).toBe('Noch offen: Rundgang und Bankverbindung. Die Bankverbindung brauchen wir, bevor wir dir deine erste Provision überweisen.');
    expect(openSummary(startSteps(full, true))).toBe('');
  });

  it('schlägt Firmendaten aus dem Vertrag nur für leere Felder vor', () => {
    const contract = { company: 'KMB Partners GmbH', address: 'Hauptstraße 1, 80331 München', contractDetails: { taxNumber: ' DE123456789 ' } };
    expect(contractSuggestion({ company_name: 'KMB', company_address: '', tax_id: null }, contract)).toEqual({ company_address: 'Hauptstraße 1, 80331 München', tax_id: 'DE123456789' });
    expect(contractSuggestion(full, contract)).toBeNull();
    expect(contractSuggestion({}, { company: ' ', address: '' })).toBeNull();
  });
});
