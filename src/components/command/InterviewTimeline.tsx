import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Video, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { de } from 'date-fns/locale';

interface Interview {
  id: string;
  scheduled_at: string;
  anonymous_id: string;
  meeting_link?: string;
  status: string;
}

interface InterviewTimelineProps {
  interviews: Interview[];
  maxItems?: number;
}

export function InterviewTimeline({ interviews, maxItems = 3 }: InterviewTimelineProps) {
  if (interviews.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Calendar className="h-4 w-4" />
        <span>Keine Interviews geplant</span>
      </div>
    );
  }

  const displayInterviews = interviews.slice(0, maxItems);

  const getTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return { label: 'Heute', variant: 'destructive' as const };
    }
    if (isTomorrow(date)) {
      return { label: 'Morgen', variant: 'warning' as const };
    }
    return { 
      label: formatDistanceToNow(date, { locale: de, addSuffix: true }),
      variant: 'secondary' as const
    };
  };

  return (
    <div className="space-y-2">
      {displayInterviews.map((interview) => {
        const timeInfo = getTimeLabel(interview.scheduled_at);
        const time = format(new Date(interview.scheduled_at), 'HH:mm', { locale: de });

        return (
          <div 
            key={interview.id}
            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={timeInfo.variant === 'warning' ? 'outline' : timeInfo.variant}
                    className={timeInfo.variant === 'warning' ? 'border-warning text-warning bg-warning/10' : ''}
                  >
                    {timeInfo.label}
                  </Badge>
                  <span className="text-sm font-medium">{time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  mit "{interview.anonymous_id}"
                </p>
              </div>
            </div>

            {interview.meeting_link && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => window.open(interview.meeting_link, '_blank')}
              >
                <Video className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}

      {interviews.length > maxItems && (
        <p className="text-xs text-muted-foreground text-center">
          +{interviews.length - maxItems} weitere Interviews
        </p>
      )}
    </div>
  );
}
