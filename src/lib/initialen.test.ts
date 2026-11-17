import { describe, expect, it } from 'vitest';
import { initialen } from './initialen';

describe('initialen', () => {
  it('überspringt Klammern und Zeichen', () => {
    expect(initialen('Ben Kurz (Test)')).toBe('BK');
    expect(initialen('Nora Lang (Test)')).toBe('NL');
  });
  it('nimmt höchstens zwei Buchstaben, auch mit Umlaut', () => {
    expect(initialen('Anna Maria Özdemir')).toBe('AM');
    expect(initialen('Özge Ünal')).toBe('ÖÜ');
  });
  it('kommt mit leerem Namen aus', () => {
    expect(initialen('')).toBe('');
    expect(initialen(null)).toBe('');
  });
});
