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
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

interface CandidateTasksSectionProps {
  candidateId: string;
  activeTaskId?: string;
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

export function CandidateTasksSection({ candidateId, activeTaskId }: CandidateTasksSectionProps) {
  const [tasks, setTasks] = useState<CandidateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [contact, setContact] = useState<CandidateContact>({});

  useEffect(() => {
    fetchTasks();
  }, [candidateId]);

  const fetchTasks = async () => {
    try {
      // Load candidate contact info
      const { data: candidate } = await supabase
        .from('candidates')
        .select('email, phone')
        .eq('id', candidateId)
        .single();

      if (candidate) {
        setContact({ email: candidate.email, phone: candidate.phone ?? undefined });
      }

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
      // Update submission stage
      const { error: subError } = await supabase
        .from('submissions')
        .update({ stage: 'candidate_opted_in' })
        .eq('id', submissionId);

      if (subError) throw subError;

      // Mark alert as handled
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

  if (loading) {
    return (
      <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between p-3",
          pendingTasks.length > 0 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/30"
        )}
      >
        <div className="flex items-center gap-2">
          {pendingTasks.length > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <Check className="h-4 w-4 text-emerald-600" />
          )}
          <span className="font-medium text-sm">
            {pendingTasks.length > 0 
              ? `${pendingTasks.length} offene Aufgabe${pendingTasks.length !== 1 ? 'n' : ''}`
              : 'Alle Aufgaben erledigt'
            }
          </span>
          {pendingTasks.filter(t => t.priority === 'critical').length > 0 && (
            <Badge variant="destructive" className="text-xs h-5">
              {pendingTasks.filter(t => t.priority === 'critical').length} kritisch
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
        <div className="divide-y">
          {pendingTasks.map(task => {
            const config = priorityConfig[task.priority];
            const Icon = config.icon;
            const isActive = task.id === activeTaskId;
            const isOptInPending = task.alert_type === 'opt_in_pending';

            return (
              <div 
                key={task.id}
                className={cn(
                  "p-3 flex flex-col gap-2 transition-colors",
                  isActive 
                    ? "ring-2 ring-primary bg-primary/5" 
                    : "hover:bg-accent/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-1.5 rounded", config.bgColor)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {task.recommended_action}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 ml-10 flex-wrap">
                  {isOptInPending && contact.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      asChild
                    >
                      <a href={`tel:${contact.phone}`}>
                        <Phone className="h-3 w-3 mr-1" />
                        Anrufen
                      </a>
                    </Button>
                  )}
                  {isOptInPending && contact.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      asChild
                    >
                      <a href={`mailto:${contact.email}`}>
                        <Mail className="h-3 w-3 mr-1" />
                        Email
                      </a>
                    </Button>
                  )}
                  {isOptInPending && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleConfirmOptIn(task.id, task.submission_id)}
                    >
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Opt-In bestätigen
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleMarkDone(task.id)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Erledigt
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Completed tasks (collapsed) */}
          {completedTasks.length > 0 && (
            <div className="p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                {completedTasks.length} erledigte Aufgabe{completedTasks.length !== 1 ? 'n' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
