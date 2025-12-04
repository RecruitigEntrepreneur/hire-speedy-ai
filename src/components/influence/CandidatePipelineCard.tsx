import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Phone, 
  Mail, 
  BookOpen,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { CandidateBehavior } from '@/hooks/useCandidateBehavior';
import { Link } from 'react-router-dom';

interface CandidatePipelineCardProps {
  submissionId: string;
  candidateName: string;
  candidateEmail?: string;
  candidatePhone?: string;
  jobTitle: string;
  behavior?: CandidateBehavior;
  hasAlerts?: boolean;
  onOpenPlaybook?: () => void;
}

export function CandidatePipelineCard({
  submissionId,
  candidateName,
  candidateEmail,
  candidatePhone,
  jobTitle,
  behavior,
  hasAlerts = false,
  onOpenPlaybook,
}: CandidatePipelineCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${hasAlerts ? 'ring-2 ring-amber-500/50' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{candidateName}</p>
                {hasAlerts && (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                → {jobTitle}
              </p>
            </div>
          </div>

          {/* Scores */}
          {behavior ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Conf</span>
                <span className="font-medium">{behavior.confidence_score}%</span>
              </div>
              <Progress 
                value={behavior.confidence_score} 
                className="h-1.5"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Ready</span>
                <span className="font-medium">{behavior.interview_readiness_score}%</span>
              </div>
              <Progress 
                value={behavior.interview_readiness_score} 
                className="h-1.5"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Close</span>
                <span className="font-medium">{behavior.closing_probability}%</span>
              </div>
              <Progress 
                value={behavior.closing_probability} 
                className="h-1.5"
              />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              Keine Score-Daten
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 pt-2 border-t">
            {candidatePhone && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => window.open(`tel:${candidatePhone}`, '_blank')}
              >
                <Phone className="h-3 w-3" />
              </Button>
            )}
            {candidateEmail && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => window.open(`mailto:${candidateEmail}`, '_blank')}
              >
                <Mail className="h-3 w-3" />
              </Button>
            )}
            {onOpenPlaybook && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={onOpenPlaybook}
              >
                <BookOpen className="h-3 w-3" />
              </Button>
            )}
            <div className="flex-1" />
            <Link to={`/recruiter/jobs/${submissionId}`}>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
