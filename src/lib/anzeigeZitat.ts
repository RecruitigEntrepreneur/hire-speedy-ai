/**
 * Zitate aus der Anzeige (Entscheidung Marko 13.11.2026): Faehrt man ueber
 * "aus der Anzeige", erscheint der Satz, aus dem ein Wert stammt.
 *
 * Gesucht wird hier im Browser, im Wortlaut der Anzeige -- nicht vom Modell
 * geliefert. Damit kann nur ein Satz erscheinen, der woertlich in der Anzeige
 * steht. Findet sich keiner, ist der Wert abgeleitet, und das wird so gesagt.
 */

export interface Zitat {
  /** Hoechstens zwei Saetze aus der Anzeige, woertlich. */
  saetze: string[];
  /** false: Teile des Werts stehen so nicht in der Anzeige (abgeleitet). */
  vollstaendig: boolean;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

/** Woerter ohne Aussage -- sie wuerden jeden Satz treffen. */
const OHNE = new Set([
  'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'mit', 'von', 'vor',
  'bei', 'fur', 'auf', 'aus', 'nach', 'uber', 'unter', 'wir', 'sie', 'ihr', 'ihre', 'ihren', 'unser', 'unsere', 'ist', 'sind',
  'wird', 'werden', 'auch', 'als', 'wie', 'bis', 'zum', 'zur', 'nicht', 'kein', 'keine', 'sehr', 'gut', 'gute', 'guter',
  'pro', 'per', 'jahr', 'the', 'and', 'des', 'eines',
]);

/** Woerter ab drei Buchstaben, Zahlen ab zwei Ziffern ("13 Monatsgehaelter"). */
const woerter = (s: string) =>
  norm(s).split(/[^a-z0-9]+/).filter((w) => (/^\d+$/.test(w) ? w.length >= 2 : w.length >= 3) && !OHNE.has(w));

/** Ein Wert als Text -- Listen, Spannen, Gewichtungen. */
export function wertAlsText(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? Object.values(x).join(' ') : String(x))).join(' ');
  if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${String(x)}`).join(' ');
  return String(v ?? '');
}

/** Die Anzeige in Saetze und Aufzaehlungspunkte zerlegt. */
export function anzeigeSaetze(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((zeile) => zeile.split(/(?<=[.!?;])\s+/))
    .map((s) => s.replace(/^[\s\-–•*·]+/, '').trim())
    .filter((s) => s.length >= 6);
}

/**
 * Der Satz (hoechstens zwei), aus dem ein Wert stammt. null: nichts in der
 * Anzeige, was den Wert traegt.
 */
export function findeZitat(anzeige: string | null | undefined, wert: unknown): Zitat | null {
  if (!anzeige) return null;
  // Eine Liste (z. B. Alleinstellungsmerkmale): jeder Punkt fuer sich.
  if (Array.isArray(wert) && wert.every((x) => typeof x === 'string')) {
    const je = (wert as string[]).map((x) => findeZitat(anzeige, x));
    const saetze = [...new Set(je.flatMap((z) => z?.saetze ?? []))].slice(0, 2);
    if (!saetze.length) return null;
    return { saetze, vollstaendig: je.every((z) => z?.vollstaendig) };
  }
  const gesucht = [...new Set(woerter(wertAlsText(wert)).map((w) => w.slice(0, 5)))];
  if (!gesucht.length) return null;
  const saetze = anzeigeSaetze(anzeige);
  const treffer = (satz: string) => {
    const ws = woerter(satz);
    return new Set(gesucht.filter((g) => ws.some((w) => w.startsWith(g))));
  };
  const bewertet = saetze.map((s) => ({ s, t: treffer(s) })).filter((x) => x.t.size > 0)
    .sort((a, b) => b.t.size - a.t.size || a.s.length - b.s.length);
  if (!bewertet.length) return null;
  const erster = bewertet[0];
  // Lange, umformulierte Texte (Arbeitsalltag) treffen selten viele Woerter.
  const mindest = gesucht.length <= 2 ? 0.5 : gesucht.length <= 8 ? 0.34 : 0.2;
  if (erster.t.size / gesucht.length < mindest) return null;
  const gedeckt = new Set(erster.t);
  const zweiter = bewertet.slice(1).find((x) => [...x.t].some((g) => !gedeckt.has(g)));
  zweiter?.t.forEach((g) => gedeckt.add(g));
  const kurz = (s: string) => (s.length > 220 ? `${s.slice(0, 217)}…` : s);
  return {
    saetze: [erster.s, ...(zweiter ? [zweiter.s] : [])].map(kurz),
    vollstaendig: gedeckt.size === gesucht.length,
  };
}

/** Gleicher Wert? Listen ohne Reihenfolge, Text ohne Gross/Klein. */
export function gleicherWert(a: unknown, b: unknown): boolean {
  const n = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase()).sort().join('|')
      : v && typeof v === 'object' ? JSON.stringify(v)
        : String(v ?? '').trim().toLowerCase();
  return n(a) === n(b);
}
