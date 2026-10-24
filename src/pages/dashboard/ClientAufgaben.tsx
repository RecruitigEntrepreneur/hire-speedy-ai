import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { DoneRow, TaskRow, WaitingRow } from '@/components/client/tasks/ClientTaskParts';
import { ClientTaskWindow } from '@/components/client/tasks/ClientTaskWindow';
import { sinceLabel, taskHref, useClientTasks, type ClientTask } from '@/lib/clientTasksApi';

/**
 * Seite „Aufgaben“ des Kunden (23.10.2026): alles, wo der Kunde dran ist, an einem Ort –
 * erst wo jemand wartet, dann der Rest der Woche; was bei anderen liegt und was erledigt
 * ist, eingeklappt darunter. Oben Zahlen und Filter nach Stelle.
 */

const GROUP_KEY = 'matchunt:aufgaben:nach-stelle';
const readGroup = () => {
  try { return localStorage.getItem(GROUP_KEY) === '1'; } catch { return false; }
};

export default function ClientAufgaben() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useClientTasks();
  const [showWaiting, setShowWaiting] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [jobFilter, setJobFilter] = useState<string | null>(null);
  const [byJob, setByJob] = useState(readGroup);
  const location = useLocation();
  const [active, setActive] = useState<ClientTask | null>(null);
  // Aufgaben einer Bewerbung öffnen im Bewerberprofil; Fragen zur Stelle und Rechnungen hier
  const open = (t: ClientTask) => (t.submissionId ? navigate(taskHref(t)) : setActive(t));
  const param = new URLSearchParams(location.search).get('aufgabe');
  useEffect(() => {
    if (!param || !data) return;
    const hit = data.tasks.find((t) => t.key === param);
    if (hit) setActive(hit);
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, data]);

  const allTasks = data?.tasks ?? [];
  // Stellen mit offenen Aufgaben, meiste zuerst
  const jobs = useMemo(() => {
    const m = new Map<string, { id: string; title: string; n: number }>();
    for (const t of allTasks) {
      if (!t.jobId) continue;
      const e = m.get(t.jobId) ?? { id: t.jobId, title: t.jobTitle ?? 'Stelle', n: 0 };
      e.n++;
      m.set(t.jobId, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [allTasks]);
  useEffect(() => {
    if (jobFilter && data && !jobs.some((j) => j.id === jobFilter)) setJobFilter(null);
  }, [jobFilter, jobs, data]);

  const tasks = jobFilter ? allTasks.filter((t) => t.jobId === jobFilter) : allTasks;
  const waiting = (data?.waiting ?? []).filter((w) => !jobFilter || w.jobId === jobFilter);
  const done = (data?.done ?? []).filter((d) => !jobFilter || d.jobId === jobFilter);
  const urgent = tasks.filter((t) => t.urgent);
  const rest = tasks.filter((t) => !t.urgent);
  const oldest = tasks.reduce<string | null>((o, t) => (!o || Date.parse(t.since) < Date.parse(o) ? t.since : o), null);
  const today = new Date().toDateString();
  const doneToday = done.filter((d) => new Date(d.doneAt).toDateString() === today).length;
  const groups = useMemo(() => {
    if (!byJob) return [];
    const m = new Map<string, { title: string; items: ClientTask[] }>();
    for (const t of tasks) {
      const k = t.jobId ?? 'ohne';
      if (!m.has(k)) m.set(k, { title: t.jobTitle ?? 'Ohne Stelle', items: [] });
      m.get(k)!.items.push(t);
    }
    return [...m.entries()].map(([k, g]) => ({ key: k, ...g }));
  }, [byJob, tasks]);
  const toggleGroup = (v: boolean) => {
    setByJob(v);
    try { localStorage.setItem(GROUP_KEY, v ? '1' : '0'); } catch { /* nur Komfort */ }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Aufgaben</h1>
          <p className="text-sm text-muted-foreground">Alles, wo Sie dran sind. Eine Aufgabe erledigt sich, sobald Sie antworten.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="text-sm text-destructive">Die Aufgaben konnten nicht geladen werden.</p>
        ) : (
          <>
            {allTasks.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Kpi value={String(tasks.length)} label={tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'} />
                  <Kpi value={String(urgent.length)} label="jemand wartet" tone={urgent.length ? 'urgent' : undefined} />
                  <Kpi value={oldest ? sinceLabel(oldest).replace('seit ', '').replace('Tagen', 'Tage') : '–'} label="ältestes Warten" />
                  <Kpi value={String(doneToday)} label="heute erledigt" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant={jobFilter ? 'outline' : 'default'} className="h-7 text-xs" onClick={() => setJobFilter(null)}>Alle Stellen · {allTasks.length}</Button>
                  {jobs.map((j) => (
                    <Button key={j.id} size="sm" variant={jobFilter === j.id ? 'default' : 'outline'} className="h-7 max-w-[16rem] text-xs" onClick={() => setJobFilter(jobFilter === j.id ? null : j.id)}>
                      <span className="truncate">{j.title}</span>&nbsp;· {j.n}
                    </Button>
                  ))}
                  {jobs.length > 1 && !jobFilter && (
                    <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={byJob} onCheckedChange={toggleGroup} aria-label="Nach Stelle ordnen" />
                      Nach Stelle ordnen
                    </label>
                  )}
                </div>
              </div>
            )}

            {allTasks.length === 0 && (
              <div className="flex flex-col items-center rounded-xl border py-10 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/70" />
                <p className="text-sm font-medium">Alles erledigt</p>
                <p className="text-sm text-muted-foreground">Gerade wartet niemand auf Sie.</p>
              </div>
            )}
            {byJob && !jobFilter && jobs.length > 1 ? (
              groups.map((g) => (
                <section key={g.key} className="space-y-1">
                  <h2 className="px-2.5 text-xs font-medium text-muted-foreground">{g.title} · {g.items.length}</h2>
                  {g.items.map((t) => <TaskRow key={t.key} task={t} onOpen={open} />)}
                </section>
              ))
            ) : (
              <>
                {urgent.length > 0 && (
                  <section className="space-y-1">
                    <h2 className="px-2.5 text-xs font-medium text-muted-foreground">Jemand wartet auf Sie · {urgent.length}</h2>
                    {urgent.map((t) => <TaskRow key={t.key} task={t} onOpen={open} />)}
                  </section>
                )}
                {rest.length > 0 && (
                  <section className="space-y-1">
                    <h2 className="px-2.5 text-xs font-medium text-muted-foreground">Diese Woche · {rest.length}</h2>
                    {rest.map((t) => <TaskRow key={t.key} task={t} onOpen={open} />)}
                  </section>
                )}
              </>
            )}
            <section className="space-y-1 border-t pt-4">
              <button type="button" className="flex items-center gap-1 px-2.5 text-xs font-medium text-muted-foreground" onClick={() => setShowWaiting((v) => !v)}>
                {showWaiting ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Läuft bei anderen · {waiting.length}
              </button>
              {showWaiting && waiting.map((w) => <WaitingRow key={w.key} item={w} onOpen={(x) => navigate(`/dashboard/candidates/${x.submissionId}?vertrag=offen`)} />)}
            </section>
            <section className="space-y-1">
              <button type="button" className="flex items-center gap-1 px-2.5 text-xs font-medium text-muted-foreground" onClick={() => setShowDone((v) => !v)}>
                {showDone ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Erledigt · letzte 7 Tage · {done.length}
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

function Kpi({ value, label, tone }: { value: string; label: string; tone?: 'urgent' }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className={tone === 'urgent' ? 'text-lg font-semibold text-destructive' : 'text-lg font-semibold'}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
