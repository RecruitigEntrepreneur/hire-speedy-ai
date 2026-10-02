// Kleine In-Memory-Nachbildung des Supabase-Query-Builders für Ablauftests.
// Unterstützt: select (inkl. eingebetteter Tabellen name!inner(spalten)),
// eq, in, order, limit, maybeSingle, single, insert, update, upsert, delete.
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Row = Record<string, any>;
const singular = (t: string) => (t.endsWith('ies') ? t.slice(0, -3) + 'y' : t.endsWith('s') ? t.slice(0, -1) : t);

export function fakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  const t = (name: string) => (tables[name] ??= []);

  function project(table: string, row: Row, select: string): Row {
    if (!select || select.trim() === '*') return { ...row };
    const out: Row = {};
    const parts: string[] = [];
    let depth = 0, cur = '';
    for (const ch of select) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    for (const part of parts) {
      const m = part.match(/^(\w+)(?:!inner)?\((.*)\)$/s);
      if (m) {
        const [, rel, inner] = m;
        const fk = row[`${singular(rel)}_id`];
        const target = t(rel).find((r) => r.id === fk);
        out[rel] = target ? project(rel, target, inner) : null;
      } else if (part === '*') Object.assign(out, row);
      else out[part] = row[part];
    }
    void table;
    return out;
  }

  function builder(table: string) {
    let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    let payload: any = null;
    let selectCols = '*';
    let returning = false;
    let onConflict: string[] = [];
    const filters: ((r: Row) => boolean)[] = [];
    let orderBy: { col: string; asc: boolean }[] = [];
    let limitN: number | null = null;

    const matches = (r: Row) => filters.every((f) => f(r));
    const run = (): { data: any; error: any } => {
      const rows = t(table);
      if (mode === 'insert') {
        const list = (Array.isArray(payload) ? payload : [payload]).map((p: Row) => ({ id: p.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...p }));
        rows.push(...list);
        return { data: returning ? list.map((r: Row) => project(table, r, selectCols)) : null, error: null };
      }
      if (mode === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const out: Row[] = [];
        for (const p of list) {
          const existing = rows.find((r) => onConflict.length && onConflict.every((c) => r[c] === p[c]));
          if (existing) { Object.assign(existing, p); out.push(existing); } else { const n = { id: crypto.randomUUID(), ...p }; rows.push(n); out.push(n); }
        }
        return { data: returning ? out.map((r) => project(table, r, selectCols)) : null, error: null };
      }
      let hit = rows.filter((r) => {
        if (!matches(r)) return false;
        // eingebettete !inner-Filter: Zeile fällt weg, wenn Ziel fehlt
        const inner = [...selectCols.matchAll(/(\w+)!inner\(/g)].map((m) => m[1]);
        return inner.every((rel) => t(rel).some((x) => x.id === r[`${singular(rel)}_id`]));
      });
      if (mode === 'update') {
        hit.forEach((r) => Object.assign(r, payload));
        return { data: returning ? hit.map((r) => project(table, r, selectCols)) : null, error: null };
      }
      if (mode === 'delete') {
        tables[table] = rows.filter((r) => !hit.includes(r));
        return { data: null, error: null };
      }
      for (const o of [...orderBy].reverse()) hit = [...hit].sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1));
      if (limitN !== null) hit = hit.slice(0, limitN);
      return { data: hit.map((r) => project(table, r, selectCols)), error: null };
    };

    const q: any = {
      select(cols = '*') { if (mode === 'select') selectCols = cols; else { returning = true; selectCols = cols; } return q; },
      insert(p: any) { mode = 'insert'; payload = p; return q; },
      update(p: any) { mode = 'update'; payload = p; return q; },
      upsert(p: any, opts?: { onConflict?: string }) { mode = 'upsert'; payload = p; onConflict = (opts?.onConflict ?? 'id').split(','); return q; },
      delete() { mode = 'delete'; return q; },
      eq(c: string, v: any) { filters.push((r) => (c.includes('->>') ? String((r[c.split('->>')[0]] ?? {})[c.split('->>')[1]]) === String(v) : r[c] === v)); return q; },
      in(c: string, vs: any[]) { filters.push((r) => vs.includes(r[c])); return q; },
      is(c: string, v: any) { filters.push((r) => (r[c] ?? null) === v); return q; },
      gt(c: string, v: any) { filters.push((r) => r[c] > v); return q; },
      ilike(c: string, v: string) { filters.push((r) => String(r[c] ?? '').toLowerCase() === String(v).toLowerCase()); return q; },
      order(c: string, o?: { ascending?: boolean }) { orderBy.push({ col: c, asc: o?.ascending !== false }); return q; },
      limit(n: number) { limitN = n; return q; },
      maybeSingle: async () => { const r = run(); const d = Array.isArray(r.data) ? r.data[0] ?? null : r.data; return { data: d, error: r.error }; },
      single: async () => { const r = run(); const d = Array.isArray(r.data) ? r.data[0] ?? null : r.data; return { data: d, error: d ? null : { message: 'no rows', code: 'PGRST116' } }; },
      then: (resolve: (v: any) => any, reject?: (e: any) => any) => Promise.resolve(run()).then(resolve, reject),
    };
    void orderBy; orderBy = orderBy;
    return q;
  }

  const db = { from: (table: string) => builder(table) } as unknown as SupabaseClient;
  return { db, tables };
}
