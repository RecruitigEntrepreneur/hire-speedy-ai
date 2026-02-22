import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, FileText, UserPlus, ArrowRight, Calendar, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CommunicationLogCardProps {
  job: {
    created_at: string;
    status: string | null;
    paused_at: string | null;
    job_summary?: any | null;
  };
  submissions: {
    id: string;
    submitted_at: string;
    stage: string;
    candidate: { full_name: string };
  }[];
  interviews: {
    id: string;
    scheduled_at: string;
    submission_id: string;
  }[];
  className?: string;
}

interface LogEvent {
  id: string;
  date: Date;
  icon: React.ReactNode;
  label: string;
  type: 'system' | 'recruiter' | 'interview';
}

export function CommunicationLogCard({ job, submissions, interviews, className }: CommunicationLogCardProps) {
  const events: LogEvent[] = [];

  // Job created
  events.push({
    id: 'created',
    date: new Date(job.created_at),
    icon: <FileText className="h-3.5 w-3.5" />,
    label: 'Job erstellt',
    type: 'system',
  });

  // Summary generated
  if (job.job_summary) {
    events.push({
      id: 'summary',
      date: new Date(job.job_summary.generated_at || job.created_at),
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      label: 'Executive Summary generiert',
      type: 'system',
    });
  }

  // Paused
  if (job.paused_at) {
    events.push({
      id: 'paused',
      date: new Date(job.paused_at),
      icon: <Pause className="h-3.5 w-3.5" />,
      label: 'Job pausiert',
      type: 'system',
    });
  }

  // Submissions
  submissions.forEach((sub) => {
    events.push({
      id: `sub-${sub.id}`,
      date: new Date(sub.submitted_at),
      icon: <UserPlus className="h-3.5 w-3.5" />,
      label: `Kandidat eingereicht: ${sub.candidate.full_name.split(' ')[0]}...`,
      type: 'recruiter',
    });
  });

  // Interviews
  interviews.forEach((iv) => {
    events.push({
      id: `iv-${iv.id}`,
      date: new Date(iv.scheduled_at),
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: 'Interview geplant',
      type: 'interview',
    });
  });

  // Sort descending
  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  const typeColors = {
    system: 'text-muted-foreground bg-muted',
    recruiter: 'text-primary bg-primary/10',
    interview: 'text-amber-600 bg-amber-500/10',
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Aktivitäten-Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Noch keine Aktivitäten — sobald Recruiter aktiv werden, sehen Sie hier alle Updates.
          </p>
        ) : (
          <ScrollArea className="h-[240px] pr-3">
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    typeColors[event.type]
                  )}>
                    {event.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(event.date, 'dd. MMM yyyy, HH:mm', { locale: de })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
