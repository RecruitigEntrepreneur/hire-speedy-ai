/**
 * Matching-Eval-Runner: ein Befehl, alle Metriken, versionierte Reports.
 *
 *   npm run eval:matching                          # alle Baseline-Varianten
 *   npm run eval:matching -- --adapter v31-live-config
 *   npm run eval:matching -- --write-baseline      # friert v31-live-config als CI-Baseline ein
 *
 * Schreibt JSON- + Markdown-Report nach evals/reports/ (timestamped).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_V31_ADAPTERS } from './adapters/v31-baseline';
import type { AdapterEvalResult, MacroMetrics } from './lib/evaluate';
import { datasetSha256, evaluateAdapter, parseDataset } from './lib/evaluate';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATASET = resolve(HERE, 'golden/matching/dataset.v1.json');
const REPORTS_DIR = resolve(HERE, 'reports');
/** Baseline-Datei ist pro Dataset-Version: baselines/baseline.<version>.json */
const baselinePathFor = (datasetVersion: string) => resolve(HERE, `baselines/baseline.${datasetVersion}.json`);
/**
 * Adapter, dessen Metriken als CI-Baseline dienen. Seit dem Config-Fix vom
 * 2026-07-18 (aktive matching_config-Zeile auf Code-Defaults korrigiert, via
 * Lovable, Backup-Zeile profile='backup-20260718') entspricht der Live-Zustand
 * der code-defaults-Variante; v31-live-config bildet den Zustand DAVOR ab.
 */
const BASELINE_ADAPTER = 'v31-code-defaults';

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(3);
}

function markdownReport(results: AdapterEvalResult[], datasetInfo: { version: string; sha256: string; jobs: number; candidates: number }): string {
  const lines: string[] = [];
  lines.push('# Matching-Eval-Report');
  lines.push('');
  lines.push(
    `Dataset: \`${datasetInfo.version}\` (synthetisch, ${datasetInfo.jobs} Jobs, ${datasetInfo.candidates} Kandidaten, sha256 \`${datasetInfo.sha256.slice(0, 12)}…\`)`,
  );
  lines.push('');
  lines.push('Richtung: Job → Kandidaten (gesamter Pool pro Job gerankt). Recall@100 ist bei');
  lines.push(`${datasetInfo.candidates} Pool-Kandidaten trivially 1.0 — aussagekräftig sind Recall@10/50, nDCG@10, MRR, Leak@10.`);
  lines.push('');
  lines.push('| Adapter | Recall@10 | Recall@50 | Recall@100 | nDCG@10 | MRR | HardNeg-Leak@10 |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    const m = r.macro;
    lines.push(
      `| \`${r.adapter}\` | ${fmt(m.recall10)} | ${fmt(m.recall50)} | ${fmt(m.recall100)} | ${fmt(m.ndcg10)} | ${fmt(m.mrr)} | ${fmt(m.leak10)} |`,
    );
  }
  lines.push('');
  for (const r of results) {
    lines.push(`## ${r.adapter}`);
    lines.push('');
    lines.push(r.description);
    lines.push('');
    lines.push(`Kill-/Exclusion-Statistik über ${r.scoredPairs} Paare:`);
    const entries = Object.entries(r.killStats).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) lines.push('- (keine Kills/Exclusions)');
    for (const [reason, count] of entries) lines.push(`- ${reason}: ${count}`);
    lines.push('');
    const lost = r.perJob.filter((j) => j.lostPositives.length > 0);
    if (lost.length > 0) {
      lines.push('Verlorene Positives (gekillt/ausgeschlossen — das sollte NIE passieren):');
      for (const j of lost) {
        for (const lp of j.lostPositives) lines.push(`- ${j.jobId}: ${lp.id} (${lp.reason})`);
      }
      lines.push('');
    }
    lines.push('| Job | Pos | HardNeg | R@10 | nDCG@10 | MRR | Leak@10 |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const j of r.perJob) {
      lines.push(
        `| ${j.jobId} | ${j.positives} | ${j.hardNegatives} | ${fmt(j.recall10)} | ${fmt(j.ndcg10)} | ${fmt(j.mrr)} | ${fmt(j.leak10)} |`,
      );
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const adapterFilters = args.flatMap((a, i) => (a === '--adapter' && args[i + 1] ? [args[i + 1]] : []));
  const datasetPath = args.includes('--dataset') ? args[args.indexOf('--dataset') + 1] : DEFAULT_DATASET;
  const writeBaseline = args.includes('--write-baseline');

  const rawJson = readFileSync(datasetPath, 'utf8');
  const dataset = parseDataset(rawJson);
  const sha256 = datasetSha256(rawJson);

  const adapters =
    adapterFilters.length > 0
      ? ALL_V31_ADAPTERS.filter((a) => adapterFilters.includes(a.name))
      : ALL_V31_ADAPTERS;
  if (adapters.length === 0) {
    throw new Error(`Kein Adapter gefunden für: ${adapterFilters.join(', ')} (verfügbar: ${ALL_V31_ADAPTERS.map((a) => a.name).join(', ')})`);
  }

  const results = adapters.map((a) => evaluateAdapter(a, dataset));

  const datasetInfo = {
    version: dataset.version,
    sha256,
    jobs: dataset.jobs.length,
    candidates: dataset.candidates.length,
  };
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, '-').slice(0, 19);

  mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = resolve(REPORTS_DIR, `${stamp}-matching.json`);
  const mdPath = resolve(REPORTS_DIR, `${stamp}-matching.md`);
  writeFileSync(jsonPath, `${JSON.stringify({ created_at: createdAt, dataset: datasetInfo, results }, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, markdownReport(results, datasetInfo), 'utf8');

  if (writeBaseline) {
    const baselineResult = results.find((r) => r.adapter === BASELINE_ADAPTER);
    if (!baselineResult) throw new Error(`--write-baseline braucht den Adapter ${BASELINE_ADAPTER}`);
    const baseline: { created_at: string; dataset_sha256: string; adapter: string; macro: MacroMetrics } = {
      created_at: createdAt,
      dataset_sha256: sha256,
      adapter: BASELINE_ADAPTER,
      macro: baselineResult.macro,
    };
    const baselinePath = baselinePathFor(dataset.version);
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    console.log(`Baseline eingefroren: ${baselinePath}`);
  }

  console.log(`Report: ${mdPath}`);
  for (const r of results) {
    const m = r.macro;
    console.log(
      `${r.adapter}: R@10=${fmt(m.recall10)} R@50=${fmt(m.recall50)} nDCG@10=${fmt(m.ndcg10)} MRR=${fmt(m.mrr)} Leak@10=${fmt(m.leak10)}`,
    );
  }
}

main();
