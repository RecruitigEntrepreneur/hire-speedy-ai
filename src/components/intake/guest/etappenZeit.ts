import { completeness } from '@/lib/briefCatalog';

/** Gerechnet, nicht gemessen (Entscheidung 02.11.: Rechnung zeigen, parallel messen). */
export const SEKUNDEN: Record<string, number> = { chips: 6, multi: 12, number: 8, short: 10, range: 20, ai: 40, text: 40, struktur: 40, date: 8 };

/**
 * Die Zeit fuer eine leere Aufnahme -- fuer den Einstieg, damit dort dieselbe
 * Zahl steht wie danach im Kopf.
 */
export function minutenOhneAnzeige(type: 'full-time' | 'freelance'): number {
  const offen = completeness({}, type).offen.filter((sl) => sl.q.key !== 'kriterien');
  const sek = offen.reduce((n, sl) => n + (SEKUNDEN[sl.form] ?? 10), 0) + 20 + 60 + 30;
  const schritte = new Set(offen.map((sl) => sl.q.key)).size + 3;
  return Math.max(1, Math.round((sek + schritte * 6) / 60));
}

