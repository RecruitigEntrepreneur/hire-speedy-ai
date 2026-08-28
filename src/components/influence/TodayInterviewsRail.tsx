import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarClock, ArrowUpRight, Video, Phone, MapPin, AlertTriangle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecruiterInterviewAgenda } from '@/hooks/useRecruiterInterviewAgenda';
import { cn } from '@/lib/utils';

function typeIcon(type: string | null) {
  if (type === 'phone') return <Phone className="h-3 w-3" />;
  if (type === 'onsite' || type === 'in_person') return <MapPin className="h-3 w-3" />;
  return <Video className="h-3 w-3" />;
}

/**
 * Kompakte Tages-Agenda für die Aufgaben-Sidebar: heutige (sonst nächste)
 * Interviews + Debrief-Zähler, verlinkt auf /recruiter/interviews.
 */
export function TodayInterviewsRail() {
  const navigate = useNavigate();
  const { data: agenda, isLoading } = useRecruiterInterviewAgenda();

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayDay = agenda?.agendaDays.find((d) => d.key === todayKey);
  // Fallback: wenn heute nichts ansteht, den nächsten Tag mit Terminen zeigen
  const shownDay = todayDay ?? agenda?.agendaDays[0] ?? null;
  const shownItems = shownDay?.items.slice(0, 3) ?? [];
  const moreCount = (shownDay?.items.length ?? 0) - shownItems.length;
  const debriefCount = agenda?.debriefDue.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Interviews
          </span>
          <Link
            to="/recruiter/interviews"
            className="text-xs font-normal text-muted-foreground hover:text-primary flex items-center gap-0.5"
          >
            Alle
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            {debriefCount > 0 && (
              <Link
                to="/recruiter/interviews"
                className="flex items-center gap-2 p-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/10 transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-medium">
                  {debriefCount} Debrief{debriefCount > 1 ? 's' : ''} fällig
                </span>
              </Link>
            )}

            {shownItems.length === 0 && debriefCount === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                Keine anstehenden Interviews.
              </p>
            )}

            {shownDay && shownItems.length > 0 && (
              <>
                {!todayDay && (
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {shownDay.label}
                  </p>
                )}
                {shownItems.map((iv) => (
                  <div
                    key={iv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/recruiter/submissions/${iv.submissionId}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(`/recruiter/submissions/${iv.submissionId}`);
                    }}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-semibold tabular-nums w-9 shrink-0">
                      {iv.scheduledAt ? format(new Date(iv.scheduledAt), 'HH:mm') : '–'}
                    </span>
                    <span className="text-muted-foreground shrink-0">{typeIcon(iv.meetingType)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{iv.candidateName}</p>
                      <p className={cn('text-[10px] text-muted-foreground truncate flex items-center gap-1')}>
                        <span className="truncate">{iv.jobTitle}</span>
                        {!iv.companyRevealed && <Lock className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                      </p>
                    </div>
                    {!iv.confirmed && (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1 border-amber-500/50 text-amber-600 dark:text-amber-400 shrink-0"
                      >
                        offen
                      </Badge>
                    )}
                  </div>
                ))}
                {moreCount > 0 && (
                  <Link
                    to="/recruiter/interviews"
                    className="block text-[11px] text-muted-foreground hover:text-primary pl-1"
                  >
                    +{moreCount} weitere
                  </Link>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
