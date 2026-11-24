/**
 * Talent Pool (Stufe 1, 25.11.2026): Kandidaten, bei denen sich der Headhunter später wieder meldet.
 * Reine Rechen-Logik: nächster Kontakt, Fälligkeit, Tagesgrenze. Der Pool lebt in „Meine Kandidaten“,
 * am fälligen Tag entsteht eine Aufgabe „Kontakt halten“.
 */
export type PoolGrund = 'silver_medalist' | 'future_fit' | 'passive' | 'general' | 'alumni';
export type PoolRhythmus = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'once';
export type PoolWechsel = 'yes' | 'maybe' | 'no';

export const POOL_GRUENDE: PoolGrund[] = ['silver_medalist', 'future_fit', 'passive', 'general'];
export const POOL_RHYTHMEN: PoolRhythmus[] = ['quarterly', 'halfyearly', 'yearly', 'once'];
/** „Wann meldest du dich?“ in Monaten ab heute. */
export const POOL_ERSTKONTAKT = [1, 3, 6, 12] as const;

/** Ein Pool mit eigenem Namen (seit 25.11.2026); ein Kandidat kann in mehreren liegen. */
export interface Pool {
  id: string;
  name: string;
  description: string | null;
  default_frequency: PoolRhythmus;
}

export interface PoolEintrag {
  id: string;
  candidate_id: string;
  pool_id: string | null;
  pool_type: PoolGrund;
  contact_frequency: PoolRhythmus;
  next_contact_at: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  consent_at: string | null;
  consent_source: 'verbal' | 'email' | null;
  retention_until: string | null;
  change_readiness: PoolWechsel | null;
  is_active: boolean;
  opted_out_at: string | null;
  created_at: string;
}

const MONATE: Record<PoolRhythmus, number | null> = { monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12, once: null };
/** Speicherfrist ab Einwilligung, danach fragt die App nach. */
export const POOL_FRIST_MONATE = 24;
/** Höchstens so viele „Kontakt halten“-Aufgaben pro Tag, damit die Aufgaben-Seite nicht überläuft. */
export const POOL_AUFGABEN_PRO_TAG = 5;

/** Monate addieren, Monatsende bleibt Monatsende (31.01. + 1 Monat = 28./29.02.). */
export function plusMonate(von: Date, monate: number): Date {
  const d = new Date(von);
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + monate);
  const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, letzter));
  return d;
}

/** Fällt der Tag aufs Wochenende, wird es der Montag danach. */
export function aufWerktag(d: Date): Date {
  const out = new Date(d);
  const wt = out.getDay();
  if (wt === 6) out.setDate(out.getDate() + 2);
  if (wt === 0) out.setDate(out.getDate() + 1);
  return out;
}

/** Nächster Kontakt nach einem erledigten Kontakt; bei „nur einmal“ gibt es keinen mehr. */
export function naechsterKontakt(rhythmus: PoolRhythmus, von: Date = new Date()): Date | null {
  const m = MONATE[rhythmus];
  return m == null ? null : aufWerktag(plusMonate(von, m));
}

/** Der Eintrag, der als Nächstes dran ist: frühester Termin zuerst, ohne Termin zuletzt. */
export function naechsterEintrag<T extends Pick<PoolEintrag, 'next_contact_at'>>(eintraege: T[]): T | null {
  return [...eintraege].sort((a, b) =>
    (a.next_contact_at ? new Date(a.next_contact_at).getTime() : Infinity) - (b.next_contact_at ? new Date(b.next_contact_at).getTime() : Infinity))[0] ?? null;
}

export function istFaellig(e: Pick<PoolEintrag, 'next_contact_at' | 'is_active' | 'opted_out_at'>, jetzt: Date = new Date()): boolean {
  if (!e.is_active || e.opted_out_at || !e.next_contact_at) return false;
  return new Date(e.next_contact_at).getTime() <= jetzt.getTime();
}

/** Volle Tage seit Fälligkeit (0 = heute fällig), sonst null. */
export function tageFaellig(e: Pick<PoolEintrag, 'next_contact_at' | 'is_active' | 'opted_out_at'>, jetzt: Date = new Date()): number | null {
  if (!istFaellig(e, jetzt)) return null;
  return Math.floor((jetzt.getTime() - new Date(e.next_contact_at!).getTime()) / 86_400_000);
}

/**
 * Welche fälligen Einträge heute zur Aufgabe werden: die am längsten fälligen zuerst, höchstens
 * `POOL_AUFGABEN_PRO_TAG`. Wer gerade in einem Prozess steckt, pausiert (`imProzess`).
 */
export function poolAufgabenHeute<T extends Pick<PoolEintrag, 'candidate_id' | 'next_contact_at' | 'is_active' | 'opted_out_at'>>(
  eintraege: T[],
  imProzess: Set<string>,
  jetzt: Date = new Date(),
): T[] {
  // Liegt jemand in mehreren Pools, gibt es trotzdem nur eine Aufgabe (die am längsten fällige)
  const gesehen = new Set<string>();
  return eintraege
    .filter((e) => istFaellig(e, jetzt) && !imProzess.has(e.candidate_id))
    .sort((a, b) => new Date(a.next_contact_at!).getTime() - new Date(b.next_contact_at!).getTime())
    .filter((e) => (gesehen.has(e.candidate_id) ? false : (gesehen.add(e.candidate_id), true)))
    .slice(0, POOL_AUFGABEN_PRO_TAG);
}
