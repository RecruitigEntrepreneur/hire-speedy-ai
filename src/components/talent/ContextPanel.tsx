import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  Video, 
  AlertTriangle, 
  TrendingUp,
  ChevronRight,
  Users,
  Timer,
  Target
} from 'lucide-react';
import { format, isToday, isTomorrow, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Interview {
  id: string;
  scheduled_at: string | null;
  meeting_link: string | null;
  status: string | null;
  submission: {
    id: string;
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
    };
  };
}

interface ContextPanelProps {
  interviews: Interview[];
  stageCounts: Record<string, number>;
  pendingActions?: {
    feedbackPending: number;
    overdueInterviews: number;
    newSubmissions: number;
  };
  avgTimePerStage?: number;
  conversionRate?: number;
}

export function ContextPanel({ 
  interviews, 
  stageCounts,
  pendingActions = { feedbackPending: 0, overdueInterviews: 0, newSubmissions: 0 },
  avgTimePerStage = 4.2,
  conversionRate = 23
}: ContextPanelProps) {
  const upcomingInterviews = interviews
    .filter(i => i.status !== 'completed' && i.status !== 'cancelled' && i.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 4);

  const pendingInterviews = interviews.filter(
    i => i.status === 'pending' && !i.scheduled_at
  ).slice(0, 3);

  const totalActive = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const hasActions = pendingActions.feedbackPending > 0 || 
                     pendingActions.overdueInterviews > 0 || 
                     pendingActions.newSubmissions > 0 ||
                     pendingInterviews.length > 0;

  const getTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return { label: 'Heute', variant: 'default' as const };
    if (isTomorrow(date)) return { label: 'Morgen', variant: 'secondary' as const };
    return { 
      label: formatDistanceToNow(date, { locale: de, addSuffix: true }), 
      variant: 'outline' as const 
    };
  };

  return (
    <div className="w-80 shrink-0 space-y-4">
      {/* Upcoming Interviews */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Nächste Interviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingInterviews.length === 0 && pendingInterviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Keine anstehenden Interviews
            </p>
          ) : (
            <>
              {upcomingInterviews.map((interview) => {
                const timeInfo = getTimeLabel(interview.scheduled_at!);
                return (
                  <div key={interview.id} className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {interview.submission.candidate.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {interview.submission.job.title}
                        </p>
                      </div>
                      <Badge variant={timeInfo.variant} className="shrink-0 text-xs">
                        {timeInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(interview.scheduled_at!), 'HH:mm')} Uhr
                      </span>
                      {interview.meeting_link && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" asChild>
                          <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer">
                            <Video className="h-3 w-3 mr-1" />
                            Join
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pending scheduling */}
              {pendingInterviews.map((interview) => (
                <div key={interview.id} className="flex items-center justify-between gap-2 py-1.5 border-t border-dashed">
                  <div className="min-w-0">
                    <p className="text-sm truncate text-muted-foreground">
                      {interview.submission.candidate.full_name}
                    </p>
                    <p className="text-xs text-amber-600">Termin ausstehend</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                    Planen
                  </Button>
                </div>
              ))}
            </>
          )}

          {(upcomingInterviews.length > 0 || pendingInterviews.length > 0) && (
            <Link 
              to="/dashboard/calendar" 
              className="text-xs text-primary hover:underline flex items-center gap-1 pt-1"
            >
              Alle Termine anzeigen
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Actions Required */}
      {hasActions && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Aktionen nötig
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingActions.newSubmissions > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Neue Kandidaten</span>
                <Badge variant="secondary">{pendingActions.newSubmissions}</Badge>
              </div>
            )}
            {pendingInterviews.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Termine planen</span>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  {pendingInterviews.length}
                </Badge>
              </div>
            )}
            {pendingActions.feedbackPending > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Feedback ausstehend</span>
                <Badge variant="outline">{pendingActions.feedbackPending}</Badge>
              </div>
            )}
            {pendingActions.overdueInterviews > 0 && (
              <div className="flex items-center justify-between text-sm text-destructive">
                <span>Überfällige Interviews</span>
                <Badge variant="destructive">{pendingActions.overdueInterviews}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Job-Statistiken
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Aktive Kandidaten
            </span>
            <span className="text-sm font-medium">{totalActive}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              Ø Zeit pro Stage
            </span>
            <span className="text-sm font-medium">{avgTimePerStage} Tage</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              Conversion Rate
            </span>
            <span className="text-sm font-medium text-green-600">{conversionRate}%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
