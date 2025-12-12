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
  const hasNoCandidates = candidates.length === 0;
  
  return (
    <div className="flex-1 min-w-[180px] max-w-[220px]">
      <div className={`border-t-2 ${stage.color} bg-muted/20 rounded-b-lg`}>
        {/* Slim Header */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {stage.label}
          </span>
          <span className={`text-xs tabular-nums font-medium ${candidates.length > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>
            {candidates.length}
          </span>
        </div>
        
        {/* Candidates - Dynamic Height */}
        <ScrollArea className={hasNoCandidates ? 'h-[120px]' : 'h-[calc(100vh-280px)] min-h-[200px]'}>
          <div className="space-y-1 px-1 pb-1.5">
            {hasNoCandidates ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="text-muted-foreground/40 text-xs">—</div>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Leer</p>
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
