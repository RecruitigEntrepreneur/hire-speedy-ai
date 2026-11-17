import { describe, expect, it } from 'vitest';
import { istNummer, nummerPasst, sucheKandidaten, sucheStellen, type SuchKandidat, type SuchStelle } from './headhunterSuche';

const k = (p: Partial<SuchKandidat>): SuchKandidat => ({
  id: p.id ?? Math.random().toString(36), full_name: 'Test Person', email: null, phone: null, job_title: null, company: null, city: null, ...p,
});

describe('Suche des Headhunters', () => {
  it('findet Kandidaten nach Vorname, Position und Ort', () => {
    const liste = [k({ id: 'paul', full_name: 'Paul Kurztest' }), k({ id: 'ines', full_name: 'Ines Kraus', job_title: 'Lohnbuchhalterin', city: 'Böblingen' })];
    expect(sucheKandidaten(liste, 'paul').map((x) => x.id)).toEqual(['paul']);
    expect(sucheKandidaten(liste, 'Lohn').map((x) => x.id)).toEqual(['ines']);
    expect(sucheKandidaten(liste, 'boblingen').map((x) => x.id)).toEqual(['ines']);
  });

  it('verlangt alle Wörter, egal in welchem Feld', () => {
    const liste = [k({ id: 'a', full_name: 'Ines Kraus', city: 'Böblingen' }), k({ id: 'b', full_name: 'Ines Weber', city: 'Hamburg' })];
    expect(sucheKandidaten(liste, 'ines hamburg').map((x) => x.id)).toEqual(['b']);
  });

  it('setzt das ganze Wort vor den Wortanfang', () => {
    const liste = [k({ id: 'paula', full_name: 'Paula Richter' }), k({ id: 'paul', full_name: 'Paul Kurztest' })];
    expect(sucheKandidaten(liste, 'paul').map((x) => x.id)).toEqual(['paul', 'paula']);
  });

  it('setzt Namenstreffer vor andere Treffer', () => {
    const liste = [k({ id: 'firma', full_name: 'Anna Berg', company: 'Paulaner AG' }), k({ id: 'name', full_name: 'Paul Kurztest' })];
    expect(sucheKandidaten(liste, 'paul').map((x) => x.id)).toEqual(['name', 'firma']);
  });

  it('findet Telefonnummern unabhängig von Schreibweise und Ländervorwahl', () => {
    const liste = [k({ id: 'tel', phone: '+49 171 2345678' }), k({ id: 'ohne' })];
    expect(istNummer('0171 234')).toBe(true);
    expect(istNummer('Paul')).toBe(false);
    expect(nummerPasst('+49 171 2345678', '0171/2345')).toBe(true);
    expect(sucheKandidaten(liste, '0171 234').map((x) => x.id)).toEqual(['tel']);
    expect(sucheKandidaten(liste, '999').map((x) => x.id)).toEqual([]);
  });

  it('zeigt die Firma einer Stelle nur, wenn sie freigegeben ist', () => {
    const stellen: SuchStelle[] = [
      { id: 'frei', title: 'Lohnbuchhalter (m/w/d)', location: 'Hamburg', company_name: 'MedTec Süd GmbH', company_revealed: true },
      { id: 'verdeckt', title: 'Controller', location: 'München', company_name: 'MedTec Süd GmbH', company_revealed: false },
    ];
    expect(sucheStellen(stellen, 'medtec').map((s) => s.id)).toEqual(['frei']);
    expect(sucheStellen(stellen, 'lohn').map((s) => s.id)).toEqual(['frei']);
    expect(sucheStellen(stellen, '0171')).toEqual([]);
  });
});
