import { describe, expect, it } from 'vitest';
import { byFit, fitLine, fitOf, isFitting, type Fit } from './matchFit';

describe('Passung beim Einreichen', () => {
  it('ausgeschlossen und ausgeblendet passen nicht, alles andere schon', () => {
    expect(isFitting('sehr_passend')).toBe(true);
    expect(isFitting('passend')).toBe(true);
    expect(isFitting('pruefen')).toBe(true);
    expect(isFitting('ausgeschlossen')).toBe(false);
    expect(isFitting('ausgeblendet')).toBe(false);
    expect(isFitting(null)).toBe(false);
    expect(isFitting(undefined)).toBe(false);
  });

  it('„Trotzdem vorschlagen“ holt einen Ausschluss als „Prüfen“ zurück, „Ausblenden“ nimmt jede Stelle raus', () => {
    expect(fitOf('ausgeschlossen', 'show')).toBe('pruefen');
    expect(fitOf('ausgeschlossen', null)).toBe('ausgeschlossen');
    expect(fitOf('passend', 'hide')).toBe('ausgeblendet');
    expect(fitOf('passend', 'show')).toBe('passend');
  });

  it('beste Stufe zuerst', () => {
    const list: Fit[] = ['pruefen', 'sehr_passend', 'passend'];
    expect([...list].sort(byFit)).toEqual(['sehr_passend', 'passend', 'pruefen']);
  });
});

describe('Zeile „Belegt / offen“', () => {
  const req = (text: string, status: 'met' | 'partial' | 'not_met' | 'unknown', cls: 'must' | 'nice' = 'must') =>
    ({ id: text, text, class: cls, status, evidence: '', note: '' });
  it('belegt zuerst, dann offen; Kann-Kriterien zählen nicht', () => {
    expect(fitLine({ exclusion: null, requirements: [req('AWS', 'met'), req('Linux', 'met'), req('Kubernetes', 'unknown'), req('Go', 'met', 'nice')] }))
      .toBe('Belegt: AWS, Linux · offen: Kubernetes');
    expect(fitLine({ exclusion: null, requirements: [req('A', 'unknown'), req('B', 'partial'), req('C', 'not_met'), req('D', 'unknown')] }))
      .toBe('offen: A, B +2');
  });
  it('Ausschluss nennt den Grund', () => {
    expect(fitLine({ exclusion: { code: 'family', text: 'Andere Berufsfamilie', overridable: true }, requirements: [] })).toBe('Andere Berufsfamilie');
  });
});

describe('Zeile ohne prüfbare Muss-Kriterien', () => {
  it('nimmt den wichtigsten Hinweis des Matchings', () => {
    expect(fitLine({ exclusion: null, requirements: [], gaps: ['Wunsch deutlich unter Budget'], summary: 'x' })).toBe('Wunsch deutlich unter Budget');
    expect(fitLine({ exclusion: null, requirements: [], gaps: [], summary: 'Passt fachlich.' })).toBe('Passt fachlich.');
  });
});
