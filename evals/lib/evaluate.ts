/**
 * Gemeinsame Evaluierungs-Logik: rankt pro Job den gesamten Kandidatenpool
 * mit einem Adapter und berechnet die Metrik-Suite. Wird vom Report-Runner
 * (run-matching-eval.ts) und vom CI-Gate (compare-to-baseline.ts) genutzt.
 */

import { createHash } from 'node:crypto';
import type { MatcherAdapter } from '../adapters/types';
import {
  GoldenDataset,
  GoldenDatasetSchema,
  LABEL_GRADES,
  isPositiveLabel,
} from '../golden/matching/schema';
import {
  hardNegativeLeakAtK,
  macroAverage,
  ndcgAtK,
  recallAtK,
  reciprocalRank,
} from '../metrics/ranking';

export interface JobEvalResult {
  jobId: string;
  title: string;
  positives: number;
  hardNegatives: number;
  recall10: number | null;
  recall50: number | null;
  recall100: number | null;
  ndcg10: number | null;
  mrr: number | null;
  leak10: number | null;
  /** Top-5 des Rankings zur Sichtprüfung: id, score, ggf. Kill-Grund. */
  top5: { id: string; score: number; note?: string }[];
  /** Positives, die gekillt/ausgeschlossen wurden (Diagnose). */
  lostPositives: { id: string; reason: string }[];
}

export interface MacroMetrics {
  recall10: number | null;
  recall50: number | null;
  recall100: number | null;
  ndcg10: number | null;
  mrr: number | null;
  leak10: number | null;
}

export interface AdapterEvalResult {
  adapter: string;
  description: string;
  macro: MacroMetrics;
  perJob: JobEvalResult[];
  /** Anzahl (Kandidat, Job)-Paare je Kill-/Exclusion-Grund. */
  killStats: Record<string, number>;
  scoredPairs: number;
}

export function datasetSha256(rawJson: string): string {
  return createHash('sha256').update(rawJson).digest('hex');
}

function tieBreakHash(jobId: string, candidateId: string): string {
  return createHash('sha256').update(`${jobId}::${candidateId}`).digest('hex');
}

export function parseDataset(rawJson: string): GoldenDataset {
  return GoldenDatasetSchema.parse(JSON.parse(rawJson));
}

export function evaluateAdapter(adapter: MatcherAdapter, dataset: GoldenDataset): AdapterEvalResult {
  const referenceNowMs = Date.parse(dataset.reference_date);
  const ctx = { dataset, referenceNowMs };
  adapter.prepare?.(ctx);

  const killStats: Record<string, number> = {};
  const perJob: JobEvalResult[] = [];
  let scoredPairs = 0;

  for (const jobEntity of dataset.jobs) {
    const labels = dataset.labels.filter((l) => l.job_id === jobEntity.id);
    const positives = new Set(labels.filter((l) => isPositiveLabel(l.label)).map((l) => l.candidate_id));
    const hardNegatives = new Set(labels.filter((l) => l.label === 'rejected').map((l) => l.candidate_id));
    const grades = new Map(labels.map((l) => [l.candidate_id, LABEL_GRADES[l.label]]));

    const scored = dataset.candidates.map((candidate) => {
      const pair = adapter.scorePair(candidate, jobEntity, ctx);
      scoredPairs++;
      if (pair.reason) killStats[pair.reason] = (killStats[pair.reason] ?? 0) + 1;
      // Tie-Break über Hash statt ID: die IDs korrelieren mit den Job-Pools
      // (cand-backend-* etc.) — alphabetische Ordnung würde bei Massen-Kills
      // (alle Scores 0) die Metriken systematisch verzerren.
      return { id: candidate.id, pair, tieBreak: tieBreakHash(jobEntity.id, candidate.id) };
    });

    // Deterministisch: Score absteigend, bei Gleichstand namens-unkorrelierter Hash.
    scored.sort((a, b) => b.pair.score - a.pair.score || a.tieBreak.localeCompare(b.tieBreak, 'en'));
    const ranked = scored.map((s) => s.id);

    perJob.push({
      jobId: jobEntity.id,
      title: jobEntity.title,
      positives: positives.size,
      hardNegatives: hardNegatives.size,
      recall10: recallAtK(ranked, positives, 10),
      recall50: recallAtK(ranked, positives, 50),
      recall100: recallAtK(ranked, positives, 100),
      ndcg10: ndcgAtK(ranked, grades, 10),
      mrr: reciprocalRank(ranked, positives),
      leak10: hardNegativeLeakAtK(ranked, hardNegatives, 10),
      top5: scored.slice(0, 5).map((s) => ({
        id: s.id,
        score: s.pair.score,
        ...(s.pair.reason ? { note: s.pair.reason } : {}),
      })),
      lostPositives: scored
        .filter((s) => positives.has(s.id) && (s.pair.killed || s.pair.excluded))
        .map((s) => ({ id: s.id, reason: s.pair.reason ?? 'unbekannt' })),
    });
  }

  const macro: MacroMetrics = {
    recall10: macroAverage(perJob.map((j) => j.recall10)),
    recall50: macroAverage(perJob.map((j) => j.recall50)),
    recall100: macroAverage(perJob.map((j) => j.recall100)),
    ndcg10: macroAverage(perJob.map((j) => j.ndcg10)),
    mrr: macroAverage(perJob.map((j) => j.mrr)),
    leak10: macroAverage(perJob.map((j) => j.leak10)),
  };

  return {
    adapter: adapter.name,
    description: adapter.description,
    macro,
    perJob,
    killStats,
    scoredPairs,
  };
}
