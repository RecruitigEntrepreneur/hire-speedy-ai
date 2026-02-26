import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PerformanceIntel } from '@/components/influence/PerformanceIntel';
import { TeamLeaderboard } from '@/components/influence/TeamLeaderboard';
import { PlaybookViewer } from '@/components/influence/PlaybookViewer';
import { InfluenceScoreBadge } from '@/components/influence/InfluenceScoreBadge';
import { TaskCard } from '@/components/influence/TaskCard';
import { TaskDetailDialog, type TaskDetailItem } from '@/components/influence/TaskDetailDialog';
import { CreateTaskDialog } from '@/components/influence/CreateTaskDialog';
import { SessionStartDialog } from '@/components/influence/SessionStartDialog';
import { ActionSession } from '@/components/influence/ActionSession';
import { SessionSummary } from '@/components/influence/SessionSummary';
import { useUnifiedTaskInbox, type TaskFilter } from '@/hooks/useUnifiedTaskInbox';
import { useRecruiterInfluenceScore } from '@/hooks/useRecruiterInfluenceScore';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { useActionSession } from '@/hooks/useActionSession';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { CheckSquare, Plus, Play, AlertCircle, Circle, ChevronDown, Loader2 } from 'lucide-react';
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
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const {
    items,
    allItems,
    urgentItems,
    openItems,
    loading,
    markDone,
    snooze,
    dismiss,
    filterCounts,
    pendingCount,
    urgentCount,
    refetch,
  } = useUnifiedTaskInbox(activeFilter);
  const { score, loading: scoreLoading } = useRecruiterInfluenceScore();
  const { logActivity } = useActivityLogger();

  // Playbook state
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<{ name: string; company: string } | null>(null);
  const { playbook } = useCoachingPlaybook(selectedPlaybookId || undefined);

  // Create Task dialog
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Session state
  const [sessionStartOpen, setSessionStartOpen] = useState(false);
  const actionSession = useActionSession();

  // Task detail dialog
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskDetailItem, setTaskDetailItem] = useState<TaskDetailItem | null>(null);

  // Completed section
  const [completedOpen, setCompletedOpen] = useState(false);

  // Handlers
  const handleMarkDone = async (item: typeof items[0]) => {
    await markDone(item.itemType, item.itemId);

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

    toast.success('Erledigt');
  };

  const handleSnooze = async (item: typeof items[0], until: Date) => {
    await snooze(item.itemType, item.itemId, until);
    toast.success('Gesnoozed');
  };

  const handleDelete = async (item: typeof items[0]) => {
    await dismiss(item.itemType, item.itemId);
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

  // Session handlers
  const handleStartSession = (selectedItems: typeof items) => {
    setSessionStartOpen(false);
    actionSession.startSession(selectedItems);
  };

  const handleSessionEnd = () => {
    refetch();
  };

  // Keyboard shortcuts (page level)
  const handlePageKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Don't trigger when session or dialog is active
    if (actionSession.isActive || sessionStartOpen || createTaskOpen) return;

    if (e.key === 'S' && e.shiftKey) {
      e.preventDefault();
      if (pendingCount > 0) {
        setSessionStartOpen(true);
      }
    }
  }, [actionSession.isActive, sessionStartOpen, createTaskOpen, pendingCount]);

  useEffect(() => {
    window.addEventListener('keydown', handlePageKeyDown);
    return () => window.removeEventListener('keydown', handlePageKeyDown);
  }, [handlePageKeyDown]);

  // Filter config
  const filters: { key: TaskFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Alle', count: filterCounts.all },
    { key: 'opt_in', label: 'Opt-In', count: filterCounts.opt_in },
    { key: 'follow_up', label: 'Follow-up', count: filterCounts.follow_up },
    { key: 'interview', label: 'Interview', count: filterCounts.interview },
    { key: 'manual', label: 'Manuell', count: filterCounts.manual },
    { key: 'other', label: 'Sonstige', count: filterCounts.other },
  ];

  // Estimated session duration (3 min per task)
  const estimatedMinutes = Math.ceil(pendingCount * 3);

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
              Dein Arbeitsmodus — priorisiert nach Impact
            </p>
          </div>
          {!scoreLoading && score && (
            <InfluenceScoreBadge score={score.influence_score} size="lg" />
          )}
        </div>

        {/* Session CTA */}
        {pendingCount > 0 && (
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      Session starten ({pendingCount} Aufgaben)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Arbeite deine Top-Aufgaben fokussiert ab · ~{estimatedMinutes} min
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => setSessionStartOpen(true)}
                  size="sm"
                  className="gap-1.5"
                >
                  <Play className="h-3.5 w-3.5" />
                  Starten
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs + Create Button */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map(f => (
            <Button
              key={f.key}
              variant={activeFilter === f.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label} ({f.count})
            </Button>
          ))}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => setCreateTaskOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Aufgabe
          </Button>
        </div>

        {/* Main Grid: Tasks (2/3) + Sidebar (1/3) */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tasks */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
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
                {/* Urgent Section */}
                {urgentItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Dringend ({urgentItems.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {urgentItems.map(item => (
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
                )}

                {/* Open Section */}
                {openItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Circle className="h-3 w-3" />
                      Offen ({openItems.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {openItems.map(item => (
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
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PerformanceIntel score={score} loading={scoreLoading} />
            <TeamLeaderboard limit={3} />

            {/* Completed */}
            <Card>
              <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        Erledigt
                        <Badge variant="secondary" className="text-[10px]">
                          {score?.alerts_actioned || 0}
                        </Badge>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', completedOpen && 'rotate-180')} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {score?.alerts_actioned || 0} Aufgaben insgesamt erledigt
                    </p>
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

        {/* Session Start Dialog */}
        <SessionStartDialog
          open={sessionStartOpen}
          onOpenChange={setSessionStartOpen}
          items={allItems}
          onStartSession={handleStartSession}
        />

        {/* Action Session Overlay */}
        {actionSession.isActive && actionSession.currentItem && (
          <ActionSession
            session={actionSession}
            onOpenPlaybook={(item) => handleOpenPlaybook(item)}
            onEnd={handleSessionEnd}
          />
        )}

        {/* Session Summary */}
        {actionSession.isFinished && (
          <SessionSummary
            session={actionSession}
            score={score}
            onClose={() => {
              actionSession.clearSession();
              refetch();
            }}
            onNewSession={() => {
              actionSession.clearSession();
              refetch();
              setSessionStartOpen(true);
            }}
          />
        )}

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
