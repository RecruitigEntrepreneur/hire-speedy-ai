/**
 * Sprachen im Interview und in der Akte (05.11.2026): Vorschläge beim Tippen und häufige
 * Sprachen zum Antippen, damit „ita“ oder „spani“ nicht so beim Kunden und im Matching landet.
 * Was nicht in der Liste steht, bleibt als getippter Text erlaubt.
 */
export const SPRACHEN = [
  'Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch', 'Portugiesisch', 'Niederländisch',
  'Polnisch', 'Tschechisch', 'Slowakisch', 'Ungarisch', 'Rumänisch', 'Bulgarisch', 'Kroatisch',
  'Serbisch', 'Bosnisch', 'Slowenisch', 'Albanisch', 'Griechisch', 'Türkisch', 'Russisch', 'Ukrainisch',
  'Schwedisch', 'Norwegisch', 'Dänisch', 'Finnisch', 'Estnisch', 'Lettisch', 'Litauisch', 'Luxemburgisch',
  'Arabisch', 'Hebräisch', 'Persisch', 'Kurdisch', 'Chinesisch', 'Japanisch', 'Koreanisch', 'Hindi',
  'Urdu', 'Vietnamesisch', 'Thailändisch', 'Indonesisch', 'Tagalog', 'Gebärdensprache',
];

/** Häufig gefragt, in dieser Reihenfolge. Die ersten fehlenden stehen gestrichelt unter den Zeilen. */
const HAEUFIG = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch'];

// Andere Schreibweisen, die beim Tippen zur deutschen Bezeichnung führen.
const ANDERE: Record<string, string> = {
  english: 'Englisch', german: 'Deutsch', french: 'Französisch', spanish: 'Spanisch', italian: 'Italienisch',
  portuguese: 'Portugiesisch', dutch: 'Niederländisch', polish: 'Polnisch', russian: 'Russisch', turkish: 'Türkisch',
  mandarin: 'Chinesisch', farsi: 'Persisch', flämisch: 'Niederländisch', holländisch: 'Niederländisch',
  kantonesisch: 'Chinesisch', thai: 'Thailändisch', dgs: 'Gebärdensprache',
};

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Steht genau so in der Liste (Groß/klein egal)? */
export function istBekannteSprache(s: string): boolean {
  const n = norm(s);
  return SPRACHEN.some((x) => norm(x) === n);
}

/**
 * Passende Sprachen zum Getippten: erst die, die so anfangen, dann die, die es enthalten.
 * Schon eingetragene Sprachen fehlen. Leere Eingabe oder ein exakter Treffer: keine Liste.
 */
export function sprachVorschlaege(eingabe: string, schon: string[] = [], max = 6): string[] {
  const n = norm(eingabe);
  if (!n || istBekannteSprache(eingabe)) return [];
  const vorhanden = new Set(schon.map(norm));
  const frei = (x: string) => !vorhanden.has(norm(x));
  const anfang = SPRACHEN.filter((x) => norm(x).startsWith(n));
  const andere = Object.entries(ANDERE).filter(([k]) => norm(k).startsWith(n)).map(([, v]) => v);
  const enthalten = n.length >= 3 ? SPRACHEN.filter((x) => norm(x).includes(n)) : [];
  return [...new Set([...anfang, ...andere, ...enthalten])].filter(frei).slice(0, max);
}

/** Häufige Sprachen, die noch fehlen (höchstens drei). */
export function haeufigFehlend(schon: string[], max = 3): string[] {
  const vorhanden = new Set(schon.map(norm));
  return HAEUFIG.filter((x) => !vorhanden.has(norm(x))).slice(0, max);
}
