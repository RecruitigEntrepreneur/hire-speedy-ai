import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUnifiedTaskInbox } from '@/hooks/useUnifiedTaskInbox';
import { groupByPerson, useTaskHost } from './taskWindow';

/**
 * Aufgaben-Fenster im Kandidatenprofil (14.10.2026). Öffnet sich über ?aufgabe=<id>:
 * aus dem Dashboard und aus dem Aufgaben-Block im Profilkopf (CandidateTasksSection).
 * Gleiches Fenster wie auf der Seite „Aufgaben“, ohne eigene Anzeige im Profil.
 */
export function CandidateTaskWindow({ candidateId }: { candidateId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allItems, loading, markDone, snooze, refetch } = useUnifiedTaskInbox('all');
  const mine = useMemo(() => allItems.filter((i) => i.candidateId === candidateId), [allItems, candidateId]);
  const groups = useMemo(() => groupByPerson(mine), [mine]);
  const task = useTaskHost({ allItems: mine, groups, markDone, snooze, refetch });

  const wanted = searchParams.get('aufgabe');
  useEffect(() => {
    if (!wanted || loading) return;
    if (!task.openItem(wanted) && groups[0]) task.setWindowKey(groups[0].key);
    const next = new URLSearchParams(searchParams);
    next.delete('aufgabe');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, loading, groups.length]);

  return task.host;
}
