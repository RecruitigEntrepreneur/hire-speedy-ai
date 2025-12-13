import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

interface PipelineBarProps {
  stageCounts: Record<string, number>;
  activeStage: string;
  onStageClick: (stage: string) => void;
  totalCandidates: number;
}

export function PipelineBar({ 
  stageCounts, 
  activeStage, 
  onStageClick,
  totalCandidates 
}: PipelineBarProps) {
  return (
    <div className="flex items-center gap-1 p-2 bg-muted/30 border-b overflow-x-auto">
      {/* All filter */}
      <button
        onClick={() => onStageClick('all')}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm whitespace-nowrap",
          activeStage === 'all' 
            ? "bg-background shadow-sm border font-medium" 
            : "hover:bg-background/50 text-muted-foreground"
        )}
      >
        Alle
        <Badge 
          variant={activeStage === 'all' ? 'default' : 'secondary'} 
          className="text-[10px] h-5 px-1.5"
        >
          {totalCandidates}
        </Badge>
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Stage buttons */}
      {PIPELINE_STAGES.map((stage, index) => {
        const count = stageCounts[stage.key] || 0;
        const isActive = activeStage === stage.key;
        
        return (
          <div key={stage.key} className="flex items-center">
            <button
              onClick={() => onStageClick(stage.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm whitespace-nowrap",
                isActive 
                  ? "bg-background shadow-sm border font-medium" 
                  : "hover:bg-background/50 text-muted-foreground"
              )}
            >
              {stage.label}
              {count > 0 && (
                <Badge 
                  variant={isActive ? 'default' : 'secondary'}
                  className={cn(
                    "text-[10px] h-5 px-1.5",
                    stage.key === 'submitted' && count > 0 && "bg-amber-500 text-white border-amber-500"
                  )}
                >
                  {count}
                </Badge>
              )}
            </button>
            
            {/* Arrow between stages */}
            {index < PIPELINE_STAGES.length - 1 && (
              <div className="text-muted-foreground/40 mx-0.5 text-xs">›</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
