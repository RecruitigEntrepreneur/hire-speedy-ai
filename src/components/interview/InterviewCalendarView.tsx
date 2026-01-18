import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Video, Phone, MapPin, Clock, Calendar } from 'lucide-react';

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

const meetingTypeConfig: Record<string, { gradient: string; iconColor: string; bgColor: string }> = {
  video: { 
    gradient: 'from-blue-500/20 to-blue-600/10', 
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-500/10'
  },
  phone: { 
    gradient: 'from-green-500/20 to-green-600/10', 
    iconColor: 'text-green-600',
    bgColor: 'bg-green-500/10'
  },
  onsite: { 
    gradient: 'from-orange-500/20 to-orange-600/10', 
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-500/10'
  },
  teams: { 
    gradient: 'from-purple-500/20 to-purple-600/10', 
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-500/10'
  },
  meet: { 
    gradient: 'from-red-500/20 to-red-600/10', 
    iconColor: 'text-red-600',
    bgColor: 'bg-red-500/10'
  },
};

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

  const isUrgent = (scheduledAt: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const minutesUntil = differenceInMinutes(scheduled, now);
    return minutesUntil > 0 && minutesUntil <= 30;
  };

  return (
    <div className="grid grid-cols-7 gap-3">
      {weekDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayInterviews = interviewsByDay.get(key) || [];
        const today = isToday(day);

        return (
          <div key={key} className="min-h-[220px]">
            {/* Day Header */}
            <div className={`
              text-center py-3 rounded-t-xl transition-all
              ${today 
                ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20' 
                : 'bg-muted/30 hover:bg-muted/50'
              }
            `}>
              <p className="text-xs font-medium uppercase tracking-wider opacity-80">
                {format(day, 'EEE', { locale: de })}
              </p>
              <p className={`text-xl font-bold ${today ? '' : 'text-foreground'}`}>
                {format(day, 'd')}
              </p>
            </div>

            {/* Interviews */}
            <div className={`
              border border-t-0 rounded-b-xl p-2 space-y-2 min-h-[170px]
              transition-all
              ${today 
                ? 'border-primary/30 bg-gradient-to-b from-primary/5 to-transparent shadow-inner' 
                : 'border-border/50 bg-card/30 hover:bg-card/50'
              }
            `}>
              {dayInterviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50">
                  <Calendar className="h-6 w-6 mb-1 opacity-30" />
                  <p className="text-[10px]">Keine Termine</p>
                </div>
              ) : (
                dayInterviews.map(interview => {
                  const config = meetingTypeConfig[interview.meeting_type || 'video'] || meetingTypeConfig.video;
                  const urgent = isUrgent(interview.scheduled_at!);
                  
                  return (
                    <button
                      key={interview.id}
                      onClick={() => onSelectInterview(interview)}
                      className={`
                        w-full text-left p-2.5 rounded-lg 
                        bg-gradient-to-br ${config.gradient}
                        border border-transparent
                        hover:border-primary/30 hover:shadow-md hover:scale-[1.02]
                        transition-all duration-200
                        ${urgent ? 'ring-2 ring-emerald-500/50 animate-pulse-slow' : ''}
                      `}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`${config.bgColor} ${config.iconColor} p-1 rounded`}>
                          {getMeetingIcon(interview.meeting_type)}
                        </span>
                        <span className={`text-xs font-semibold ${config.iconColor}`}>
                          {format(parseISO(interview.scheduled_at!), 'HH:mm')}
                        </span>
                        {urgent && (
                          <span className="relative flex h-2 w-2 ml-auto">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium truncate text-foreground">
                        {interview.submission.candidate.full_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {interview.submission.job.title}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
