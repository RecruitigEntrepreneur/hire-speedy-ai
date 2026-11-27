import { describe, expect, it } from 'vitest';
import { euroAusText } from './euroAusText';

describe('euroAusText: was jemand ins Eurofeld tippt', () => {
  it('liest übliche Schreibweisen', () => {
    expect(euroAusText('55.000').wert).toBe(55000);
    expect(euroAusText('55000').wert).toBe(55000);
    expect(euroAusText('55 000').wert).toBe(55000);
    expect(euroAusText('55,000').wert).toBe(55000);
    expect(euroAusText('120.000 €').wert).toBe(120000);
  });

  it('versteht k und Tsd. als Tausend', () => {
    expect(euroAusText('55k')).toEqual({ wert: 55000, alsTausend: true });
    expect(euroAusText('55 Tsd.')).toEqual({ wert: 55000, alsTausend: true });
  });

  it('Jahresgehalt: eine Zahl unter 1.000 heißt Tausend Euro', () => {
    expect(euroAusText('55', true)).toEqual({ wert: 55000, alsTausend: true });
    expect(euroAusText('55,5', true)).toEqual({ wert: 55500, alsTausend: true });
    expect(euroAusText('55.000', true)).toEqual({ wert: 55000, alsTausend: false });
  });

  it('Tagessatz: kleine Zahlen bleiben, wie sie sind', () => {
    expect(euroAusText('800')).toEqual({ wert: 800, alsTausend: false });
    expect(euroAusText('1.200')).toEqual({ wert: 1200, alsTausend: false });
  });

  it('leer oder null ergibt nichts', () => {
    expect(euroAusText('').wert).toBeNull();
    expect(euroAusText('0', true).wert).toBeNull();
    expect(euroAusText('abc').wert).toBeNull();
  });
});
