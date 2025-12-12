import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PipelineCandidate } from '@/hooks/useHiringPipeline';
import { 
  X, 
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface PipelineCandidateCardProps {
  candidate: PipelineCandidate;
  stage: string;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function PipelineCandidateCard({ 
  candidate, 
  stage,
  onMove, 
  onReject,
  isProcessing 
}: PipelineCandidateCardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'accepted', 'interview', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const getNextStageLabel = (nextStage: string | null) => {
    const labels: Record<string, string> = {
      accepted: 'Shortlist',
      interview: 'Interview',
      offer: 'Angebot',
      hired: 'Eingestellt',
    };
    return nextStage ? labels[nextStage] : null;
  };

  const nextStage = getNextStage(stage);
  const nextStageLabel = getNextStageLabel(nextStage);
  const isUrgent = candidate.hoursInStage >= 24;
  const isWarning = candidate.hoursInStage >= 12 && candidate.hoursInStage < 24;

  const formatSalary = (salary: number | null | undefined) => {
    if (!salary) return null;
    return `${Math.round(salary / 1000)}k`;
  };

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: false, locale: de });
  };

  // Build compact info string
  const infoItems = [
    formatTime(candidate.submittedAt),
    candidate.candidate.experienceYears ? `${candidate.candidate.experienceYears}J` : null,
    formatSalary(candidate.candidate.expectedSalary),
  ].filter(Boolean);

  return (
    <div className={`p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer group ${
      isUrgent ? 'border-destructive/40' : 
      isWarning ? 'border-warning/40' : 
      'border-border/40'
    }`}>
      {/* Main Row */}
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6 text-[10px] shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(candidate.candidate.fullName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <Link 
            to={`/dashboard/candidates/${candidate.id}`}
            className="text-sm font-medium hover:text-primary transition-colors block truncate leading-tight"
          >
            {candidate.candidate.fullName}
          </Link>
          <span className="text-[11px] text-muted-foreground leading-tight">
            {infoItems.join(' · ')}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {candidate.matchScore && (
            <span className="text-xs font-medium text-primary">{candidate.matchScore}%</span>
          )}
          {(isUrgent || isWarning) && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className={`h-3.5 w-3.5 ${isUrgent ? 'text-destructive' : 'text-warning'}`} />
              </TooltipTrigger>
              <TooltipContent>
                {isUrgent ? 'Über 24h ohne Aktion' : 'Über 12h ohne Aktion'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      {stage !== 'hired' && (
        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {nextStage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] flex-1 text-primary hover:text-primary hover:bg-primary/10 px-2"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onMove(candidate.id, nextStage);
              }}
              disabled={isProcessing}
            >
              {nextStageLabel}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onReject(candidate.id);
            }}
            disabled={isProcessing}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
