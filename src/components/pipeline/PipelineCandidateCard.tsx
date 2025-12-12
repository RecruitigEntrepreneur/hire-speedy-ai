import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PipelineCandidate } from '@/hooks/useHiringPipeline';
import { 
  Check, 
  X, 
  Calendar, 
  Gift,
  Clock,
  Euro,
  Briefcase,
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

  return (
    <Card className={`p-3 hover:shadow-md transition-all cursor-pointer group ${
      isUrgent ? 'border-destructive/50 bg-destructive/5' : 
      isWarning ? 'border-warning/50 bg-warning/5' : 
      'border-border/50'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {getInitials(candidate.candidate.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Link 
            to={`/dashboard/candidates/${candidate.id}`}
            className="font-medium text-sm hover:text-primary transition-colors block truncate"
          >
            {candidate.candidate.fullName}
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(candidate.submittedAt), { addSuffix: true, locale: de })}
          </div>
        </div>
        {(isUrgent || isWarning) && (
          <Tooltip>
            <TooltipTrigger>
              <AlertTriangle className={`h-4 w-4 ${isUrgent ? 'text-destructive' : 'text-warning'}`} />
            </TooltipTrigger>
            <TooltipContent>
              {isUrgent ? 'Kritisch: Über 24h ohne Aktion' : 'Warnung: Über 12h ohne Aktion'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Info Row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {candidate.matchScore && (
          <Badge variant="outline" className="text-xs h-5">
            {candidate.matchScore}%
          </Badge>
        )}
        {candidate.candidate.experienceYears && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {candidate.candidate.experienceYears}J
          </span>
        )}
        {candidate.candidate.expectedSalary && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Euro className="h-3 w-3" />
            {Math.round(candidate.candidate.expectedSalary / 1000)}k
          </span>
        )}
      </div>

      {/* Interview Info */}
      {stage === 'interview' && candidate.interviewScheduledAt && (
        <div className="text-xs text-chart-2 flex items-center gap-1 mb-3 bg-chart-2/10 px-2 py-1 rounded">
          <Calendar className="h-3 w-3" />
          {new Date(candidate.interviewScheduledAt).toLocaleDateString('de-DE', { 
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
          })}
        </div>
      )}

      {/* Offer Status */}
      {stage === 'offer' && candidate.offerStatus && (
        <div className="text-xs text-success flex items-center gap-1 mb-3 bg-success/10 px-2 py-1 rounded">
          <Gift className="h-3 w-3" />
          {candidate.offerStatus === 'pending' ? 'Angebot gesendet' : candidate.offerStatus}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {nextStage && stage !== 'hired' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1 text-primary hover:text-primary hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              onMove(candidate.id, nextStage);
            }}
            disabled={isProcessing}
          >
            <ChevronRight className="h-3 w-3 mr-1" />
            {nextStageLabel}
          </Button>
        )}
        {stage !== 'hired' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onReject(candidate.id);
            }}
            disabled={isProcessing}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}
