import { describe, expect, it } from 'vitest';
import { sucheKundenBewerber, sucheKundenStellen, type KundenBewerber, type KundenStelle } from './kundenSuche';

const stellen: KundenStelle[] = [
  { id: '1', title: 'Lohnbuchhalter (m/w/d)', location: 'Hamburg', status: 'published', laufend: 8 },
  { id: '2', title: 'Entwurf Lohn und Gehalt', location: null, status: 'draft', laufend: 0 },
  { id: '3', title: 'Controller', location: 'München', status: 'published', laufend: 2 },
];
const bewerber: KundenBewerber[] = [
  { id: 'a', name: 'PR-AB12CD', kuerzel: 'PR-AB12CD', rolle: 'Lohnbuchhalterin', stelle: 'Lohnbuchhalter (m/w/d)', archiv: false },
  { id: 'b', name: 'Ines Kraus', kuerzel: 'PR-0107AA', rolle: 'Lohnbuchhalterin', stelle: 'Lohnbuchhalter (m/w/d)', archiv: false },
  { id: 'c', name: 'Paul Alt', kuerzel: 'PR-99', rolle: 'Controller', stelle: 'Controller', archiv: true },
];

describe('Kunden-Suche', () => {
  it('findet Stellen über einen Wortteil, laufende vor Entwürfen', () => {
    expect(sucheKundenStellen(stellen, 'Lohn').map((s) => s.id)).toEqual(['1', '2']);
  });
  it('findet Stellen über den Ort', () => {
    expect(sucheKundenStellen(stellen, 'münchen').map((s) => s.id)).toEqual(['3']);
  });
  it('findet Bewerber über Rolle und Stelle', () => {
    expect(sucheKundenBewerber(bewerber, 'lohn').map((b) => b.id)).toEqual(['a', 'b']);
  });
  it('findet Bewerber über das Kürzel', () => {
    expect(sucheKundenBewerber(bewerber, 'pr-ab12').map((b) => b.id)).toEqual(['a']);
  });
  it('stellt Namenstreffer vor andere, Archiv nach hinten', () => {
    expect(sucheKundenBewerber(bewerber, 'ines').map((b) => b.id)).toEqual(['b']);
    expect(sucheKundenBewerber(bewerber, 'controller').map((b) => b.id)).toEqual(['c']);
  });
  it('liefert nichts bei leerer Eingabe', () => {
    expect(sucheKundenStellen(stellen, '  ')).toEqual([]);
    expect(sucheKundenBewerber(bewerber, '')).toEqual([]);
  });
});
