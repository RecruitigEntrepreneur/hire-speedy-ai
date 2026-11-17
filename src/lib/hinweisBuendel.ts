/**
 * Glocke (17.11.2026): Gleiche Meldungen, die direkt aufeinander folgen, stehen in einer Zeile.
 * Nur reine Info-Meldungen je Stelle werden gebündelt; alles, wobei jemand etwas tun muss,
 * bleibt eine eigene Zeile. Titel und Text kommen aus der Datenbank (Deutsch), daher lesen wir
 * Stelle und Headhunter aus dem Text („Name (Firma) sucht jetzt für „Stelle“.“).
 */

export const BUENDELBAR = new Set(['search_started', 'pause_ended', 'pause_ending']);

export interface BuendelHinweis {
  id: string;
  type: string | null;
  message: string | null;
  is_read: boolean | null;
}

export type GlockenEintrag<T extends BuendelHinweis> =
  | { art: 'einzeln'; key: string; hinweis: T }
  | { art: 'buendel'; key: string; type: string; hinweise: T[] };

/** Fasst direkt aufeinanderfolgende bündelbare Meldungen gleichen Typs zusammen (ab zwei). */
export function buendeln<T extends BuendelHinweis>(liste: T[]): GlockenEintrag<T>[] {
  const out: GlockenEintrag<T>[] = [];
  let i = 0;
  while (i < liste.length) {
    const n = liste[i];
    const type = n.type ?? '';
    let j = i + 1;
    if (BUENDELBAR.has(type)) while (j < liste.length && liste[j].type === type) j++;
    if (j - i >= 2) out.push({ art: 'buendel', key: `b-${n.id}`, type, hinweise: liste.slice(i, j) });
    else out.push({ art: 'einzeln', key: n.id, hinweis: n });
    i = j;
  }
  return out;
}

/** Stellentitel aus „…“, ohne „(m/w/d)“ am Ende. */
export function stelleAus(message: string | null): string | null {
  const m = message?.match(/„([^“”]+)[“”]/);
  if (!m) return null;
  return m[1].replace(/\s*\((?:m\/w\/d|w\/m\/d|m\/f\/d|f\/m\/d|w\/m\/x|m\/w\/x|all genders)\)\s*$/i, '').trim() || null;
}

/** Name des Headhunters vor „(Firma) sucht jetzt für“. */
export function headhunterAus(message: string | null): string | null {
  const m = message?.match(/^(.+?)\s+(?:\(.*\)\s+)?sucht jetzt für/);
  return m ? m[1].trim() : null;
}
