import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  AlertTriangle, 
  Check, 
  Clock,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  ShieldCheck,
  Info,
  FileText,
  MessageSquare,
  Edit,
  Upload,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';

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
  },
  high: { 
    icon: AlertTriangle, 
    label: 'Hoch', 
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
  },
  medium: { 
    icon: Clock, 
    label: 'Mittel', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
  },
  low: { 
    icon: Clock, 
    label: 'Normal', 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
};

// Fields covered by CV upload - don't show individually if CV is missing
const CV_FIELDS = ['Skills', 'Erfahrung', 'CV Summary', 'CV Highlights'];
// Fields covered by Interview - don't show individually if interview is missing
const INTERVIEW_FIELDS = ['Gehalt', 'Verfügbarkeit', 'Wechselmotivation'];
// Profile/Stammdaten fields - shown as individual edit tasks
const PROFILE_FIELDS = ['Name', 'E-Mail', 'Telefon', 'Jobtitel', 'Standort'];

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

  // 1. CV missing → one big task
  if (!hasCv) {
    tasks.push({
      id: 'expose-cv',
      title: 'CV hochladen und analysieren lassen',
      description: 'Skills, Erfahrung und Zusammenfassung werden automatisch aus dem CV extrahiert.',
      actions: ['cv_upload'],
    });
  }

  // 2. Interview missing → one big task
  if (!hasInterview) {
    tasks.push({
      id: 'expose-interview',
      title: 'Interview durchführen',
      description: 'Gehaltsvorstellung, Wechselmotivation und Verfügbarkeit werden im Interview erfasst.',
      actions: ['interview', 'call'],
    });
  }

  // 3. Residual fields (only if CV/Interview exist but fields still missing)
  const residual = missing.filter(f => {
    if (!hasCv && CV_FIELDS.includes(f)) return false;
    if (!hasInterview && INTERVIEW_FIELDS.includes(f)) return false;
    return true;
  });

  const fieldTaskMap: Record<string, { title: string; description: string; actions: ExposeTask['actions'] }> = {
    // Stammdaten
    'Name': { title: 'Name eintragen', description: 'Der Name des Kandidaten fehlt.', actions: ['edit'] },
    'E-Mail': { title: 'E-Mail eintragen', description: 'E-Mail-Adresse des Kandidaten fehlt.', actions: ['edit'] },
    'Telefon': { title: 'Telefonnummer eintragen', description: 'Telefonnummer des Kandidaten fehlt.', actions: ['edit'] },
    'Jobtitel': { title: 'Jobtitel eintragen', description: 'Aktuelle Position/Jobtitel fehlt.', actions: ['edit'] },
    'Standort': { title: 'Standort eintragen', description: 'Stadt/Standort des Kandidaten fehlt.', actions: ['edit'] },
    // CV residual
    'Gehalt': { title: 'Gehaltsvorstellung erfragen', description: 'Für das Exposé wird eine Gehaltsvorstellung benötigt.', actions: ['call', 'edit'] },
    'Verfügbarkeit': { title: 'Verfügbarkeit klären', description: 'Verfügbarkeitsdatum oder Kündigungsfrist eintragen.', actions: ['call', 'edit'] },
    'Skills': { title: 'Skills ergänzen (mind. 3)', description: 'Mindestens 3 Skills werden für das Exposé benötigt.', actions: ['edit'] },
    'Erfahrung': { title: 'Berufserfahrung eintragen', description: 'Erfahrungsjahre für das Exposé eintragen.', actions: ['edit'] },
    'CV Summary': { title: 'CV hochladen', description: 'CV-Zusammenfassung fehlt.', actions: ['cv_upload'] },
    'CV Highlights': { title: 'CV hochladen', description: 'CV-Highlights fehlen.', actions: ['cv_upload'] },
    // Interview residual
    'Wechselmotivation': { title: 'Wechselmotivation erfragen', description: 'Warum will der Kandidat wechseln?', actions: ['call', 'interview'] },
  };

  for (const field of residual) {
    const config = fieldTaskMap[field];
    if (config) {
      // Avoid duplicate CV tasks
      if (tasks.some(t => t.id === `expose-residual-${field}` || (config.actions.includes('cv_upload') && tasks.some(t2 => t2.id.startsWith('expose-residual') && t2.actions.includes('cv_upload'))))) continue;
      tasks.push({ id: `expose-residual-${field}`, ...config });
    }
  }

  return tasks;
}

export function CandidateTasksSection({ candidateId, activeTaskId, candidate, onEdit, onCvUpload, onStartInterview }: CandidateTasksSectionProps) {
  const [tasks, setTasks] = useState<CandidateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [contact, setContact] = useState<CandidateContact>({});
  const [hasInterview, setHasInterview] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [candidateId]);

  const fetchTasks = async () => {
    try {
      // Load candidate contact info
      const { data: candidateData } = await supabase
        .from('candidates')
        .select('email, phone')
        .eq('id', candidateId)
        .single();

      if (candidateData) {
        setContact({ email: candidateData.email, phone: candidateData.phone ?? undefined });
      }

      // Check if interview notes exist
      const { count } = await supabase
        .from('candidate_interview_notes')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', candidateId);

      setHasInterview((count ?? 0) > 0);

      // Get all submissions for this candidate
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('candidate_id', candidateId);

      if (!submissions || submissions.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const submissionIds = submissions.map(s => s.id);

      // Get alerts for these submissions
      const { data: alerts, error } = await supabase
        .from('influence_alerts')
        .select('*')
        .in('submission_id', submissionIds)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks((alerts || []) as unknown as CandidateTask[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (taskId: string) => {
    try {
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
      toast.success('Aufgabe als erledigt markiert');
    } catch (error) {
      console.error('Error marking task done:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleConfirmOptIn = async (taskId: string, submissionId: string) => {
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
      toast.success('Opt-In bestätigt – Kunde wird benachrichtigt');
    } catch (error) {
      console.error('Error confirming opt-in:', error);
      toast.error('Fehler beim Bestätigen');
    }
  };

  const pendingTasks = tasks.filter(t => !t.action_taken);
  const completedTasks = tasks.filter(t => t.action_taken);
  const exposeTasks = buildExposeTasks(candidate, hasInterview);

  const totalPending = pendingTasks.length + exposeTasks.length;

  if (loading) {
    return (
      <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
    );
  }

  if (tasks.length === 0 && exposeTasks.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between p-3",
          totalPending > 0 ? "bg-amber-500/10" : "bg-muted/30"
        )}
      >
        <div className="flex items-center gap-2">
          {totalPending > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <Check className="h-4 w-4 text-emerald-600" />
          )}
          <span className="font-medium text-sm">
            {totalPending > 0 
              ? `${totalPending} offene Aufgabe${totalPending !== 1 ? 'n' : ''}`
              : 'Alle Aufgaben erledigt'
            }
          </span>
          {pendingTasks.filter(t => t.priority === 'critical').length > 0 && (
            <Badge variant="destructive" className="text-xs h-5">
              {pendingTasks.filter(t => t.priority === 'critical').length} kritisch
            </Badge>
          )}
          {exposeTasks.length > 0 && (
            <Badge variant="outline" className="text-xs h-5 text-blue-600 border-blue-500/50">
              Exposé
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Task list */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Grid of all tasks */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {/* DB-based tasks (Influence Alerts) */}
            {pendingTasks.map(task => {
              const config = priorityConfig[task.priority];
              const Icon = config.icon;
              const isActive = task.id === activeTaskId;
              const isOptInPending = task.alert_type === 'opt_in_pending';

              return (
                <div 
                  key={task.id}
                  className={cn(
                    "border rounded-lg p-2.5 flex flex-col justify-between min-h-[88px] transition-colors",
                    isActive 
                      ? "ring-2 ring-primary bg-primary/5" 
                      : task.priority === 'critical'
                        ? "border-l-2 border-l-amber-500 bg-amber-500/5"
                        : "border-border bg-card hover:bg-accent/50"
                  )}
                >
                  {/* Row 1: Badge + Done */}
                  <div className="flex items-center justify-between gap-1">
                    <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", config.bgColor, config.color)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
                          onClick={() => handleMarkDone(task.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Erledigt</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Row 2: Title */}
                  <p className="font-medium text-sm truncate mt-1">{task.title}</p>

                  {/* Row 3: Actions */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {isOptInPending && contact.phone && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a href={`tel:${contact.phone}`}>
                              <Phone className="h-3 w-3" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Anrufen</TooltipContent>
                      </Tooltip>
                    )}
                    {isOptInPending && contact.email && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a href={`mailto:${contact.email}`}>
                              <Mail className="h-3 w-3" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Email</TooltipContent>
                      </Tooltip>
                    )}
                    {isOptInPending && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => handleConfirmOptIn(task.id, task.submission_id)}
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Opt-In
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Exposé-critical pseudo-tasks */}
            {exposeTasks.map(task => (
              <div key={task.id} className="border rounded-lg p-2.5 flex flex-col justify-between min-h-[88px] border-l-2 border-l-blue-500 bg-blue-500/5 hover:bg-accent/50 transition-colors">
                {/* Row 1: Exposé badge */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600">
                    <Info className="h-3 w-3" />
                    Exposé
                  </div>
                </div>

                {/* Row 2: Title */}
                <p className="font-medium text-sm truncate mt-1">{task.title}</p>

                {/* Row 3: Actions */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {task.actions.includes('call') && (candidate?.phone || contact.phone) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                          <a href={`tel:${candidate?.phone || contact.phone}`}>
                            <Phone className="h-3 w-3" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Anrufen</TooltipContent>
                    </Tooltip>
                  )}
                  {task.actions.includes('cv_upload') && onCvUpload && (
                    <Button variant="default" size="sm" className="h-6 text-[10px] px-2" onClick={onCvUpload}>
                      <Upload className="h-3 w-3 mr-1" />
                      CV
                    </Button>
                  )}
                  {task.actions.includes('interview') && onStartInterview && (
                    <Button variant="default" size="sm" className="h-6 text-[10px] px-2" onClick={onStartInterview}>
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Interview
                    </Button>
                  )}
                  {task.actions.includes('edit') && onEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Bearbeiten</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Completed tasks (collapsed) */}
          {completedTasks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {completedTasks.length} erledigte Aufgabe{completedTasks.length !== 1 ? 'n' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
