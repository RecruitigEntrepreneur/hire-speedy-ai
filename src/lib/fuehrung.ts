/**
 * Führung disziplinarisch UND fachlich (05.11.2026). leadership_scope bleibt die höchste
 * Stufe und leadership_team_size ihre Zahl, so lesen alte Stellen weiter richtig. Wer neben
 * der disziplinarischen Führung auch fachlich führt, steht in leadership_also_functional
 * mit eigener Zahl leadership_functional_size (Migration 20261105110000).
 */
export interface FuehrungWerte {
  leadership_scope: string | null;
  leadership_team_size: number | null;
  leadership_also_functional?: boolean | null;
  leadership_functional_size?: number | null;
}

export type FuehrungArt = 'disciplinary' | 'functional';
type Patch = Required<FuehrungWerte>;

export function fuehrungArten(f: FuehrungWerte): { keine: boolean; disziplinarisch: boolean; fachlich: boolean } {
  const disziplinarisch = f.leadership_scope === 'disciplinary';
  return {
    keine: f.leadership_scope === 'none',
    disziplinarisch,
    fachlich: f.leadership_scope === 'functional' || (disziplinarisch && f.leadership_also_functional === true),
  };
}

/** Zahl der Geführten je Art, null wenn die Art nicht gewählt ist oder keine Zahl hat. */
export function fuehrungZahl(f: FuehrungWerte, art: FuehrungArt): number | null {
  if (art === 'disciplinary') return f.leadership_scope === 'disciplinary' ? f.leadership_team_size : null;
  if (f.leadership_scope === 'functional') return f.leadership_team_size;
  return f.leadership_scope === 'disciplinary' && f.leadership_also_functional ? f.leadership_functional_size ?? null : null;
}

/** Feldname der Zahl je Art, für „fehlt“-Markierung und Fokus. */
export function fuehrungZahlFeld(f: FuehrungWerte, art: FuehrungArt): string {
  return art === 'functional' && f.leadership_scope === 'disciplinary' ? 'leadership_functional_size' : 'leadership_team_size';
}

const setze = (scope: string | null, d: number | null, fach: boolean, f: number | null): Patch => {
  if (scope === 'disciplinary') {
    return { leadership_scope: scope, leadership_team_size: d, leadership_also_functional: fach, leadership_functional_size: fach ? f : null };
  }
  if (scope === 'functional') {
    return { leadership_scope: scope, leadership_team_size: f, leadership_also_functional: null, leadership_functional_size: null };
  }
  return { leadership_scope: scope, leadership_team_size: null, leadership_also_functional: null, leadership_functional_size: null };
};

/**
 * Ein Knopf wurde angetippt. „Keine“ schließt die beiden anderen aus, „Disziplinarisch“ und
 * „Fachlich“ gehen zusammen. Ein zweiter Tipp nimmt die Art wieder raus, die Zahl der anderen bleibt.
 */
export function fuehrungUmschalten(f: FuehrungWerte, art: 'none' | FuehrungArt): Patch {
  const a = fuehrungArten(f);
  const d = fuehrungZahl(f, 'disciplinary');
  const fz = fuehrungZahl(f, 'functional');
  if (art === 'none') return setze(a.keine ? null : 'none', null, false, null);
  const disz = art === 'disciplinary' ? !a.disziplinarisch : a.disziplinarisch;
  const fach = art === 'functional' ? !a.fachlich : a.fachlich;
  if (disz) return setze('disciplinary', d, fach, fz);
  if (fach) return setze('functional', null, true, fz);
  return setze(null, null, false, null);
}

/** Zahl für eine Art setzen. */
export function fuehrungZahlSetzen(f: FuehrungWerte, art: FuehrungArt, n: number | null): Partial<Patch> {
  return { [fuehrungZahlFeld(f, art)]: n } as Partial<Patch>;
}

/**
 * Für die Kundenkarte: „keine“, „disziplinarisch, 4 Personen“, „fachlich, 12 Personen“ oder
 * bei beiden „disziplinarisch 4 Personen, fachlich 12 Personen“.
 */
export function fuehrungText(f: FuehrungWerte): string | null {
  const a = fuehrungArten(f);
  if (!f.leadership_scope) return null;
  if (a.keine) return 'keine';
  const d = fuehrungZahl(f, 'disciplinary');
  const fz = fuehrungZahl(f, 'functional');
  if (a.disziplinarisch && a.fachlich) {
    return `disziplinarisch${d ? ` ${d} Personen` : ''}, fachlich${fz ? ` ${fz} Personen` : ''}`;
  }
  const n = a.disziplinarisch ? d : fz;
  return `${a.disziplinarisch ? 'disziplinarisch' : 'fachlich'}${n ? `, ${n} Personen` : ''}`;
}
