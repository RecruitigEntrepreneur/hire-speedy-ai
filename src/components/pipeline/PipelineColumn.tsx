import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div className="flex-1 min-w-[200px] max-w-[240px]">
      <div className={`border-t-2 ${stage.color} bg-muted/30 rounded-b-lg`}>
        {/* Slim Header */}
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {stage.label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {candidates.length}
          </span>
        </div>
        
        {/* Candidates */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1.5 px-1.5 pb-2">
            {candidates.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
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
      </div>
    </div>
  );
}

export function PipelineColumnSkeleton() {
  return (
    <div className="flex-1 min-w-[200px] max-w-[240px]">
      <div className="border-t-2 border-muted bg-muted/30 rounded-b-lg">
        <div className="px-2.5 py-2">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-1.5 px-1.5 pb-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
