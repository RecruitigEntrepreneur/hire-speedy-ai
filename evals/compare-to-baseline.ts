/**
 * CI-Gate: vergleicht den aktuellen Stand der Baseline-Engine gegen die
 * eingefrorene Baseline (evals/baselines/baseline.v1.json).
 *
 * Schlägt fehl (Exit 1), wenn eine Kern-Metrik um mehr als die Toleranz
 * regressiert. Verbesserungen bestehen das Gate, werden aber gemeldet —
 * eine bewusst aktualisierte Baseline erzeugt man mit:
 *   npm run eval:matching -- --write-baseline
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_V31_ADAPTERS } from './adapters/v31-baseline';
import type { MacroMetrics } from './lib/evaluate';
import { datasetSha256, evaluateAdapter, parseDataset } from './lib/evaluate';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Beide Golden-Datasets werden geprüft; Baseline-Datei folgt der Dataset-Version. */
const DATASETS = ['golden/matching/dataset.v1.json', 'golden/matching/dataset.real.v1.json'];

/** Absolute Toleranz pro Metrik; leak10 ist "kleiner ist besser". */
const TOLERANCE = 0.02;
const HIGHER_IS_BETTER: (keyof MacroMetrics)[] = ['recall10', 'recall50', 'recall100', 'ndcg10', 'mrr'];
const LOWER_IS_BETTER: (keyof MacroMetrics)[] = ['leak10'];

function checkDataset(datasetRelPath: string): boolean {
  const rawJson = readFileSync(resolve(HERE, datasetRelPath), 'utf8');
  const dataset = parseDataset(rawJson);
  const sha256 = datasetSha256(rawJson);
  const baselinePath = resolve(HERE, `baselines/baseline.${dataset.version}.json`);

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
    dataset_sha256: string;
    adapter: string;
    macro: MacroMetrics;
  };

  if (baseline.dataset_sha256 !== sha256) {
    console.error(
      `FEHLER [${dataset.version}]: Das Golden-Dataset hat sich seit dem Einfrieren der Baseline geändert.\n` +
        `Baseline bewusst neu erzeugen: npm run eval:matching -- --dataset evals/${datasetRelPath} --write-baseline`,
    );
    return false;
  }

  const adapter = ALL_V31_ADAPTERS.find((a) => a.name === baseline.adapter);
  if (!adapter) {
    console.error(`FEHLER [${dataset.version}]: Baseline-Adapter ${baseline.adapter} existiert nicht mehr.`);
    return false;
  }

  const current = evaluateAdapter(adapter, dataset).macro;
  const failures: string[] = [];
  const improvements: string[] = [];

  const check = (key: keyof MacroMetrics, higherIsBetter: boolean) => {
    const base = baseline.macro[key];
    const now = current[key];
    if (base === null || now === null) return;
    const delta = now - base;
    const regressed = higherIsBetter ? delta < -TOLERANCE : delta > TOLERANCE;
    const improved = higherIsBetter ? delta > TOLERANCE : delta < -TOLERANCE;
    const line = `${key}: ${base.toFixed(3)} → ${now.toFixed(3)} (Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(3)})`;
    if (regressed) failures.push(line);
    else if (improved) improvements.push(line);
  };

  for (const key of HIGHER_IS_BETTER) check(key, true);
  for (const key of LOWER_IS_BETTER) check(key, false);

  if (improvements.length > 0) {
    console.log(`[${dataset.version}] Verbesserungen gegenüber Baseline (ggf. bewusst aktualisieren):`);
    for (const l of improvements) console.log(`  + ${l}`);
  }
  if (failures.length > 0) {
    console.error(`[${dataset.version}] EVAL-REGRESSION gegenüber eingefrorener Baseline:`);
    for (const l of failures) console.error(`  - ${l}`);
    return false;
  }
  console.log(`[${dataset.version}] Eval-Gate bestanden (Adapter ${baseline.adapter}, Toleranz ±${TOLERANCE}).`);
  return true;
}

function main(): void {
  const ok = DATASETS.map(checkDataset).every(Boolean);
  if (!ok) {
    console.error('\nBuild abgebrochen. Änderung überarbeiten oder Baseline BEWUSST neu setzen (mit Begründung im PR).');
    process.exit(1);
  }
}

main();
