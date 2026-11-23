import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useBesetzungen, type BesetzungGroup, type BesetzungItem } from '@/lib/besetzungApi';
import { useClientTasks } from '@/lib/clientTasksApi';
import { BesetzungCard } from '@/components/besetzungen/BesetzungParts';
import { BesetzungWindow, type BesetzungForm } from '@/components/besetzungen/BesetzungWindow';
import { introOf, dayMonth, eur } from '@/components/besetzungen/besetzungView';
import { useTranslation } from 'react-i18next';
import { OfferTaskWindow } from '@/components/offers/OfferTaskWindow';
import { ContractTaskWindow } from '@/components/contracts/ContractTaskWindow';
import { StellenTitelKurz } from '@/components/client/StellenTitelKurz';

/**
 * Kunden-Seite „Besetzungen“ (Etappe 2, 25.10.2026; Umbau Nachbesetzung 11.11.2026, K3):
 * ersetzt „Angebote“ und „Placements“. Alles nach dem Interview in vier Reitern: Im Angebot ·
 * Bis zum Start · Im Haus · Abgeschlossen. Klick auf eine Karte öffnet das Fenster
 * „Besetzung · Name“, bei einem Angebot das vorhandene Angebots-Fenster.
 * Adresse: ?besetzung=<submissionId> öffnet das Fenster, &melden=ende direkt „Besetzung endet“
 * (Aufgabe „… hat vor dem Start abgesagt“). Rechnungen: eigener Bereich.
 */

// Beschriftung und leere Listen: clientPlacements:page.tabs.<key> bzw. page.empty.<key>
const TABS: { key: BesetzungGroup }[] = [{ key: 'angebot' }, { key: 'start' }, { key: 'haus' }, { key: 'ab' }];

function Kpi({ label, value, sub, onClick }: { label: string; value: string; sub?: string | null; onClick?: () => void }) {
  const inner = (
    <>
      <p className="text-xs text-muted-foreground max-sm:text-[10.5px] max-sm:leading-tight">{label}</p>
      <p className="text-xl font-semibold max-sm:text-sm max-sm:tabular-nums">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground max-sm:text-[10.5px]">{sub}</p>}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="rounded-xl border bg-card px-4 py-3 max-sm:px-2 max-sm:py-2 text-left transition-colors hover:border-foreground/30">{inner}</button>
    : <div className="rounded-xl border bg-card px-4 py-3 max-sm:px-2 max-sm:py-2">{inner}</div>;
}

export default function ClientBesetzungen() {
  const { t } = useTranslation('clientPlacements');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = useBesetzungen();
  const tasks = useClientTasks();
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const [winFor, setWinFor] = useState<string | null>(null);
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<BesetzungForm | null>(null);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const taskSubs = useMemo(() => new Set((tasks.data?.tasks ?? []).map((t) => t.submissionId).filter(Boolean) as string[]), [tasks.data]);
  const jobs = useMemo(() => {
    const m = new Map<string, { id: string; title: string; n: number }>();
    for (const i of items) m.set(i.jobId, { id: i.jobId, title: i.jobTitle, n: (m.get(i.jobId)?.n ?? 0) + 1 });
    return [...m.values()];
  }, [items]);
  const aktiveStelle = jobFilter ? jobs.find((j) => j.id === jobFilter) ?? null : null;
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

  // Direkt ins Fenster (Glocke, Mail, Aufgabe): ?besetzung=<submissionId>[&melden=ende]
  useEffect(() => {
    const sub = params.get('besetzung');
    if (!sub || !q.data) return;
    const hit = q.data.items.find((i) => i.submissionId === sub);
    const melden = params.get('melden');
    if (hit) {
      if (hit.group === 'angebot') setOfferFor(sub);
      else { setInitialForm(melden === 'ende' && hit.can?.endReport ? 'end' : null); setWinFor(sub); }
    }
    const next = new URLSearchParams(params); next.delete('besetzung'); next.delete('melden'); if (hit) next.set('reiter', hit.group); setParams(next, { replace: true });
  }, [params, q.data, setParams]);

  const open = (i: BesetzungItem) => { setInitialForm(null); if (i.group === 'angebot') setOfferFor(i.submissionId); else setWinFor(i.submissionId); };
  const current = items.find((i) => i.submissionId === winFor) ?? null;
  const list = filtered.filter((i) => i.group === tab);
  const k = q.data?.kpis;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.subtitle')}</p>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : q.error ? (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : t('page.loadError')}</p>
        ) : (
          <>
            {/* Handy (17.11.2026): drei kleine Kacheln nebeneinander statt untereinander */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Kpi label={t('page.placedYear', { year: new Date().getFullYear() })} value={String(k?.placedThisYear ?? 0)} sub={t('page.signed')} />
              <Kpi label={t('page.openInvoices')} value={eur(k?.openInvoiceCents ?? 0)} sub={t('page.toInvoices')} onClick={() => navigate('/dashboard/rechnungen')} />
              <Kpi label={t('page.nextStart')} value={k?.nextStart ? dayMonth(k.nextStart.date) : '–'} sub={k?.nextStart?.name ?? null} />
            </div>

            <div className="space-y-3">
              {/* Apple-Stil (22.11.2026): Reiter als ruhige graue Pillen, die Stelle über ein Menü statt zwei Zeilen Pillen */}
              <div className="flex flex-wrap items-center gap-2">
                <div role="tablist" className="handy-wischen flex min-w-0 gap-1 max-md:w-full">
                  {TABS.map((tb) => (
                    <button key={tb.key} type="button" role="tab" aria-selected={tab === tb.key} onClick={() => setTab(tb.key)}
                      className={cn('h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors', tab === tb.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
                      {t(`page.tabs.${tb.key}`)} <span className="font-normal">{counts[tb.key]}</span>
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                  {jobs.length > 1 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 max-w-[14rem] shrink-0 gap-1.5 text-xs">
                          <span className="truncate">{aktiveStelle ? <StellenTitelKurz titel={aktiveStelle.title} /> : t('page.allJobs')}</span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setJobFilter(null)}><span className={cn(!jobFilter && 'font-medium')}>{t('page.allJobs')}</span></DropdownMenuItem>
                        {jobs.map((j) => (
                          <DropdownMenuItem key={j.id} className="cursor-pointer justify-between gap-3" onClick={() => setJobFilter(j.id)}>
                            <span className={cn('truncate', jobFilter === j.id && 'font-medium')}>{j.title}</span>
                            <span className="text-xs text-muted-foreground">{j.n}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('page.searchPlaceholder')} className="h-8 pl-8 text-sm" aria-label={t('page.search')} />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{introOf(tab)}</p>
            </div>

            <div className="space-y-2">
              {list.length === 0 ? (
                <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{search || jobFilter ? t('page.nothingFound') : t(`page.empty.${tab}`)}</p>
              ) : list.map((i) => <BesetzungCard key={i.submissionId} item={i} hasTask={taskSubs.has(i.submissionId)} onOpen={() => open(i)} />)}
            </div>
          </>
        )}
      </div>

      <BesetzungWindow
        item={current} open={!!current} initialForm={initialForm}
        onOpenChange={(o) => { if (!o) { setWinFor(null); setInitialForm(null); } }}
        onContract={(sub) => { setWinFor(null); setContractFor(sub); }}
        onOpenSubmission={(sub) => {
          const hit = items.find((i) => i.submissionId === sub);
          setInitialForm(null);
          setWinFor(sub);
          if (hit) setTab(hit.group);
        }}
      />
      <OfferTaskWindow submissionId={offerFor} open={!!offerFor} onOpenChange={(o) => { if (!o) setOfferFor(null); }}
        onAdjust={() => offerFor && navigate(`/dashboard/candidates/${offerFor}`, { state: { open: 'offer' } })}
        onReject={() => offerFor && navigate(`/dashboard/candidates/${offerFor}`, { state: { open: 'reject' } })}
        onContract={() => { const s = offerFor; setOfferFor(null); setContractFor(s); }} />
      <ContractTaskWindow submissionId={contractFor} open={!!contractFor} onOpenChange={(o) => { if (!o) setContractFor(null); }} />
    </DashboardLayout>
  );
}
