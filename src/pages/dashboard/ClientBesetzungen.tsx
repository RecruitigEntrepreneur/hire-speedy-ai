import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useBesetzungen, type BesetzungGroup, type BesetzungItem } from '@/lib/besetzungApi';
import { useClientTasks, type ClientTask } from '@/lib/clientTasksApi';
import { BesetzungCard } from '@/components/besetzungen/BesetzungParts';
import { BesetzungWindow } from '@/components/besetzungen/BesetzungWindow';
import { INTRO, dayMonth, eur } from '@/components/besetzungen/besetzungView';
import { OfferTaskWindow } from '@/components/offers/OfferTaskWindow';
import { ContractTaskWindow } from '@/components/contracts/ContractTaskWindow';
import { ClientTaskWindow } from '@/components/client/tasks/ClientTaskWindow';

/**
 * Kunden-Seite „Besetzungen“ (Etappe 2, 25.10.2026): ersetzt „Angebote“ und „Placements“.
 * Alles nach dem Interview in vier Reitern: Im Angebot · Bis zum Start · Im Haus ·
 * Abgeschlossen. Klick auf eine Karte öffnet das Fenster „Besetzung · Name“, bei einem
 * Angebot das vorhandene Angebots-Fenster. Rechnungen: eigener Bereich (Etappe 3).
 */

const TABS: { key: BesetzungGroup; label: string }[] = [
  { key: 'angebot', label: 'Im Angebot' },
  { key: 'start', label: 'Bis zum Start' },
  { key: 'haus', label: 'Im Haus' },
  { key: 'ab', label: 'Abgeschlossen' },
];

const EMPTY: Record<BesetzungGroup, string> = {
  angebot: 'Gerade läuft kein Angebot. Ein Angebot machen Sie im Bewerberprofil nach dem Interview.',
  start: 'Niemand zwischen Zusage und erstem Arbeitstag.',
  haus: 'Noch niemand im Haus, der über Matchunt kam.',
  ab: 'Noch nichts abgeschlossen. Hier landen Besetzungen nach dem Continuity-Zeitraum bzw. 6 Monate nach Start, dazu Nichtantritte und Ausgeschiedene.',
};

function Kpi({ label, value, sub, onClick }: { label: string; value: string; sub?: string | null; onClick?: () => void }) {
  const inner = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/30">{inner}</button>
    : <div className="rounded-xl border bg-card px-4 py-3">{inner}</div>;
}

export default function ClientBesetzungen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useBesetzungen();
  const tasks = useClientTasks();
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const [winFor, setWinFor] = useState<string | null>(null);
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [startTask, setStartTask] = useState<ClientTask | null>(null);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const taskSubs = useMemo(() => new Set((tasks.data?.tasks ?? []).map((t) => t.submissionId).filter(Boolean) as string[]), [tasks.data]);
  const jobs = useMemo(() => {
    const m = new Map<string, { id: string; title: string; n: number }>();
    for (const i of items) m.set(i.jobId, { id: i.jobId, title: i.jobTitle, n: (m.get(i.jobId)?.n ?? 0) + 1 });
    return [...m.values()];
  }, [items]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => (!jobFilter || i.jobId === jobFilter) && (!s || `${i.name} ${i.jobTitle} ${i.recruiterName ?? ''}`.toLowerCase().includes(s)));
  }, [items, search, jobFilter]);
  const counts = useMemo(() => {
    const c: Record<BesetzungGroup, number> = { angebot: 0, start: 0, haus: 0, ab: 0 };
    for (const i of filtered) c[i.group] += 1;
    return c;
  }, [filtered]);

  // Reiter aus der Adresse, sonst der erste mit Einträgen (bevorzugt „Bis zum Start“)
  const asked = params.get('reiter') as BesetzungGroup | null;
  const fallback: BesetzungGroup = q.data ? (q.data.counts.start ? 'start' : TABS.find((t) => q.data!.counts[t.key])?.key ?? 'angebot') : 'start';
  const tab: BesetzungGroup = asked && TABS.some((t) => t.key === asked) ? asked : fallback;
  const setTab = (key: BesetzungGroup) => { const next = new URLSearchParams(params); next.set('reiter', key); setParams(next, { replace: true }); };

  // Direkt ins Fenster (Glocke, Mail): ?besetzung=<submissionId>
  useEffect(() => {
    const sub = params.get('besetzung');
    if (!sub || !q.data) return;
    const hit = q.data.items.find((i) => i.submissionId === sub);
    if (hit) { if (hit.group === 'angebot') setOfferFor(sub); else setWinFor(sub); }
    const next = new URLSearchParams(params); next.delete('besetzung'); if (hit) next.set('reiter', hit.group); setParams(next, { replace: true });
  }, [params, q.data, setParams]);

  const open = (i: BesetzungItem) => (i.group === 'angebot' ? setOfferFor(i.submissionId) : setWinFor(i.submissionId));
  const current = items.find((i) => i.submissionId === winFor) ?? null;
  const list = filtered.filter((i) => i.group === tab);
  const k = q.data?.kpis;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Besetzungen</h1>
          <p className="text-sm text-muted-foreground">Alles nach dem Interview: Angebot, Zusage, Vertrag, Start, Continuity.</p>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : q.error ? (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Die Besetzungen konnten nicht geladen werden.'}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Kpi label={`Besetzt ${new Date().getFullYear()}`} value={String(k?.placedThisYear ?? 0)} sub="unterschrieben" />
              <Kpi label="Offene Rechnungen" value={k?.openInvoiceCents ? eur(k.openInvoiceCents) : '0 €'} sub="zu den Rechnungen" onClick={() => navigate('/dashboard/rechnungen')} />
              <Kpi label="Nächster Start" value={k?.nextStart ? dayMonth(k.nextStart.date) : '–'} sub={k?.nextStart?.name ?? null} />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {TABS.map((t) => (
                  <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} className="h-8" onClick={() => setTab(t.key)}>
                    {t.label} ({counts[t.key]})
                  </Button>
                ))}
                <div className="relative ml-auto w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Stelle, Headhunter" className="h-8 pl-8 text-sm" aria-label="Suchen" />
                </div>
              </div>
              {jobs.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant={jobFilter ? 'outline' : 'secondary'} className="h-7 text-xs" onClick={() => setJobFilter(null)}>Alle Stellen</Button>
                  {jobs.map((j) => (
                    <Button key={j.id} size="sm" variant={jobFilter === j.id ? 'secondary' : 'outline'} className="h-7 max-w-[16rem] text-xs" onClick={() => setJobFilter(jobFilter === j.id ? null : j.id)}>
                      <span className="truncate">{j.title}</span>&nbsp;· {j.n}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">{INTRO[tab]}</p>
            </div>

            <div className="space-y-2">
              {list.length === 0 ? (
                <p className={cn('rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground')}>{search || jobFilter ? 'Nichts gefunden.' : EMPTY[tab]}</p>
              ) : list.map((i) => <BesetzungCard key={i.submissionId} item={i} hasTask={taskSubs.has(i.submissionId)} onOpen={() => open(i)} />)}
            </div>
          </>
        )}
      </div>

      <BesetzungWindow
        item={current} open={!!current} onOpenChange={(o) => { if (!o) setWinFor(null); }}
        onContract={(sub) => { setWinFor(null); setContractFor(sub); }}
        onStartCheck={(i) => {
          const t = (tasks.data?.tasks ?? []).find((x) => x.key === `start:${i.placement?.id}`) ?? null;
          if (t) { setWinFor(null); setStartTask(t); } else navigate(`/dashboard/aufgaben`);
        }}
      />
      <OfferTaskWindow submissionId={offerFor} open={!!offerFor} onOpenChange={(o) => { if (!o) setOfferFor(null); }}
        onAdjust={() => offerFor && navigate(`/dashboard/candidates/${offerFor}`, { state: { open: 'offer' } })}
        onReject={() => offerFor && navigate(`/dashboard/candidates/${offerFor}`, { state: { open: 'reject' } })}
        onContract={() => { const s = offerFor; setOfferFor(null); setContractFor(s); }} />
      <ContractTaskWindow submissionId={contractFor} open={!!contractFor} onOpenChange={(o) => { if (!o) setContractFor(null); }} />
      <ClientTaskWindow task={startTask} open={!!startTask} onOpenChange={(o) => { if (!o) setStartTask(null); }} handlers={null} />
    </DashboardLayout>
  );
}
