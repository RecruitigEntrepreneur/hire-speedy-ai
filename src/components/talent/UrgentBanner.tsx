import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Calendar, 
  Clock, 
  ChevronDown,
  ChevronUp,
  Video
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface UrgentItem {
  id: string;
  type: 'overdue' | 'interview_today' | 'waiting_long';
  title: string;
  subtitle: string;
  submissionId: string;
  scheduledAt?: string;
  meetingLink?: string;
}

interface UrgentBannerProps {
  items: UrgentItem[];
  onItemClick: (submissionId: string) => void;
}

export function UrgentBanner({ items, onItemClick }: UrgentBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const overdueCount = items.filter(i => i.type === 'overdue').length;
  const interviewsToday = items.filter(i => i.type === 'interview_today').length;
  const waitingLong = items.filter(i => i.type === 'waiting_long').length;

  const getIcon = (type: UrgentItem['type']) => {
    switch (type) {
      case 'overdue': return AlertTriangle;
      case 'interview_today': return Video;
      case 'waiting_long': return Clock;
    }
  };

  return (
    <div className="border-b bg-amber-50/50 dark:bg-amber-950/20">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
      >
        <div className="flex items-center gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="font-medium text-amber-900 dark:text-amber-200">
            {items.length} dringende Aktion{items.length !== 1 ? 'en' : ''}
          </span>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5">
                {overdueCount} überfällig
              </Badge>
            )}
            {interviewsToday > 0 && (
              <Badge className="text-[10px] h-5 bg-blue-500">
                {interviewsToday} Interview{interviewsToday !== 1 ? 's' : ''} heute
              </Badge>
            )}
            {waitingLong > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 border-amber-400 text-amber-700">
                {waitingLong} warten &gt;48h
              </Badge>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {items.slice(0, 5).map(item => {
            const Icon = getIcon(item.type);
            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.submissionId)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                  "hover:bg-background/80",
                  item.type === 'overdue' && "bg-destructive/5",
                  item.type === 'interview_today' && "bg-blue-500/5"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 shrink-0",
                  item.type === 'overdue' && "text-destructive",
                  item.type === 'interview_today' && "text-blue-500",
                  item.type === 'waiting_long' && "text-amber-600"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                </div>
                {item.scheduledAt && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(item.scheduledAt), 'HH:mm', { locale: de })}
                  </span>
                )}
              </button>
            );
          })}
          {items.length > 5 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              +{items.length - 5} weitere
            </p>
          )}
        </div>
      )}
    </div>
  );
}
