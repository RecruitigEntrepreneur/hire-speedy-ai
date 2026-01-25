import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const CANDIDATE_STAGES = [
  { key: 'new', label: 'Neu' },
  { key: 'contacted', label: 'Kontaktiert' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Angebot' },
  { key: 'placed', label: 'Platziert' },
];

interface CandidateStagePipelineProps {
  currentStage: string;
  onStageChange?: (stage: string) => void;
  disabled?: boolean;
}

export function CandidateStagePipeline({ 
  currentStage, 
  onStageChange,
  disabled = false 
}: CandidateStagePipelineProps) {
  const currentIndex = CANDIDATE_STAGES.findIndex(s => s.key === currentStage);

  // Don't show pipeline for rejected status
  if (currentStage === 'rejected') {
    return null;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-1.5">
        {CANDIDATE_STAGES.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <Tooltip key={stage.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => !disabled && onStageChange?.(stage.key)}
                  disabled={disabled}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-200",
                    isPast && "bg-primary",
                    isCurrent && "bg-primary ring-2 ring-primary/30 scale-150",
                    !isPast && !isCurrent && "bg-muted-foreground/30",
                    !disabled && "hover:scale-[2] cursor-pointer"
                  )}
                  aria-label={stage.label}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {stage.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
        <span className="ml-1.5 text-xs text-muted-foreground">
          {CANDIDATE_STAGES[currentIndex]?.label || currentStage}
        </span>
      </div>
    </TooltipProvider>
  );
}
