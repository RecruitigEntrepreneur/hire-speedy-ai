import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PipelineCandidateCard } from './PipelineCandidateCard';
import { PipelineCandidate, PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

interface PipelineColumnProps {
  stage: typeof PIPELINE_STAGES[number];
  candidates: PipelineCandidate[];
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function PipelineColumn({ 
  stage, 
  candidates, 
  onMove, 
  onReject,
  isProcessing 
}: PipelineColumnProps) {
  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <Card className="h-full border-border/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
            </div>
            <Badge variant="secondary" className="h-5 text-xs">
              {candidates.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <ScrollArea className="h-[calc(100vh-320px)]">
            <div className="space-y-2 pr-2">
              {candidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Keine Kandidaten
                </div>
              ) : (
                candidates.map((candidate) => (
                  <PipelineCandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    stage={stage.key}
                    onMove={onMove}
                    onReject={onReject}
                    isProcessing={isProcessing}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export function PipelineColumnSkeleton() {
  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <Card className="h-full border-border/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
