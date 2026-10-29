import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateTaskDialog } from '@/components/influence/CreateTaskDialog';
import { useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useRecruiterInterviewAgenda, type RecruiterInterview } from '@/hooks/useRecruiterInterviewAgenda';
import { useRecruiterPipeline, PIPELINE_LABELS, type PipelineStageKey } from '@/hooks/useRecruiterPipeline';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { DAY_MS, buildGuide, dateDe, daysSince, euro, firstName, hoursSince, useTaskHost, type Guide, type PersonGroup } from '@/components/recruiter/tasks/taskWindow';
import { KundePrueftWindow } from '@/components/recruiter/tasks/KundePrueftWindow';
import { bundleByJob, viewText, type StalledBundle } from '@/lib/kundePrueft';
import { handgriffOf, rowItem, rowItems, splitJetzt, type Handgriff, type JetztRow } from '@/components/recruiter/tasks/jetztRows';
import { format, isToday, isTomorrow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bell, Check, CheckSquare, ChevronDown, ChevronRight, Lock, Mail, NotebookPen, Phone, Plus, Video } from 'lucide-react';
import { Honorar } from '@/components/recruiter/Honorar';
import { useVerdecke } from '@/lib/honorarVerdeckt';

// ---------------------------------------------------------------------------
// „Heute“: eine Seite, eine Spalte. Jede Zeile ist ein Deal, der einen Handgriff
// braucht. Kompakt: Pille, Name, ein Satz, ein Knopf. Aufgeklappt: Grund in
// Fakten, Aufgabe in Schritten, Ziel. Aufgaben entstehen aus dem Zustand
// (useUnifiedTaskInbox) und verschwinden, wenn sich der Zustand ändert.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export default function RecruiterHeute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { allItems, completedItems, waitingItems, parkedItems, loading, markDone, snooze, refetch } = useUnifiedTaskInbox('all');
  const { data: agenda } = useRecruiterInterviewAgenda();
  const pipeline = useRecruiterPipeline();
  const [stageFilter, setStageFilter] = useState<PipelineStageKey | null>(null);

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
  const { jetzt, groups, bundles, rows } = useMemo(() => splitJetzt(allItems), [allItems]);
  const waitingOptIn = useMemo(
    () => allItems.filter(i => !i.isStale && i.taskCategory === 'opt_in_pending' && hoursSince(i.createdAt) < 24),
    [allItems],
  );
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
  const STAGE_ORDER: PipelineStageKey[] = ['submitted', 'in_review', 'interview_1', 'interview_2', 'offer', 'placed'];
  /** Weiteste Phase einer Zeile (bei Stellen-Zeilen über alle Kandidaten) */
  const furthestStage = (r: JetztRow): PipelineStageKey | null => rowItems(r).map(stageOfItem)
    .filter((x): x is PipelineStageKey => !!x)
    .sort((a, b) => STAGE_ORDER.indexOf(b) - STAGE_ORDER.indexOf(a))[0] ?? null;
  const totalTasks = rows.reduce((n, r) => n + rowItems(r).length, 0);
  const restTasks = filteredRows.slice(1).reduce((n, r) => n + rowItems(r).length, 0);
  const filteredWaiting = useMemo(() => (stageFilter ? waitingOptIn.filter(i => stageOfItem(i) === stageFilter) : []), [waitingOptIn, stageFilter, pipeline]);
  const doneToday = useMemo(
    () => completedItems.filter(i => i.completedAt && isToday(new Date(i.completedAt))),
    [completedItems],
  );
  const upcoming: RecruiterInterview[] = useMemo(
    () => (agenda?.all ?? []).filter(iv => iv.scheduledAt && iv.endsAt && iv.endsAt > now && iv.status !== 'cancelled').sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [agenda, now],
  );
  const todayInterviews = upcoming.filter(iv => isToday(new Date(iv.scheduledAt!)));
  const weekInterviews = upcoming.filter(iv => new Date(iv.scheduledAt!).getTime() < now + 7 * DAY_MS);
  const moneyInPlay = jetzt.reduce((n, i) => n + (i.feeValue ?? 0), 0);
  const calls = groups.filter(g => buildGuide(g.primary).primary.kind === 'call' || buildGuide(g.primary).primary.kind === 'followup').length;
  const totalToday = rows.length + doneToday.length;

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
  const dealCount = pipeline ? pipeline.stages.reduce((n, st) => n + st.count, 0) : 0;
  const headline = loading
    ? 'Einen Moment …'
    : rows.length === 0
      ? `Nichts braucht dich gerade. ${waitingOptIn.length + upcoming.length + waitingItems.length + parkedItems.length} Deals laufen, ${stale.length} ohne Bewegung.`
      : `${dealCount} Deals${pipeline && pipeline.totalFee > 0 ? `, ${Math.round(pipeline.totalFee / 1000)}.000 € im Spiel` : ''}. ${totalTasks} ${totalTasks === 1 ? 'Aufgabe' : 'Aufgaben'} in ${rows.length} ${rows.length === 1 ? 'Handgriff' : 'Handgriffen'}, als Nächstes: ${rowName(rows[0])}.`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Kopf */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <CheckSquare className="h-6 w-6 text-primary" />
              Aufgaben
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{verdecke(headline)}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Eigene Erinnerung
          </Button>
        </div>

        {/* Pipeline */}
        <div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {(pipeline?.stages ?? (Object.keys(PIPELINE_LABELS) as PipelineStageKey[]).map(key => ({ key, label: PIPELINE_LABELS[key], count: 0, fee: 0, deadline: null }))).map(st => {
              const needs = needsByStage[st.key] ?? 0;
              const active = stageFilter === st.key;
              const deadlineSoon = st.deadline ? new Date(st.deadline).getTime() - Date.now() < 7 * DAY_MS : false;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStageFilter(active ? null : st.key)}
                  className={cn(
                    'relative rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/40',
                    active ? 'border-foreground' : 'border-border/30',
                  )}
                >
                  {(needs > 0 || deadlineSoon) && (
                    <span className={cn('absolute right-2 top-2 rounded-full px-1.5 text-[10px] font-semibold', deadlineSoon && needs === 0 ? 'bg-amber-500 text-black' : 'bg-foreground text-background')}>
                      {needs > 0 ? needs : format(new Date(st.deadline!), 'EEE', { locale: de })}
                    </span>
                  )}
                  <div className="text-[11px] text-muted-foreground">{st.label}</div>
                  <div className="text-xl font-semibold tabular-nums">{st.count}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {st.key === 'placed' && st.deadline ? `Garantie bis ${dateDe(st.deadline)}` : st.fee > 0 ? <Honorar>{`${Math.round(st.fee / 1000)}.000 €`}</Honorar> : '—'}
                  </div>
                </button>
              );
            })}
          </div>
          {pipeline && pipeline.totalFee > 0 && (
            <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {pipeline.stages.map((st, i) => st.fee > 0 && (
                <div key={st.key} className={['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-violet-400', 'bg-emerald-500', 'bg-muted-foreground'][i]} style={{ width: `${(st.fee / pipeline.totalFee) * 100}%` }} />
              ))}
            </div>
          )}
          {pipeline && (
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span>Abgesagt diesen Monat · {pipeline.rejectedThisMonth}</span>
              <span>Zurückgezogen · {pipeline.withdrawnThisMonth}</span>
              <span>Ohne Bewegung seit 3 Wochen · {stale.length}</span>
              <span>Heute erledigt · {doneToday.length}</span>
            </div>
          )}
        </div>

        {since.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><span className="font-medium text-foreground">Seit gestern:</span> {since.map(s => s.title).join(' · ')}</span>
          </div>
        )}

        {/* Jetzt (Variante A, 28.10.2026): oben genau eine Sache, darunter nach Handgriff */}
        {loading ? (
          <Card className="border-border/30 shadow-sm"><CardContent className="px-4 py-6 text-sm text-muted-foreground">Lädt …</CardContent></Card>
        ) : filteredRows.length + filteredWaiting.length === 0 ? (
          <Card className="border-border/30 shadow-sm" data-tour="tasks.list">
            <CardContent className="px-4 py-6 text-sm text-muted-foreground">
              {stageFilter ? 'In dieser Stufe braucht dich gerade nichts.' : 'Nichts braucht dich gerade. Sonst nichts.'}
              {stageFilter && <button type="button" className="ml-2 text-xs text-muted-foreground underline hover:text-foreground" onClick={() => setStageFilter(null)}>Alle anzeigen</button>}
            </CardContent>
          </Card>
        ) : (
          <>
            {stageFilter && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{PIPELINE_LABELS[stageFilter]} · {filteredRows.length + filteredWaiting.length} {filteredRows.length + filteredWaiting.length === 1 ? 'Deal' : 'Deals'}</span>
                <button type="button" className="hover:text-foreground" onClick={() => setStageFilter(null)}>Filter von der Pipeline · Alle anzeigen</button>
              </div>
            )}
            {filteredRows[0] && (
              <NextCard row={filteredRows[0]} stage={furthestStage(filteredRows[0])}
                onOpen={() => openRow(filteredRows[0])} onOpenItem={(id) => task.openItem(id)} />
            )}
            {(filteredRows.length > 1 || filteredWaiting.length > 0) && (
              <Card className="border-border/30 shadow-sm" data-tour="tasks.list">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 px-4 py-3">
                  <CardTitle className="text-sm">Danach heute</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {restTasks} {restTasks === 1 ? 'Aufgabe' : 'Aufgaben'} · {filteredRows.length - 1} {filteredRows.length - 1 === 1 ? 'Handgriff' : 'Handgriffe'}
                  </span>
                </CardHeader>
                <CardContent className="p-0">
                  {BLOCKS.map(b => {
                    const list = filteredRows.slice(1).filter(r => handgriffOf(r) === b.key);
                    if (!list.length) return null;
                    const oneClient = b.key === 'kunde' && list.length === 1 && list[0].kind === 'bundle' && list[0].bundle.companyName;
                    return (
                      <div key={b.key}>
                        <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
                          <span>{oneClient && list[0].kind === 'bundle' ? `Eine Mail an ${list[0].bundle.companyName}` : `${b.label} · ${list.length}`}</span>
                          <span className="font-normal">{b.hint}</span>
                        </div>
                        <div className="divide-y divide-border/40">
                          {list.map(r => r.kind === 'person' ? (
                            <PersonRow key={r.key} row={r} group={r.group} stage={stageOfItem(r.group.primary)} onOpen={() => openRow(r)} onAct={task.act} />
                          ) : (
                            <BundleRow key={r.key} row={r} bundle={r.bundle} more={r.more} stage={furthestStage(r)} sameClientCount={r.more.length ? 0 : sameClient(r.bundle).length} onOpen={() => openRow(r)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {filteredWaiting.map(i => (
                    <div key={i.itemId} className="flex items-center gap-3 border-t border-border/40 px-4 py-3 text-sm text-muted-foreground">
                      <div className="min-w-0 flex-1"><Badge variant="secondary" className="mr-2 h-4 px-1.5 text-[10px]">Wartet</Badge><span className="text-foreground">{i.candidateName}</span> · Einladung seit {hoursSince(i.createdAt)} Std. Ab 24 Std. oben.</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Termine + Wartet */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/30 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 px-4 py-3">
              <CardTitle className="text-sm">Termine</CardTitle>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/recruiter/interviews')}>Interviews →</button>
            </CardHeader>
            <CardContent className="p-0">
              {weekInterviews.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Keine Termine in den nächsten sieben Tagen.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {weekInterviews.slice(0, 5).map(iv => (
                    <div key={iv.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-muted-foreground tabular-nums">{relativeTime(iv.scheduledAt!)}</span>
                      <span className="min-w-0 flex-1 truncate">{iv.candidateName} · {iv.jobTitle}</span>
                      {iv.joinUrl ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <a href={iv.joinUrl} target="_blank" rel="noopener noreferrer">Beitreten</a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate(`/recruiter/interviews?interview=${iv.id}`)}>Öffnen</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/30 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 px-4 py-3">
              <CardTitle className="text-sm">Wartet auf andere</CardTitle>
              <span className="text-xs text-muted-foreground">nichts zu tun</span>
            </CardHeader>
            <CardContent className="p-0">
              {waitingOptIn.length + upcoming.length + waitingBundles.length + parkedItems.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Nichts liegt bei Kunden oder Kandidaten.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {waitingBundles.map(b => {
                    const matchunt = b.items.every(i => i.waitState === 'matchunt');
                    const last = b.items.map(i => i.lastNudgeAt ?? '').sort().pop() || null;
                    const next = b.items.map(i => i.nextNudgeAt ?? '').filter(Boolean).sort()[0] || null;
                    const zweite = b.items.some(i => (i.nudgeCount ?? 0) >= 2);
                    return (
                      <div key={`w-${b.key}`} className="px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">{matchunt ? 'Matchunt' : b.kind === 'feedback' ? 'Feedback' : 'Kunde'}</Badge>
                          <span className="min-w-0 flex-1 truncate">{b.items.map(i => i.candidateName).join(', ')} · {b.jobTitle}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 pl-[3.25rem] text-xs text-muted-foreground">
                          <span>
                            {matchunt
                              ? `2 Erinnerungen ohne Antwort. Matchunt kümmert sich seit ${dateDe(next)}.`
                              : `${b.kind === 'feedback' ? 'Kunde gefragt' : 'Kunde erinnert'} am ${dateDe(last)} · ${zweite ? 'Matchunt übernimmt' : b.kind === 'feedback' ? '2. Nachfrage' : '2. Erinnerung'} ab ${dateDe(next)}`}
                          </span>
                          {!matchunt && last && (
                            <button type="button" className="text-primary hover:underline" onClick={() => setOpenState({ bundle: b, sameClient: [], startSent: { at: last } })}>
                              Kandidaten Bescheid geben
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
                        <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">{i.parkKind === 'contract' ? 'Vertrag' : i.parkKind === 'counter' ? 'Gegenwunsch' : 'Pausiert'}</Badge>
                        <span className="min-w-0 flex-1 truncate">{i.candidateName}{i.jobTitle ? ` · ${i.jobTitle}` : ''}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 pl-[3.25rem] text-xs text-muted-foreground">
                        <span>{i.parkNote}</span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            if (i.parkKind === 'contract' && i.submissionId) task.openContract(i.submissionId);
                            else if (i.candidateId) navigate(`/recruiter/candidates/${i.candidateId}`);
                          }}
                        >
                          Öffnen
                        </button>
                      </div>
                    </div>
                  ))}
                  {waitingOptIn.map(i => (
                    <div key={i.itemId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">Opt-In</Badge>
                      <span className="min-w-0 flex-1 truncate">{i.candidateName || i.title} · Einladung seit {hoursSince(i.createdAt)} Std.</span>
                      <span className="shrink-0 text-xs text-muted-foreground">ab 24 Std. oben</span>
                    </div>
                  ))}
                  {upcoming.slice(0, 5).map(iv => (
                    <div key={iv.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">Termin</Badge>
                      <span className="min-w-0 flex-1 truncate">{iv.candidateName} · {iv.jobTitle}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(iv.scheduledAt!)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ohne Bewegung */}
        {stale.length > 0 && (
          <FoldCard label="Ohne Bewegung seit über 3 Wochen" count={stale.length} open={staleOpen} onToggle={() => setStaleOpen(o => !o)}>
            {stale.map(i => (
              <div key={i.itemId} className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground">
                <span className="min-w-0 flex-1 truncate"><span className="text-foreground">{i.candidateName || i.title}</span> · {i.jobTitle} · {daysSince(i.createdAt)} Tage</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => task.openDetail(i)}>Öffnen</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => task.later(i, new Date(Date.now() + 14 * DAY_MS))}>14 Tage ruhen</Button>
              </div>
            ))}
            <p className="px-4 py-2 text-xs text-muted-foreground">„Zurückziehen“ mit Grund kommt in der nächsten Stufe.</p>
          </FoldCard>
        )}

        {/* Erledigt */}
        {completedItems.length > 0 && (
          <FoldCard label="Erledigt · letzte 7 Tage" count={completedItems.length} open={doneOpen} onToggle={() => setDoneOpen(o => !o)}>
            {completedItems.map(i => (
              <div key={`${i.itemType}-${i.itemId}`} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="w-24 shrink-0 tabular-nums">{i.completedAt ? format(new Date(i.completedAt), 'dd.MM. HH:mm', { locale: de }) : ''}</span>
                <span className="truncate"><span className="text-foreground">{i.title}</span>{i.candidateName ? ` · ${i.candidateName}` : ''}{i.jobTitle ? ` · ${i.jobTitle}` : ''}</span>
              </div>
            ))}
          </FoldCard>
        )}

        <p className="text-xs text-muted-foreground">Sonst nichts.</p>
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
  if (isToday(d) && diffH >= 0 && diffH <= 6) return diffH === 0 ? 'jetzt' : `in ${diffH} Std.`;
  if (isToday(d)) return format(d, 'HH:mm', { locale: de });
  if (isTomorrow(d)) return `morgen ${format(d, 'HH:mm', { locale: de })}`;
  return format(d, 'EEE dd.MM. HH:mm', { locale: de });
}

function FoldCard({ label, count, open, onToggle, children }: { label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Card className="border-border/30 shadow-sm">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-accent/40" onClick={onToggle}>
        <span className="text-muted-foreground">{label} · {count}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="divide-y divide-border/40 border-t border-border/40">{children}</div>}
    </Card>
  );
}

/** Eine Zeile „Kunde prüft“ für eine Stelle: alle wartenden Kandidaten, ein Knopf. */
/** Diese Knöpfe würden sofort wählen bzw. abhaken – in der Liste öffnen sie stattdessen das Fenster. */
const DIRECT_KINDS = new Set(['call', 'followup', 'done']);

const BLOCKS: { key: Handgriff; label: string; hint: string }[] = [
  { key: 'anruf', label: 'Anrufe', hint: 'Kandidat oder Kunde anrufen' },
  { key: 'kunde', label: 'Mails an Kunden', hint: 'eine Bitte für alle Kandidaten' },
  { key: 'kurz', label: 'Kurz erledigen', hint: '' },
];

const rowName = (r: JetztRow) => (r.kind === 'person'
  ? (r.group.primary.candidateName ? firstName(r.group.primary.candidateName) : r.group.primary.title)
  : (r.more.length && r.bundle.companyName ? r.bundle.companyName : r.bundle.jobTitle ?? 'Stelle'));

/** Linke Spalte (Vorschlag 6, 28.10.2026): Phase der Einreichung als vier Striche, darunter das Wort. */
const PHASES = ['Eingereicht', 'Interview', 'Angebot', 'Vertrag'];
const phaseIndex = (stage: PipelineStageKey | null) =>
  stage === 'placed' ? 3 : stage === 'offer' ? 2 : stage === 'interview_1' || stage === 'interview_2' ? 1 : stage ? 0 : null;
/** Mindest-Phase aus der Aufgabe selbst (die Pipeline-Stufe hinkt manchmal hinterher) */
const impliedPhase = (cat: string) =>
  cat.startsWith('contract_') ? 3 : cat.startsWith('offer_') ? 2
    : ['interview_debrief_due', 'client_feedback_due', 'recommendation_due', 'opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h'].includes(cat) ? 1 : 0;
/** „In Prüfung“ (29.10.2026): hat das Kundenteam die Profile geöffnet? */
function ViewState({ bundle }: { bundle: StalledBundle }) {
  const items = bundle.items;
  if (items.length === 1) {
    const it = items[0];
    return <span className={it.clientViewCount ? 'text-emerald-600' : 'text-amber-600'}>{viewText(it.clientViewCount, it.clientLastViewedAt)}</span>;
  }
  const seen = items.filter(i => (i.clientViewCount ?? 0) > 0).length;
  return <span className={seen ? 'text-emerald-600' : 'text-amber-600'}>{seen === 0 ? 'noch keins geöffnet' : `${seen} von ${items.length} angesehen`}</span>;
}

function PhaseCell({ stage, items }: { stage: PipelineStageKey | null; items: UnifiedTaskItem[] }) {
  const fromStage = phaseIndex(stage);
  const idx = Math.max(fromStage ?? -1, ...items.map(i => impliedPhase(i.taskCategory)));
  const label = idx < 0 ? '–' : stage === 'placed' && idx === 3 ? 'Platziert' : stage === 'in_review' && idx === 0 ? 'In Prüfung' : PHASES[idx];
  return (
    <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1" title={idx < 0 ? undefined : `Phase: ${label}`}>
      <div className="flex gap-0.5" aria-hidden="true">
        {PHASES.map((_, i) => (
          <span key={i} className={cn('h-3.5 w-1.5 rounded-sm', i <= idx ? 'bg-emerald-500' : 'bg-muted-foreground/25')} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

/** Ganz oben: genau eine Sache, mit Grund und allen Aufgaben dieser Person bzw. dieses Kunden. */
function NextCard({ row, stage, onOpen, onOpenItem }: {
  row: JetztRow;
  stage: PipelineStageKey | null;
  onOpen: () => void;
  onOpenItem: (itemId: string) => boolean;
}) {
  const item = rowItem(row);
  const guide = buildGuide(item);
  const fee = euro(row.fee);
  const all = row.kind === 'person' ? [row.group.primary, ...row.group.others] : [];
  const title = row.kind === 'person' ? row.group.name : rowName(row);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.04] px-4 py-3">
      <PhaseCell stage={stage} items={rowItems(row)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Als Nächstes</p>
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-base font-semibold">{title}</span>
          {item.jobTitle && row.kind === 'person' && <span className="text-sm text-muted-foreground">· {item.jobTitle}</span>}
          {item.companyName && <span className="text-sm text-muted-foreground">· {item.companyName}</span>}
          {fee && <span className="text-sm font-medium text-emerald-500 tabular-nums"><Honorar>{fee}</Honorar></span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {row.kind === 'bundle' ? bundleLine(row.bundle, row.more) : [guide.advice, ...all.slice(1).map(o => buildGuide(o).advice)].join(' ')}
        </p>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Button size="sm" className="h-8 text-xs" onClick={onOpen}>Aufgabe öffnen</Button>
        {all.length > 1 && (
          <div className="flex flex-wrap justify-end gap-1 text-[11px] text-muted-foreground">
            <span>{all.length} Aufgaben:</span>
            {all.map((o, k) => (
              <span key={o.itemId} className="inline-flex gap-1">
                {k > 0 && <span aria-hidden="true">·</span>}
                <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => { if (!onOpenItem(o.itemId)) onOpen(); }}>
                  {buildGuide(o).pill}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Stellen-Zeile in Sätzen: wer wartet wie lange beim Kunden. */
function bundleLine(bundle: StalledBundle, more: StalledBundle[]): string {
  const feedback = bundle.kind === 'feedback';
  const parts = [bundle, ...more].flatMap(b => b.items.map(i => `${i.candidateName}${more.length ? ` (${b.jobTitle})` : ''}`));
  return `${parts.join(', ')} ${feedback ? 'warten auf den Eindruck des Kunden' : 'liegen beim Kunden'}, am längsten seit ${Math.max(bundle.days, ...more.map(b => b.days))} Tagen.`;
}

function BundleRow({ row, bundle, more, stage, sameClientCount, onOpen }: {
  row: JetztRow;
  bundle: StalledBundle;
  more: StalledBundle[];
  stage: PipelineStageKey | null;
  sameClientCount: number;
  onOpen: () => void;
}) {
  const fee = euro(bundle.feeTotal);
  const n = bundle.items.length;
  const names = bundle.items.map(i => (n > 1 ? firstName(i.candidateName) : i.candidateName)).join(', ');
  const feedback = bundle.kind === 'feedback';
  const lastNudge = bundle.items.map(i => i.lastNudgeAt ?? '').sort().pop() || null;
  // „1. Erinnerung“ las sich wie „schon erinnert“ (Durchklick 27.10.2026)
  const stand = bundle.erinnerung === 2
    ? `${lastNudge ? `${feedback ? 'gefragt' : 'erinnert'} am ${dateDe(lastNudge)} · ` : ''}${feedback ? '2. Nachfrage' : '2. Erinnerung'}`
    : feedback ? 'noch nicht gefragt' : 'noch nicht erinnert';
  const interviewAt = bundle.items[0]?.interviewAt ?? null;
  // Mehrere Stellen desselben Kunden: eine Zeile, eine Mail (28.10.2026)
  if (more.length > 0) {
    const all = [bundle, ...more];
    const total = euro(all.reduce((x, b) => x + b.feeTotal, 0));
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <PhaseCell stage={stage} items={rowItems(row)} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{feedback ? 'Feedback' : 'Prüfung'}</Badge>
            <span className="font-medium">{bundle.companyName}</span>
            <span className="text-muted-foreground">· {all.length} Stellen</span>
            {total && <span className="font-medium text-emerald-500 tabular-nums"><Honorar>{total}</Honorar></span>}
          </div>
          {all.map(b => (
            <div key={b.key} className="text-sm text-muted-foreground">
              {b.items.map(i => i.candidateName).join(', ')} · {b.jobTitle} · {feedback ? `ohne Eindruck seit ${b.days} Tagen` : `beim Kunden seit ${b.days} Tagen`}
              {!feedback && <> · <ViewState bundle={b} /></>}
            </div>
          ))}
          <div className="text-sm text-muted-foreground">{stand}</div>
        </button>
        <Button size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={onOpen}>
          <Mail className="h-3 w-3" />{feedback ? 'Kunden fragen' : 'Kunden erinnern'}
        </Button>
        <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onOpen} aria-label="Aufgabe öffnen">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <PhaseCell stage={stage} items={rowItems(row)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{feedback ? 'Feedback' : 'Prüfung'}</Badge>
          <span className="font-medium">{bundle.jobTitle}</span>
          {bundle.companyName && <span className="text-muted-foreground">· {bundle.companyName}</span>}
          {!bundle.items[0]?.companyRevealed && <Lock className="h-3 w-3 text-muted-foreground" />}
          {fee && <span className="font-medium text-emerald-500 tabular-nums"><Honorar>{fee}</Honorar></span>}
        </div>
        <div className="text-sm text-muted-foreground">
          {n === 1 ? names : `${n} Kandidaten (${names})`}
          {feedback
            ? <> · {n === 1 && interviewAt ? `Interview ${dateDe(interviewAt)} · ` : ''}Kunde ohne Eindruck seit {bundle.days} Tagen · {stand}</>
            : <> · beim Kunden seit {bundle.days} Tagen · <ViewState bundle={bundle} /> · {stand}</>}
          {sameClientCount > 0 && <span> · geht mit {sameClientCount} weiteren Stelle{sameClientCount === 1 ? '' : 'n'} in eine Mail</span>}
        </div>
      </button>
      <Button size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={onOpen}>
        <Mail className="h-3 w-3" />{feedback ? 'Kunden fragen' : 'Kunden erinnern'}
      </Button>
      <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onOpen} aria-label="Aufgabe öffnen">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function PersonRow({ row, group, stage, onOpen, onAct }: {
  row: JetztRow;
  group: PersonGroup;
  stage: PipelineStageKey | null;
  onOpen: () => void;
  onAct: (item: UnifiedTaskItem, guide: Guide) => void;
}) {
  const navigate = useNavigate();
  const item = group.primary;
  const guide = buildGuide(item);
  const fee = euro(item.feeValue);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <PhaseCell stage={stage} items={rowItems(row)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{guide.pill}</Badge>
          <span
            className="font-medium hover:underline"
            onClick={e => { if (item.candidateId) { e.stopPropagation(); navigate(`/recruiter/candidates/${item.candidateId}`); } }}
          >
            {group.name}
          </span>
          {item.jobTitle && <span className="text-muted-foreground">· {item.jobTitle}</span>}
          {item.companyName && <span className="text-muted-foreground">· {item.companyName}</span>}
          {!item.companyName && item.jobTitle && <Lock className="h-3 w-3 text-muted-foreground" />}
          {fee && <span className="font-medium text-emerald-500 tabular-nums"><Honorar>{fee}</Honorar></span>}
          {group.others.length > 0 && <span className="text-xs text-muted-foreground">+{group.others.length} {group.others.length === 1 ? 'Aufgabe' : 'Aufgaben'}</span>}
        </div>
        <div className="text-sm text-muted-foreground">{guide.advice}</div>
      </button>
      {/* Erst die Aufgabe öffnen, angerufen oder gesendet wird im Fenster (28.10.2026) */}
      {DIRECT_KINDS.has(guide.primary.kind) ? (
        <Button size="sm" className="h-7 shrink-0 text-xs" onClick={onOpen}>Aufgabe öffnen</Button>
      ) : (
        <Button size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={() => onAct(item, guide)}>
          {guide.primary.kind === 'debrief' && <NotebookPen className="h-3 w-3" />}
          {(guide.primary.kind === 'client' || guide.primary.kind === 'candidate') && <Mail className="h-3 w-3" />}
          {guide.primary.label}
        </Button>
      )}
      <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onOpen} aria-label="Aufgabe öffnen">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
