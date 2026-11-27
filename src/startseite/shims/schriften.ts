// Ersatz für next/font/google: die Schriften liegen als Dateien unter public/fonts/startseite
// (aus dem Labor übernommen, kein Abruf bei Google). Jede „Schrift“ liefert dieselbe Klasse, die die
// Variablen setzt (startseite/schriften.css).
type Schrift = { variable: string; className: string; style: { fontFamily: string } };
const s = (): Schrift => ({ variable: 'mu-schriften', className: 'mu-schriften', style: { fontFamily: 'inherit' } });
export const Figtree = (_o?: unknown) => s();
export const Inter_Tight = (_o?: unknown) => s();
export const Poppins = (_o?: unknown) => s();
export const Source_Serif_4 = (_o?: unknown) => s();
