import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Users } from 'lucide-react';
import { getPipelineStageColor, getPipelineStageLabel } from '@/lib/jobPipelineStatus';

interface Submission {
  id: string;
  stage: string;
  status: string | null;
}

interface PipelineSnapshotCardProps {
  jobId: string;
  submissions: Submission[];
  className?: string;
}

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Neu' },
  { key: 'screening', label: 'Prüfung' },
  { key: 'interview', label: 'Interview' },
  { key: 'second_interview', label: '2. Interview' },
  { key: 'offer', label: 'Angebot' },
  { key: 'hired', label: 'Eingestellt' },
];

export function PipelineSnapshotCard({ jobId, submissions, className }: PipelineSnapshotCardProps) {
  const getCountByStage = (stage: string) => {
    return submissions.filter(s => (s.stage || 'submitted') === stage).length;
  };

  const activeSubmissions = submissions.filter(s => !['rejected', 'hired'].includes(s.stage || ''));
  const totalActive = activeSubmissions.length;
  const maxStageCount = Math.max(...PIPELINE_STAGES.map(s => getCountByStage(s.key)), 1);

  // Calculate progress percentage
  const hiredCount = getCountByStage('hired');
  const offerCount = getCountByStage('offer');
  const interviewCount = getCountByStage('interview') + getCountByStage('second_interview');
  
  let progressPercentage = 0;
  if (hiredCount > 0) progressPercentage = 100;
  else if (offerCount > 0) progressPercentage = 80;
  else if (interviewCount > 0) progressPercentage = 50;
  else if (submissions.length > 0) progressPercentage = 20;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Pipeline Fortschritt
          </span>
          <Button variant="ghost" size="sm" asChild className="text-xs h-7">
            <Link to={`/dashboard/pipeline?job=${jobId}`}>
              Verwalten
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {hiredCount > 0 
              ? `${hiredCount} eingestellt` 
              : offerCount > 0 
                ? `${offerCount} im Angebot`
                : interviewCount > 0
                  ? `${interviewCount} in Interviews`
                  : `${totalActive} aktive Kandidaten`}
          </p>
        </div>

        {/* Stage Breakdown */}
        <div className="space-y-2">
          {PIPELINE_STAGES.filter(stage => getCountByStage(stage.key) > 0 || stage.key === 'submitted').map((stage) => {
            const count = getCountByStage(stage.key);
            const barWidth = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0;
            
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className="w-20 text-xs text-muted-foreground truncate">
                  {stage.label}
                </div>
                <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full ${getPipelineStageColor(stage.key)} transition-all duration-500 rounded-full`}
                    style={{ width: `${barWidth}%` }}
                  />
                  {count > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Gesamt:</span>
            <span className="font-medium">{submissions.length} Kandidaten</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Abgelehnt:</span>
            <span className="font-medium">{submissions.filter(s => s.stage === 'rejected').length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
