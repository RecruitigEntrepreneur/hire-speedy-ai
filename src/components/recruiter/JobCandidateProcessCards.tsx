import { useRef, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  ExternalLink,
  Clock,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isToday, isTomorrow, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { SubmissionDetailDialog } from '@/components/influence/SubmissionDetailDialog';

// Stage pipeline config (same as CandidateActiveProcesses)
const STAGE_ORDER = [
  'new', 'submitted', 'screening', 'shortlisted',
  'interview_requested', 'candidate_opted_in',
  'interview', 'offer', 'hired',
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
  offer:                { label: 'Angebot',            shortLabel: 'Angebot',   className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dotColor: 'bg-emerald-500' },
  hired:                { label: 'Eingestellt',        shortLabel: 'Eingest.',  className: 'bg-green-500/10 text-green-700 border-green-500/30',  dotColor: 'bg-green-600' },
};

function getStageInfo(stage: string | null) {
  return STAGE_CONFIG[stage || 'submitted'] || STAGE_CONFIG.submitted;
}

function getStageIndex(stage: string | null): number {
  const idx = STAGE_ORDER.indexOf((stage || 'submitted') as any);
  return idx >= 0 ? idx : 1;
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
              {isPassed && ' ✓'}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export interface JobSubmission {
  id: string;
  candidate_id: string;
  status: string;
  stage: string | null;
  submitted_at: string;
  match_score: number | null;
  candidates: {
    full_name: string;
    email: string;
    job_title?: string | null;
  };
}

interface JobCandidateProcessCardsProps {
  submissions: JobSubmission[];
  onOpenSubmitForm: () => void;
}

export function JobCandidateProcessCards({ submissions, onOpenSubmitForm }: JobCandidateProcessCardsProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  useEffect(() => {
    if (submissions.length > 0) {
      setTimeout(checkScroll, 50);
    }
  }, [submissions]);

  if (submissions.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Meine Kandidaten ({submissions.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-foreground"
          onClick={onOpenSubmitForm}
        >
          + Weiteren einreichen
        </Button>
      </div>

      {/* Horizontal scroll container */}
      <div className="relative">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none rounded-l-lg" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-lg" />
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {submissions.map((sub) => {
            const stageInfo = getStageInfo(sub.stage);
            const initials = sub.candidates?.full_name
              ?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
            const timeSince = sub.submitted_at
              ? formatDistanceToNow(new Date(sub.submitted_at), { locale: de, addSuffix: true })
              : null;

            return (
              <div
                key={sub.id}
                onClick={() => { setSelectedSubmissionId(sub.id); setDialogOpen(true); }}
                className={cn(
                  'shrink-0 w-56 rounded-lg border p-2.5 transition-all hover:shadow-sm group cursor-pointer',
                  'hover:border-muted-foreground/30'
                )}
              >
                {/* Row 1: Avatar + Name + Navigate */}
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate flex-1">
                    {sub.candidates?.full_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/recruiter/candidates/${sub.candidate_id}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>

                {/* Row 2: Job title / role */}
                <p className="text-[11px] text-muted-foreground truncate mt-0.5 pl-8">
                  {sub.candidates?.job_title || sub.candidates?.email}
                </p>

                {/* Row 3: Stage pipeline + badge */}
                <div className="flex items-center justify-between gap-2 mt-2 pl-8">
                  <MiniStagePipeline currentStage={sub.stage} />
                  <Badge
                    variant="outline"
                    className={cn('shrink-0 text-[9px] px-1.5 py-0 leading-4', stageInfo.className)}
                  >
                    {stageInfo.shortLabel}
                  </Badge>
                </div>

                {/* Row 4: Time + Match Score */}
                <div className="mt-1.5 pl-8 flex items-center justify-between text-[10px] text-muted-foreground">
                  {timeSince && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {timeSince}
                    </span>
                  )}
                  {sub.match_score != null && (
                    <span className={cn(
                      'font-medium tabular-nums',
                      sub.match_score >= 80 ? 'text-emerald-600' :
                      sub.match_score >= 60 ? 'text-amber-600' : 'text-muted-foreground'
                    )}>
                      {sub.match_score}% Match
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
