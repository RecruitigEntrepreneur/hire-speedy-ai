import type { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { bundleByJob, type StalledBundle } from '@/lib/kundePrueft';
import { groupByPerson, hoursSince, type PersonGroup } from './taskWindow';

export type JetztRow =
  | { kind: 'person'; key: string; prio: number; fee: number; critical: boolean; group: PersonGroup }
  | { kind: 'bundle'; key: string; prio: number; fee: number; critical: boolean; bundle: StalledBundle };

/**
 * Was die Seite „Aufgaben“ unter „Jetzt“ zeigt (20.10.2026 auch fürs Dashboard, damit
 * beide dieselben Zeilen und dieselbe Zahl haben): Personen-Zeilen, „Kunde prüft“ je
 * Stelle gebündelt. Opt-Ins unter 24 Stunden warten noch, alte Deals ruhen.
 */
export function splitJetzt(allItems: UnifiedTaskItem[], now = new Date()) {
  const jetzt = allItems.filter(i => !i.isStale && !(i.taskCategory === 'opt_in_pending' && hoursSince(i.createdAt) < 24));
  const groups = groupByPerson(jetzt.filter(i => i.taskCategory !== 'client_review_stalled'));
  const bundles = bundleByJob(jetzt.filter(i => i.taskCategory === 'client_review_stalled'), now);
  const rows: JetztRow[] = [
    ...groups.map(g => ({ kind: 'person' as const, key: g.key, prio: g.primary.sortPriority, fee: g.primary.feeValue ?? 0, critical: g.primary.priority === 'critical', group: g })),
    ...bundles.map(b => ({ kind: 'bundle' as const, key: `job-${b.key}`, prio: Math.min(...b.items.map(i => i.sortPriority)), fee: b.feeTotal, critical: b.items.some(i => i.priority === 'critical'), bundle: b })),
  ].sort((a, b) => a.prio - b.prio || b.fee - a.fee);
  return { jetzt, groups, bundles, rows };
}

export const rowItem = (r: JetztRow) => (r.kind === 'person' ? r.group.primary : r.bundle.items[0]);
