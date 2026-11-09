/**
 * Führung als Text für die KI (05.11.2026), gleiche Regeln wie src/lib/fuehrung.ts:
 * leadership_scope ist die höchste Stufe, leadership_team_size ihre Zahl. Wer daneben
 * fachlich führt, steht in leadership_also_functional + leadership_functional_size
 * (Migration 20261105110000). Ohne Führung: null.
 *
 * „disziplinarisch, 4 Personen; fachlich zusätzlich 12 Personen“
 */
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function fuehrungKiText(n: Record<string, unknown> | null | undefined, einheit = 'Personen'): string | null {
  const scope = typeof n?.leadership_scope === 'string' ? n.leadership_scope : '';
  if (!scope || scope === 'none') return null;
  const team = zahl(n?.leadership_team_size);
  const art = scope === 'disciplinary' ? 'disziplinarisch' : scope === 'functional' ? 'fachlich' : scope;
  let text = `${art}${team ? `, ${team} ${einheit}` : ''}`;
  if (scope === 'disciplinary' && n?.leadership_also_functional === true) {
    const fach = zahl(n?.leadership_functional_size);
    text += `; fachlich zusätzlich${fach ? ` ${fach} Personen` : ''}`;
  }
  return text;
}
