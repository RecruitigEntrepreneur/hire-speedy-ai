/**
 * Baut evals/golden/matching/taxonomy.fixture.json aus den Seed-Migrationen.
 *
 * Der Live-Matcher lädt skill_taxonomy und skill_synonyms zur Laufzeit aus der
 * DB. Für den Eval-Harness frieren wir den Stand ein, den die Migrationen
 * erzeugen — inklusive der DB-Semantik: Anwendung in Timestamp-Reihenfolge,
 * ON CONFLICT DO UPDATE aktualisiert nur die im SET genannten Spalten,
 * ON CONFLICT DO NOTHING überspringt Duplikate, Spalten-Defaults
 * (confidence 1.0, bidirectional true, active true) werden aufgefüllt.
 *
 * Achtung: Die Live-DB kann davon abweichen (Admin-Edits). Sobald DB-Zugang
 * besteht, wird das Fixture durch einen echten Export ersetzt (TODO in
 * docs/ai/AI_ROADMAP.md).
 *
 * Aufruf: npx tsx evals/tools/build-taxonomy-fixture.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_PATH = resolve(ROOT, 'evals/golden/matching/taxonomy.fixture.json');

/** Seed-Migrationen in Anwendungs-Reihenfolge (Timestamp aufsteigend). */
const SEED_MIGRATIONS = [
  'supabase/migrations/20251213030355_2b592422-1978-4c82-b080-c073cb44d732.sql',
  'supabase/migrations/20260122212342_6d5f5cb2-7637-4a06-baf5-b1d5c7e074f8.sql',
  'supabase/migrations/20260124144038_4640af9b-2340-4bec-addd-f481342d9043.sql',
  'supabase/migrations/20260125151941_84c5fdb6-25af-4e15-94e0-caa6f68ed0a9.sql',
];

type SqlValue = string | number | boolean | null | string[] | Record<string, unknown>;

interface InsertBlock {
  table: 'skill_taxonomy' | 'skill_synonyms';
  columns: string[];
  tuples: SqlValue[][];
  /** 'none' = kein ON CONFLICT, 'nothing' = DO NOTHING, sonst: Spalten des DO UPDATE SET */
  conflict: 'none' | 'nothing' | string[];
}

// ---------------------------------------------------------------------------
// SQL-Parsing (bewusst nur für die bekannten Seed-Formate, kein General-Parser)
// ---------------------------------------------------------------------------

function parseInsertBlocks(sql: string): InsertBlock[] {
  const blocks: InsertBlock[] = [];
  const insertRe = /INSERT INTO\s+(?:public\.)?(skill_taxonomy|skill_synonyms)\s*\(([^)]*)\)\s*VALUES/gi;
  let m: RegExpExecArray | null;
  while ((m = insertRe.exec(sql)) !== null) {
    const table = m[1] as InsertBlock['table'];
    const columns = m[2].split(',').map((c) => c.trim().toLowerCase());
    const { tuples, conflict } = scanValues(sql, insertRe.lastIndex);
    blocks.push({ table, columns, tuples, conflict });
  }
  return blocks;
}

function scanValues(sql: string, start: number): { tuples: SqlValue[][]; conflict: InsertBlock['conflict'] } {
  const tuples: SqlValue[][] = [];
  let conflict: InsertBlock['conflict'] = 'none';
  let i = start;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === '(') {
      const { fields, end } = parseTuple(sql, i);
      tuples.push(fields);
      i = end;
    } else if (ch === ';') {
      break;
    } else if (sql.slice(i, i + 11).toUpperCase() === 'ON CONFLICT') {
      const semi = sql.indexOf(';', i);
      const clause = sql.slice(i, semi === -1 ? sql.length : semi);
      if (/DO NOTHING/i.test(clause)) {
        conflict = 'nothing';
      } else {
        // Spalten aus "DO UPDATE SET col = EXCLUDED.col, ..." ziehen
        const cols = [...clause.matchAll(/(\w+)\s*=\s*EXCLUDED\./gi)].map((x) => x[1].toLowerCase());
        conflict = cols;
      }
      break;
    } else if (sql.slice(i, i + 2) === '--') {
      i = sql.indexOf('\n', i);
      if (i === -1) break;
    } else {
      i++;
    }
  }
  return { tuples, conflict };
}

/** Parst ein Tupel ab öffnender Klammer; string-aware ('' = Escape), klammer-aware. */
function parseTuple(sql: string, open: number): { fields: SqlValue[]; end: number } {
  const rawFields: string[] = [];
  let current = '';
  let depth = 0; // Klammern/Brackets innerhalb des Tupels
  let inString = false;
  let i = open + 1;
  for (; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      if (ch === "'" && sql[i + 1] === "'") {
        current += "''";
        i++;
      } else if (ch === "'") {
        inString = false;
        current += ch;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
    } else if (ch === ']' || ch === '}') {
      depth--;
      current += ch;
    } else if (ch === ')') {
      if (depth === 0) break;
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      rawFields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  rawFields.push(current.trim());
  return { fields: rawFields.map(parseValue), end: i + 1 };
}

function unquoteSqlString(raw: string): string {
  return raw.slice(1, -1).replace(/''/g, "'");
}

function parseValue(raw: string): SqlValue {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (/^NULL$/i.test(trimmed)) return null;
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  // ARRAY['a', 'b']::text[] | ARRAY[]::text[]
  const arrayMatch = trimmed.match(/^ARRAY\[(.*)\](?:::text\[\])?$/is);
  if (arrayMatch) {
    const inner = arrayMatch[1].trim();
    if (!inner) return [];
    return [...inner.matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1].replace(/''/g, "'"));
  }

  // '...'::jsonb oder nackter String
  const jsonbMatch = trimmed.match(/^('(?:[^']|'')*')::jsonb$/is);
  if (jsonbMatch) return JSON.parse(unquoteSqlString(jsonbMatch[1])) as Record<string, unknown>;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return unquoteSqlString(trimmed);

  throw new Error(`Unbekanntes SQL-Literal: ${raw}`);
}

// ---------------------------------------------------------------------------
// Upsert-Anwendung mit DB-Semantik
// ---------------------------------------------------------------------------

interface TaxonomyRow {
  canonical_name: string;
  aliases: string[] | null;
  category: string | null;
  related_skills: string[] | null;
  transferability_from: Record<string, unknown> | null;
}

interface SynonymRow {
  canonical_name: string;
  synonym: string;
  confidence: number;
  bidirectional: boolean;
}

function rowFromTuple(columns: string[], tuple: SqlValue[]): Record<string, SqlValue> {
  const row: Record<string, SqlValue> = {};
  columns.forEach((col, idx) => {
    row[col] = tuple[idx] ?? null;
  });
  // transferability_from kommt in einem Seed als nackter String-JSON ohne ::jsonb
  if (typeof row.transferability_from === 'string') {
    row.transferability_from = JSON.parse(row.transferability_from) as Record<string, unknown>;
  }
  return row;
}

function main(): void {
  const taxonomy = new Map<string, TaxonomyRow>();
  const synonyms = new Map<string, SynonymRow>();

  for (const relPath of SEED_MIGRATIONS) {
    const sql = readFileSync(resolve(ROOT, relPath), 'utf8');
    for (const block of parseInsertBlocks(sql)) {
      for (const tuple of block.tuples) {
        if (tuple.length !== block.columns.length) {
          throw new Error(`Feld-/Spaltenzahl passt nicht in ${relPath}: ${JSON.stringify(tuple)}`);
        }
        const row = rowFromTuple(block.columns, tuple);
        if (block.table === 'skill_taxonomy') {
          const key = row.canonical_name as string;
          const existing = taxonomy.get(key);
          if (existing && Array.isArray(block.conflict)) {
            for (const col of block.conflict) {
              (existing as unknown as Record<string, SqlValue>)[col] = row[col] ?? null;
            }
          } else if (existing && block.conflict === 'nothing') {
            // skip
          } else {
            taxonomy.set(key, {
              canonical_name: key,
              aliases: (row.aliases as string[] | null) ?? null,
              category: (row.category as string | null) ?? null,
              related_skills: (row.related_skills as string[] | null) ?? null,
              transferability_from: (row.transferability_from as Record<string, unknown> | null) ?? null,
            });
          }
        } else {
          const key = `${row.canonical_name} ${row.synonym}`;
          if (synonyms.has(key)) {
            if (block.conflict === 'nothing') continue;
            throw new Error(`Synonym-Duplikat ohne ON CONFLICT in ${relPath}: ${key}`);
          }
          synonyms.set(key, {
            canonical_name: row.canonical_name as string,
            synonym: row.synonym as string,
            confidence: (row.confidence as number | null) ?? 1.0,
            bidirectional: (row.bidirectional as boolean | null) ?? true,
          });
        }
      }
    }
  }

  const fixture = {
    _meta: {
      description:
        'Eingefrorener skill_taxonomy/skill_synonyms-Stand aus den Seed-Migrationen. ' +
        'Durch echten DB-Export ersetzen, sobald Zugang besteht.',
      source_migrations: SEED_MIGRATIONS,
      generated_by: 'evals/tools/build-taxonomy-fixture.ts',
    },
    taxonomy: [...taxonomy.values()].sort((a, b) => a.canonical_name.localeCompare(b.canonical_name, 'en')),
    synonyms: [...synonyms.values()].sort(
      (a, b) =>
        a.canonical_name.localeCompare(b.canonical_name, 'en') || a.synonym.localeCompare(b.synonym, 'en'),
    ),
  };

  writeFileSync(OUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  console.log(`taxonomy.fixture.json geschrieben: ${fixture.taxonomy.length} Taxonomie-Einträge, ${fixture.synonyms.length} Synonyme`);
}

main();
