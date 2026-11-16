import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUnifiedTaskInbox } from '@/hooks/useUnifiedTaskInbox';
import { BUNDLED_CATEGORIES, bundleByJob, type StalledBundle } from '@/lib/kundePrueft';
import { groupByPerson, useTaskHost } from './taskWindow';
import { KundePrueftWindow } from './KundePrueftWindow';

/**
 * Aufgaben-Fenster im Kandidatenprofil (14.10.2026). Öffnet sich über ?aufgabe=<id>:
 * aus dem Dashboard und aus dem Aufgaben-Block im Profilkopf (CandidateTasksSection).
 * Gleiches Fenster wie auf der Seite „Aufgaben“, ohne eigene Anzeige im Profil.
 */
export function CandidateTaskWindow({ candidateId }: { candidateId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { allItems, soonItems, waitingItems, parkedItems, loading, markDone, snooze, refetch } = useUnifiedTaskInbox('all');
  const mine = useMemo(() => [...allItems, ...soonItems].filter((i) => i.candidateId === candidateId), [allItems, soonItems, candidateId]);
  // „Kunde prüft“ gehört ins Stellen-Fenster (unten), nie ins Personen-Fenster.
  const groups = useMemo(() => groupByPerson(mine.filter(i => !BUNDLED_CATEGORIES.includes(i.taskCategory))), [mine]);
  const task = useTaskHost({ allItems: mine, groups, markDone, snooze, refetch });
  // „Kunde prüft“: dasselbe Stellen-Fenster wie auf der Seite „Aufgaben“, mit allen
  // wartenden Kandidaten dieser Stelle (eine Mail an den Kunden).
  const bundles = useMemo(() => bundleByJob(allItems.filter(i => BUNDLED_CATEGORIES.includes(i.taskCategory)), new Date()), [allItems]);
  const waitingBundles = useMemo(() => bundleByJob(waitingItems, new Date()), [waitingItems]);
  // Festgehalten, damit Schritt 2 nach dem Neuladen sichtbar bleibt
  const [openState, setOpenState] = useState<{ bundle: StalledBundle; sameClient: StalledBundle[]; startSent?: { at: string } } | null>(null);
  const sameClientOf = (b: StalledBundle) => (b.items[0]?.companyRevealed && b.companyName
    ? bundles.filter(x => x.key !== b.key && x.kind === b.kind && x.items[0]?.companyRevealed && x.companyName === b.companyName)
    : []);

  const wanted = searchParams.get('aufgabe');
  useEffect(() => {
    if (!wanted || loading) return;
    const b = bundles.find(x => x.items.some(i => i.itemId === wanted));
    const w = waitingBundles.find(x => x.items.some(i => i.itemId === wanted));
    const last = w?.items.map(i => i.lastNudgeAt ?? '').sort().pop();
    const parkedContract = parkedItems.find(i => i.itemId === wanted && i.parkKind === 'contract');
    if (parkedContract?.submissionId) task.openContract(parkedContract.submissionId);
    else if (b) setOpenState({ bundle: b, sameClient: sameClientOf(b) });
    else if (w && last) setOpenState({ bundle: w, sameClient: [], startSent: { at: last } });
    else if (!task.openItem(wanted) && groups[0] && !wanted.startsWith('derived-stalled-') && !wanted.startsWith('derived-feedback-')) task.setWindowKey(groups[0].key);
    const next = new URLSearchParams(searchParams);
    next.delete('aufgabe');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, loading, groups.length]);

  // Aus der Glocke (15.11.2026): ?vertrag=1 öffnet das Vertrags-Fenster, ?nachgespraech=1 das
  // Nachgespräch. Der Hinweis kennt nur den Kandidaten; die Aufgabe dazu sagt, welcher Vorgang gemeint ist.
  const glocke = searchParams.get('vertrag') ? 'vertrag' : searchParams.get('nachgespraech') ? 'nachgespraech' : null;
  useEffect(() => {
    if (!glocke || loading) return;
    const next = new URLSearchParams(searchParams);
    next.delete(glocke);
    if (glocke === 'nachgespraech') {
      const it = mine.find((i) => i.taskCategory === 'interview_debrief_due');
      if (it) task.openItem(it.itemId);
      // Nachgespräch schon geführt: der Vorgang mit dem Verlauf (öffnet CandidateActiveProcesses)
      else next.set('vorgang', '1');
      setSearchParams(next, { replace: true });
      return;
    }
    setSearchParams(next, { replace: true });
    const it = [...mine, ...parkedItems].find((i) => i.candidateId === candidateId && i.taskCategory.startsWith('contract_') && i.submissionId)
      ?? parkedItems.find((i) => i.candidateId === candidateId && i.parkKind === 'contract' && i.submissionId);
    if (it?.submissionId) { task.openContract(it.submissionId); return; }
    // Keine Aufgabe (mehr) dazu: der neueste Vorgang des Kandidaten
    void supabase.from('submissions').select('id').eq('candidate_id', candidateId).order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => { const id = (data as { id: string }[] | null)?.[0]?.id; if (id) task.openContract(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glocke, loading]);

  return (
    <>
      {task.host}
      <KundePrueftWindow bundle={openState?.bundle ?? null} sameClient={openState?.sameClient ?? []} startSent={openState?.startSent ?? null} onClose={() => setOpenState(null)} onDone={refetch} />
    </>
  );
}
