import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DoneRow, TaskCard, WaitingRow } from '@/components/client/tasks/ClientTaskParts';
import { ForYouCard } from '@/components/client/job/JobControl';
import { ClientTaskWindow } from '@/components/client/tasks/ClientTaskWindow';
import { taskHref, useClientTasks, waitingLabel, type ClientTask, type ClientTaskKind } from '@/lib/clientTasksApi';
import { cn } from '@/lib/utils';
import { StellenTitelKurz } from '@/components/client/StellenTitelKurz';

/**
 * Seite „Aufgaben“ des Kunden (23.10.2026): alles, wo der Kunde dran ist, an einem Ort –
 * erst wo jemand wartet, dann der Rest der Woche; was bei anderen liegt und was erledigt
 * ist, eingeklappt darunter.
 * Apple-Stil (22.11.2026): ein Satz statt Zahlen-Kisten, „Als Nächstes“ groß, darunter die Aufgaben als
 * Karten mit Reitern nach Art; die Stelle wählt man oben rechts.
 */

/** Art der Aufgabe für die Reiter über den Karten; die Namen stehen unter tasks.kind.<key>. */
const ARTEN: { key: string; kinds: ClientTaskKind[] }[] = [
  { key: 'pruefen', kinds: ['review'] },
  { key: 'feedback', kinds: ['feedback', 'decide_unsure'] },
  { key: 'termine', kinds: ['alternative', 'expired_request'] },
  { key: 'angebote', kinds: ['make_offer', 'counter', 'offer_overdue'] },
  { key: 'vertraege', kinds: ['send_contract', 'contract_signed_check', 'docusign_sign', 'confirm_signature'] },
  { key: 'fragen', kinds: ['recruiter_question'] },
  { key: 'rechnungen', kinds: ['invoice', 'purchase_order'] },
  { key: 'start', kinds: ['confirm_start', 'start_check', 'end_confirm'] },
  { key: 'sonstiges', kinds: ['research_position', 'research_offer', 'job_paused'] },
];

export default function ClientAufgaben() {
  const { t } = useTranslation('clientDashboard');
  const navigate = useNavigate();
  const { data, isLoading, error } = useClientTasks();
  const [showWaiting, setShowWaiting] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const location = useLocation();
  const [active, setActive] = useState<ClientTask | null>(null);
  // Aufgaben einer Bewerbung öffnen im Bewerberprofil; Fragen zur Stelle und Rechnungen hier
  const open = (task: ClientTask) => (task.submissionId ? navigate(taskHref(task)) : setActive(task));
  const param = new URLSearchParams(location.search).get('aufgabe');
  // Aus der Glocke (15.11.2026) kommt ?stelle= mit: Ist die Frage schon beantwortet, gibt es die
  // Aufgabe nicht mehr – dann zur Stelle statt auf eine Liste ohne Fenster.
  const stelle = new URLSearchParams(location.search).get('stelle');
  useEffect(() => {
    if (!param || !data) return;
    // Gleiche Fragen können zweimal in der Glocke stehen: dann die offene Frage zur selben Stelle.
    const hit = data.tasks.find((x) => x.key === param)
      ?? (stelle && param.startsWith('question:') ? data.tasks.find((x) => x.key.startsWith('question:') && x.jobId === stelle) : undefined);
    if (hit) setActive(hit);
    if (!hit && stelle) { navigate(`/dashboard/jobs/${stelle}`, { replace: true }); return; }
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, data]);

  const allTasks = data?.tasks ?? [];
  // Stellen mit offenen Aufgaben, meiste zuerst
  const jobs = useMemo(() => {
    const m = new Map<string, { id: string; title: string; n: number }>();
    for (const x of allTasks) {
      if (!x.jobId) continue;
      const e = m.get(x.jobId) ?? { id: x.jobId, title: x.jobTitle ?? t('tasks.job'), n: 0 };
      e.n++;
      m.set(x.jobId, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [allTasks, t]);
  useEffect(() => {
    if (jobFilter && data && !jobs.some((j) => j.id === jobFilter)) setJobFilter(null);
  }, [jobFilter, jobs, data]);

  const tasks = jobFilter ? allTasks.filter((x) => x.jobId === jobFilter) : allTasks;
  const waiting = (data?.waiting ?? []).filter((w) => !jobFilter || w.jobId === jobFilter);
  const done = (data?.done ?? []).filter((d) => !jobFilter || d.jobId === jobFilter);
  // „Als Nächstes“ (21.11.2026): die eine Aufgabe steht groß oben und fehlt deshalb in der Liste darunter.
  const [nextKey, setNextKey] = useState<string | null>(null);
  const listed = tasks.filter((x) => x.key !== nextKey);
  const [art, setArt] = useState<string | null>(null);
  // Reiter nach Art, nur Arten mit Aufgaben
  const arten = ARTEN.map((a) => ({ ...a, items: listed.filter((x) => a.kinds.includes(x.kind)) })).filter((a) => a.items.length);
  const nachArt = art ? arten.find((a) => a.key === art)?.items ?? listed : listed;
  const waitingCount = tasks.filter((x) => x.urgent).length;
  const aktiveStelle = jobFilter ? jobs.find((j) => j.id === jobFilter) ?? null : null;
  // Wechselt die Stelle, gilt wieder „Alle“ bei der Art
  useEffect(() => { setArt(null); }, [jobFilter]);

  // „Als Nächstes“ (21.11.2026): die wichtigste Aufgabe groß, mit einem Knopf und „Später“.
  const karte = tasks.length > 0 ? (
    <ForYouCard
      tasks={tasks} waiting={waiting} items={[]} loading={false} onOpen={open}
      title={t('tasks.next')} noAll tour onCurrent={setNextKey}
      whoOf={(x) => x.jobTitle ?? x.who ?? null}
      subOf={(x) => [x.detail, waitingLabel(x)].filter(Boolean).join(' · ') || null}
    />
  ) : null;
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        {/* data-tour: Ziel des Kunden-Rundgangs (lib/clientGuide.ts) */}
        <div data-tour="tasks.main" className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('tasks.title')}</h1>
            {/* Apple-Stil (22.11.2026): ein Satz statt der vier Zahlen-Kisten */}
            <p className="text-sm text-muted-foreground">{allTasks.length > 0 ? t('tasks.summary', { total: tasks.length, waiting: waitingCount }) : t('tasks.lead')}</p>
          </div>
          {jobs.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[18rem] gap-1.5 text-xs">
                  <span className="truncate">{aktiveStelle ? <StellenTitelKurz titel={aktiveStelle.title} /> : t('tasks.allJobsPlain')}</span>
                  <span className="font-normal text-muted-foreground">{aktiveStelle ? aktiveStelle.n : allTasks.length}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem className="cursor-pointer justify-between gap-3" onClick={() => setJobFilter(null)}>
                  <span className={cn(!jobFilter && 'font-medium')}>{t('tasks.allJobsPlain')}</span>
                  <span className="text-xs text-muted-foreground">{allTasks.length}</span>
                </DropdownMenuItem>
                {jobs.map((j) => (
                  <DropdownMenuItem key={j.id} className="cursor-pointer justify-between gap-3" onClick={() => setJobFilter(j.id)}>
                    <span className={cn('truncate', jobFilter === j.id && 'font-medium')}>{j.title}</span>
                    <span className="text-xs text-muted-foreground">{j.n}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">{t('tasks.loadError')}</p>
        ) : (
          <>
            {allTasks.length === 0 && (
              <div className="flex flex-col items-center rounded-xl border bg-card py-10 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium">{t('tiles.allDone')}</p>
                <p className="text-sm text-muted-foreground">{t('tasks.nobodyWaiting')}</p>
              </div>
            )}
            {allTasks.length > 0 && (
              <>
                    {karte}
                    <div role="tablist" className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {[{ key: null as string | null, label: t('tiles.all'), n: listed.length }, ...arten.map((a) => ({ key: a.key as string | null, label: t(`tasks.kind.${a.key}`), n: a.items.length }))].map((a) => (
                        <button key={a.key ?? 'alle'} type="button" role="tab" aria-selected={art === a.key} onClick={() => setArt(a.key)}
                          className={cn('h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors', art === a.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
                          {a.label} <span className="font-normal">{a.n}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">{nachArt.map((x) => <TaskCard key={x.key} task={x} onOpen={open} />)}</div>
              </>
            )}
            <section className="space-y-1 border-t pt-4">
              <button type="button" className="flex items-center gap-1 px-2.5 text-xs font-medium text-muted-foreground" onClick={() => setShowWaiting((v) => !v)}>
                {showWaiting ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {t('tasks.waitingOthers', { count: waiting.length })}
              </button>
              {showWaiting && waiting.map((w) => <WaitingRow key={w.key} item={w} onOpen={(x) => navigate(`/dashboard/candidates/${x.submissionId}?vertrag=offen`)} />)}
            </section>
            <section className="space-y-1">
              <button type="button" className="flex items-center gap-1 px-2.5 text-xs font-medium text-muted-foreground" onClick={() => setShowDone((v) => !v)}>
                {showDone ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {t('tasks.done7', { count: done.length })}
              </button>
              {showDone && done.map((d) => <DoneRow key={`${d.key}:${d.doneAt}`} item={d} />)}
            </section>
          </>
        )}
      </div>
      <ClientTaskWindow task={active} open={!!active} onOpenChange={(o) => { if (!o) setActive(null); }} handlers={null} />
    </DashboardLayout>
  );
}
