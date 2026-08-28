import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * DRIFT GUARD für die eingefrorene V3.1-Baseline.
 *
 * matcher.ts ist eine verbatim-Kopie von supabase/functions/calculate-match-v3-1/index.ts
 * (Commit c966bd2), ohne Deno-Imports und serve()-Handler. Dieser Test stellt sicher:
 *
 * 1. Die Replika ist byte-identisch mit den referenzierten Zeilenbereichen der Quelldatei.
 * 2. Ändert jemand den Live-Matcher, schlägt dieser Test fehl — absichtlich.
 *    Dann gilt: Eval-Suite gegen die Änderung laufen lassen, Zahlen vergleichen und
 *    BEWUSST entscheiden, ob die Baseline neu eingefroren wird (Replika + Baseline-JSON
 *    aktualisieren) oder die Änderung zurückgenommen wird. Kein stilles Update.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(HERE, '../../../supabase/functions/calculate-match-v3-1/index.ts');
const REPLICA_PATH = resolve(HERE, 'matcher.ts');

const MARKER_BEGIN = '// >>> BEGIN VERBATIM SEGMENT 1 (source lines 5-591)';
const MARKER_SEAM = '// >>> SEAM (source lines 592-713 omitted: serve() handler and DB access)';
const MARKER_END = '// >>> END VERBATIM SEGMENT 2 (source lines 714-EOF)';

const DRIFT_HELP =
  'Der Live-Matcher (calculate-match-v3-1/index.ts) weicht von der eingefrorenen ' +
  'Baseline-Replika ab. Das ist ein bewusstes Gate: Eval-Suite laufen lassen ' +
  '(npm run eval:matching), Metriken vergleichen, dann entweder (a) die Baseline ' +
  'explizit neu einfrieren (Replika-Segmente + evals/baselines/ aktualisieren) ' +
  'oder (b) die Matcher-Änderung überdenken. Siehe evals/README.md.';

function sliceLines(text: string, fromLine1: number, toLine1?: number): string {
  const lines = text.split('\n');
  const slice = toLine1 === undefined ? lines.slice(fromLine1 - 1) : lines.slice(fromLine1 - 1, toLine1);
  return slice.join('\n').trimEnd();
}

function replicaSegment(replica: string, startMarker: string, endMarker: string): string {
  const start = replica.indexOf(startMarker);
  const end = replica.indexOf(endMarker);
  expect(start, `Marker fehlt in matcher.ts: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `Marker fehlt in matcher.ts: ${endMarker}`).toBeGreaterThan(start);
  return replica.slice(start + startMarker.length, end).replace(/^\n/, '').trimEnd();
}

describe('V3.1 Baseline-Replika Drift-Guard', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const replica = readFileSync(REPLICA_PATH, 'utf8');

  it('Segment 1 (Konstanten, Domain-Erkennung, Typen, Synonym-Map) ist byte-identisch', () => {
    const expected = sliceLines(source, 5, 591);
    const actual = replicaSegment(replica, MARKER_BEGIN, MARKER_SEAM);
    expect(actual === expected, DRIFT_HELP).toBe(true);
  });

  it('Segment 2 (buildConfig + komplette Scoring-Pipeline) ist byte-identisch', () => {
    const expected = sliceLines(source, 714);
    const actual = replicaSegment(replica, MARKER_SEAM, MARKER_END);
    expect(actual === expected, DRIFT_HELP).toBe(true);
  });

  it('die ausgelassenen Zeilen 592-713 enthalten nur Handler/DB-Zugriff, keine Scoring-Logik', () => {
    const omitted = sliceLines(source, 592, 713);
    // Wenn im ausgelassenen Bereich plötzlich function-Deklarationen auftauchen,
    // wurde Scoring-Logik in den Handler verschoben — Replika wäre unvollständig.
    expect(omitted.includes('serve(async'), DRIFT_HELP).toBe(true);
    expect(/\nfunction\s/.test(omitted), DRIFT_HELP).toBe(false);
  });
});
