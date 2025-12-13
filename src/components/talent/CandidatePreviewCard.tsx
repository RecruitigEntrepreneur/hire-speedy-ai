import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ChevronRight, 
  X, 
  Clock,
  Briefcase,
  MapPin
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

export interface CandidatePreviewCardProps {
  id: string;
  submissionId: string;
  name: string;
  currentRole: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  status: string;
  matchScore: number | null;
  submittedAt: string;
  hoursInStage: number;
  company?: string;
  city?: string;
}

interface CardProps {
  candidate: CandidatePreviewCardProps;
  onSelect: () => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function CandidatePreviewCard({
  candidate,
  onSelect,
  onMove,
  onReject,
  isProcessing
}: CardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageLabel = (stage: string) => {
    return PIPELINE_STAGES.find(s => s.key === stage)?.label || stage;
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const nextStage = getNextStage(candidate.stage);
  const isUrgent = candidate.hoursInStage >= 48;
  const isWarning = candidate.hoursInStage >= 24 && candidate.hoursInStage < 48;

  const getMatchScoreColor = (score: number | null) => {
    if (!score) return '';
    if (score >= 80) return 'bg-green-100 text-green-700 border-green-300';
    if (score >= 60) return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        isUrgent && "border-l-4 border-l-destructive bg-destructive/5",
        isWarning && !isUrgent && "border-l-4 border-l-amber-500 bg-amber-500/5"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Header with Avatar and Match Score */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {getInitials(candidate.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{candidate.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {candidate.currentRole}
              </p>
            </div>
          </div>
          
          {candidate.matchScore && (
            <div className={cn(
              "flex flex-col items-center justify-center w-12 h-12 rounded-lg border text-sm font-bold shrink-0",
              getMatchScoreColor(candidate.matchScore)
            )}>
              <span>{candidate.matchScore}%</span>
              <span className="text-[9px] font-normal opacity-70">Match</span>
            </div>
          )}
        </div>

        {/* Job Info */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="truncate">{candidate.jobTitle}</span>
          </div>
          {candidate.city && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{candidate.city}</span>
            </div>
          )}
        </div>

        {/* Status Row */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-xs">
            {getStageLabel(candidate.stage)}
          </Badge>
          <span className={cn(
            "text-xs flex items-center gap-1",
            isUrgent && "text-destructive font-medium",
            isWarning && "text-amber-600"
          )}>
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de })}
          </span>
        </div>

        {/* Quick Actions (on hover) */}
        {candidate.stage !== 'hired' && (
          <div 
            className="flex items-center gap-2 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {nextStage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => onMove(candidate.submissionId, nextStage)}
                    disabled={isProcessing}
                  >
                    <ChevronRight className="h-3.5 w-3.5 mr-1" />
                    Weiter
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{getStageLabel(nextStage)}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onReject(candidate.submissionId)}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ablehnen</TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>
    </Card>
  );
}