/**
 * Darstellung auf diesem Gerät (Einstellungen › Darstellung, 16.11.2026): Schriftgröße und
 * „weniger Bewegung“. Gilt sofort für die ganze App, gemerkt im Browser wie Hell/Dunkel.
 */
export type Schrift = 'klein' | 'normal' | 'gross';

const SCHRIFT_KEY = 'matchunt.schrift';
const BEWEGUNG_KEY = 'matchunt.weniger-bewegung';
const EVENT = 'matchunt:ansicht';
const PX: Record<Schrift, string> = { klein: '15px', normal: '', gross: '17.5px' };

function lies(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function schreib(key: string, wert: string | null) {
  try { if (wert === null) localStorage.removeItem(key); else localStorage.setItem(key, wert); } catch { /* privater Modus */ }
}

export function schrift(): Schrift {
  const s = lies(SCHRIFT_KEY);
  return s === 'klein' || s === 'gross' ? s : 'normal';
}
export function wenigerBewegung(): boolean {
  return lies(BEWEGUNG_KEY) === '1';
}

/** Setzt Schriftgröße und Bewegung am Dokument. Beim Start und nach jeder Änderung. */
export function ansichtAnwenden() {
  const root = document.documentElement;
  root.style.fontSize = PX[schrift()];
  root.classList.toggle('weniger-bewegung', wenigerBewegung());
}

export function setSchrift(s: Schrift) {
  schreib(SCHRIFT_KEY, s === 'normal' ? null : s);
  ansichtAnwenden();
  window.dispatchEvent(new Event(EVENT));
}
export function setWenigerBewegung(an: boolean) {
  schreib(BEWEGUNG_KEY, an ? '1' : null);
  ansichtAnwenden();
  window.dispatchEvent(new Event(EVENT));
}
export const ANSICHT_EVENT = EVENT;
