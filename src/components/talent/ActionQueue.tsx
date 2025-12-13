import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Clock, 
  MessageSquare, 
  Eye, 
  AlertTriangle,
  ChevronRight,
  UserPlus,
  Video
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, differenceInHours } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface ActionItem {
  id: string;
  type: 'schedule_interview' | 'review_candidate' | 'give_feedback' | 'join_interview' | 'overdue';
  priority: 'urgent' | 'high' | 'normal';
  title: string;
  subtitle: string;
  submissionId: string;
  candidateId: string;
  scheduledAt?: string;
  jobTitle?: string;
  meetingLink?: string;
}

interface ActionQueueProps {
  actions: ActionItem[];
  onSelectAction: (action: ActionItem) => void;
  selectedId?: string;
}

export function ActionQueue({ actions, onSelectAction, selectedId }: ActionQueueProps) {
  const getActionIcon = (type: ActionItem['type']) => {
    switch (type) {
      case 'schedule_interview': return Calendar;
      case 'review_candidate': return Eye;
      case 'give_feedback': return MessageSquare;
      case 'join_interview': return Video;
      case 'overdue': return AlertTriangle;
      default: return Clock;
    }
  };

  const getActionLabel = (type: ActionItem['type']) => {
    switch (type) {
      case 'schedule_interview': return 'Termin planen';
      case 'review_candidate': return 'Prüfen';
      case 'give_feedback': return 'Feedback';
      case 'join_interview': return 'Interview';
      case 'overdue': return 'Überfällig';
      default: return 'Aktion';
    }
  };

  const getPriorityStyles = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'urgent': return 'border-l-destructive bg-destructive/5';
      case 'high': return 'border-l-amber-500 bg-amber-500/5';
      default: return 'border-l-primary bg-primary/5';
    }
  };

  const formatScheduledTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return `Heute, ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `Morgen, ${format(date, 'HH:mm')}`;
    return format(date, 'dd.MM., HH:mm', { locale: de });
  };

  // Group actions by priority
  const urgentActions = actions.filter(a => a.priority === 'urgent');
  const highActions = actions.filter(a => a.priority === 'high');
  const normalActions = actions.filter(a => a.priority === 'normal');

  const renderActionGroup = (title: string, items: ActionItem[], variant: 'destructive' | 'warning' | 'default') => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className={cn(
            "text-xs font-medium uppercase tracking-wider",
            variant === 'destructive' && "text-destructive",
            variant === 'warning' && "text-amber-600",
            variant === 'default' && "text-muted-foreground"
          )}>
            {title}
          </span>
          <Badge 
            variant={variant === 'default' ? 'secondary' : variant === 'warning' ? 'outline' : 'destructive'} 
            className={cn(
              "text-[10px] h-4 px-1.5",
              variant === 'warning' && "border-amber-400 text-amber-600"
            )}
          >
            {items.length}
          </Badge>
        </div>
        {items.map(action => {
          const Icon = getActionIcon(action.type);
          return (
            <button
              key={action.id}
              onClick={() => onSelectAction(action)}
              className={cn(
                "w-full text-left p-3 rounded-lg border-l-4 transition-all",
                "hover:shadow-sm hover:scale-[1.01]",
                getPriorityStyles(action.priority),
                selectedId === action.submissionId && "ring-2 ring-primary ring-offset-1"
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  "mt-0.5 p-1 rounded",
                  action.priority === 'urgent' && "bg-destructive/10 text-destructive",
                  action.priority === 'high' && "bg-amber-500/10 text-amber-600",
                  action.priority === 'normal' && "bg-primary/10 text-primary"
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {getActionLabel(action.type)}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate mt-0.5">
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {action.subtitle}
                  </p>
                  {action.scheduledAt && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatScheduledTime(action.scheduledAt)}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  if (actions.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Aktionen
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-700">Alles erledigt!</p>
            <p className="text-xs text-muted-foreground mt-1">Keine offenen Aktionen</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-3 border-b bg-background">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Aktionen
          <Badge variant="secondary" className="ml-auto">
            {actions.length}
          </Badge>
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {renderActionGroup('Überfällig', urgentActions, 'destructive')}
          {renderActionGroup('Heute', highActions, 'warning')}
          {renderActionGroup('Offen', normalActions, 'default')}
        </div>
      </ScrollArea>
    </div>
  );
}