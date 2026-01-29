import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, ArrowRight, Clock, Video } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Interview {
  id: string;
  scheduled_at: string;
  status: string;
  submission_id: string;
}

interface Submission {
  id: string;
  candidate: {
    full_name: string;
    seniority: string | null;
  };
}

interface UpcomingInterviewsCardProps {
  interviews: Interview[];
  submissions: Submission[];
  jobTitle?: string;
  onViewInterview: (interview: Interview) => void;
  onViewAll: () => void;
  className?: string;
}

export function UpcomingInterviewsCard({
  interviews,
  submissions,
  jobTitle,
  onViewInterview,
  onViewAll,
  className
}: UpcomingInterviewsCardProps) {
  // Filter to upcoming interviews only, limit to 3
  const upcomingInterviews = interviews
    .filter(i => i.status === 'scheduled' && new Date(i.scheduled_at) > new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 3);

  const getSubmissionForInterview = (interview: Interview) => {
    return submissions.find(s => s.id === interview.submission_id);
  };

  const generateAnonymousId = (submissionId: string): string => {
    const prefix = jobTitle?.slice(0, 2).toUpperCase() || 'XX';
    return `${prefix}-${submissionId.slice(0, 4).toUpperCase()}`;
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Heute';
    if (isTomorrow(date)) return 'Morgen';
    if (isThisWeek(date)) return format(date, 'EEEE', { locale: de });
    return format(date, 'd. MMM', { locale: de });
  };

  const getTimeLabel = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm', { locale: de }) + ' Uhr';
  };

  if (upcomingInterviews.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Nächste Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Keine Interviews geplant</p>
            <p className="text-xs mt-1">Plane Interviews mit Kandidaten aus der Pipeline</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Nächste Interviews
          </span>
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs h-7">
            Kalender
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingInterviews.map((interview) => {
          const submission = getSubmissionForInterview(interview);
          if (!submission) return null;
          
          const anonymousId = generateAnonymousId(submission.id);
          const isTodays = isToday(new Date(interview.scheduled_at));
          
          return (
            <div
              key={interview.id}
              onClick={() => onViewInterview(interview)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm",
                isTodays && "border-primary/30 bg-primary/5"
              )}
            >
              {/* Date/Time */}
              <div className={cn(
                "text-center min-w-[60px] p-2 rounded-lg",
                isTodays ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <p className="text-xs font-medium">
                  {getDateLabel(interview.scheduled_at)}
                </p>
                <p className={cn(
                  "text-sm font-bold",
                  !isTodays && "text-foreground"
                )}>
                  {getTimeLabel(interview.scheduled_at)}
                </p>
              </div>

              {/* Candidate Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {anonymousId.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-mono font-medium text-sm">{anonymousId}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {submission.candidate.seniority || 'Kandidat'}
                </p>
              </div>

              {/* Status */}
              <Badge variant="outline" className="shrink-0 gap-1">
                <Video className="h-3 w-3" />
                Geplant
              </Badge>
            </div>
          );
        })}

        {/* More Interviews Indicator */}
        {interviews.filter(i => i.status === 'scheduled').length > 3 && (
          <p className="text-xs text-center text-muted-foreground">
            +{interviews.filter(i => i.status === 'scheduled').length - 3} weitere geplant
          </p>
        )}
      </CardContent>
    </Card>
  );
}
