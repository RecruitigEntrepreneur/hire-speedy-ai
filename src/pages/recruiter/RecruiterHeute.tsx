import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateTaskDialog } from '@/components/influence/CreateTaskDialog';
import { useMinutenTakt, useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useRecruiterInterviewAgenda, type RecruiterInterview } from '@/hooks/useRecruiterInterviewAgenda';
import { useRecruiterPipeline, PIPELINE_LABELS, type PipelineStageKey } from '@/hooks/useRecruiterPipeline';
import { dayMonth, dayMonthBare, dfLocale } from '@/components/recruiter/tasks/sprache';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { DAY_MS, buildGuide, dateShort, daysSince, euro, firstName, groupByPerson, useTaskHost, viewLabel } from '@/components/recruiter/tasks/taskWindow';
import { KundePrueftWindow } from '@/components/recruiter/tasks/KundePrueftWindow';
import { bundleByJob, type StalledBundle } from '@/lib/kundePrueft';
import { handgriffOf, rowItem, splitJetzt, type Handgriff, type JetztRow } from '@/components/recruiter/tasks/jetztRows';
import { format, isToday, isTomorrow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Phone, Plus, Video } from 'lucide-react';
import { Honorar } from '@/components/recruiter/Honorar';
import { useVerdecke } from '@/lib/honorarVerdeckt';
import { istGleichDran } from '@/lib/kandidatVorbereiten';

// ---------------------------------------------------------------------------
// „Heute“: eine Seite, eine Spalte. Jede Zeile ist ein Deal, der einen Handgriff
// braucht. Kompakt: Pille, Name, ein Satz, ein Knopf. Aufgeklappt: Grund in
// Fakten, Aufgabe in Schritten, Ziel. Aufgaben entstehen aus dem Zustand
// (useUnifiedTaskInbox) und verschwinden, wenn sich der Zustand ändert.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

const NS = 'recruiterTasks';
/** Texte in der Sprache der Oberfläche; die Seite lädt den Namespace über useTranslation. */
const tr = (key: string, options?: Record<string, unknown>): string => i18n.t(`${NS}:${key}`, options);

export default function RecruiterHeute() {
  useTranslation(NS);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { allItems, completedItems, waitingItems, parkedItems, soonItems, prepCount, loading, markDone, snooze, refetch } = useUnifiedTaskInbox('all');
  const { data: agenda } = useRecruiterInterviewAgenda();
  const pipeline = useRecruiterPipeline();
  const [stageFilter, setStageFilter] = useState<PipelineStageKey | null>(null);

  // Wie beim Kunden (23.11.2026): oben eine Aufgabe zum Blättern, darunter Reiter nach Handgriff
  const [tab, setTab] = useState<'all' | Handgriff>('all');
  const [nextIdx, setNextIdx] = useState(0);
  const [termineOpen, setTermineOpen] = useState(true);
  const [waitOpen, setWaitOpen] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [since, setSince] = useState<{ title: string; created_at: string }[]>([]);

  // „Seit gestern“: die Ereignisse der letzten 24 Stunden, als eine Zeile
  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('title, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setSince(data ?? []));
  }, [user?.id]);

  const now = Date.now();
  // „Jetzt“: dieselben Zeilen wie die Aufgaben-Karte im Dashboard
  // Der Takt läuft, solange heute ein Termin ansteht: 30 Minuten vorher rückt er nach oben
  const takt = useMinutenTakt(allItems.some(i => i.prep?.art === 'termin'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { groups, bundles, rows } = useMemo(() => splitJetzt(allItems), [allItems, takt]);
  // Vor der Einreichung, gerade erst angelegt: noch kein Handgriff, aber diese Woche dran
  const soonGroups = useMemo(() => groupByPerson(soonItems), [soonItems]);
  const stale = useMemo(() => allItems.filter(i => i.isStale), [allItems]);
  // „Kunde prüft“ je Stelle gebündelt (20.10.2026): eine Zeile, eine Mail für alle
  // Kandidaten. Alles andere bleibt je Person.
  const waitingBundles = useMemo(() => bundleByJob(waitingItems, new Date()), [waitingItems]);
  // Das Fenster hält seine Stelle fest: nach dem Erinnern lädt die Liste neu und die
  // Zeile wandert nach „Wartet“ – Schritt 2 muss trotzdem sichtbar bleiben.
  const [openState, setOpenState] = useState<{ bundle: StalledBundle; sameClient: StalledBundle[]; startSent?: { at: string } } | null>(null);
  const sameClient = (b: StalledBundle) => (b.items[0]?.companyRevealed && b.companyName
    ? bundles.filter(x => x.key !== b.key && x.kind === b.kind && x.items[0]?.companyRevealed && x.companyName === b.companyName)
    : []);
  const task = useTaskHost({ allItems, groups, markDone, snooze, refetch });
  /** Zeile öffnen: Stellen-Zeile ins Erinnerungs-Fenster (alle Stellen des Kunden), sonst die Aufgabe. */
  const openRow = (r: JetztRow) => {
    if (r.kind === 'bundle') setOpenState({ bundle: r.bundle, sameClient: r.more.length ? r.more : sameClient(r.bundle) });
    else task.setWindowKey(r.group.key);
  };
  const stageOfItem = (i: UnifiedTaskItem): PipelineStageKey | null => (i.submissionId && pipeline ? pipeline.stageOf[i.submissionId] ?? null : null);
  const needsByStage = useMemo(() => {
    const m: Partial<Record<PipelineStageKey, number>> = {};
    for (const r of rows) { const k = stageOfItem(rowItem(r)); if (k) m[k] = (m[k] ?? 0) + 1; }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, pipeline]);
  const filteredRows = useMemo(() => (stageFilter ? rows.filter(r => stageOfItem(rowItem(r)) === stageFilter) : rows), [rows, stageFilter, pipeline]);
  const doneToday = useMemo(
    () => completedItems.filter(i => i.completedAt && isToday(new Date(i.completedAt))),
    [completedItems],
  );
  const upcoming: RecruiterInterview[] = useMemo(
    () => (agenda?.all ?? []).filter(iv => iv.scheduledAt && iv.endsAt && iv.endsAt > now && iv.status !== 'cancelled').sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [agenda, now],
  );
  const weekInterviews = upcoming.filter(iv => new Date(iv.scheduledAt!).getTime() < now + 7 * DAY_MS);

  // Deeplink vom Dashboard: ?item=<id> klappt die Zeile auf
  const deepLink = searchParams.get('item');
  useEffect(() => {
    if (!deepLink || loading) return;
    const b = bundles.find(x => x.items.some(i => i.itemId === deepLink));
    if (b) setOpenState({ bundle: b, sameClient: sameClient(b) }); else task.openItem(deepLink);
    const next = new URLSearchParams(searchParams);
    next.delete('item');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, loading, groups.length]);

  // ─── Render ────────────────────────────────────────────────────────────

  const verdecke = useVerdecke();
  const runningCount = pipeline ? pipeline.stages.reduce((n, st) => n + st.count, 0) : 0;
  const headline = loading
    ? tr('heute.oneMoment')
    : rows.length === 0
      ? tr('heute.headlineIdle', { running: upcoming.length + waitingItems.length + parkedItems.length, stale: stale.length })
      : [
          tr('heute.summary', { count: rows.length }),
          runningCount > 0 ? tr('heute.running', { count: runningCount }) : null,
          pipeline && pipeline.totalFee > 0 ? tr('heute.possible', { fee: euro(pipeline.totalFee) }) : null,
        ].filter(Boolean).join(' · ');

  // Oben steht genau eine Aufgabe; „Später“ und die Pfeile blättern nur, sie verschieben nichts.
  const idx = filteredRows.length ? Math.min(nextIdx, filteredRows.length - 1) : 0;
  const nextRow = filteredRows[idx] ?? null;
  const restRows = filteredRows.filter((_, i) => i !== idx);
  const reiter = BLOCKS.map(b => ({ key: b, count: restRows.filter(r => handgriffOf(r) === b).length })).filter(x => x.count > 0);
  const aktiv = tab !== 'all' && reiter.some(x => x.key === tab) ? tab : 'all';
  const sichtbar = aktiv === 'all' ? restRows : restRows.filter(r => handgriffOf(r) === aktiv);
  const stages = pipeline?.stages ?? (Object.keys(PIPELINE_LABELS) as PipelineStageKey[]).map(key => ({ key, label: PIPELINE_LABELS[key], count: 0, fee: 0, deadline: null as string | null }));
  const waitCount = waitingBundles.length + parkedItems.length;

  const rowCard = (r: JetztRow, quiet = false) => {
    const item = rowItem(r);
    const guide = buildGuide(item);
    if (r.kind === 'bundle') {
      const feedback = r.bundle.kind === 'feedback';
      const all = [r.bundle, ...r.more];
      const fee = euro(all.reduce((x, b) => x + b.feeTotal, 0));
      const days = Math.max(...all.map(b => b.days));
      return (
        <TaskCard
          key={r.key}
          title={r.more.length && r.bundle.companyName ? r.bundle.companyName : r.bundle.jobTitle ?? tr('fallback.job')}
          sub={[feedback ? tr('guide.feedbackDue.pill') : tr('guide.reviewStalled.pill'), r.more.length ? tr('heute.jobs', { count: all.length }) : r.bundle.companyName].filter(Boolean).join(' · ')}
          text={<>{bundleLine(r.bundle, r.more)}{!feedback && !r.more.length && <> <ViewState bundle={r.bundle} />.</>}</>}
          left={<>{tr('heute.sinceDays', { count: days })}{fee && <> · <Honorar>{fee}</Honorar></>}</>}
          action={feedback ? tr('guide.askClient') : tr('guide.remindClient')}
          onOpen={() => openRow(r)}
          onAction={() => openRow(r)}
        />
      );
    }
    const fee = euro(item.feeValue);
    const offen = quiet ? () => task.openPrep(item) : () => openRow(r);
    return (
      <TaskCard
        key={r.key}
        title={r.group.name}
        sub={[guide.pill, item.jobTitle, item.candidateRole, item.companyName].filter(Boolean).join(' · ')}
        text={guide.advice}
        left={<>{sinceText(item.createdAt)}{fee && <> · <Honorar>{fee}</Honorar></>}{r.group.others.length > 0 && <> · +{tr('heute.tasksCount', { count: r.group.others.length })}</>}</>}
        action={quiet || DIRECT_KINDS.has(guide.primary.kind) ? tr('heute.openTask') : guide.primary.label}
        onOpen={offen}
        onAction={quiet ? offen : DIRECT_KINDS.has(guide.primary.kind) ? offen : () => task.act(item, guide)}
      />
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        {/* Kopf */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tr('heute.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{verdecke(headline)}</p>
          </div>
          <Button variant="secondary" size="sm" className="gap-1.5 rounded-full px-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {tr('heute.ownReminder')}
          </Button>
        </div>

        {since.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border bg-card px-4 py-2.5 text-xs text-muted-foreground">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><span className="font-medium text-foreground">{tr('heute.sinceYesterday')}</span> {since.map(s => s.title).join(' · ')}</span>
          </div>
        )}

        {/* Als Nächstes (links) und Deine Pipeline (rechts) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {loading ? (
            <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{tr('nach.loading')}</div>
          ) : !nextRow ? (
            <div className="flex flex-col justify-center rounded-xl border bg-card p-5 text-sm text-muted-foreground" data-tour="tasks.list">
              <p>{stageFilter ? tr('heute.emptyStage') : tr('heute.empty')}</p>
              {stageFilter && <button type="button" className="mt-2 self-start text-sm text-klick hover:underline" onClick={() => setStageFilter(null)}>{tr('heute.showAll')} ›</button>}
            </div>
          ) : (
            <NextCard
              row={nextRow}
              position={idx + 1}
              total={filteredRows.length}
              onOpen={() => openRow(nextRow)}
              onOpenItem={(id) => task.openItem(id)}
              onStep={(d) => setNextIdx((idx + d + filteredRows.length) % filteredRows.length)}
            />
          )}

          <div className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight">{tr('heute.pipelineTitle')}</h2>
              <Link to="/recruiter/submissions" className="text-sm text-klick hover:underline">{tr('heute.pipelineDetails')} ›</Link>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3">
              {stages.map(st => {
                const needs = needsByStage[st.key] ?? 0;
                const active = stageFilter === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setStageFilter(active ? null : st.key); setNextIdx(0); }}
                    className={cn('-m-1.5 min-w-0 rounded-lg p-1.5 text-left transition-colors hover:bg-accent/50', active && 'ring-1 ring-foreground')}
                  >
                    <p className={cn('text-xl font-semibold tracking-tight tabular-nums', st.count === 0 && 'text-muted-foreground/50')}>{st.count}</p>
                    <p className="truncate text-xs text-muted-foreground">{tr(`heute.stages.${st.key}`)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {needs > 0 ? tr('heute.tasksCount', { count: needs })
                        : st.key === 'placed' && st.deadline ? tr('heute.guaranteeUntil', { date: dateShort(st.deadline) })
                        : st.fee > 0 ? <Honorar>{euro(st.fee)}</Honorar> : ' '}
                    </p>
                  </button>
                );
              })}
            </div>
            {pipeline && (
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                {[
                  tr('heute.stats.rejected', { count: pipeline.rejectedThisMonth }),
                  tr('heute.stats.withdrawn', { count: pipeline.withdrawnThisMonth }),
                  tr('heute.stats.doneToday', { count: doneToday.length }),
                  prepCount > 0 ? tr('heute.stats.prep', { count: prepCount }) : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Reiter nach Handgriff und die übrigen Aufgaben als Karten */}
        {!loading && nextRow && (
          <div>
            {stageFilter && (
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{tr('heute.filterCount', { stage: tr(`heute.stages.${stageFilter}`), count: filteredRows.length })}</span>
                <button type="button" className="text-klick hover:underline" onClick={() => setStageFilter(null)}>{tr('heute.filterReset')} ›</button>
              </div>
            )}
            {restRows.length > 0 && (
              <>
                <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {[{ key: 'all' as const, label: tr('heute.tabAll'), count: restRows.length }, ...reiter.map(x => ({ key: x.key, label: tr(`heute.blocks.${x.key}.label`), count: x.count }))].map(x => (
                    <button
                      key={x.key}
                      type="button"
                      role="tab"
                      aria-selected={aktiv === x.key}
                      onClick={() => setTab(x.key)}
                      className={cn('h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors', aktiv === x.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}
                    >
                      {x.label} {x.count}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{sichtbar.map(r => rowCard(r))}</div>
              </>
            )}
          </div>
        )}

        {/* Diese Woche (01.11.2026): gerade angelegt, noch kein Gespräch */}
        {!loading && !stageFilter && soonGroups.length > 0 && (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight">{tr('heute.thisWeek', { count: soonGroups.length })}</h2>
              <span className="text-xs text-muted-foreground">{tr('heute.thisWeekHint')}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {soonGroups.map(g => rowCard({ kind: 'person', key: g.key, prio: g.primary.sortPriority, fee: 0, critical: false, group: g }, true))}
            </div>
          </div>
        )}

        {/* Klappzeilen wie beim Kunden */}
        <div className="space-y-2">
          <FoldCard label={tr('heute.appointments')} count={weekInterviews.length} open={termineOpen} onToggle={() => setTermineOpen(o => !o)}>
            {weekInterviews.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{tr('heute.noAppointments')}</p>
            ) : weekInterviews.slice(0, 5).map(iv => (
              <div key={iv.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 text-muted-foreground tabular-nums">{relativeTime(iv.scheduledAt!)}</span>
                <span className="min-w-0 flex-1 truncate">{iv.candidateName} · {iv.jobTitle}</span>
                {iv.joinUrl ? (
                  <a href={iv.joinUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-klick hover:underline">{tr('pw.join')} ›</a>
                ) : (
                  <button type="button" className="shrink-0 text-xs font-medium text-klick hover:underline" onClick={() => navigate(`/recruiter/interviews?interview=${iv.id}`)}>{tr('guide.open')} ›</button>
                )}
              </div>
            ))}
            <Link to="/recruiter/interviews" className="block px-4 py-2.5 text-xs text-klick hover:underline">{tr('heute.toInterviews')} ›</Link>
          </FoldCard>

          <FoldCard label={tr('heute.waiting')} count={waitCount} open={waitOpen} onToggle={() => setWaitOpen(o => !o)}>
            {waitCount === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">{tr('heute.waitingEmpty')}</p>}
            {waitingBundles.map(b => {
              const matchunt = b.items.every(i => i.waitState === 'matchunt');
              const last = b.items.map(i => i.lastNudgeAt ?? '').sort().pop() || null;
              const next = b.items.map(i => i.nextNudgeAt ?? '').filter(Boolean).sort()[0] || null;
              const zweite = b.items.some(i => (i.nudgeCount ?? 0) >= 2);
              return (
                <div key={`w-${b.key}`} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">{matchunt ? 'Matchunt' : b.kind === 'feedback' ? tr('guide.feedbackDue.pill') : tr('fallback.client')}</Badge>
                    <span className="min-w-0 flex-1 truncate">{b.items.map(i => i.candidateName).join(', ')} · {b.jobTitle}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {matchunt
                        ? tr('heute.wait.matchunt', { date: next ? dayMonthBare(next) : '' })
                        : tr(`heute.wait.${b.kind === 'feedback' ? 'asked' : 'reminded'}Then${zweite ? 'Matchunt' : 'Second'}`, { last: dateShort(last), next: dateShort(next) })}
                    </span>
                    {!matchunt && last && (
                      <button type="button" className="font-medium text-klick hover:underline" onClick={() => setOpenState({ bundle: b, sameClient: [], startSent: { at: last } })}>
                        {tr('heute.tellCandidates')} ›
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Vertrag bis Tag 10, pausierte Stelle: nichts zu tun, mit Datum (28.10.2026) */}
            {parkedItems.map(i => (
              <div key={i.itemId} className="px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">{i.parkKind === 'contract' ? tr('guide.contract.pill') : i.parkKind === 'counter' ? tr('guide.counter.pill') : tr('heute.paused')}</Badge>
                  <span className="min-w-0 flex-1 truncate">{i.candidateName}{i.jobTitle ? ` · ${i.jobTitle}` : ''}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{i.parkNote}</span>
                  <button
                    type="button"
                    className="font-medium text-klick hover:underline"
                    onClick={() => {
                      if (i.parkKind === 'contract' && i.submissionId) task.openContract(i.submissionId);
                      else if (i.candidateId) navigate(`/recruiter/candidates/${i.candidateId}`);
                    }}
                  >
                    {tr('guide.open')} ›
                  </button>
                </div>
              </div>
            ))}
          </FoldCard>

          {stale.length > 0 && (
            <FoldCard label={tr('heute.staleTitle')} count={stale.length} open={staleOpen} onToggle={() => setStaleOpen(o => !o)}>
              {stale.map(i => (
                <div key={i.itemId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate"><span className="text-foreground">{i.candidateName || i.title}</span> · {i.jobTitle ?? i.candidateRole} · {tr('heute.days', { count: daysSince(i.createdAt) })}</span>
                  <button type="button" className="shrink-0 text-xs font-medium text-klick hover:underline" onClick={() => { if (i.prep) task.openPrep(i); else task.openDetail(i); }}>{tr('guide.open')} ›</button>
                  <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => task.later(i, new Date(Date.now() + 14 * DAY_MS))}>{tr('heute.rest14')}</button>
                </div>
              ))}
            </FoldCard>
          )}

          {completedItems.length > 0 && (
            <FoldCard label={tr('heute.doneTitle')} count={completedItems.length} open={doneOpen} onToggle={() => setDoneOpen(o => !o)}>
              {completedItems.map(i => (
                <div key={`${i.itemType}-${i.itemId}`} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span className="w-24 shrink-0 tabular-nums">{i.completedAt ? `${dayMonth(i.completedAt)} ${format(new Date(i.completedAt), 'HH:mm')}` : ''}</span>
                  <span className="truncate"><span className="text-foreground">{i.title}</span>{i.candidateName ? ` · ${i.candidateName}` : ''}{i.jobTitle ? ` · ${i.jobTitle}` : ''}</span>
                </div>
              ))}
            </FoldCard>
          )}
        </div>
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) refetch(); }} />
      {task.host}
      <KundePrueftWindow bundle={openState?.bundle ?? null} sameClient={openState?.sameClient ?? []} startSent={openState?.startSent ?? null} onClose={() => setOpenState(null)} onDone={refetch} />
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------

function relativeTime(iso: string) {
  const d = new Date(iso);
  const diffH = Math.round((d.getTime() - Date.now()) / 3_600_000);
  if (isToday(d) && diffH >= 0 && diffH <= 6) return diffH === 0 ? tr('heute.time.now') : tr('heute.time.inHours', { hours: diffH });
  if (isToday(d)) return format(d, 'HH:mm');
  if (isTomorrow(d)) return tr('heute.time.tomorrow', { time: format(d, 'HH:mm') });
  return `${format(d, 'EEE', { locale: dfLocale() })} ${dayMonth(d)} ${format(d, 'HH:mm')}`;
}

const sinceText = (iso: string) => {
  const n = daysSince(iso);
  return n <= 0 ? tr('heute.sinceToday') : tr('heute.sinceDays', { count: n });
};

/** Klappzeile wie auf der Aufgaben-Seite des Kunden. */
function FoldCard({ label, count, open, onToggle, children }: { label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button type="button" aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-accent/40" onClick={onToggle}>
        <span>{label} <span className="text-muted-foreground">· {count}</span></span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="divide-y border-t">{children}</div>}
    </div>
  );
}

/** Diese Knöpfe würden sofort wählen bzw. abhaken – in der Liste öffnen sie stattdessen das Fenster. */
const DIRECT_KINDS = new Set(['call', 'followup', 'done']);

// Reiter: heute.blocks.<key>.label
const BLOCKS: Handgriff[] = ['anruf', 'kunde', 'vorbereiten', 'kontakt', 'kurz'];

const rowName = (r: JetztRow) => (r.kind === 'person'
  ? r.group.primary.prep && istGleichDran(r.group.primary.prep) ? tr('heute.talkWith', { first: firstName(r.group.primary.candidateName) })
    : (r.group.primary.candidateName ? firstName(r.group.primary.candidateName) : r.group.primary.title)
  : (r.more.length && r.bundle.companyName ? r.bundle.companyName : r.bundle.jobTitle ?? tr('fallback.job')));

/** „In Prüfung“ (29.10.2026): hat das Kundenteam die Profile geöffnet? Ruhig, ohne Ampelfarben. */
function ViewState({ bundle }: { bundle: StalledBundle }) {
  const items = bundle.items;
  if (items.length === 1) return <span>{viewLabel(items[0].clientViewCount, items[0].clientLastViewedAt)}</span>;
  const seen = items.filter(i => (i.clientViewCount ?? 0) > 0).length;
  return <span>{seen === 0 ? tr('heute.noneOpened') : tr('heute.seenOf', { seen, total: items.length })}</span>;
}

/** Eine Aufgabe als Karte: oben wer oder was, unten seit wann und die eine Handlung in Blau. */
function TaskCard({ title, sub, text, left, action, onOpen, onAction }: {
  title: string;
  sub?: string;
  text?: React.ReactNode;
  left: React.ReactNode;
  action: string;
  onOpen: () => void;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 transition-colors hover:bg-accent/30">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <p className="truncate text-sm font-medium">{title}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        {text && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{text}</p>}
      </button>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-muted-foreground tabular-nums">{left}</span>
        <button type="button" className="shrink-0 whitespace-nowrap font-medium text-klick hover:underline" onClick={onAction}>{action} ›</button>
      </div>
    </div>
  );
}

/** Ganz oben: genau eine Sache, mit Grund und allen Aufgaben dieser Person bzw. dieses Kunden. */
function NextCard({ row, position, total, onOpen, onOpenItem, onStep }: {
  row: JetztRow;
  position: number;
  total: number;
  onOpen: () => void;
  onOpenItem: (itemId: string) => boolean;
  onStep: (delta: 1 | -1) => void;
}) {
  const navigate = useNavigate();
  const item = rowItem(row);
  const guide = buildGuide(item);
  const fee = euro(row.fee);
  const all = row.kind === 'person' ? [row.group.primary, ...row.group.others] : [];
  const title = row.kind === 'person' ? row.group.name : rowName(row);
  const termin = item.prep?.art === 'termin' ? item.prep.termin : null;
  const meta = [row.kind === 'person' ? item.jobTitle : null, item.candidateRole, item.companyName].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5" data-tour="tasks.list">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">{tr('heute.next')}</h2>
        {total > 1 && <span className="text-xs text-muted-foreground tabular-nums">{tr('heute.ofCount', { n: position, total })}</span>}
      </div>
      <button type="button" className="mt-3 min-w-0 text-left" onClick={onOpen}>
        <p className="text-[17px] font-semibold leading-snug tracking-tight">{title}</p>
        {(meta || fee) && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {meta}{meta && fee ? ' · ' : ''}{fee && <Honorar>{fee}</Honorar>}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {row.kind === 'bundle' ? bundleLine(row.bundle, row.more) : [guide.advice, ...all.slice(1).map(o => buildGuide(o).advice)].join(' ')}
        </p>
      </button>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {termin ? (
          <>
            {termin.joinUrl ? (
              <Button size="sm" className="gap-1.5 rounded-full px-4" asChild><a href={termin.joinUrl} target="_blank" rel="noreferrer"><Video className="h-4 w-4" />{tr('pw.join')}</a></Button>
            ) : item.candidatePhone ? (
              <Button size="sm" className="gap-1.5 rounded-full px-4" asChild><a href={`tel:${item.candidatePhone.replace(/[^\d+]/g, '')}`}><Phone className="h-4 w-4" />{tr('guide.call')}</a></Button>
            ) : null}
            <Button size="sm" variant="secondary" className="rounded-full px-4" onClick={() => navigate(`/recruiter/candidates/${item.candidateId}?interview=live`)}>{tr('pw.openInterview')}</Button>
          </>
        ) : (
          <Button size="sm" className="rounded-full px-4" data-tour="tasks.open" onClick={onOpen}>{tr('heute.openTask')}</Button>
        )}
        {total > 1 && <Button size="sm" variant="secondary" className="rounded-full px-4" onClick={() => onStep(1)}>{tr('heute.later')}</Button>}
      </div>
      {all.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
          <span>{tr('heute.tasksColon', { count: all.length })}</span>
          {all.map((o, k) => (
            <span key={o.itemId} className="inline-flex gap-1">
              {k > 0 && <span aria-hidden="true">·</span>}
              <button type="button" className="text-klick hover:underline" onClick={() => { if (!onOpenItem(o.itemId)) onOpen(); }}>
                {buildGuide(o).pill}
              </button>
            </span>
          ))}
        </div>
      )}
      {total > 1 && (
        <div className="mt-auto flex items-center justify-between pt-4">
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: Math.min(total, 7) }).map((_, i) => (
              <span key={i} className={cn('h-1 rounded-full', i === Math.min(position - 1, 6) ? 'w-4 bg-foreground' : 'w-1 bg-muted-foreground/30')} />
            ))}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full p-0" aria-label={tr('heute.prevTask')} onClick={() => onStep(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="secondary" className="h-8 w-8 rounded-full p-0" aria-label={tr('heute.nextTask')} onClick={() => onStep(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Stellen-Zeile in Sätzen: wer wartet wie lange beim Kunden. */
function bundleLine(bundle: StalledBundle, more: StalledBundle[]): string {
  const feedback = bundle.kind === 'feedback';
  const parts = [bundle, ...more].flatMap(b => b.items.map(i => `${i.candidateName}${more.length ? ` (${b.jobTitle})` : ''}`));
  return tr(feedback ? 'heute.bundleLineFeedback' : 'heute.bundleLineReview', { names: parts.join(', '), days: Math.max(bundle.days, ...more.map(b => b.days)) });
}
