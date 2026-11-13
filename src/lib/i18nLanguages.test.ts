import { describe, expect, it } from 'vitest';
import { matchLanguage, pickLanguage, swissSpelling, visibleLanguages } from '@/i18n/languages';

describe('matchLanguage', () => {
  it('ordnet Browser-Angaben den Plattform-Sprachen zu', () => {
    expect(matchLanguage('sv-SE')).toBe('sv');
    expect(matchLanguage('no')).toBe('nb');
    expect(matchLanguage('nn-NO')).toBe('nb');
    expect(matchLanguage('de-AT')).toBe('de-AT');
    expect(matchLanguage('de-LI')).toBe('de-CH');
    expect(matchLanguage('de_DE')).toBe('de');
    expect(matchLanguage('en-US')).toBe('en');
    expect(matchLanguage('fi')).toBeNull();
    expect(matchLanguage('')).toBeNull();
  });
});

describe('pickLanguage', () => {
  const all = { showDrafts: true };
  it('nimmt die eigene Wahl vor allem anderen', () => {
    expect(pickLanguage({ ...all, stored: 'en', link: 'sv', browser: ['de-DE'] })).toEqual({ language: 'en', source: 'choice', suggestion: null });
  });
  it('nimmt die Link-Sprache vor dem Browser und schlägt die Browser-Sprache vor', () => {
    expect(pickLanguage({ ...all, link: 'de', browser: ['sv-SE', 'en'] })).toEqual({ language: 'de', source: 'link', suggestion: 'sv' });
  });
  it('schlägt nichts vor, wenn Link und Browser dieselbe Sprache meinen', () => {
    expect(pickLanguage({ ...all, link: 'de', browser: ['de-AT'] }).suggestion).toBeNull();
  });
  it('nimmt den Browser, wenn es keinen Link gibt', () => {
    expect(pickLanguage({ ...all, browser: ['fi', 'nb-NO'] })).toEqual({ language: 'nb', source: 'browser', suggestion: null });
  });
  it('fällt auf Englisch zurück, nicht auf Deutsch', () => {
    expect(pickLanguage({ ...all, browser: ['fi'] })).toEqual({ language: 'en', source: 'default', suggestion: null });
  });
  it('zeigt alle sechs Sprachen live, auch ohne Freischaltung', () => {
    expect(visibleLanguages(false).map((l) => l.code)).toEqual(['de', 'de-AT', 'de-CH', 'en', 'sv', 'nb']);
    expect(pickLanguage({ link: 'sv', browser: ['de'] }).language).toBe('sv');
  });
});

describe('swissSpelling', () => {
  it('ersetzt das Eszett', () => {
    expect(swissSpelling('Straße, außerdem groß')).toBe('Strasse, ausserdem gross');
  });
});
