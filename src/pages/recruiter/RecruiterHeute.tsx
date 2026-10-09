import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreateTaskDialog } from '@/components/influence/CreateTaskDialog';
import { TaskDetailDialog, type TaskDetailItem } from '@/components/influence/TaskDetailDialog';
import { useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useRecruiterInterviewAgenda, type RecruiterInterview } from '@/hooks/useRecruiterInterviewAgenda';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useRecruiterPipeline, PIPELINE_LABELS, type PipelineStageKey } from '@/hooks/useRecruiterPipeline';
import { messageSetFor, composeClientText, composeCandidateText } from '@/lib/aufgabenTexte';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isToday, isTomorrow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bell, Check, CheckSquare, ChevronDown, ChevronRight, Lock, Mail, NotebookPen, Phone, Plus, Video } from 'lucide-react';

// ---------------------------------------------------------------------------
// „Heute“: eine Seite, eine Spalte. Jede Zeile ist ein Deal, der einen Handgriff
// braucht. Kompakt: Pille, Name, ein Satz, ein Knopf. Aufgeklappt: Grund in
// Fakten, Aufgabe in Schritten, Ziel. Aufgaben entstehen aus dem Zustand
// (useUnifiedTaskInbox) und verschwinden, wenn sich der Zustand ändert.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

type Kind = 'call' | 'followup' | 'debrief' | 'done' | 'akte' | 'client' | 'candidate';

interface Guide {
  pill: string;
  advice: string;
  facts: string[];
  consequence: string | null;
  steps: { text: string; hint?: string }[];
  goal: string;
  primary: { label: string; kind: Kind };
  reachedOptions: string[];
}

const euro = (n: number | null) => (n && n > 0 ? `${Math.round(n / 1000)}.000 €` : null);
const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)) : 0);
const hoursSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)) : 0);
const firstName = (name: string | null) => (name ? name.trim().split(/\s+/)[0] : 'der Kandidat');
const dateDe = (iso: string | null) => (iso ? format(new Date(iso), 'dd.MM.', { locale: de }) : '');

function buildGuide(item: UnifiedTaskItem): Guide {
  const name = item.candidateName || 'Kandidat';
  const first = firstName(item.candidateName);
  const job = item.jobTitle || 'die Stelle';
  const fee = euro(item.feeValue);
  const cat = item.taskCategory;

  if (cat === 'client_review_stalled') {
    const d = daysSince(item.createdAt);
    return {
      pill: 'Prüfung',
      advice: `Kunde prüft seit ${d} Tagen ohne Antwort. Nachfassen.`,
      facts: [
        `Eingereicht am ${dateDe(item.createdAt)}, seit ${d} Tagen in Prüfung.`,
        fee ? `Honorar bei Abschluss: ${fee}.` : 'Honorar: noch nicht bekannt.',
        'Der Kunde hat sich seitdem nicht gemeldet.',
      ],
      consequence: d >= 14 ? 'Nach zwei Wochen ohne Antwort ist der Deal meist verloren, wenn niemand nachfasst.' : 'Ohne Nachfassen kühlt der Deal ab, und der Kandidat verliert das Interesse.',
      steps: [
        { text: 'Beim Kunden nachfassen.', hint: 'Entscheidung oder Rückfrage erbitten, Frist nennen.' },
        { text: `${first} auf dem Laufenden halten.`, hint: 'Kurz sagen, dass du nachgefasst hast, und fragen, ob er noch verfügbar ist.' },
      ],
      goal: 'Antwort des Kunden',
      primary: { label: 'Kunden erinnern', kind: 'client' },
      reachedOptions: ['Entscheidung zugesagt', 'Kunde braucht mehr Infos', 'Kunde sagt ab', `${first} informiert`],
    };
  }
  if (cat === 'interview_debrief_due') {
    const h = hoursSince(item.createdAt);
    return {
      pill: 'Debrief',
      advice: `Interview war ${h < 48 ? `vor ${h} Std.` : `am ${dateDe(item.createdAt)}`}. Dein Debrief fehlt.`,
      facts: [
        `Das Interview mit ${name} für ${job} ist vorbei.`,
        'Der Kunde entscheidet nach deinem Eindruck; sein Feedback steht noch aus.',
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Ohne Debrief liegt der Deal still, und die Details verblassen.',
      steps: [
        { text: `${first} kurz anrufen.`, hint: 'Wie lief es, Zweifel, Gehalt, Stimmung?' },
        { text: 'Drei Sätze eintragen, Empfehlung wählen.', hint: 'Weiter · Unsicher · Nicht passend' },
      ],
      goal: 'Debrief gespeichert',
      primary: { label: 'Debrief', kind: 'debrief' },
      reachedOptions: [],
    };
  }
  if (cat === 'opt_in_pending' || cat === 'opt_in_pending_24h' || cat === 'opt_in_pending_48h') {
    const h = hoursSince(item.createdAt);
    const since = h < 48 ? `${h} Std.` : `${Math.floor(h / 24)} Tagen`;
    return {
      pill: 'Opt-In',
      advice: `Einladung seit ${since} offen, Kunde wartet. Heute erreichen.`,
      facts: [
        `Der Kunde hat ein Interview für ${job} angefragt.`,
        `${name} hat die Einladung seit ${since} nicht beantwortet.`,
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Laufen die Terminvorschläge ab, fragt der Kunde den nächsten Kandidaten.',
      steps: [
        { text: `${first} anrufen.`, hint: 'Welche Zeit passt? Er klickt nur den Link in der Einladung.' },
        { text: 'Wenn keine Zeit passt: Zeiten beim Kunden anfragen.' },
        { text: 'Wenn er nicht will: Grund erfassen, Anfrage zurückziehen.' },
      ],
      goal: 'Termin gewählt',
      primary: { label: 'Anrufen', kind: 'call' },
      reachedOptions: ['Hat gewählt', 'Wählt heute', 'Lehnt ab'],
    };
  }
  if (cat === 'rejected_inform') {
    return {
      pill: 'Absage',
      advice: `Kunde hat abgesagt. ${first} weiß es noch nicht.`,
      facts: [
        `Der Kunde hat ${name} für ${job} abgesagt (${dateDe(item.createdAt)}).`,
        item.description?.includes('Grund:') ? item.description.slice(item.description.indexOf('Grund:')).replace(/\)\.?$/, '').trim() + '.' : 'Kein Grund hinterlegt.',
        'Der Kandidat hat noch keine Nachricht von dir.',
      ],
      consequence: 'Wer von der Absage zuerst vom Kunden erfährt, verliert das Vertrauen in dich.',
      steps: [
        { text: `${first} informieren.`, hint: 'Wertschätzend, Grund in neutraler Sprache, kein Firmenname.' },
        { text: 'Andere Stellen anbieten oder im Blick behalten.' },
      ],
      goal: `${first} informiert`,
      primary: { label: `${first} informieren`, kind: 'candidate' },
      reachedOptions: ['Informiert', 'Will andere Stellen', 'Kein Interesse mehr'],
    };
  }
  if (item.itemType === 'task') {
    return {
      pill: 'Eigene',
      advice: item.description || item.title,
      facts: [item.dueAt ? `Fällig am ${dateDe(item.dueAt)}.` : 'Ohne Datum.'],
      consequence: null,
      steps: [{ text: item.title }],
      goal: 'Erledigt',
      primary: { label: 'Erledigt', kind: 'done' },
      reachedOptions: [],
    };
  }
  // Historische Engine-Alerts
  return {
    pill: 'Hinweis',
    advice: item.description || item.title,
    facts: [item.recommendedAction || item.title],
    consequence: null,
    steps: [{ text: item.recommendedAction || 'Prüfen und entscheiden.' }],
    goal: 'Geklärt',
    primary: { label: item.candidatePhone ? 'Anrufen' : 'Öffnen', kind: item.candidatePhone ? 'call' : 'akte' },
    reachedOptions: ['Geklärt'],
  };
}

interface PersonGroup {
  key: string;
  name: string;
  initials: string;
  primary: UnifiedTaskItem;
  others: UnifiedTaskItem[];
}

function groupByPerson(items: UnifiedTaskItem[]): PersonGroup[] {
  const map = new Map<string, UnifiedTaskItem[]>();
  for (const it of items) {
    const key = it.candidateId || it.itemId;
    map.set(key, [...(map.get(key) ?? []), it]);
  }
  const groups: PersonGroup[] = [];
  for (const [key, list] of map) {
    const sorted = [...list].sort((a, b) => a.sortPriority - b.sortPriority || (b.feeValue ?? 0) - (a.feeValue ?? 0));
    const name = sorted[0].candidateName || sorted[0].title;
    const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    groups.push({ key, name, initials, primary: sorted[0], others: sorted.slice(1) });
  }
  return groups.sort((a, b) => a.primary.sortPriority - b.primary.sortPriority || (b.primary.feeValue ?? 0) - (a.primary.feeValue ?? 0));
}

// ---------------------------------------------------------------------------

export default function RecruiterHeute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { allItems, completedItems, loading, markDone, snooze, refetch } = useUnifiedTaskInbox('all');
  const { data: agenda } = useRecruiterInterviewAgenda();
  const pipeline = useRecruiterPipeline();
  const [stageFilter, setStageFilter] = useState<PipelineStageKey | null>(null);
  const { logActivity } = useActivityLogger();

  const [windowKey, setWindowKey] = useState<string | null>(null);
  const [windowTab, setWindowTab] = useState<'client' | 'candidate'>('client');
  const [staleOpen, setStaleOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [reached, setReached] = useState<{ item: UnifiedTaskItem; guide: Guide } | null>(null);
  const [detail, setDetail] = useState<TaskDetailItem | null>(null);
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
  const jetzt = useMemo(
    () => allItems.filter(i => !i.isStale && !(i.taskCategory === 'opt_in_pending' && hoursSince(i.createdAt) < 24)),
    [allItems],
  );
  const waitingOptIn = useMemo(
    () => allItems.filter(i => !i.isStale && i.taskCategory === 'opt_in_pending' && hoursSince(i.createdAt) < 24),
    [allItems],
  );
  const stale = useMemo(() => allItems.filter(i => i.isStale), [allItems]);
  const groups = useMemo(() => groupByPerson(jetzt), [jetzt]);
  const stageOfItem = (i: UnifiedTaskItem): PipelineStageKey | null => (i.submissionId && pipeline ? pipeline.stageOf[i.submissionId] ?? null : null);
  const needsByStage = useMemo(() => {
    const m: Partial<Record<PipelineStageKey, number>> = {};
    for (const g of groups) { const k = stageOfItem(g.primary); if (k) m[k] = (m[k] ?? 0) + 1; }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, pipeline]);
  const filteredGroups = useMemo(() => (stageFilter ? groups.filter(g => stageOfItem(g.primary) === stageFilter) : groups), [groups, stageFilter, pipeline]);
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
  const totalToday = groups.length + doneToday.length;

  // Deeplink vom Dashboard: ?item=<id> klappt die Zeile auf
  const deepLink = searchParams.get('item');
  useEffect(() => {
    if (!deepLink || loading) return;
    const g = groups.find(x => x.primary.itemId === deepLink || x.others.some(o => o.itemId === deepLink));
    if (g) setWindowKey(g.key);
    const next = new URLSearchParams(searchParams);
    next.delete('item');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, loading, groups.length]);

  // ─── Handgriffe ────────────────────────────────────────────────────────

  const act = (item: UnifiedTaskItem, guide: Guide) => {
    switch (guide.primary.kind) {
      case 'client':
      case 'candidate': {
        const g = groups.find(x => x.primary.itemId === item.itemId || x.others.some(o => o.itemId === item.itemId));
        if (g) { setWindowTab(guide.primary.kind); setWindowKey(g.key); }
        return;
      }
      case 'debrief':
        navigate(`/recruiter/interviews?interview=${item.itemId.replace('derived-debrief-', '')}`);
        return;
      case 'call':
        if (item.candidatePhone) window.location.href = `tel:${item.candidatePhone}`;
        setReached({ item, guide });
        return;
      case 'followup':
        setReached({ item, guide });
        return;
      case 'done':
        markDone(item.itemType, item.itemId).then(({ error }) => {
          if (error) toast.error('Konnte nicht als erledigt markiert werden.');
          else toast.success('Erledigt');
        });
        return;
      case 'akte':
        if (item.candidateId) navigate(`/recruiter/candidates/${item.candidateId}`);
        return;
    }
  };

  const sendMessage = async (item: UnifiedTaskItem, action: 'client_nudge' | 'candidate_message', text: string, meta: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      body: { action, submissionId: item.submissionId, text, ...meta },
    });
    const failure = error?.message || (data && (data as any).error) || (data && (data as any).message && !(data as any).ok ? (data as any).message : null);
    if (failure) {
      const msg = typeof failure === 'string' ? failure : 'Senden fehlgeschlagen.';
      toast.error(/Failed to send a request/i.test(msg) ? 'Senden nicht möglich: Die Function „recruiter-notify“ ist noch nicht deployt.' : msg);
      return false;
    }
    if (action === 'client_nudge') {
      toast.success(`Kunde erinnert (${(data as any)?.recipients ?? 1} Empfänger). Die Zeile ruht bis zur Antwort.`);
      await snooze(item.itemType, item.itemId, new Date(Date.now() + 3 * DAY_MS));
    } else {
      toast.success('Nachricht gesendet.');
      if (item.taskCategory === 'rejected_inform') await markDone(item.itemType, item.itemId);
      else await snooze(item.itemType, item.itemId, new Date(Date.now() + DAY_MS));
    }
    refetch();
    return true;
  };

  const later = async (item: UnifiedTaskItem, until: Date) => {
    const { error } = await snooze(item.itemType, item.itemId, until);
    if (error) toast.error('Konnte nicht vertagt werden.');
    else toast.success(`Vertagt bis ${format(until, 'EEEE HH:mm', { locale: de })}`);
  };

  const confirmReached = async (yes: boolean, outcome: string | null, note: string) => {
    if (!reached) return;
    const { item, guide } = reached;
    setReached(null);
    if (item.candidateId) {
      await logActivity(
        item.candidateId,
        'call',
        yes ? `Erreicht: ${outcome ?? guide.goal}` : 'Nicht erreicht',
        note || undefined,
        { reached: yes, outcome, task_category: item.taskCategory },
        item.submissionId || undefined,
      );
    }
    if (yes) {
      const { error } = await markDone(item.itemType, item.itemId);
      if (error) toast.error('Beleg gespeichert, Zeile konnte nicht geschlossen werden.');
      else toast.success(outcome ? `${outcome}. Zeile geschlossen.` : 'Zeile geschlossen.');
    } else {
      await snooze(item.itemType, item.itemId, new Date(Date.now() + 2 * 3_600_000));
      toast.success('Wiedervorlage in 2 Stunden.');
    }
  };

  const openDetail = (item: UnifiedTaskItem) => {
    setDetail({
      itemType: item.itemType, itemId: item.itemId, title: item.title, description: item.description,
      recommendedAction: item.recommendedAction, taskCategory: item.taskCategory, priority: item.priority,
      submissionId: item.submissionId, candidateId: item.candidateId, jobId: item.jobId, playbookId: item.playbookId,
      createdAt: item.createdAt, dueAt: item.dueAt, impactScore: item.impactScore, candidateName: item.candidateName,
      candidatePhone: item.candidatePhone, candidateEmail: item.candidateEmail, jobTitle: item.jobTitle, companyName: item.companyName,
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const dealCount = pipeline ? pipeline.stages.reduce((n, st) => n + st.count, 0) : 0;
  const headline = loading
    ? 'Einen Moment …'
    : groups.length === 0
      ? `Nichts braucht dich gerade. ${waitingOptIn.length + upcoming.length} Deals laufen, ${stale.length} ohne Bewegung.`
      : `${dealCount} Deals${pipeline && pipeline.totalFee > 0 ? `, ${Math.round(pipeline.totalFee / 1000)}.000 € im Spiel` : ''}. ${groups.length} ${groups.length === 1 ? 'braucht' : 'brauchen'} dich heute, erstes Ziel: ${groups[0].primary.candidateName ? firstName(groups[0].primary.candidateName) : groups[0].primary.title}.`;

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
            <p className="mt-0.5 text-sm text-muted-foreground">{headline}</p>
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
                    {st.key === 'placed' && st.deadline ? `Garantie bis ${dateDe(st.deadline)}` : st.fee > 0 ? `${Math.round(st.fee / 1000)}.000 €` : '—'}
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

        {/* Jetzt */}
        <Card className="border-border/30 shadow-sm" data-tour="tasks.list">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/40 px-4 py-3">
            <CardTitle className="text-sm">{stageFilter ? `${PIPELINE_LABELS[stageFilter]} · ${filteredGroups.length + filteredWaiting.length} ${filteredGroups.length + filteredWaiting.length === 1 ? 'Deal' : 'Deals'}` : `Jetzt · ${groups.length}`}</CardTitle>
            {stageFilter ? (
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setStageFilter(null)}>Filter von der Pipeline · Alle anzeigen</button>
            ) : (
              <span className="text-xs text-muted-foreground">nach Dringlichkeit</span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Lädt …</p>
            ) : filteredGroups.length + filteredWaiting.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{stageFilter ? 'In dieser Stufe braucht dich gerade nichts.' : 'Nichts braucht dich gerade. Sonst nichts.'}</p>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredGroups.map(g => (
                  <PersonRow key={g.key} group={g} stage={stageOfItem(g.primary)} onOpen={() => setWindowKey(g.key)} onAct={act} />
                ))}
                {filteredWaiting.map(i => (
                  <div key={i.itemId} className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{(i.candidateName || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div className="min-w-0 flex-1"><Badge variant="secondary" className="mr-2 h-4 px-1.5 text-[10px]">Wartet</Badge><span className="text-foreground">{i.candidateName}</span> · Einladung seit {hoursSince(i.createdAt)} Std. Ab 24 Std. oben.</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
              {waitingOptIn.length + upcoming.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Nichts liegt bei Kunden oder Kandidaten.</p>
              ) : (
                <div className="divide-y divide-border/40">
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
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openDetail(i)}>Öffnen</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => later(i, new Date(Date.now() + 14 * DAY_MS))}>14 Tage ruhen</Button>
              </div>
            ))}
            <p className="px-4 py-2 text-xs text-muted-foreground">„Zurückziehen“ mit Grund kommt in der nächsten Stufe.</p>
          </FoldCard>
        )}

        {/* Erledigt */}
        {completedItems.length > 0 && (
          <FoldCard label="Erledigt" count={completedItems.length} open={doneOpen} onToggle={() => setDoneOpen(o => !o)}>
            {completedItems.map(i => (
              <div key={`${i.itemType}-${i.itemId}`} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="truncate">{i.candidateName ? `${i.candidateName} · ` : ''}{i.title}</span>
              </div>
            ))}
          </FoldCard>
        )}

        <p className="text-xs text-muted-foreground">Sonst nichts.</p>
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) refetch(); }} />
      <TaskDetailDialog
        open={!!detail}
        onOpenChange={o => { if (!o) setDetail(null); }}
        item={detail}
        onMarkDone={async id => { const it = allItems.find(i => i.itemId === id); if (it) { const { error } = await markDone(it.itemType, it.itemId); if (error) toast.error('Konnte nicht als erledigt markiert werden.'); } }}
        onSnooze={async (id, until) => { const it = allItems.find(i => i.itemId === id); if (it) await later(it, until); }}
      />
      <TaskWindow
        group={groups.find(g => g.key === windowKey) ?? null}
        initialTab={windowTab}
        onSend={sendMessage}
        onClose={() => setWindowKey(null)}
        onAct={(item, guide) => { setWindowKey(null); act(item, guide); }}
        onLater={(item, until) => { setWindowKey(null); later(item, until); }}
        onDetail={item => { setWindowKey(null); openDetail(item); }}
      />
      <ReachedDialog state={reached} onClose={() => setReached(null)} onConfirm={confirmReached} />
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

function PersonRow({ group, stage, onOpen, onAct }: {
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{group.initials}</div>
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
          {stage && <span className="text-muted-foreground">· {PIPELINE_LABELS[stage]}</span>}
          {fee && <span className="font-medium text-emerald-500 tabular-nums">{fee}</span>}
          {group.others.length > 0 && <span className="text-xs text-muted-foreground">+{group.others.length} weiterer Deal</span>}
        </div>
        <div className="text-sm text-muted-foreground">{guide.advice}</div>
      </button>
      <Button size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={() => onAct(item, guide)}>
        {guide.primary.kind === 'call' && <Phone className="h-3 w-3" />}
        {guide.primary.kind === 'debrief' && <NotebookPen className="h-3 w-3" />}
        {(guide.primary.kind === 'client' || guide.primary.kind === 'candidate') && <Mail className="h-3 w-3" />}
        {guide.primary.label}
      </Button>
      <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onOpen} aria-label="Aufgabe öffnen">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Die Aufgabe als Fenster: Grund, Deine Aufgabe, Ziel, Knöpfe. Die Liste bleibt kompakt. */
function TaskWindow({ group, initialTab, onSend, onClose, onAct, onLater, onDetail }: {
  group: PersonGroup | null;
  initialTab: 'client' | 'candidate';
  onSend: (item: UnifiedTaskItem, action: 'client_nudge' | 'candidate_message', text: string, meta: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
  onAct: (item: UnifiedTaskItem, guide: Guide) => void;
  onLater: (item: UnifiedTaskItem, until: Date) => void;
  onDetail: (item: UnifiedTaskItem) => void;
}) {
  const navigate = useNavigate();
  const item = group?.primary ?? null;
  const [tab, setTab] = useState<'client' | 'candidate'>(initialTab);
  const [intent, setIntent] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [candKeys, setCandKeys] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ title: string; created_at: string; activity_type: string }[]>([]);
  const set = useMemo(() => item ? messageSetFor(item.taskCategory, { jobTitle: item.jobTitle, firstName: firstName(item.candidateName) }) : null, [item?.itemId, item?.taskCategory, item?.jobTitle, item?.candidateName]);
  useEffect(() => {
    setTab(initialTab);
    setIntent(set?.clientIntents[0]?.key ?? null);
    setHints([]);
    setCandKeys(set?.candidate[0] ? [set.candidate[0].key] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.itemId, initialTab]);
  useEffect(() => {
    if (!item?.submissionId) { setHistory([]); return; }
    supabase
      .from('candidate_activity_log')
      .select('title, created_at, activity_type')
      .eq('related_submission_id', item.submissionId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setHistory((data ?? []) as any));
  }, [item?.submissionId]);
  if (!group || !item || !set) return null;
  const guide = buildGuide(item);
  const fee = euro(item.feeValue);
  const first = firstName(item.candidateName);
  const clientText = composeClientText(set, intent, hints);
  const candidateText = composeCandidateText(set, candKeys);
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  const canClient = !!item.submissionId && set.clientIntents.length > 0;
  const canCandidate = !!item.submissionId && !!item.candidateEmail && set.candidate.length > 0;
  const send = async () => {
    setSending(true);
    const ok = tab === 'client'
      ? await onSend(item, 'client_nudge', clientText, { intent, hints })
      : await onSend(item, 'candidate_message', candidateText, { kind: candKeys.join(','), subject: set.candidateSubject });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b p-5 pb-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{group.initials}</div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-x-2 text-base">
                <span>{group.name}</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{guide.pill}</Badge>
                {fee && <span className="text-sm font-medium text-emerald-500 tabular-nums">{fee}</span>}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1 text-xs">
                {item.jobTitle}{item.companyName ? ` · ${item.companyName}` : ''}
                {!item.companyName && <Lock className="h-3 w-3" />}
              </DialogDescription>
            </div>
          </div>
          <p className="text-sm">{guide.advice}</p>
        </DialogHeader>

        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1.25fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Grund</p>
              <ul className="space-y-1.5 text-sm">
                {guide.facts.map((f, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{f}</span></li>)}
                {guide.consequence && <li className="flex gap-2 text-muted-foreground"><span>→</span><span>{guide.consequence}</span></li>}
              </ul>
              {group.others.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Dazu: {group.others.map(o => `${o.jobTitle} · ${buildGuide(o).advice}`).join(' · ')}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bisher</p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch kein Kontakt zu diesem Deal.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {history.map((h, i) => <li key={i} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateDe(h.created_at)}</span><span>{h.title}</span></li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="mb-2 inline-flex rounded-md border border-border/60 bg-background p-0.5 text-xs">
              <button type="button" disabled={!canClient} className={cn('rounded px-2.5 py-1', tab === 'client' ? 'bg-accent text-foreground' : 'text-muted-foreground', !canClient && 'opacity-40')} onClick={() => setTab('client')}>An den Kunden</button>
              <button type="button" disabled={!canCandidate} className={cn('rounded px-2.5 py-1', tab === 'candidate' ? 'bg-accent text-foreground' : 'text-muted-foreground', !canCandidate && 'opacity-40')} onClick={() => setTab('candidate')}>An {first}</button>
            </div>
            {tab === 'client' ? (
              <>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Was möchtest du?</p>
                <div className="flex flex-wrap gap-1.5">
                  {set.clientIntents.map(c => (
                    <Button key={c.key} size="sm" variant={intent === c.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setIntent(c.key)}>{c.label}</Button>
                  ))}
                </div>
                {set.clientHints.length > 0 && (
                  <>
                    <p className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hinweis mitgeben</p>
                    <div className="flex flex-wrap gap-1.5">
                      {set.clientHints.map(c => (
                        <Button key={c.key} size="sm" variant={hints.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setHints(h => toggle(h, c.key))}>{c.label}</Button>
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{clientText || 'Wähle eine Bitte.'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Geht als Benachrichtigung ins Kunden-Dashboard und als Mail. Vor Opt-In nur das Bewerber-Kürzel, kein Name. Höchstens einmal in drei Tagen.</p>
              </>
            ) : (
              <>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Was soll {first} wissen?</p>
                <div className="flex flex-wrap gap-1.5">
                  {set.candidate.map(c => (
                    <Button key={c.key} size="sm" variant={candKeys.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setCandKeys(k => toggle(k, c.key))}>{c.label}</Button>
                  ))}
                </div>
                <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{candidateText ? `Hallo ${first}, ${candidateText}` : 'Wähle einen Satz.'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Mail über Matchunt mit deinem Namen, Antworten landen bei dir. Kein Firmenname vor Reveal.</p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-xs">
          <span className="text-muted-foreground">Ziel heute: <span className="font-medium text-emerald-500">{guide.goal}</span></span>
          <div className="flex flex-wrap items-center gap-1.5">
            <LaterMenu onPick={until => onLater(item, until)} />
            {item.candidatePhone && guide.primary.kind !== 'call' && guide.primary.kind !== 'followup' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild><a href={`tel:${item.candidatePhone}`}><Phone className="mr-1 h-3 w-3" />Anrufen</a></Button>
            )}
            {item.submissionId && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/recruiter/submissions/${item.submissionId}`)}>Einreichung</Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onDetail(item)}>Details</Button>
            {(guide.primary.kind === 'call' || guide.primary.kind === 'followup') && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                <Phone className="h-3 w-3" />{guide.primary.kind === 'call' ? 'Anrufen' : 'Nachgefasst'}
              </Button>
            )}
            {guide.primary.kind === 'debrief' || guide.primary.kind === 'done' ? (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                {guide.primary.kind === 'debrief' && <NotebookPen className="h-3 w-3" />}
                {guide.primary.label}
              </Button>
            ) : (
              <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || (tab === 'client' ? !clientText || !canClient : !candidateText || !canCandidate)} onClick={send}>
                <Mail className="h-3 w-3" />{tab === 'client' ? 'An den Kunden senden' : `An ${first} senden`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LaterMenu({ onPick }: { onPick: (until: Date) => void }) {
  const [open, setOpen] = useState(false);
  const evening = new Date(); evening.setHours(18, 0, 0, 0);
  const tomorrow = new Date(Date.now() + DAY_MS); tomorrow.setHours(9, 0, 0, 0);
  const threeDays = new Date(Date.now() + 3 * DAY_MS); threeDays.setHours(9, 0, 0, 0);
  return (
    <span className="relative">
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(o => !o)}>Später</Button>
      {open && (
        <span className="absolute right-0 z-20 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
          {[['Heute Abend', evening], ['Morgen', tomorrow], ['3 Tage', threeDays]].map(([label, d]) => (
            <button key={label as string} type="button" className="rounded px-2 py-1 text-left text-xs hover:bg-accent" onClick={() => { setOpen(false); onPick(d as Date); }}>
              {label as string}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function ReachedDialog({ state, onClose, onConfirm }: {
  state: { item: UnifiedTaskItem; guide: Guide } | null;
  onClose: () => void;
  onConfirm: (yes: boolean, outcome: string | null, note: string) => void;
}) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { setOutcome(null); setNote(''); }, [state?.item.itemId]);
  if (!state) return null;
  const isFollowup = state.guide.primary.kind === 'followup';
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFollowup ? 'Nachgefasst?' : 'Erreicht?'}</DialogTitle>
          <DialogDescription>{state.item.candidateName || state.item.title} · {state.item.jobTitle}</DialogDescription>
        </DialogHeader>
        {state.guide.reachedOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.guide.reachedOptions.map(o => (
              <Button key={o} size="sm" variant={outcome === o ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setOutcome(outcome === o ? null : o)}>{o}</Button>
            ))}
          </div>
        )}
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz, eine Zeile …" rows={2} className="text-sm" />
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onConfirm(false, null, note)}>Nicht erreicht · in 2 Std. erneut</Button>
          <Button size="sm" onClick={() => onConfirm(true, outcome, note)}>{isFollowup ? 'Ja, nachgefasst' : 'Ja, erreicht'}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Die Antwort landet als Beleg im Aktivitätslog. „Ja“ schließt die Zeile; sie kommt wieder, wenn sich am Deal nichts ändert.</p>
      </DialogContent>
    </Dialog>
  );
}
