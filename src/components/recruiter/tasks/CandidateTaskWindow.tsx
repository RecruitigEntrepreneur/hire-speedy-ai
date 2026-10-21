import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUnifiedTaskInbox } from '@/hooks/useUnifiedTaskInbox';
import { bundleByJob, type StalledBundle } from '@/lib/kundePrueft';
import { groupByPerson, useTaskHost } from './taskWindow';
import { KundePrueftWindow } from './KundePrueftWindow';

/**
 * Aufgaben-Fenster im Kandidatenprofil (14.10.2026). Öffnet sich über ?aufgabe=<id>:
 * aus dem Dashboard und aus dem Aufgaben-Block im Profilkopf (CandidateTasksSection).
 * Gleiches Fenster wie auf der Seite „Aufgaben“, ohne eigene Anzeige im Profil.
 */
export function CandidateTaskWindow({ candidateId }: { candidateId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allItems, waitingItems, loading, markDone, snooze, refetch } = useUnifiedTaskInbox('all');
  const mine = useMemo(() => allItems.filter((i) => i.candidateId === candidateId), [allItems, candidateId]);
  // „Kunde prüft“ gehört ins Stellen-Fenster (unten), nie ins Personen-Fenster.
  const groups = useMemo(() => groupByPerson(mine.filter(i => i.taskCategory !== 'client_review_stalled')), [mine]);
  const task = useTaskHost({ allItems: mine, groups, markDone, snooze, refetch });
  // „Kunde prüft“: dasselbe Stellen-Fenster wie auf der Seite „Aufgaben“, mit allen
  // wartenden Kandidaten dieser Stelle (eine Mail an den Kunden).
  const bundles = useMemo(() => bundleByJob(allItems.filter(i => i.taskCategory === 'client_review_stalled'), new Date()), [allItems]);
  const waitingBundles = useMemo(() => bundleByJob(waitingItems, new Date()), [waitingItems]);
  // Festgehalten, damit Schritt 2 nach dem Neuladen sichtbar bleibt
  const [openState, setOpenState] = useState<{ bundle: StalledBundle; sameClient: StalledBundle[]; startSent?: { at: string } } | null>(null);
  const sameClientOf = (b: StalledBundle) => (b.items[0]?.companyRevealed && b.companyName
    ? bundles.filter(x => x.key !== b.key && x.items[0]?.companyRevealed && x.companyName === b.companyName)
    : []);

  const wanted = searchParams.get('aufgabe');
  useEffect(() => {
    if (!wanted || loading) return;
    const b = bundles.find(x => x.items.some(i => i.itemId === wanted));
    const w = waitingBundles.find(x => x.items.some(i => i.itemId === wanted));
    const last = w?.items.map(i => i.lastNudgeAt ?? '').sort().pop();
    if (b) setOpenState({ bundle: b, sameClient: sameClientOf(b) });
    else if (w && last) setOpenState({ bundle: w, sameClient: [], startSent: { at: last } });
    else if (!task.openItem(wanted) && groups[0] && !wanted.startsWith('derived-stalled-')) task.setWindowKey(groups[0].key);
    const next = new URLSearchParams(searchParams);
    next.delete('aufgabe');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, loading, groups.length]);

  return (
    <>
      {task.host}
      <KundePrueftWindow bundle={openState?.bundle ?? null} sameClient={openState?.sameClient ?? []} startSent={openState?.startSent ?? null} onClose={() => setOpenState(null)} onDone={refetch} />
    </>
  );
}
