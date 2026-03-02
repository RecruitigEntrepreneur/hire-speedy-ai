import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  Phone,
  Mail,
  ShieldCheck,
  Info,
  MessageSquare,
  Edit,
  Upload,
  Plus,
  ListTodo,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useRecruiterTasks } from '@/hooks/useRecruiterTasks';
import { CreateTaskDialog } from '@/components/influence/CreateTaskDialog';
import { TaskDetailDialog, TaskDetailItem } from '@/components/influence/TaskDetailDialog';

interface CandidateTask {
  id: string;
  alert_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recommended_action: string;
  action_taken: string | null;
  created_at: string;
  submission_id: string;
  playbook_id?: string | null;
  // Enriched data
  jobTitle?: string | null;
  companyName?: string | null;
}

interface CandidateContact {
  email?: string;
  phone?: string;
}

interface ExposeTask {
  id: string;
  title: string;
  description: string;
  actions: ('call' | 'edit' | 'cv_upload' | 'interview')[];
}

interface CandidateTasksSectionProps {
  candidateId: string;
  activeTaskId?: string;
  candidate?: {
    full_name?: string | null;
    email?: string;
    phone?: string | null;
    job_title?: string | null;
    skills?: string[] | null;
    experience_years?: number | null;
    expected_salary?: number | null;
    availability_date?: string | null;
    notice_period?: string | null;
    city?: string | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown[] | null;
    change_motivation?: string | null;
    would_recommend?: boolean | null;
  } | null;
  onEdit?: () => void;
  onCvUpload?: () => void;
  onStartInterview?: () => void;
}

const priorityConfig = {
  critical: {
    icon: AlertCircle,
    label: 'Kritisch',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-l-destructive',
  },
  high: {
    icon: AlertTriangle,
    label: 'Hoch',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-l-amber-500',
  },
  medium: {
    icon: Clock,
    label: 'Mittel',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-l-blue-500',
  },
  low: {
    icon: Clock,
    label: 'Normal',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-l-muted-foreground',
  },
};

// Fields covered by CV upload - don't show individually if CV is missing
const CV_FIELDS = ['Skills', 'Erfahrung', 'CV Summary', 'CV Highlights'];
// Fields covered by Interview - don't show individually if interview is missing
const INTERVIEW_FIELDS = ['Gehalt', 'Verfügbarkeit', 'Wechselmotivation'];

function buildExposeTasks(
  candidate: CandidateTasksSectionProps['candidate'],
  hasInterview: boolean
): ExposeTask[] {
  if (!candidate) return [];

  const readiness = getExposeReadiness(candidate);
  if (readiness.isReady) return [];

  const missing = readiness.missingFields;
  const tasks: ExposeTask[] = [];

  const hasCv = !!(candidate.cv_ai_summary || (candidate.cv_ai_bullets && candidate.cv_ai_bullets.length > 0));

  if (!hasCv) {
    tasks.push({
      id: 'expose-cv',
      title: 'CV hochladen und analysieren lassen',
      description: 'Skills, Erfahrung und Zusammenfassung werden automatisch aus dem CV extrahiert.',
      actions: ['cv_upload'],
    });
  }

  if (!hasInterview) {
    tasks.push({
      id: 'expose-interview',
      title: 'Interview durchführen',
      description: 'Gehaltsvorstellung, Wechselmotivation und Verfügbarkeit werden im Interview erfasst.',
      actions: ['interview', 'call'],
    });
  }

  const residual = missing.filter(f => {
    if (!hasCv && CV_FIELDS.includes(f)) return false;
    if (!hasInterview && INTERVIEW_FIELDS.includes(f)) return false;
    return true;
  });

  const fieldTaskMap: Record<string, { title: string; description: string; actions: ExposeTask['actions'] }> = {
    'Name': { title: 'Name eintragen', description: 'Der Name des Kandidaten fehlt.', actions: ['edit'] },
    'E-Mail': { title: 'E-Mail eintragen', description: 'E-Mail-Adresse des Kandidaten fehlt.', actions: ['edit'] },
    'Telefon': { title: 'Telefonnummer eintragen', description: 'Telefonnummer des Kandidaten fehlt.', actions: ['edit'] },
    'Jobtitel': { title: 'Jobtitel eintragen', description: 'Aktuelle Position/Jobtitel fehlt.', actions: ['edit'] },
    'Standort': { title: 'Standort eintragen', description: 'Stadt/Standort des Kandidaten fehlt.', actions: ['edit'] },
    'Gehalt': { title: 'Gehaltsvorstellung erfragen', description: 'Für das Exposé wird eine Gehaltsvorstellung benötigt.', actions: ['call', 'edit'] },
    'Verfügbarkeit': { title: 'Verfügbarkeit klären', description: 'Verfügbarkeitsdatum oder Kündigungsfrist eintragen.', actions: ['call', 'edit'] },
    'Skills': { title: 'Skills ergänzen (mind. 3)', description: 'Mindestens 3 Skills werden für das Exposé benötigt.', actions: ['edit'] },
    'Erfahrung': { title: 'Berufserfahrung eintragen', description: 'Erfahrungsjahre für das Exposé eintragen.', actions: ['edit'] },
    'CV Summary': { title: 'CV hochladen', description: 'CV-Zusammenfassung fehlt.', actions: ['cv_upload'] },
    'CV Highlights': { title: 'CV hochladen', description: 'CV-Highlights fehlen.', actions: ['cv_upload'] },
    'Wechselmotivation': { title: 'Wechselmotivation erfragen', description: 'Warum will der Kandidat wechseln?', actions: ['call', 'interview'] },
  };

  for (const field of residual) {
    const config = fieldTaskMap[field];
    if (config) {
      if (tasks.some(t => t.id === `expose-residual-${field}` || (config.actions.includes('cv_upload') && tasks.some(t2 => t2.id.startsWith('expose-residual') && t2.actions.includes('cv_upload'))))) continue;
      tasks.push({ id: `expose-residual-${field}`, ...config });
    }
  }

  return tasks;
}

// Convert a CandidateTask to TaskDetailItem for the dialog
function toDetailItem(
  task: CandidateTask,
  candidateId: string,
  candidateName: string | null,
  candidatePhone: string | null,
  candidateEmail: string | null,
): TaskDetailItem {
  return {
    itemType: 'alert',
    itemId: task.id,
    title: task.title,
    description: task.message || null,
    recommendedAction: task.recommended_action || null,
    taskCategory: task.alert_type,
    priority: task.priority,
    submissionId: task.submission_id,
    candidateId,
    jobId: null,
    playbookId: task.playbook_id || null,
    createdAt: task.created_at,
    dueAt: null,
    impactScore: 50,
    candidateName,
    candidatePhone,
    candidateEmail,
    jobTitle: task.jobTitle || null,
    companyName: task.companyName || null,
  };
}

export function CandidateTasksSection({ candidateId, activeTaskId, candidate, onEdit, onCvUpload, onStartInterview }: CandidateTasksSectionProps) {
  const [tasks, setTasks] = useState<CandidateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<CandidateContact>({});
  const [hasInterview, setHasInterview] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<TaskDetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { logActivity } = useActivityLogger();
  const { pendingTasks: manualTasks, completeTask } = useRecruiterTasks();

  // Horizontal scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [candidateId]);

  const fetchTasks = async () => {
    try {
      const { data: candidateData } = await supabase
        .from('candidates')
        .select('email, phone')
        .eq('id', candidateId)
        .single();

      if (candidateData) {
        setContact({ email: candidateData.email, phone: candidateData.phone ?? undefined });
      }

      const { count } = await supabase
        .from('candidate_interview_notes')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId);

      setHasInterview((count ?? 0) > 0);

      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, job_id')
        .eq('candidate_id', candidateId);

      if (!submissions || submissions.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const submissionIds = submissions.map(s => s.id);

      // Fetch job info for enrichment
      const jobIds = [...new Set(submissions.map(s => s.job_id))];
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, company_name')
        .in('id', jobIds);

      const jobMap = new Map((jobs || []).map(j => [j.id, j]));
      const subJobMap = new Map(submissions.map(s => [s.id, jobMap.get(s.job_id)]));

      const { data: alerts, error } = await supabase
        .from('influence_alerts')
        .select('*')
        .in('submission_id', submissionIds)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich alerts with job info
      const enriched = (alerts || []).map((a: any) => {
        const job = subJobMap.get(a.submission_id);
        return {
          ...a,
          jobTitle: job?.title || null,
          companyName: job?.company_name || null,
        };
      });

      setTasks(enriched as unknown as CandidateTask[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Re-check scroll after data loads
  useEffect(() => {
    if (!loading) {
      setTimeout(checkScroll, 50);
    }
  }, [loading, tasks, manualTasks]);

  const handleMarkDone = async (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const task = tasks.find(t => t.id === taskId);
      const { error } = await supabase
        .from('influence_alerts')
        .update({
          action_taken: 'marked_done',
          action_taken_at: new Date().toISOString(),
          is_read: true
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, action_taken: 'marked_done' } : t
      ));

      await logActivity(
        candidateId,
        'alert_actioned',
        `Aufgabe erledigt: ${task?.title || 'Aufgabe'}`,
        undefined,
        { alert_type: task?.alert_type, priority: task?.priority },
        task?.submission_id || undefined,
        taskId
      );

      toast.success('Aufgabe als erledigt markiert');
    } catch (error) {
      console.error('Error marking task done:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleMarkDoneFromDialog = async (taskId: string) => {
    await handleMarkDone(taskId);
  };

  const handleConfirmOptIn = async (taskId: string, submissionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const { error: subError } = await supabase
        .from('submissions')
        .update({ stage: 'candidate_opted_in' })
        .eq('id', submissionId);

      if (subError) throw subError;

      const { error: alertError } = await supabase
        .from('influence_alerts')
        .update({
          action_taken: 'opt_in_confirmed',
          action_taken_at: new Date().toISOString(),
          is_read: true
        })
        .eq('id', taskId);

      if (alertError) throw alertError;

      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, action_taken: 'opt_in_confirmed' } : t
      ));

      await logActivity(
        candidateId,
        'note' as any,
        'Opt-In vom Recruiter bestätigt',
        undefined,
        { submission_id: submissionId },
        submissionId,
        taskId
      );

      toast.success('Opt-In bestätigt – Kunde wird benachrichtigt');
    } catch (error) {
      console.error('Error confirming opt-in:', error);
      toast.error('Fehler beim Bestätigen');
    }
  };

  const pendingTasks = tasks.filter(t => !t.action_taken);
  const completedTasks = tasks.filter(t => t.action_taken);
  const exposeTasks = buildExposeTasks(candidate, hasInterview);
  const candidateManualTasks = manualTasks.filter(t => t.candidate_id === candidateId);

  const handleCompleteManualTask = async (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await completeTask(taskId);
    const task = candidateManualTasks.find(t => t.id === taskId);
    if (task) {
      await logActivity(
        candidateId,
        'note' as any,
        `Manuelle Aufgabe erledigt: ${task.title}`,
        undefined,
        { task_type: task.task_type }
      );
    }
    toast.success('Aufgabe erledigt');
  };

  const openTaskDetail = (task: CandidateTask) => {
    setDetailItem(toDetailItem(
      task,
      candidateId,
      candidate?.full_name || null,
      candidate?.phone || contact.phone || null,
      candidate?.email || contact.email || null,
    ));
    setDetailOpen(true);
  };

  const openExposeDetail = (task: ExposeTask) => {
    setDetailItem({
      itemType: 'expose',
      itemId: task.id,
      title: task.title,
      description: task.description,
      recommendedAction: task.description,
      taskCategory: 'expose',
      priority: 'medium',
      submissionId: null,
      candidateId,
      jobId: null,
      playbookId: null,
      createdAt: new Date().toISOString(),
      dueAt: null,
      impactScore: 0,
      candidateName: candidate?.full_name || null,
      candidatePhone: candidate?.phone || contact.phone || null,
      candidateEmail: candidate?.email || contact.email || null,
      jobTitle: null,
      companyName: null,
    });
    setDetailOpen(true);
  };

  const openManualTaskDetail = (task: any) => {
    setDetailItem({
      itemType: 'task',
      itemId: task.id,
      title: task.title,
      description: task.description || null,
      recommendedAction: null,
      taskCategory: task.task_type || 'other',
      priority: 'medium',
      submissionId: null,
      candidateId,
      jobId: null,
      playbookId: null,
      createdAt: task.created_at,
      dueAt: task.due_at || null,
      impactScore: 0,
      candidateName: candidate?.full_name || null,
      candidatePhone: candidate?.phone || contact.phone || null,
      candidateEmail: candidate?.email || contact.email || null,
      jobTitle: null,
      companyName: null,
    });
    setDetailOpen(true);
  };

  const totalPending = pendingTasks.length + exposeTasks.length + candidateManualTasks.length;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Aufgaben
          </span>
        </div>
        <div className="flex gap-2">
          <div className="h-[100px] w-64 bg-muted/30 rounded-lg animate-pulse shrink-0" />
          <div className="h-[100px] w-64 bg-muted/30 rounded-lg animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  if (totalPending === 0 && completedTasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Aufgaben{totalPending > 0 ? ` (${totalPending})` : ''}
          </span>
          {pendingTasks.filter(t => t.priority === 'critical').length > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
              {pendingTasks.filter(t => t.priority === 'critical').length} kritisch
            </Badge>
          )}
          {completedTasks.length > 0 && totalPending === 0 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-emerald-600 border-emerald-500/50">
              <Check className="h-2.5 w-2.5 mr-0.5" />
              Alles erledigt
            </Badge>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCreateTaskOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Aufgabe hinzufügen</TooltipContent>
        </Tooltip>
      </div>

      {/* Horizontal scroll container */}
      {totalPending > 0 && (
        <div className="relative">
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none rounded-l-lg" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none rounded-r-lg" />
          )}

          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* DB-based tasks (Influence Alerts) — enhanced cards */}
            {pendingTasks.map(task => {
              const config = priorityConfig[task.priority];
              const isOptInPending = task.alert_type === 'opt_in_pending';
              const timeAgo = formatDistanceToNow(new Date(task.created_at), { locale: de, addSuffix: true });

              return (
                <div
                  key={task.id}
                  onClick={() => openTaskDetail(task)}
                  className={cn(
                    'shrink-0 w-64 rounded-lg border border-l-[3px] p-2.5 transition-all hover:shadow-sm cursor-pointer group',
                    config.borderColor,
                    task.id === activeTaskId && 'ring-2 ring-primary bg-primary/5'
                  )}
                >
                  {/* Row 1: Badge + Time */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="outline" className={cn('shrink-0 text-[9px] px-1.5 py-0 leading-4', config.color)}>
                      {config.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                  </div>

                  {/* Row 2: Title (2 lines) */}
                  <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">{task.title}</p>

                  {/* Row 3: Job context */}
                  {(task.jobTitle || task.companyName) && (
                    <div className="flex items-center gap-1 mt-1 min-w-0">
                      <Shield className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {task.companyName ? `${task.companyName}` : ''}{task.jobTitle ? ` · ${task.jobTitle}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Row 4: Quick actions */}
                  <div className="flex items-center justify-end mt-1.5 gap-0.5">
                    {isOptInPending && (
                      <Button
                        variant="default"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => handleConfirmOptIn(task.id, task.submission_id, e)}
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                      </Button>
                    )}
                    {contact.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${contact.phone}`; }}
                      >
                        <Phone className="h-2.5 w-2.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={(e) => handleMarkDone(task.id, e)}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Exposé-critical pseudo-tasks — enhanced */}
            {exposeTasks.map(task => (
              <div
                key={task.id}
                onClick={() => openExposeDetail(task)}
                className="shrink-0 w-64 rounded-lg border border-l-[3px] border-l-blue-500 p-2.5 transition-all hover:shadow-sm cursor-pointer group"
              >
                {/* Row 1: Badge + label */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="shrink-0 text-[9px] px-1.5 py-0 leading-4 text-blue-600 border-blue-500/50">
                    Exposé
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">Exposé-Pflicht</span>
                </div>

                {/* Row 2: Title (2 lines) */}
                <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">{task.title}</p>

                {/* Row 3: Description */}
                <p className="text-[10px] text-muted-foreground truncate mt-1">
                  {task.description}
                </p>

                {/* Row 4: Actions */}
                <div className="flex items-center justify-end mt-1.5 gap-0.5">
                  {task.actions.includes('cv_upload') && onCvUpload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); onCvUpload(); }}
                    >
                      <Upload className="h-2.5 w-2.5 text-blue-600" />
                    </Button>
                  )}
                  {task.actions.includes('interview') && onStartInterview && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); onStartInterview(); }}
                    >
                      <MessageSquare className="h-2.5 w-2.5 text-blue-600" />
                    </Button>
                  )}
                  {task.actions.includes('edit') && onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    >
                      <Edit className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {/* Manual recruiter tasks — enhanced */}
            {candidateManualTasks.map(task => {
              const timeAgo = formatDistanceToNow(new Date(task.created_at), { locale: de, addSuffix: true });
              return (
                <div
                  key={task.id}
                  onClick={() => openManualTaskDetail(task)}
                  className="shrink-0 w-64 rounded-lg border border-l-[3px] border-l-violet-500 p-2.5 transition-all hover:shadow-sm cursor-pointer group"
                >
                  {/* Row 1: Badge + Time */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="outline" className="shrink-0 text-[9px] px-1.5 py-0 leading-4 text-violet-600 border-violet-500/50">
                      Manuell
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                  </div>

                  {/* Row 2: Title (2 lines) */}
                  <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">{task.title}</p>

                  {/* Row 3: Description */}
                  {task.description && (
                    <p className="text-[10px] text-muted-foreground truncate mt-1">
                      {task.description}
                    </p>
                  )}

                  {/* Row 4: Done action */}
                  <div className="flex items-center justify-end mt-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={(e) => handleCompleteManualTask(task.id, e)}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed count (subtle) */}
      {completedTasks.length > 0 && totalPending > 0 && (
        <p className="text-[10px] text-muted-foreground pl-5.5">
          + {completedTasks.length} erledigte Aufgabe{completedTasks.length !== 1 ? 'n' : ''}
        </p>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        candidateId={candidateId}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={detailItem}
        onMarkDone={handleMarkDoneFromDialog}
        onSnooze={async (itemId, until) => {
          // Snooze: update snoozed_until on the alert
          const task = tasks.find(t => t.id === itemId);
          if (task) {
            await supabase
              .from('influence_alerts')
              .update({ snoozed_until: until.toISOString() } as any)
              .eq('id', itemId);
            setTasks(prev => prev.filter(t => t.id !== itemId));
            toast.success('Aufgabe zurückgestellt');
          }
        }}
      />
    </div>
  );
}
