/**
 * Gleichzeitiges Arbeiten an einer Aufnahme (26.11.2026, Entscheidung Marko: „Alles auf einmal“).
 *
 * Vorher schrieb jedes Speichern die ganze Stelle (built, answers, dyn, …) als einen Block:
 * Arbeiteten zwei Personen gleichzeitig, gewann still, wer zuletzt speicherte. Jetzt schickt
 * der Browser nur, was sich gegenüber dem letzten Serverstand geändert hat -- je Antwort
 * („Blatt“ im JSON), und der Server führt diese Änderungen in den aktuellen Stand ein.
 * Pro Antwort gilt die letzte Änderung; Listen (z. B. Kriterien) zählen als eine Antwort.
 *
 * Rein, ohne Abhängigkeiten: dieselbe Datei läuft im Browser und in den Functions.
 */

export const OPS_FELDER = ['built', 'answers', 'dyn', 'freelance', 'flexibility'] as const;
export type OpsFeld = typeof OPS_FELDER[number];

/** Eine Änderung: an `pfad` innerhalb von `feld` steht jetzt `wert` (oder nichts mehr, `weg`). */
export interface Op {
  feld: OpsFeld;
  pfad: string[];
  wert?: unknown;
  weg?: true;
}

/** Wer was zuletzt geändert hat, liegt am Entwurf unter dyn.wer; das schreibt nur der Server. */
export const WER_PFAD = 'wer';

type Obj = Record<string, unknown>;
const istObjekt = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diffInto(feld: OpsFeld, pfad: string[], alt: unknown, neu: unknown, out: Op[]) {
  if (istObjekt(alt) && istObjekt(neu)) {
    for (const k of new Set([...Object.keys(alt), ...Object.keys(neu)])) {
      if (feld === 'dyn' && pfad.length === 0 && k === WER_PFAD) continue;
      if (!(k in neu)) { out.push({ feld, pfad: [...pfad, k], weg: true }); continue; }
      diffInto(feld, [...pfad, k], alt[k], neu[k], out);
    }
    return;
  }
  if (!gleich(alt, neu)) {
    if (neu === undefined) out.push({ feld, pfad, weg: true });
    else out.push({ feld, pfad, wert: neu });
  }
}

/** Was hat sich von `alt` nach `neu` geändert? Je Feld, bis hinunter zu einzelnen Antworten. */
export function diffOps(alt: Partial<Record<OpsFeld, unknown>>, neu: Partial<Record<OpsFeld, unknown>>): Op[] {
  const out: Op[] = [];
  for (const feld of OPS_FELDER) {
    if (!(feld in neu)) continue;
    diffInto(feld, [], alt[feld] ?? null, neu[feld] ?? null, out);
  }
  return out;
}

const klon = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Setzt die Änderungen in einen Stand ein (ohne ihn zu verändern) und gibt den neuen Stand zurück. */
export function applyOps<T extends Partial<Record<OpsFeld, unknown>>>(stand: T, ops: Op[]): T {
  const neu = klon(stand) as Record<string, unknown>;
  for (const op of ops) {
    if (!(OPS_FELDER as readonly string[]).includes(op.feld)) continue;
    if (op.pfad.length === 0) {
      neu[op.feld] = op.weg ? null : klon(op.wert);
      continue;
    }
    if (!istObjekt(neu[op.feld])) neu[op.feld] = {};
    let ziel = neu[op.feld] as Obj;
    for (const teil of op.pfad.slice(0, -1)) {
      if (!istObjekt(ziel[teil])) ziel[teil] = {};
      ziel = ziel[teil] as Obj;
    }
    const letzter = op.pfad[op.pfad.length - 1];
    if (op.weg) delete ziel[letzter];
    else ziel[letzter] = klon(op.wert);
  }
  return neu as T;
}

/** Schlüssel einer Antwort für dyn.wer und für Hinweise: „built.title“, „dyn.catalog.known.vakanz_grund“. */
export const opSchluessel = (op: Pick<Op, 'feld' | 'pfad'>): string => {
  // Antworten aus dem Fragenkatalog liegen als {value, from} -- gemeint ist die Antwort, nicht ihr Teil.
  const p = op.feld === 'dyn' && op.pfad[0] === 'catalog' && op.pfad[1] === 'known' ? op.pfad.slice(0, 3) : op.pfad;
  return [op.feld, ...p].join('.');
};

/** Kürzel aus einem Namen oder einer Adresse: „Test Ansprechpartner“ → „TA“. */
export function kuerzel(name: string | null | undefined): string {
  const s = String(name ?? '').trim();
  if (!s) return '?';
  const basis = s.includes('@') ? s.split('@')[0].replace(/[._-]+/g, ' ') : s;
  const teile = basis.split(/\s+/).filter(Boolean);
  const k = teile.length > 1 ? teile[0][0] + teile[teile.length - 1][0] : basis.slice(0, 2);
  return k.toUpperCase();
}

/** Ändern sich zwei Stände an derselben Antwort? Liefert die Schlüssel, die beide berühren. */
export function ueberschneidung(a: Op[], b: Op[]): string[] {
  const s = new Set(a.map(opSchluessel));
  return [...new Set(b.map(opSchluessel).filter((k) => s.has(k)))];
}
