/**
 * Suche des Kunden (17.11.2026, Kunden-Durchklick Punkt 3): Stellen der ganzen Firma nach Titel
 * und Ort, Bewerber nach Kürzel, Rolle, Stelle und (erst nach Freigabe) Name. Gefiltert wird im
 * Browser wie beim Headhunter. Vorher suchte die Leiste nur Stellen, die die Person selbst angelegt
 * hatte, und nur unter den ersten 50 Bewerbern („Lohn“ fand nichts).
 */
import { normal, woerterPassen } from './headhunterSuche';

export interface KundenStelle {
  id: string;
  title: string | null;
  location: string | null;
  status: string | null;
  /** laufende Kandidaten (ohne Archiv) */
  laufend: number;
}

export interface KundenBewerber {
  id: string;
  /** Name nach Freigabe, sonst das Kürzel */
  name: string;
  kuerzel: string;
  rolle: string | null;
  stelle: string | null;
  archiv: boolean;
}

/** Laufende Stellen vor Entwürfen und geschlossenen. */
const AKTIV = new Set(['published', 'paused', 'pending_approval']);

function namensRang(name: string, n: string): number {
  const v = normal(name);
  const woerter = v.split(/\s+/);
  if (woerter.includes(n)) return 0;
  if (woerter.some((w) => w.startsWith(n))) return 1;
  if (v.includes(n)) return 2;
  return 3;
}

export function sucheKundenStellen(liste: KundenStelle[], q: string, max = 5): KundenStelle[] {
  const t = q.trim();
  if (!t) return [];
  const n = normal(t);
  return liste
    .filter((s) => woerterPassen([s.title, s.location], t))
    .map((s) => ({ s, rang: (AKTIV.has(s.status ?? '') ? 0 : 10) + namensRang(s.title ?? '', n) }))
    .sort((a, b) => a.rang - b.rang)
    .slice(0, max)
    .map((x) => x.s);
}

export function sucheKundenBewerber(liste: KundenBewerber[], q: string, max = 6): KundenBewerber[] {
  const t = q.trim();
  if (!t) return [];
  const n = normal(t);
  return liste
    .filter((b) => woerterPassen([b.name, b.kuerzel, b.rolle, b.stelle], t))
    .map((b) => ({ b, rang: (b.archiv ? 10 : 0) + namensRang(b.name, n) }))
    .sort((a, b) => a.rang - b.rang)
    .slice(0, max)
    .map((x) => x.b);
}
