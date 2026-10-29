import type { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { BUNDLED_CATEGORIES, bundleByJob, type StalledBundle } from '@/lib/kundePrueft';
import { groupByPerson, type PersonGroup } from './taskWindow';

export type JetztRow =
  | { kind: 'person'; key: string; prio: number; fee: number; critical: boolean; group: PersonGroup }
  /** `more`: weitere Stellen desselben Kunden – eine Zeile, eine Mail (28.10.2026) */
  | { kind: 'bundle'; key: string; prio: number; fee: number; critical: boolean; bundle: StalledBundle; more: StalledBundle[] };

/** Wie Julia die Aufgabe erledigt: Blöcke auf der Seite „Aufgaben“ (Variante A, 28.10.2026). */
export type Handgriff = 'anruf' | 'kunde' | 'kurz';

const DAY_MS = 86_400_000;
const CALLS = new Set([
  'interview_debrief_due', 'opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h', 'offer_deliver',
  'contract_nudge', 'contract_followup', 'contract_follow', 'contract_missing', 'interview_reminder', 'interview_prep_missing',
  'ghosting_risk', 'engagement_drop', 'salary_mismatch', 'call',
]);
const CLIENT_MAILS = new Set(['client_review_stalled', 'client_feedback_due', 'offer_counter_stalled']);
/** Nähe zum Geld: Angebot und Vertrag vor Interview vor Prüfung */
const stageWeight = (cat: string) =>
  cat.startsWith('offer_') || cat.startsWith('contract_') ? 3
    : ['interview_debrief_due', 'client_feedback_due', 'recommendation_due', 'opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h', 'interview_reminder', 'interview_prep_missing'].includes(cat) ? 2
      : 1;

export const rowItems = (r: JetztRow): UnifiedTaskItem[] =>
  r.kind === 'person' ? [r.group.primary, ...r.group.others] : [r.bundle, ...r.more].flatMap(b => b.items);

/** Nächste echte Frist der Zeile in der Zukunft (Angebotsfrist, Rückruf, Mail-Uhr), sonst null. */
function nextDeadline(r: JetztRow, now: number): UnifiedTaskItem | null {
  const future = rowItems(r).filter(i => i.dueAt && Date.parse(i.dueAt) > now);
  return future.sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))[0] ?? null;
}

/**
 * Reihenfolge (Variante A): 1. Uhr in den nächsten 24 Std., 2. Nähe zum Geld,
 * 3. Honorar, 4. was länger offen ist.
 */
function rankKey(r: JetztRow, now: number) {
  const items = rowItems(r);
  const deadline = nextDeadline(r, now);
  const clock = deadline && Date.parse(deadline.dueAt!) - now <= DAY_MS ? 1 : 0;
  const stage = Math.max(...items.map(i => stageWeight(i.taskCategory)));
  const oldest = Math.min(...items.map(i => Date.parse(i.createdAt) || now));
  return { clock, stage, fee: r.fee, oldest };
}

/**
 * Was die Seite „Aufgaben“ unter „Jetzt“ zeigt (20.10.2026 auch fürs Dashboard, damit
 * beide dieselben Zeilen und dieselbe Zahl haben): Personen-Zeilen, „Kunde prüft“ und
 * „Kunde gibt kein Feedback“ je Kunde gebündelt. Alte Deals ruhen. Opt-In steht sofort hier, nicht erst
 * nach 24 Stunden (29.10.2026, Live-Befund Luca: sonst nur im Kandidatenprofil sichtbar).
 */
export function splitJetzt(allItems: UnifiedTaskItem[], now = new Date()) {
  const jetzt = allItems.filter(i => !i.isStale);
  const groups = groupByPerson(jetzt.filter(i => !BUNDLED_CATEGORIES.includes(i.taskCategory)));
  const bundles = bundleByJob(jetzt.filter(i => BUNDLED_CATEGORIES.includes(i.taskCategory)), now);
  // Stellen desselben (aufgedeckten) Kunden: eine Zeile, eine Mail
  const byClient = new Map<string, StalledBundle[]>();
  for (const b of bundles) {
    const key = b.items[0]?.companyRevealed && b.companyName ? `${b.kind}|${b.companyName}` : `${b.kind}|${b.key}`;
    byClient.set(key, [...(byClient.get(key) ?? []), b]);
  }
  const t = now.getTime();
  const rows: JetztRow[] = [
    ...groups.map(g => ({ kind: 'person' as const, key: g.key, prio: g.primary.sortPriority, fee: g.primary.feeValue ?? 0, critical: g.primary.priority === 'critical', group: g })),
    ...[...byClient.values()].map(([first, ...more]) => {
      const all = [first, ...more];
      const items = all.flatMap(b => b.items);
      return { kind: 'bundle' as const, key: `job-${first.key}`, prio: Math.min(...items.map(i => i.sortPriority)), fee: all.reduce((n, b) => n + b.feeTotal, 0), critical: items.some(i => i.priority === 'critical'), bundle: first, more };
    }),
  ];
  const ranked = rows.map(r => ({ r, k: rankKey(r, t) }))
    .sort((a, b) => b.k.clock - a.k.clock || b.k.stage - a.k.stage || b.k.fee - a.k.fee || a.k.oldest - b.k.oldest)
    .map(x => x.r);
  return { jetzt, groups, bundles, rows: ranked };
}

export const rowItem = (r: JetztRow) => (r.kind === 'person' ? r.group.primary : r.bundle.items[0]);

/** Block auf der Seite: Anrufe, Mails an Kunden, Kurz erledigen. */
export function handgriffOf(r: JetztRow): Handgriff {
  if (r.kind === 'bundle') return 'kunde';
  const it = r.group.primary;
  if (CLIENT_MAILS.has(it.taskCategory)) return 'kunde';
  if (CALLS.has(it.taskCategory)) return 'anruf';
  return 'kurz';
}

export interface WaitInfo {
  /** kandidat · kunde · kandidaten (Stellen-Zeile) · du (eigene Erinnerung) */
  who: 'kandidat' | 'kunde' | 'kandidaten' | 'du';
  whoLabel: string;
  time: string;
  tone: 'red' | 'amber' | 'muted';
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const berlinDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

function whoOf(it: UnifiedTaskItem): WaitInfo['who'] {
  const c = it.taskCategory;
  if (it.itemType === 'task') return 'du';
  if (c === 'offer_deliver') return it.title.startsWith('Rückruf') ? 'kandidat' : 'kunde';
  if (c.startsWith('contract_') || c === 'recommendation_due') return 'kunde';
  return 'kandidat';
}

/** Linke Spalte (Vorschlag 8): wer auf Julia wartet, darunter Frist bzw. wie lange offen. */
export function waitOf(r: JetztRow, now = new Date()): WaitInfo {
  const t = now.getTime();
  const deadline = nextDeadline(r, t);
  const base = deadline ?? rowItem(r);
  let who: WaitInfo['who'];
  let whoLabel: string;
  if (r.kind === 'bundle') {
    const n = rowItems(r).length;
    who = 'kandidaten';
    whoLabel = n === 1 ? 'Kandidat' : `${n} Kandidaten`;
  } else {
    who = whoOf(base);
    whoLabel = who === 'kunde' ? 'Kunde' : who === 'du' ? 'Du' : 'Kandidat';
  }
  if (deadline) {
    const ms = Date.parse(deadline.dueAt!);
    if (ms - t <= DAY_MS) {
      const day = berlinDay(ms) === berlinDay(t) ? '' : 'morgen ';
      return { who, whoLabel, time: `bis ${day}${clock(ms)}`, tone: 'red' };
    }
    // Kalendertage bis zur Frist (Berlin), wie „Noch 6 Tage“ im Fenster
    const days = Math.round((Date.parse(`${berlinDay(ms)}T12:00:00Z`) - Date.parse(`${berlinDay(t)}T12:00:00Z`)) / DAY_MS);
    return { who, whoLabel, time: `${days} T. bis ${deadline.taskCategory === 'offer_deliver' ? 'Antwort' : 'Frist'}`, tone: 'amber' };
  }
  const days = r.kind === 'bundle'
    ? Math.max(r.bundle.days, ...r.more.map(b => b.days))
    : Math.max(0, Math.floor((t - Date.parse(rowItem(r).createdAt)) / DAY_MS));
  const where = r.kind === 'bundle' ? (r.bundle.kind === 'feedback' ? 'ohne Feedback' : 'beim Kunden') : 'offen';
  const time = days === 0 ? 'seit heute' : `${days} T. ${where}`;
  // Rot, sobald etwas überfällig ist (Frist vorbei) oder als kritisch gilt
  const overdue = rowItems(r).some(i => i.dueAt && Date.parse(i.dueAt) < t);
  return { who, whoLabel, time, tone: r.critical || overdue ? 'red' : 'muted' };
}
