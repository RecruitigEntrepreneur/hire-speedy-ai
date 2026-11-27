/**
 * Text fuer die PDF-Standardschriften (Helvetica, WinAnsi) druckbar machen.
 *
 * pdf-lib wirft bei JEDEM Zeichen ausserhalb des Zeichensatzes der Schrift --
 * und zwar das ganze Dokument weg. Ein einziges "ł", ein Pfeil oder ein
 * unsichtbares Leerzeichen aus einer kopierten Firmenangabe genuegte, und der
 * Kunde stand in der Jobaufnahme vor "Das Dokument konnte nicht erzeugt
 * werden." (25.11.2026). Ein Vertrag, der ein Zeichen vereinfacht schreibt, ist
 * besser als gar kein Vertrag.
 *
 * Reihenfolge: behalten, was die Schrift kann -> bekannte Ersetzung ->
 * Akzent abtrennen (ć -> c) -> "?".
 *
 * Ohne Abhaengigkeiten, damit es unter Deno und in den Tests gleich laeuft.
 */

const ERSATZ: Record<string, string> = {
  // Buchstaben, die sich nicht in Grundbuchstabe + Akzent zerlegen lassen
  'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ħ': 'h', 'Ħ': 'H',
  'ŋ': 'n', 'Ŋ': 'N', 'ĸ': 'k', 'ŧ': 't', 'Ŧ': 'T', 'ẞ': 'SS', 'ĳ': 'ij', 'Ĳ': 'IJ',
  // Striche und Anfuehrungszeichen
  '‐': '-', '‑': '-', '‒': '-', '―': '-', '−': '-', '⁃': '-',
  '‛': "'", '′': "'", '‟': '"', '″': '"', '‹': '<', '›': '>',
  // Pfeile, Vergleiche, Haken, Aufzaehlungszeichen
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '⇐': '<=',
  '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '∙': '·', '⋅': '·',
  '✓': 'x', '✔': 'x', '☑': '[x]', '☐': '[ ]', '■': '-', '□': '-', '▪': '-', '●': '•', '○': 'o', '◦': 'o',
};

/** Leerraum, den die Schrift nicht kennt: schmale, breite und geschuetzte Leerzeichen, Tabulator. */
const LEERRAUM = /[\t\v\f\r\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g;
/** Unsichtbares: Breite-Null-Zeichen, Schreibrichtungsmarken, BOM, Variantenselektoren, Steuerzeichen. */
const UNSICHTBAR = /[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFE00-\uFE0F\uFEFF]/g;

/**
 * @param text  beliebiger Text; Zeilenumbrueche (\n) bleiben erhalten
 * @param kann  ob die Schrift den Codepoint darstellen kann (PDFFont.getCharacterSet())
 */
export function pdfSicher(text: unknown, kann: (codepoint: number) => boolean): string {
  const roh = String(text ?? '').normalize('NFC').replace(LEERRAUM, ' ').replace(UNSICHTBAR, '');
  let out = '';
  for (const zeichen of roh) {
    if (zeichen === '\n' || kann(zeichen.codePointAt(0)!)) { out += zeichen; continue; }
    const ersatz = ERSATZ[zeichen]
      // NFKD zerlegt "ć" in "c" + Akzent, "ﬁ" in "fi", "²" in "2"; die Akzente fallen weg.
      ?? zeichen.normalize('NFKD').replace(/\p{M}/gu, '');
    let teil = '';
    for (const z of ersatz) teil += kann(z.codePointAt(0)!) ? z : '';
    out += teil || '?';
  }
  return out;
}
