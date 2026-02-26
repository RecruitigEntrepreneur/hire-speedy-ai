import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Briefcase,
  Calendar,
  ExternalLink,
  Video,
  Clock,
  Shield,
  Unlock,
} from 'lucide-react';
import { formatSimpleAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useRef, useState, useEffect } from 'react';
import { SubmissionDetailDialog } from '@/components/influence/SubmissionDetailDialog';

interface CandidateActiveProcessesProps {
  candidateId: string;
}

// Full stage pipeline for visual display
const STAGE_ORDER = [
  'new',
  'submitted',
  'screening',
  'shortlisted',
  'interview_requested',
  'candidate_opted_in',
  'interview',
  'offer',
  'hired',
] as const;

const STAGE_CONFIG: Record<string, { label: string; shortLabel: string; className: string; dotColor: string }> = {
  new:                  { label: 'Neu',                shortLabel: 'Neu',       className: 'bg-muted text-muted-foreground',                      dotColor: 'bg-muted-foreground' },
  submitted:            { label: 'Eingereicht',        shortLabel: 'Einger.',   className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',     dotColor: 'bg-blue-500' },
  screening:            { label: 'Screening',          shortLabel: 'Screen.',   className: 'bg-violet-500/10 text-violet-600 border-violet-500/20', dotColor: 'bg-violet-500' },
  shortlisted:          { label: 'Shortlisted',        shortLabel: 'Short.',    className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', dotColor: 'bg-indigo-500' },
  interview_requested:  { label: 'Interview angefragt', shortLabel: 'Angefr.',  className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',  dotColor: 'bg-amber-500' },
  candidate_opted_in:   { label: 'Opt-In erteilt',     shortLabel: 'Opt-In',    className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',     dotColor: 'bg-cyan-500' },
  interview:            { label: 'Interview',          shortLabel: 'Interv.',   className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',  dotColor: 'bg-amber-500' },
  interview_scheduled:  { label: 'Interview geplant',  shortLabel: 'Geplant',   className: 'bg-green-500/10 text-green-600 border-green-500/20',  dotColor: 'bg-green-500' },
  interview_counter_proposed: { label: 'Gegenvorschlag', shortLabel: 'Gegen.', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20', dotColor: 'bg-orange-500' },
  interview_declined:   { label: 'Abgelehnt',          shortLabel: 'Abgel.',    className: 'bg-red-500/10 text-red-600 border-red-500/20',        dotColor: 'bg-red-500' },
  client_review:        { label: 'Client Review',      shortLabel: 'Review',    className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', dotColor: 'bg-indigo-500' },
  offer:                { label: 'Angebot',            shortLabel: 'Angebot',   className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dotColor: 'bg-emerald-500' },
  hired:                { label: 'Eingestellt',        shortLabel: 'Eingest.',  className: 'bg-green-500/10 text-green-700 border-green-500/30',  dotColor: 'bg-green-600' },
};

function getStageInfo(stage: string | null) {
  return STAGE_CONFIG[stage || 'new'] || STAGE_CONFIG.new;
}

function getStageIndex(stage: string | null): number {
  const idx = STAGE_ORDER.indexOf((stage || 'new') as any);
  return idx >= 0 ? idx : 0;
}

function formatInterviewCountdown(scheduledAt: string): { text: string; urgent: boolean } {
  const date = new Date(scheduledAt);
  if (isPast(date)) {
    return { text: `Vergangen`, urgent: true };
  }
  if (isToday(date)) {
    return { text: `Heute ${format(date, 'HH:mm')}`, urgent: true };
  }
  if (isTomorrow(date)) {
    return { text: `Morgen ${format(date, 'HH:mm')}`, urgent: false };
  }
  return {
    text: `${format(date, 'EEE d. MMM', { locale: de })}`,
    urgent: false,
  };
}

function MiniStagePipeline({ currentStage }: { currentStage: string | null }) {
  const currentIndex = getStageIndex(currentStage);
  const keyStages = ['submitted', 'screening', 'interview', 'offer', 'hired'];

  return (
    <div className="flex items-center gap-0.5">
      {keyStages.map((stage) => {
        const stageConfig = getStageInfo(stage);
        const stageIdx = getStageIndex(stage);
        const isActive = stage === currentStage || (
          (currentStage?.startsWith('interview') || currentStage === 'candidate_opted_in') && stage === 'interview'
        );
        const isPassed = stageIdx < currentIndex;

        return (
          <Tooltip key={stage}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  isActive ? 'w-5' : 'w-2.5',
                  isActive ? stageConfig.dotColor :
                  isPassed ? 'bg-green-400' :
                  'bg-muted-foreground/20'
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {stageConfig.label}
              {isActive && ' (aktuell)'}
              {isPassed && ' \u2713'}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function TripleBlindBadge({ companyRevealed, identityUnlocked }: { companyRevealed: boolean; identityUnlocked?: boolean }) {
  if (companyRevealed || identityUnlocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Unlock className="h-3 w-3 text-green-500 shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Identitäten freigeschaltet</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Shield className="h-3 w-3 text-muted-foreground shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">Triple-Blind aktiv</TooltipContent>
    </Tooltip>
  );
}

export function CandidateActiveProcesses({ candidateId }: CandidateActiveProcessesProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
    }
  }, []);

  const { data: processes, isLoading } = useQuery({
    queryKey: ['candidate-active-processes', candidateId],
    queryFn: async () => {
      const { data: submissions, error: subError } = await supabase
        .from('submissions')
        .select('id, status, stage, company_revealed, identity_unlocked, job_id, submitted_at')
        .eq('candidate_id', candidateId)
        .not('status', 'in', '("rejected","withdrawn","hired","client_rejected","expired")');

      if (subError) throw subError;
      if (!submissions || submissions.length === 0) return [];

      const jobIds = [...new Set(submissions.map(s => s.job_id))];
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, company_name, industry')
        .in('id', jobIds);

      const submissionIds = submissions.map(s => s.id);
      const { data: interviews } = await supabase
        .from('interviews')
        .select('id, submission_id, scheduled_at, status, meeting_link, meeting_type, teams_join_url, google_meet_link, meeting_format, duration_minutes')
        .in('submission_id', submissionIds)
        .in('status', ['scheduled', 'pending_response'])
        .order('scheduled_at', { ascending: true });

      const jobMap = new Map((jobs || []).map(j => [j.id, j]));
      const interviewMap = new Map<string, (typeof interviews extends (infer T)[] | null ? T : never)[]>();
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
        interviewCount: interviewMap.get(sub.id)?.length || 0,
      }));
    },
  });

  // Submission detail dialog
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openSubmissionDialog = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setDialogOpen(true);
  };

  // Re-check scroll after data loads
  useEffect(() => {
    if (processes) {
      setTimeout(checkScroll, 50);
    }
  }, [processes]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Aktive Prozesse
          </span>
        </div>
        <div className="flex gap-2">
          <div className="h-[88px] w-52 bg-muted/30 rounded-lg animate-pulse shrink-0" />
          <div className="h-[88px] w-52 bg-muted/30 rounded-lg animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  if (!processes || processes.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Aktive Prozesse
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-5.5">Keine aktiven Prozesse</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Aktive Prozesse ({processes.length})
        </span>
      </div>

      {/* Horizontal scroll container */}
      <div className="relative">
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none rounded-l-lg" />
        )}
        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none rounded-r-lg" />
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {processes.map((process) => {
            const stageInfo = getStageInfo(process.stage);
            const companyRevealed = !!(process as any).company_revealed;
            const identityUnlocked = !!(process as any).identity_unlocked;

            const companyName = process.job
              ? companyRevealed
                ? process.job.company_name
                : formatSimpleAnonymousCompany(process.job.industry)
              : 'Unbekannt';

            const meetingLink = process.nextInterview?.teams_join_url
              || process.nextInterview?.google_meet_link
              || process.nextInterview?.meeting_link;

            const interviewInfo = process.nextInterview?.scheduled_at
              ? formatInterviewCountdown(process.nextInterview.scheduled_at)
              : null;

            const isAwaitingOptIn = process.stage === 'interview_requested';
            const timeSinceSubmission = process.submitted_at
              ? formatDistanceToNow(new Date(process.submitted_at), { locale: de, addSuffix: true })
              : null;

            return (
              <div
                key={process.id}
                onClick={() => openSubmissionDialog(process.id)}
                className={cn(
                  'shrink-0 w-52 rounded-lg border p-2.5 transition-all hover:shadow-sm group cursor-pointer',
                  isAwaitingOptIn && 'border-amber-500/30 bg-amber-500/5',
                  interviewInfo?.urgent && 'border-primary/30 bg-primary/5',
                  !isAwaitingOptIn && !interviewInfo?.urgent && 'hover:border-muted-foreground/30'
                )}
              >
                {/* Row 1: Company + icons */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <TripleBlindBadge
                    companyRevealed={companyRevealed}
                    identityUnlocked={identityUnlocked}
                  />
                  <span className="text-xs font-medium truncate flex-1">{companyName}</span>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {meetingLink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); window.open(meetingLink, '_blank'); }}
                      >
                        <Video className="h-3 w-3 text-primary" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => { e.stopPropagation(); navigate(`/recruiter/jobs/${process.job_id}`); }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Row 2: Job title */}
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {process.job?.title || 'Unbekannte Stelle'}
                </p>

                {/* Row 3: Stage pipeline */}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <MiniStagePipeline currentStage={process.stage} />
                  <Badge
                    variant="outline"
                    className={cn('shrink-0 text-[9px] px-1.5 py-0 leading-4', stageInfo.className)}
                  >
                    {stageInfo.shortLabel}
                  </Badge>
                </div>

                {/* Row 4: Contextual info */}
                <div className="mt-1.5 text-[10px] text-muted-foreground truncate">
                  {interviewInfo && (
                    <span className={cn(
                      'inline-flex items-center gap-1 font-medium',
                      interviewInfo.urgent ? 'text-primary' : 'text-foreground'
                    )}>
                      <Calendar className="h-2.5 w-2.5" />
                      {interviewInfo.text}
                    </span>
                  )}

                  {isAwaitingOptIn && !interviewInfo && (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <Clock className="h-2.5 w-2.5" />
                      Wartet auf Opt-In
                    </span>
                  )}

                  {!interviewInfo && !isAwaitingOptIn && timeSinceSubmission && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {timeSinceSubmission}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission Detail Dialog */}
      <SubmissionDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        submissionId={selectedSubmissionId}
      />
    </div>
  );
}
