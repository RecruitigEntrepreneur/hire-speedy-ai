import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Calendar, ExternalLink, Video, FileText } from 'lucide-react';
import { formatSimpleAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface CandidateActiveProcessesProps {
  candidateId: string;
}

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  new: { label: 'Neu', className: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Eingereicht', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  screening: { label: 'Screening', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  interview: { label: 'Interview', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  offer: { label: 'Angebot', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  candidate_opted_in: { label: 'Opt-In', className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
  client_review: { label: 'Client Review', className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
};

function getStageInfo(stage: string | null) {
  return STAGE_CONFIG[stage || 'new'] || STAGE_CONFIG.new;
}

function formatInterviewCountdown(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  if (isToday(date)) {
    return `Heute um ${format(date, 'HH:mm')}`;
  }
  if (isTomorrow(date)) {
    return `Morgen um ${format(date, 'HH:mm')}`;
  }
  return `${format(date, 'd. MMM HH:mm', { locale: de })} (${formatDistanceToNow(date, { locale: de, addSuffix: true })})`;
}

export function CandidateActiveProcesses({ candidateId }: CandidateActiveProcessesProps) {
  const { data: processes, isLoading } = useQuery({
    queryKey: ['candidate-active-processes', candidateId],
    queryFn: async () => {
      // Fetch active submissions with job info
      const { data: submissions, error: subError } = await supabase
        .from('submissions')
        .select('id, status, stage, company_revealed, job_id, submitted_at')
        .eq('candidate_id', candidateId)
        .not('status', 'in', '("rejected","withdrawn","hired","client_rejected","expired")');

      if (subError) throw subError;
      if (!submissions || submissions.length === 0) return [];

      // Fetch jobs for these submissions
      const jobIds = [...new Set(submissions.map(s => s.job_id))];
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, company_name, industry')
        .in('id', jobIds);

      // Fetch upcoming interviews for these submissions
      const submissionIds = submissions.map(s => s.id);
      const { data: interviews } = await supabase
        .from('interviews')
        .select('id, submission_id, scheduled_at, status, meeting_link, meeting_type, teams_join_url, google_meet_link')
        .in('submission_id', submissionIds)
        .in('status', ['scheduled', 'pending_response'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });

      const jobMap = new Map((jobs || []).map(j => [j.id, j]));
      const interviewMap = new Map<string, typeof interviews>();
      (interviews || []).forEach(iv => {
        if (!interviewMap.has(iv.submission_id)) {
          interviewMap.set(iv.submission_id, []);
        }
        interviewMap.get(iv.submission_id)!.push(iv);
      });

      return submissions.map(sub => ({
        ...sub,
        job: jobMap.get(sub.job_id) || null,
        nextInterview: interviewMap.get(sub.id)?.[0] || null,
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Briefcase className="h-3.5 w-3.5 animate-pulse" />
        <span>Lade aktive Prozesse…</span>
      </div>
    );
  }

  if (!processes || processes.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Briefcase className="h-3.5 w-3.5" />
        <span>Keine aktiven Prozesse</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Aktive Prozesse ({processes.length})
        </span>
      </div>

      <div className="space-y-2">
        {processes.map((process) => {
          const stageInfo = getStageInfo(process.stage);
          const companyName = process.job
            ? process.company_revealed
              ? process.job.company_name
              : formatSimpleAnonymousCompany(process.job.industry)
            : 'Unbekannt';

          const meetingLink = process.nextInterview?.teams_join_url
            || process.nextInterview?.google_meet_link
            || process.nextInterview?.meeting_link;

          return (
            <div
              key={process.id}
              className="rounded-lg border bg-card p-3 space-y-2"
            >
              {/* Row 1: Company + Stage */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{companyName}</p>
                  {process.job && (
                    <p className="text-xs text-muted-foreground truncate">{process.job.title}</p>
                  )}
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${stageInfo.className}`}>
                  {stageInfo.label}
                </Badge>
              </div>

              {/* Row 2: Interview info + Actions */}
              <div className="flex items-center justify-between gap-2">
                {process.nextInterview?.scheduled_at ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3 w-3 text-primary" />
                    <span className="font-medium text-primary">
                      {formatInterviewCountdown(process.nextInterview.scheduled_at)}
                    </span>
                    {process.nextInterview.meeting_type && (
                      <span className="text-muted-foreground">
                        · {process.nextInterview.meeting_type}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Kein Interview geplant</span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {meetingLink && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(meetingLink, '_blank')}
                      title="Meeting beitreten"
                    >
                      <Video className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    asChild
                    title="Job öffnen"
                  >
                    <Link to={`/recruiter/jobs/${process.job_id}`}>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
