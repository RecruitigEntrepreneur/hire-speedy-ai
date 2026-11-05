import { describe, expect, it } from 'vitest';
import { haeufigFehlend, istBekannteSprache, sprachVorschlaege } from './sprachen';

describe('Sprachen vorschlagen', () => {
  it('ergänzt Angefangenes', () => {
    expect(sprachVorschlaege('spani')).toEqual(['Spanisch']);
    expect(sprachVorschlaege('ita')).toEqual(['Italienisch', 'Litauisch']);
    expect(sprachVorschlaege('fran')).toEqual(['Französisch']);
  });

  it('erst was so anfängt, dann was es enthält', () => {
    expect(sprachVorschlaege('sch')[0]).toBe('Schwedisch');
    expect(sprachVorschlaege('isch').length).toBe(6);
  });

  it('versteht englische und andere Schreibweisen', () => {
    expect(sprachVorschlaege('english')).toEqual(['Englisch']);
    expect(sprachVorschlaege('Mandarin')).toEqual(['Chinesisch']);
    expect(sprachVorschlaege('holl')).toEqual(['Niederländisch']);
  });

  it('ohne Umlaute und Groß/klein', () => {
    expect(sprachVorschlaege('TURK')).toEqual(['Türkisch']);
    expect(istBekannteSprache('türkisch')).toBe(true);
  });

  it('lässt schon eingetragene weg und schweigt bei Treffer oder leerer Eingabe', () => {
    expect(sprachVorschlaege('deu', ['Deutsch'])).toEqual([]);
    expect(sprachVorschlaege('Spanisch')).toEqual([]);
    expect(sprachVorschlaege('  ')).toEqual([]);
    expect(sprachVorschlaege('Klingonisch')).toEqual([]);
  });

  it('häufige, die noch fehlen', () => {
    expect(haeufigFehlend(['Deutsch', 'Italienisch', 'Spanisch'])).toEqual(['Englisch', 'Französisch']);
    expect(haeufigFehlend([])).toEqual(['Deutsch', 'Englisch', 'Französisch']);
    expect(haeufigFehlend(['deutsch', 'englisch'])).toEqual(['Französisch', 'Spanisch', 'Italienisch']);
  });
});
