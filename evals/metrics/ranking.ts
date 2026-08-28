/**
 * Ranking-Metriken für Matching-Evals.
 *
 * Konventionen:
 * - `ranked` ist die vollständige, absteigend sortierte ID-Liste eines Rankings.
 * - Metriken liefern null, wenn sie für den Fall undefiniert sind (z. B. keine
 *   Positives) — Makro-Mittel lassen nulls aus, statt mit 0 zu verfälschen.
 */

export function recallAtK(ranked: string[], positives: ReadonlySet<string>, k: number): number | null {
  if (positives.size === 0) return null;
  const topK = ranked.slice(0, k);
  let hit = 0;
  for (const id of topK) if (positives.has(id)) hit++;
  return hit / positives.size;
}

/**
 * nDCG@k mit graduierter Relevanz (Gain 2^grade - 1).
 * `grades` enthält nur gelabelte IDs; alles andere zählt als Grade 0.
 */
export function ndcgAtK(ranked: string[], grades: ReadonlyMap<string, number>, k: number): number | null {
  const gain = (g: number) => 2 ** g - 1;
  let dcg = 0;
  ranked.slice(0, k).forEach((id, i) => {
    dcg += gain(grades.get(id) ?? 0) / Math.log2(i + 2);
  });
  const ideal = [...grades.values()].filter((g) => g > 0).sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  ideal.forEach((g, i) => {
    idcg += gain(g) / Math.log2(i + 2);
  });
  if (idcg === 0) return null;
  return dcg / idcg;
}

/** Mean Reciprocal Rank (hier: Reciprocal Rank des ersten Positives). */
export function reciprocalRank(ranked: string[], positives: ReadonlySet<string>): number | null {
  if (positives.size === 0) return null;
  const idx = ranked.findIndex((id) => positives.has(id));
  return idx === -1 ? 0 : 1 / (idx + 1);
}

/**
 * Hard-Negative-Leak@k: Anteil der explizit abgelehnten Kandidaten, die
 * trotzdem in den Top-k landen. 0 = sauber, 1 = alle Abgelehnten oben.
 */
export function hardNegativeLeakAtK(
  ranked: string[],
  hardNegatives: ReadonlySet<string>,
  k: number,
): number | null {
  if (hardNegatives.size === 0) return null;
  const topK = new Set(ranked.slice(0, k));
  let leaked = 0;
  for (const id of hardNegatives) if (topK.has(id)) leaked++;
  return leaked / hardNegatives.size;
}

/** Makro-Mittel; null-Einträge (undefinierte Fälle) werden ausgelassen. */
export function macroAverage(values: readonly (number | null)[]): number | null {
  const defined = values.filter((v): v is number => v !== null);
  if (defined.length === 0) return null;
  return defined.reduce((a, b) => a + b, 0) / defined.length;
}
