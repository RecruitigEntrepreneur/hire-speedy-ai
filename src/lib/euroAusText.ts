/**
 * Eine Zahl aus dem, was jemand ins Eurofeld tippt (27.11.2026, Durchklick Marko:
 * „hier könnte jemand auch nur 55 schreiben“). Versteht „55.000“, „55000“,
 * „55 000“, „55k“, „55 Tsd.“ und „55,5“. `tausender`: beim Jahresgehalt heißt
 * eine Zahl unter 1.000 Tausend Euro -- „55“ wird 55.000.
 */
export function euroAusText(text: string, tausender = false): { wert: number | null; alsTausend: boolean } {
  const s = text.trim().toLowerCase();
  if (!s) return { wert: null, alsTausend: false };
  const k = /(k|tsd\.?|tausend)\s*$/.test(s);
  const zahl = s.replace(/k|tsd\.?|tausend|€|eur(o)?/g, '').trim();
  const m = zahl.match(/^(\d{1,3}(?:[.,\s\u00a0\u202f]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/);
  let n = m
    ? Number(m[1].replace(/[.,\s\u00a0\u202f]/g, '') + (m[2] ? `.${m[2]}` : ''))
    : Number(zahl.replace(/\D/g, '').slice(0, 7) || NaN);
  if (!Number.isFinite(n) || n <= 0) return { wert: null, alsTausend: false };
  const alsTausend = k || (tausender && n < 1000);
  if (alsTausend) n *= 1000;
  return { wert: Math.min(Math.round(n), 9_999_999), alsTausend };
}
