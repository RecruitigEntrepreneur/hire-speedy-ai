import { describe, expect, it } from 'vitest';
import { bildTitel, umbrechen } from './beitragsBild';

const mess = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };

describe('Beitragsbild', () => {
  it('teilt den Titel am Gedankenstrich und lässt (m/w/d) weg', () => {
    expect(bildTitel('Tax Manager (m/w/d) – Konzernsteuern')).toEqual(['Tax Manager', 'Konzernsteuern']);
    expect(bildTitel('Senior Controller (m/w/d)')).toEqual(['Senior Controller']);
  });

  it('bricht um und kürzt die letzte Zeile mit …', () => {
    expect(umbrechen(mess, 'Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung', 300, 3))
      .toEqual(['Steuerberaterexamen komplett', 'bezahlt inkl. 3 Monate', 'Freistellung']);
    const zwei = umbrechen(mess, 'Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung', 300, 2);
    expect(zwei).toHaveLength(2);
    expect(zwei[1].endsWith('…')).toBe(true);
    expect(zwei[1].length * 10).toBeLessThanOrEqual(300);
  });
});
