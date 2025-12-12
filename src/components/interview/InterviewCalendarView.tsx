import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Phone, MapPin, Clock } from 'lucide-react';

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  status: string | null;
  meeting_link?: string | null;
  notes?: string | null;
  feedback?: string | null;
  submission: {
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
    };
  };
}

interface InterviewCalendarViewProps {
  interviews: Interview[];
  onSelectInterview: (interview: any) => void;
}

export function InterviewCalendarView({ interviews, onSelectInterview }: InterviewCalendarViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  const interviewsByDay = useMemo(() => {
    const map = new Map<string, Interview[]>();
    
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, []);
    });

    interviews
      .filter(i => i.scheduled_at && i.status !== 'cancelled')
      .forEach(interview => {
        const date = parseISO(interview.scheduled_at!);
        const key = format(date, 'yyyy-MM-dd');
        if (map.has(key)) {
          map.get(key)!.push(interview);
        }
      });

    // Sort interviews by time
    map.forEach((list) => {
      list.sort((a, b) => 
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
      );
    });

    return map;
  }, [interviews, weekDays]);

  const getMeetingIcon = (type: string | null) => {
    switch (type) {
      case 'video': return <Video className="h-3 w-3" />;
      case 'phone': return <Phone className="h-3 w-3" />;
      case 'onsite': return <MapPin className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayInterviews = interviewsByDay.get(key) || [];
        const today = isToday(day);

        return (
          <div key={key} className="min-h-[200px]">
            {/* Day Header */}
            <div className={`text-center py-2 rounded-t-lg ${
              today ? 'bg-primary text-primary-foreground' : 'bg-muted/50'
            }`}>
              <p className="text-xs font-medium">
                {format(day, 'EEE', { locale: de })}
              </p>
              <p className={`text-lg font-bold ${today ? '' : 'text-foreground'}`}>
                {format(day, 'd')}
              </p>
            </div>

            {/* Interviews */}
            <div className={`border border-t-0 rounded-b-lg p-1.5 space-y-1.5 min-h-[160px] ${
              today ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}>
              {dayInterviews.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Keine Termine
                </p>
              ) : (
                dayInterviews.map(interview => (
                  <button
                    key={interview.id}
                    onClick={() => onSelectInterview(interview)}
                    className="w-full text-left p-2 rounded bg-card border border-border/50 hover:border-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      {getMeetingIcon(interview.meeting_type)}
                      <span>{format(parseISO(interview.scheduled_at!), 'HH:mm')}</span>
                      {interview.duration_minutes && (
                        <span>({interview.duration_minutes}min)</span>
                      )}
                    </div>
                    <p className="text-xs font-medium truncate">
                      {interview.submission.candidate.full_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {interview.submission.job.title}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
