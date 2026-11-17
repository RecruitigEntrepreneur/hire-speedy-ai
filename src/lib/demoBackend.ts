/**
 * Demo-Modus für den Kunden-Rundgang (16.11.2026): Die Beispiel-Bühne zeigt die ECHTEN
 * Seiten der App (Bewerberprofil, Interviews, Besetzungen …) mit Beispieldaten. Dafür
 * beantwortet dieses Zwischenstück, solange die Bühne offen ist, die Datenzugriffe des
 * Supabase-Clients aus einem Register mit Beispieldaten.
 *
 * - Lesen: Das Register liefert Zeilen (gefiltert nach eq/in/is …) oder `null` = echte Datenbank.
 * - Schreiben (insert/update/upsert/delete) und Aktionen (Functions, RPC) gehen nie raus,
 *   sobald das Register sie kennt; im Rundgang wird nichts gespeichert und nichts gesendet.
 * - Realtime-Kanäle, die die Bühne öffnet, sind stumm.
 *
 * Alles wird beim Verlassen der Bühne zurückgesetzt (`uninstall`).
 */

export type DemoFilter = { op: string; col: string; val: unknown };
export interface DemoQuery {
  table: string;
  kind: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  columns: string | null;
  filters: DemoFilter[];
  order: { col: string; ascending: boolean }[];
  limit: number | null;
  single: 'single' | 'maybe' | null;
  count: boolean;
  head: boolean;
  /** Daten bei insert/update/upsert. */
  values: unknown;
}

export interface DemoRegistry {
  /** Zeilen einer Tabelle/Sicht; `null` = nicht Teil der Demo, echte Abfrage. */
  table?: (q: DemoQuery) => Record<string, unknown>[] | null;
  /** Antwort einer Edge Function; `null` = echte Function. */
  fn?: (name: string, body: unknown) => unknown | null;
  /** Antwort einer RPC; `undefined` = echte RPC. */
  rpc?: (name: string, args: unknown) => unknown;
  /** Mitschnitt, etwa für die Entwicklung. */
  log?: (entry: { type: string; name: string; detail?: unknown; demo: boolean; result?: unknown }) => void;
  /** Auch die Antworten echter Abfragen mitschneiden (nur Entwicklung). */
  logResults?: boolean;
}

type Call = [string, unknown[]];
type Result = { data: unknown; error: unknown; count?: number | null; status?: number; statusText?: string };

const FILTERS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'overlaps', 'match', 'not', 'or', 'filter', 'textSearch']);

const cmp = (a: unknown, b: unknown) => (a == null || b == null ? 0 : a < b ? -1 : a > b ? 1 : 0);

function keep(row: Record<string, unknown>, f: DemoFilter): boolean {
  const v = row[f.col];
  switch (f.op) {
    case 'eq': return v === f.val || String(v) === String(f.val);
    case 'neq': return v !== f.val;
    case 'in': return Array.isArray(f.val) && f.val.some((x) => x === v || String(x) === String(v));
    case 'is': return f.val === null ? v == null : v === f.val;
    case 'gt': return cmp(v, f.val) > 0;
    case 'gte': return cmp(v, f.val) >= 0;
    case 'lt': return cmp(v, f.val) < 0;
    case 'lte': return cmp(v, f.val) <= 0;
    case 'match': return Object.entries((f.val ?? {}) as Record<string, unknown>).every(([k, x]) => row[k] === x);
    default: return true;
  }
}

/** Baut aus den aufgezeichneten Aufrufen eine Abfrage-Beschreibung. */
function describe(table: string, calls: Call[]): DemoQuery {
  const q: DemoQuery = { table, kind: 'select', columns: null, filters: [], order: [], limit: null, single: null, count: false, head: false, values: null };
  for (const [name, args] of calls) {
    if (name === 'select') {
      if (q.kind === 'select') q.columns = (args[0] as string) ?? '*';
      const opts = (args[1] ?? {}) as { count?: string; head?: boolean };
      if (opts.count) q.count = true;
      if (opts.head) q.head = true;
    } else if (name === 'insert' || name === 'update' || name === 'upsert' || name === 'delete') {
      q.kind = name; q.values = args[0] ?? null;
    } else if (FILTERS.has(name)) {
      if (name === 'match') q.filters.push({ op: 'match', col: '', val: args[0] });
      else q.filters.push({ op: name, col: String(args[0]), val: args.length > 2 ? args[2] : args[1] });
    } else if (name === 'order') {
      q.order.push({ col: String(args[0]), ascending: ((args[1] ?? {}) as { ascending?: boolean }).ascending !== false });
    } else if (name === 'limit') q.limit = Number(args[0]);
    else if (name === 'range') q.limit = Number(args[1]) - Number(args[0]) + 1;
    else if (name === 'single') q.single = 'single';
    else if (name === 'maybeSingle') q.single = 'maybe';
  }
  return q;
}

function answer(q: DemoQuery, rows: Record<string, unknown>[]): Result {
  if (q.kind !== 'select') {
    const out = Array.isArray(q.values) ? q.values : q.values ? [q.values] : [];
    const withIds = out.map((r, i) => ({ id: `demo-${q.table}-${i}`, ...(r as Record<string, unknown>) }));
    if (q.single) return { data: withIds[0] ?? null, error: null, status: 200, statusText: 'OK' };
    return { data: q.columns ? withIds : null, error: null, status: 201, statusText: 'Created' };
  }
  let list = rows.filter((r) => q.filters.every((f) => keep(r, f)));
  for (const o of [...q.order].reverse()) list = [...list].sort((a, b) => (o.ascending ? 1 : -1) * cmp(a[o.col], b[o.col]));
  if (q.limit != null) list = list.slice(0, q.limit);
  const count = q.count ? list.length : null;
  if (q.head) return { data: null, error: null, count, status: 200, statusText: 'OK' };
  if (q.single === 'maybe') return { data: list[0] ?? null, error: null, count, status: 200, statusText: 'OK' };
  if (q.single === 'single') {
    return list[0]
      ? { data: list[0], error: null, count, status: 200, statusText: 'OK' }
      : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: '', hint: '' }, count, status: 406, statusText: 'Not Acceptable' };
  }
  return { data: list, error: null, count, status: 200, statusText: 'OK' };
}

/**
 * Nimmt alle Aufrufe einer Abfrage auf und entscheidet erst beim Ausführen, ob die Demo
 * oder die echte Datenbank antwortet.
 */
function builder(start: Call, run: (calls: Call[]) => PromiseLike<Result>) {
  const calls: Call[] = [start];
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (ok: (r: Result) => unknown, fail?: (e: unknown) => unknown) => run(calls).then(ok, fail);
      if (prop === 'catch') return (fail: (e: unknown) => unknown) => run(calls).then((r) => r, fail);
      if (prop === 'finally') return (fn: () => void) => run(calls).then((r) => { fn(); return r; }, (e) => { fn(); throw e; });
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => { calls.push([prop, args]); return proxy; };
    },
  });
  return proxy;
}

/** Spielt die aufgezeichneten Aufrufe auf dem echten Abfrage-Objekt ab. */
function replay(target: unknown, calls: Call[]): PromiseLike<Result> {
  let cur = target as Record<string, (...a: unknown[]) => unknown>;
  for (const [name, args] of calls.slice(1)) cur = cur[name](...args) as typeof cur;
  return cur as unknown as PromiseLike<Result>;
}

const silentChannel = () => {
  const ch: Record<string, unknown> = {
    __demo: true,
    on: () => ch,
    subscribe: (cb?: (status: string) => void) => { cb?.('SUBSCRIBED'); return ch; },
    unsubscribe: () => Promise.resolve('ok'),
    send: () => Promise.resolve('ok'),
    track: () => Promise.resolve('ok'),
    untrack: () => Promise.resolve('ok'),
    presenceState: () => ({}),
  };
  return ch;
};

interface PatchableClient {
  from: (table: string) => unknown;
  rpc: (name: string, args?: unknown, opts?: unknown) => unknown;
  channel: (name: string, opts?: unknown) => unknown;
  removeChannel: (ch: unknown) => unknown;
  functions: { invoke: (name: string, opts?: { body?: unknown }) => Promise<{ data: unknown; error: unknown }> };
}

/** Schaltet den Demo-Modus für diesen Client ein; die Rückgabe schaltet ihn wieder aus. */
export function installDemoBackend(client: PatchableClient, registry: DemoRegistry): () => void {
  const self = client as unknown as Record<string, unknown>;
  const orig = { from: client.from.bind(client), rpc: client.rpc.bind(client), channel: client.channel.bind(client), removeChannel: client.removeChannel.bind(client) };
  const realFunctions = () => Object.getPrototypeOf(client) && (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(client), 'functions')?.get?.call(client) as PatchableClient['functions']);
  const log = registry.log ?? (() => undefined);

  self.from = (table: string) => builder(['from', [table]], (calls) => {
    const q = describe(table, calls);
    const rows = registry.table?.(q) ?? null;
    log({ type: q.kind === 'select' ? 'select' : q.kind, name: table, detail: { filters: q.filters, columns: q.columns }, demo: rows !== null });
    if (rows === null) {
      const real = replay(orig.from(table), calls);
      return registry.logResults ? real.then((r) => { log({ type: 'result', name: table, detail: q.filters, demo: false, result: r.data }); return r; }) : real;
    }
    return Promise.resolve(answer(q, rows));
  });

  self.rpc = (name: string, args?: unknown, opts?: unknown) => builder(['rpc', [name, args, opts]], (calls) => {
    const value = registry.rpc?.(name, args);
    log({ type: 'rpc', name, detail: args, demo: value !== undefined });
    if (value === undefined) return replay(orig.rpc(name, args, opts), calls);
    return Promise.resolve({ data: value, error: null, status: 200, statusText: 'OK' });
  });

  self.channel = () => silentChannel();
  self.removeChannel = (ch: unknown) => ((ch as { __demo?: boolean })?.__demo ? Promise.resolve('ok') : orig.removeChannel(ch));

  const demoFunctions = {
    invoke: async (name: string, opts?: { body?: unknown }) => {
      const value = registry.fn?.(name, opts?.body) ?? null;
      log({ type: 'function', name, detail: opts?.body, demo: value !== null });
      if (value === null) {
        const real = await realFunctions().invoke(name, opts);
        if (registry.logResults) log({ type: 'result', name, detail: opts?.body, demo: false, result: real.data });
        return real;
      }
      return { data: value, error: null };
    },
  };
  Object.defineProperty(self, 'functions', { configurable: true, get: () => demoFunctions });

  return () => {
    delete self.from; delete self.rpc; delete self.channel; delete self.removeChannel; delete self.functions;
  };
}
