import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

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
    <div className="flex items-center w-full">
      {CANDIDATE_STAGES.map((stage, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === CANDIDATE_STAGES.length - 1;

        return (
          <div key={stage.key} className="flex items-center flex-1">
            {/* Stage Button */}
            <button
              onClick={() => !disabled && onStageChange?.(stage.key)}
              disabled={disabled}
              className={cn(
                "relative flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 min-w-0",
                isPast && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/10 text-primary ring-2 ring-primary ring-offset-1",
                !isPast && !isCurrent && "bg-muted text-muted-foreground",
                !disabled && "hover:scale-105 cursor-pointer"
              )}
              aria-label={stage.label}
            >
              {isPast && <Check className="h-3 w-3 shrink-0" />}
              <span className="truncate">{stage.label}</span>
            </button>

            {/* Connector Line */}
            {!isLast && (
              <div 
                className={cn(
                  "h-0.5 flex-1 mx-1 min-w-2 transition-colors duration-200",
                  isPast ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
