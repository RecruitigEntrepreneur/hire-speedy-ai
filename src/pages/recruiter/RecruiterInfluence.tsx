import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TodayInterviewsRail } from '@/components/influence/TodayInterviewsRail';
import { PlaybookViewer } from '@/components/influence/PlaybookViewer';
import { TaskCard } from '@/components/influence/TaskCard';
import { TaskDetailDialog, type TaskDetailItem } from '@/components/influence/TaskDetailDialog';
import { CreateTaskDialog } from '@/components/influence/CreateTaskDialog';
import { useUnifiedTaskInbox } from '@/hooks/useUnifiedTaskInbox';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { CheckSquare, Plus, AlertCircle, Circle, CalendarDays, CalendarRange, ChevronDown, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function RecruiterInfluence() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    items,
    allItems,
    completedItems,
    loading,
    markDone,
    snooze,
    dismiss,
    filterCounts,
    pendingCount,
    refetch,
  } = useUnifiedTaskInbox('all');
  const { logActivity } = useActivityLogger();

  // Playbook state
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<{ name: string; company: string } | null>(null);
  const { playbook } = useCoachingPlaybook(selectedPlaybookId || undefined);

  // Create Task dialog
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Task detail dialog
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetailItem, setTaskDetailItem] = useState<TaskDetailItem | null>(null);

  // Completed section
  const [completedOpen, setCompletedOpen] = useState(false);
  const [staleOpen, setStaleOpen] = useState(false);

  // Handlers
  const handleMarkDone = async (item: typeof items[0]) => {
    const { error } = await markDone(item.itemType, item.itemId);
    if (error) {
      toast.error('Konnte nicht als erledigt markiert werden.');
      return;
    }

    // Log activity
    if (item.candidateId) {
      await logActivity(
        item.candidateId,
        'alert_actioned',
        `Aufgabe erledigt: ${item.title}`,
        undefined,
        { item_type: item.itemType, task_category: item.taskCategory },
        item.submissionId || undefined,
        item.itemType === 'alert' ? item.itemId : undefined
      );
    }

    toast.success(
      item.itemType === 'derived'
        ? 'Erledigt — kommt wieder, falls sich weiterhin nichts bewegt'
        : 'Erledigt'
    );
  };

  const handleSnooze = async (item: typeof items[0], until: Date) => {
    const { error } = await snooze(item.itemType, item.itemId, until);
    if (error) {
      toast.error('Konnte nicht vertagt werden.');
      return;
    }
    toast.success('Vertagt');
  };

  const handleDelete = async (item: typeof items[0]) => {
    const { error } = await dismiss(item.itemType, item.itemId);
    if (error) {
      toast.error('Konnte nicht gelöscht werden.');
      return;
    }
    toast.success('Gelöscht');
  };

  const handleOpenPlaybook = (item: typeof items[0]) => {
    if (!item.playbookId) return;
    setSelectedCandidate({
      name: item.candidateName || '[Name]',
      company: item.companyName || '[Firma]',
    });
    setSelectedPlaybookId(item.playbookId);
  };

  const handleClickItem = (item: typeof items[0]) => {
    // Debrief: das Formular existiert im Termin-Sheet der Interviews-Seite.
    if (item.itemId.startsWith('derived-debrief-')) {
      navigate(`/recruiter/interviews?interview=${item.itemId.replace('derived-debrief-', '')}`);
      return;
    }
    // Open the task detail dialog
    setTaskDetailItem({
      itemType: item.itemType,
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      recommendedAction: item.recommendedAction,
      taskCategory: item.taskCategory,
      priority: item.priority,
      submissionId: item.submissionId,
      candidateId: item.candidateId,
      jobId: item.jobId,
      playbookId: item.playbookId,
      createdAt: item.createdAt,
      dueAt: item.dueAt,
      impactScore: item.impactScore,
      candidateName: item.candidateName,
      candidatePhone: item.candidatePhone,
      candidateEmail: item.candidateEmail,
      jobTitle: item.jobTitle,
      companyName: item.companyName,
    });
    setTaskDetailOpen(true);
  };

  // Deeplink vom Dashboard: /recruiter/influence?item=<id> öffnet die Aufgabe direkt.
  const deepLinkItem = searchParams.get('item');
  useEffect(() => {
    if (!deepLinkItem || loading) return;
    const target = allItems.find(i => i.itemId === deepLinkItem);
    if (target) {
      handleClickItem(target);
      const next = new URLSearchParams(searchParams);
      next.delete('item');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkItem, loading, allItems]);

  // Zeit-Gruppierung: Überfällig/Dringend → Heute → Diese Woche → Später.
  // Items ohne dueAt landen bei "Später", außer sie sind kritisch.
  const timeGroups = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(now.getTime() + 7 * 86_400_000);

    const overdue: typeof items = [];
    const today: typeof items = [];
    const week: typeof items = [];
    const later: typeof items = [];
    // Älter als drei Wochen ist keine Dringlichkeit mehr, sondern ein Deal ohne
    // Bewegung: unten, grau, eingeklappt — bis „Zurückziehen“ gebaut ist.
    const stale: typeof items = [];

    for (const item of items) {
      const due = item.dueAt ? new Date(item.dueAt) : null;
      if (item.isStale) stale.push(item);
      else if ((due && due < now) || item.priority === 'critical') overdue.push(item);
      else if (due && due <= endOfToday) today.push(item);
      else if (due && due <= endOfWeek) week.push(item);
      else later.push(item);
    }

    return [
      { key: 'overdue', label: `Überfällig & Dringend (${overdue.length})`, items: overdue, icon: <AlertCircle className="h-3 w-3" />, tone: 'text-destructive' },
      { key: 'today', label: `Heute fällig (${today.length})`, items: today, icon: <CalendarDays className="h-3 w-3" />, tone: 'text-amber-600 dark:text-amber-400' },
      { key: 'week', label: `Diese Woche (${week.length})`, items: week, icon: <CalendarRange className="h-3 w-3" />, tone: 'text-muted-foreground' },
      { key: 'later', label: `Später & ohne Termin (${later.length})`, items: later, icon: <Circle className="h-3 w-3" />, tone: 'text-muted-foreground' },
      { key: 'stale', label: `Ohne Bewegung seit über 3 Wochen (${stale.length})`, items: stale, icon: <Circle className="h-3 w-3" />, tone: 'text-muted-foreground', collapsed: true },
    ].filter(g => g.items.length > 0);
  }, [items]);

  const activeCount = timeGroups.filter(g => g.key !== 'stale').reduce((n, g) => n + g.items.length, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-primary" />
              Aufgaben
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount > 0 ? `${activeCount} Deals brauchen dich.` : 'Nichts braucht dich gerade.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1"
            onClick={() => setCreateTaskOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Eigene Erinnerung
          </Button>
        </div>

        {/* Main Grid: Tasks (2/3) + Sidebar (1/3) */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tasks */}
          <div className="lg:col-span-2 space-y-4" data-tour="tasks.list">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 && completedItems.length === 0 ? (
              // Noch nie eine Aufgabe gehabt: „gut gemacht“ wäre für Neue irreführend.
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Noch keine Aufgaben</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Aufgaben entstehen, sobald Bewegung in deine Vorstellungen kommt, etwa wenn ein Kunde deinen Kandidaten kennenlernen will.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link to="/recruiter/jobs">Offene Jobs ansehen</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Keine offenen Aufgaben — gut gemacht!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {timeGroups.map(group => (
                  <div key={group.key} className="space-y-2">
                    {'collapsed' in group && group.collapsed ? (
                      <button
                        type="button"
                        className={cn('text-xs font-medium uppercase tracking-wider flex items-center gap-1', group.tone)}
                        onClick={() => setStaleOpen(o => !o)}
                      >
                        {group.icon}
                        {group.label}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', staleOpen && 'rotate-180')} />
                      </button>
                    ) : (
                      <p className={cn('text-xs font-medium uppercase tracking-wider flex items-center gap-1', group.tone)}>
                        {group.icon}
                        {group.label}
                      </p>
                    )}
                    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2', 'collapsed' in group && group.collapsed && !staleOpen && 'hidden')}>
                      {group.items.map(item => (
                        <TaskCard
                          key={`${item.itemType}-${item.itemId}`}
                          item={item}
                          onMarkDone={() => handleMarkDone(item)}
                          onSnooze={(until) => handleSnooze(item, until)}
                          onDelete={item.itemType === 'task' ? () => handleDelete(item) : undefined}
                          onOpenPlaybook={item.playbookId ? () => handleOpenPlaybook(item) : undefined}
                          onClick={() => handleClickItem(item)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Sidebar: Interviews → Performance → Erledigt */}
          <div className="space-y-6">
            <TodayInterviewsRail />

            {/* Completed — echte Liste der letzten Erledigungen */}
            <Card>
              <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        Erledigt
                        <Badge variant="secondary" className="text-[10px]">
                          {completedItems.length}
                        </Badge>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', completedOpen && 'rotate-180')} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-1.5">
                    {completedItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Noch nichts erledigt — starte mit deiner ersten Aufgabe.
                      </p>
                    ) : (
                      completedItems.map(item => (
                        <div
                          key={`${item.itemType}-${item.itemId}`}
                          className="flex items-start gap-2 py-1"
                        >
                          <Check className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {item.candidateName ? `${item.candidateName} · ` : ''}
                              {item.completedAt
                                ? formatDistanceToNow(new Date(item.completedAt), { locale: de, addSuffix: true })
                                : ''}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </div>
        </div>

        {/* Playbook Viewer (Sheet) */}
        <PlaybookViewer
          playbook={playbook}
          open={!!selectedPlaybookId}
          onClose={() => {
            setSelectedPlaybookId(null);
            setSelectedCandidate(null);
          }}
          candidateName={selectedCandidate?.name}
          companyName={selectedCandidate?.company}
        />

        {/* Create Task Dialog */}
        <CreateTaskDialog
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
        />

        {/* Task Detail Dialog */}
        <TaskDetailDialog
          open={taskDetailOpen}
          onOpenChange={setTaskDetailOpen}
          item={taskDetailItem}
          onMarkDone={async (itemId) => {
            const item = allItems.find(i => i.itemId === itemId);
            if (item) {
              await handleMarkDone(item);
            }
          }}
          onSnooze={async (itemId, until) => {
            const item = allItems.find(i => i.itemId === itemId);
            if (item) {
              await handleSnooze(item, until);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
