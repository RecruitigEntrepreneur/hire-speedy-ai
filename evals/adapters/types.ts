/**
 * Gemeinsame Schnittstelle für alle Matching-Implementierungen im Eval-Harness.
 *
 * Ein Adapter bewertet ein (Kandidat, Job)-Paar und liefert einen sortierbaren
 * Score. Der Runner (evals/run-matching-eval.ts) rankt damit pro Job alle
 * Kandidaten des Datasets und berechnet Recall@K, nDCG@10, MRR und die
 * Hard-Negative-Leak-Rate. Neue Engines (V2-Retrieval, Reranker, LLM-Judge)
 * implementieren dieselbe Schnittstelle und werden gegen dieselben Fixtures
 * gemessen.
 */

import type { GoldenCandidate, GoldenDataset, GoldenJob } from '../golden/matching/schema';

export interface PairScore {
  /** Sortier-Score (höher = besser). Gekillte/ausgeschlossene Paare: 0. */
  score: number;
  killed: boolean;
  excluded: boolean;
  /** Kill-/Exclusion-Grund für die Diagnose-Statistik (z. B. 'visa', 'language', 'coverage'). */
  reason?: string;
  /** Anzeige-Tier der Engine ('hot' | 'standard' | 'maybe' | 'hidden'), falls vorhanden. */
  policy?: string;
  /** Roh-Ergebnis der Engine für Debugging/Reports. */
  raw?: unknown;
}

export interface AdapterContext {
  dataset: GoldenDataset;
  /** Fester Zeitpunkt (ms epoch) für alle Datumslogik — Determinismus. */
  referenceNowMs: number;
}

export interface MatcherAdapter {
  name: string;
  description: string;
  /** Einmalige Vorbereitung (Synonym-Map etc.); vor scorePair aufgerufen. */
  prepare?(ctx: AdapterContext): void;
  scorePair(candidate: GoldenCandidate, job: GoldenJob, ctx: AdapterContext): PairScore;
}
