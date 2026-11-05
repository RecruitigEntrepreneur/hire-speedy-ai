import { describe, expect, it } from 'vitest';
import { fuehrungArten, fuehrungText, fuehrungUmschalten, fuehrungZahl, fuehrungZahlSetzen, type FuehrungWerte } from './fuehrung';

const leer: FuehrungWerte = { leadership_scope: null, leadership_team_size: null, leadership_also_functional: null, leadership_functional_size: null };
const mit = (f: FuehrungWerte, p: Partial<FuehrungWerte>): FuehrungWerte => ({ ...f, ...p });

describe('Führung disziplinarisch und fachlich', () => {
  it('beide Arten lassen sich antippen, jede mit eigener Zahl', () => {
    let f = mit(leer, fuehrungUmschalten(leer, 'disciplinary'));
    f = mit(f, fuehrungZahlSetzen(f, 'disciplinary', 4));
    f = mit(f, fuehrungUmschalten(f, 'functional'));
    f = mit(f, fuehrungZahlSetzen(f, 'functional', 12));
    expect(f).toEqual({ leadership_scope: 'disciplinary', leadership_team_size: 4, leadership_also_functional: true, leadership_functional_size: 12 });
    expect(fuehrungArten(f)).toEqual({ keine: false, disziplinarisch: true, fachlich: true });
    expect(fuehrungText(f)).toBe('disziplinarisch 4 Personen, fachlich 12 Personen');
  });

  it('nur fachlich bleibt wie bisher: scope functional, Zahl in leadership_team_size', () => {
    let f = mit(leer, fuehrungUmschalten(leer, 'functional'));
    f = mit(f, fuehrungZahlSetzen(f, 'functional', 12));
    expect(f.leadership_scope).toBe('functional');
    expect(f.leadership_team_size).toBe(12);
    expect(fuehrungText(f)).toBe('fachlich, 12 Personen');
  });

  it('Disziplinarisch dazu: die fachliche Zahl wandert mit', () => {
    const f = mit(leer, { leadership_scope: 'functional', leadership_team_size: 12 });
    const g = mit(f, fuehrungUmschalten(f, 'disciplinary'));
    expect(g).toEqual({ leadership_scope: 'disciplinary', leadership_team_size: null, leadership_also_functional: true, leadership_functional_size: 12 });
  });

  it('Disziplinarisch raus: fachlich bleibt mit seiner Zahl', () => {
    const f: FuehrungWerte = { leadership_scope: 'disciplinary', leadership_team_size: 4, leadership_also_functional: true, leadership_functional_size: 12 };
    const g = mit(f, fuehrungUmschalten(f, 'disciplinary'));
    expect(g).toEqual({ leadership_scope: 'functional', leadership_team_size: 12, leadership_also_functional: null, leadership_functional_size: null });
  });

  it('Fachlich raus: disziplinarisch bleibt mit seiner Zahl', () => {
    const f: FuehrungWerte = { leadership_scope: 'disciplinary', leadership_team_size: 4, leadership_also_functional: true, leadership_functional_size: 12 };
    const g = mit(f, fuehrungUmschalten(f, 'functional'));
    expect(g).toEqual({ leadership_scope: 'disciplinary', leadership_team_size: 4, leadership_also_functional: false, leadership_functional_size: null });
    expect(fuehrungText(g)).toBe('disziplinarisch, 4 Personen');
  });

  it('„Keine“ nimmt beide raus, ein zweiter Tipp leert das Feld', () => {
    const f: FuehrungWerte = { leadership_scope: 'disciplinary', leadership_team_size: 4, leadership_also_functional: true, leadership_functional_size: 12 };
    const g = mit(f, fuehrungUmschalten(f, 'none'));
    expect(g).toEqual({ leadership_scope: 'none', leadership_team_size: null, leadership_also_functional: null, leadership_functional_size: null });
    expect(fuehrungText(g)).toBe('keine');
    expect(mit(g, fuehrungUmschalten(g, 'none')).leadership_scope).toBeNull();
  });

  it('alte Einträge ohne die neuen Spalten lesen sich wie bisher', () => {
    const alt: FuehrungWerte = { leadership_scope: 'disciplinary', leadership_team_size: 16 };
    expect(fuehrungArten(alt).fachlich).toBe(false);
    expect(fuehrungZahl(alt, 'functional')).toBeNull();
    expect(fuehrungText(alt)).toBe('disziplinarisch, 16 Personen');
    expect(fuehrungText(leer)).toBeNull();
  });

  it('beide ohne Zahlen', () => {
    const f: FuehrungWerte = { leadership_scope: 'disciplinary', leadership_team_size: null, leadership_also_functional: true, leadership_functional_size: null };
    expect(fuehrungText(f)).toBe('disziplinarisch, fachlich');
  });
});
