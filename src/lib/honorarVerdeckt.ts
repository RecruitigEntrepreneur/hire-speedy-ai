import { useCallback, useSyncExternalStore } from 'react';

/**
 * „Honorar ausblenden“ (21.10.2026): das Auge in der Kopfleiste verdeckt jeden
 * Betrag, der das eigene Geld des Headhunters zeigt -- Verdienst, Honorar,
 * Honorar-Prozent, offenes Honorar, Verdienste, Auszahlungen --, wie bei einer
 * Wallet. Gemerkt pro Gerät (im Büro verdeckt, zu Hause nicht), gilt in allen
 * offenen Tabs. Gehalt und Tagessatz des Kandidaten bleiben sichtbar.
 */
const SCHLUESSEL = 'matchunt.honorar-verdeckt';
const hoerer = new Set<() => void>();

function lesen(): boolean {
  try { return window.localStorage.getItem(SCHLUESSEL) === '1'; } catch { return false; }
}

let stand = typeof window === 'undefined' ? false : lesen();
const melden = () => { for (const h of hoerer) h(); };

export function setHonorarVerdeckt(an: boolean) {
  stand = an;
  try {
    if (an) window.localStorage.setItem(SCHLUESSEL, '1');
    else window.localStorage.removeItem(SCHLUESSEL);
  } catch { /* privates Fenster: gilt dann nur bis zum Neuladen */ }
  melden();
}

function abonnieren(h: () => void) {
  hoerer.add(h);
  const andererTab = (e: StorageEvent) => { if (e.key === SCHLUESSEL) { stand = lesen(); melden(); } };
  window.addEventListener('storage', andererTab);
  return () => { hoerer.delete(h); window.removeEventListener('storage', andererTab); };
}

export function useHonorarVerdeckt(): boolean {
  return useSyncExternalStore(abonnieren, () => stand, () => false);
}

export const VERDECKT = '•••••';

// Zahl mit Tausenderpunkt/Komma, optional „k“/„Tsd.“; Spannen mit – oder -.
const ZAHL = String.raw`\d[\d.,]*(?:\s?(?:k|Tsd\.?))?`;
const SPANNE = String.raw`(?:\s?[–-]\s?€?\s?${ZAHL})?`;
const EURO = new RegExp(String.raw`€\s?${ZAHL}${SPANNE}|${ZAHL}${SPANNE}\s?(?:€|EUR\b)`, 'g');
const PROZENT = /\d+(?:[.,]\d+)?\s?%/g;

/**
 * Verdeckt alle Euro-Beträge und Prozentwerte in einem Text:
 * „13.125 €“ → „••••• €“, „€892k“ → „••••• €“, „15 % Honorar“ → „•• % Honorar“.
 * Nur für Texte, die ausschließlich eigenes Geld nennen.
 */
export function verdeckeBetraege(text: string): string {
  return text.replace(EURO, `${VERDECKT} €`).replace(PROZENT, '•• %');
}

/** Für zusammengesetzte Texte (Aufgaben, Hinweise): gibt `text` verdeckt oder unverändert zurück. */
export function useVerdecke(): (text: string) => string {
  const verdeckt = useHonorarVerdeckt();
  return useCallback((text: string) => (verdeckt ? verdeckeBetraege(text) : text), [verdeckt]);
}
