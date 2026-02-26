import { Phone, Mail, Check, Trash2, BookOpen, Lightbulb } from 'lucide-react';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { SnoozeDropdown } from './SnoozeDropdown';

interface TaskCardProps {
  item: UnifiedTaskItem;
  onMarkDone: () => void;
  onSnooze: (until: Date) => void;
  onDelete?: () => void;
  onOpenPlaybook?: () => void;
  onClick?: () => void;
  compact?: boolean;
}

const ALERT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  'opt_in_pending': { label: 'Opt-In', color: 'bg-primary/10 text-primary' },
  'opt_in_pending_24h': { label: 'Opt-In dringend', color: 'bg-destructive/10 text-destructive' },
  'opt_in_pending_48h': { label: 'Opt-In überfällig', color: 'bg-destructive/10 text-destructive' },
  'interview_prep_missing': { label: 'Vorbereitung', color: 'bg-primary/10 text-primary' },
  'interview_reminder': { label: 'Interview', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  'salary_mismatch': { label: 'Gehalt', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  'salary_negotiation': { label: 'Gehalt', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  'ghosting_risk': { label: 'Ghosting', color: 'bg-destructive/10 text-destructive' },
  'engagement_drop': { label: 'Engagement', color: 'bg-primary/10 text-primary' },
  'closing_opportunity': { label: 'Closing', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  'follow_up_needed': { label: 'Follow-up', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  'no_activity': { label: 'Inaktiv', color: 'bg-muted text-muted-foreground' },
  'sla_warning': { label: 'SLA', color: 'bg-destructive/10 text-destructive' },
  'culture_concern': { label: 'Kultur', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  'document_missing': { label: 'Dokument', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  'client_feedback_positive': { label: 'Feedback+', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  'client_feedback_negative': { label: 'Feedback-', color: 'bg-destructive/10 text-destructive' },
  // Manual task types
  'call': { label: 'Anruf', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  'email': { label: 'E-Mail', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  'follow_up': { label: 'Follow-up', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  'meeting': { label: 'Meeting', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  'other': { label: 'Sonstiges', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
};

function getTypeInfo(item: UnifiedTaskItem) {
  if (item.itemType === 'task') {
    const base = ALERT_TYPE_CONFIG[item.taskCategory] || ALERT_TYPE_CONFIG['other'];
    return { label: `Manuell: ${base.label}`, color: base.color };
  }
  return ALERT_TYPE_CONFIG[item.taskCategory] || { label: item.taskCategory, color: 'bg-muted text-muted-foreground' };
}

function getTimeLabel(item: UnifiedTaskItem): string {
  if (item.dueAt) {
    const dueDate = new Date(item.dueAt);
    if (isPast(dueDate)) {
      return formatDistanceToNow(dueDate, { locale: de, addSuffix: false }) + ' überfällig';
    }
    return 'Fällig ' + format(dueDate, 'dd.MM.', { locale: de });
  }
  return formatDistanceToNow(new Date(item.createdAt), { locale: de, addSuffix: false });
}

export function TaskCard({ item, onMarkDone, onSnooze, onDelete, onOpenPlaybook, onClick, compact = false }: TaskCardProps) {
  const isUrgent = item.priority === 'critical';
  const typeInfo = getTypeInfo(item);
  const isManual = item.itemType === 'task';

  return (
    <div
      className={cn(
        'border rounded-lg p-3 flex flex-col gap-2 transition-all cursor-pointer hover:shadow-sm hover:border-primary/30',
        isUrgent
          ? 'border-l-2 border-l-destructive bg-destructive/[0.04]'
          : 'border-border bg-card'
      )}
      onClick={onClick}
    >
      {/* Row 1: Badge + Time + Actions */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge className={cn('text-[10px] font-medium px-1.5 py-0 h-4 border-0 shrink-0', typeInfo.color)}>
            {typeInfo.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {getTimeLabel(item)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={(e) => { e.stopPropagation(); onMarkDone(); }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Erledigt</TooltipContent>
          </Tooltip>
          <SnoozeDropdown onSnooze={onSnooze} />
          {isManual && onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Löschen</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Row 2: Candidate name */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium text-sm truncate">
          {item.candidateName || 'Kein Kandidat'}
        </span>
      </div>

      {/* Row 3: Job @ Company */}
      {(item.jobTitle || item.companyName) && (
        <div className="text-xs text-muted-foreground truncate">
          {item.jobTitle}{item.companyName ? ` · ${item.companyName}` : ''}
        </div>
      )}

      {/* Row 4: Message / Description (the "Warum?" explanation) */}
      {!compact && item.description && (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lightbulb className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
          <span className="line-clamp-2">{item.description}</span>
        </div>
      )}

      {/* Row 5: Playbook link + Contact actions */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1">
          {item.playbookId && onOpenPlaybook && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] text-primary hover:text-primary/80 px-1.5 gap-1"
                  onClick={(e) => { e.stopPropagation(); onOpenPlaybook(); }}
                >
                  <BookOpen className="h-3 w-3" />
                  Playbook
                </Button>
              </TooltipTrigger>
              <TooltipContent>Coaching-Playbook öffnen</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {item.candidatePhone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${item.candidatePhone}`; }}
                >
                  <Phone className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{item.candidatePhone}</TooltipContent>
            </Tooltip>
          )}
          {item.candidateEmail && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${item.candidateEmail}`; }}
                >
                  <Mail className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{item.candidateEmail}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
