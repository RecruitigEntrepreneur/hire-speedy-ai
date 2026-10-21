import { describe, expect, it } from 'vitest';
import { verdeckeBetraege } from './honorarVerdeckt';

describe('Honorar ausblenden', () => {
  it('verdeckt Euro-Beträge in jeder Schreibweise', () => {
    expect(verdeckeBetraege('13.125 €')).toBe('••••• €');
    expect(verdeckeBetraege('€13.125')).toBe('••••• €');
    expect(verdeckeBetraege('€892k')).toBe('••••• €');
    expect(verdeckeBetraege('€11.5k')).toBe('••••• €');
    expect(verdeckeBetraege('60–150 €')).toBe('••••• €');
    expect(verdeckeBetraege('1.250,50 EUR')).toBe('••••• €');
  });

  it('verdeckt Beträge und Prozent in Sätzen und lässt den Rest stehen', () => {
    expect(verdeckeBetraege('Honorar bei Abschluss: 13.125 €.')).toBe('Honorar bei Abschluss: ••••• €.');
    expect(verdeckeBetraege('≈ 13.125 € für dich')).toBe('≈ ••••• € für dich');
    expect(verdeckeBetraege('15 % Honorar')).toBe('•• % Honorar');
    expect(verdeckeBetraege('3 laufend · offenes Honorar ~€26k')).toBe('3 laufend · offenes Honorar ~••••• €');
  });

  it('lässt Texte ohne Betrag unverändert', () => {
    expect(verdeckeBetraege('Honorar: noch nicht bekannt.')).toBe('Honorar: noch nicht bekannt.');
  });
});
