import { cn } from '@/lib/utils';
import { Star, Phone, Calendar, Gift, UserCheck } from 'lucide-react';

const CANDIDATE_STAGES = [
  { key: 'new', label: 'Neu', icon: Star },
  { key: 'contacted', label: 'Kontaktiert', icon: Phone },
  { key: 'interview', label: 'Interview', icon: Calendar },
  { key: 'offer', label: 'Angebot', icon: Gift },
  { key: 'placed', label: 'Platziert', icon: UserCheck },
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
  const progressPercent = currentIndex >= 0 
    ? (currentIndex / (CANDIDATE_STAGES.length - 1)) * 100 
    : 0;

  // Don't show pipeline for rejected status
  if (currentStage === 'rejected') {
    return null;
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-border" />
        
        {/* Progress line */}
        <div 
          className="absolute top-4 left-[10%] h-0.5 bg-primary transition-all duration-500 ease-out" 
          style={{ width: `${progressPercent * 0.8}%` }}
        />
        
        {CANDIDATE_STAGES.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const StageIcon = stage.icon;

          return (
            <button
              key={stage.key}
              onClick={() => !disabled && onStageChange?.(stage.key)}
              disabled={disabled}
              className={cn(
                "relative z-10 flex flex-col items-center gap-1.5 group transition-transform",
                !disabled && "hover:scale-105",
                isCurrent && "scale-110",
                disabled && "cursor-default"
              )}
            >
              <div 
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isPast && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                  isFuture && "bg-background border-muted-foreground/30 text-muted-foreground",
                  !disabled && isFuture && "group-hover:border-primary/50 group-hover:text-primary/70"
                )}
              >
                <StageIcon className="h-4 w-4" />
              </div>
              <span 
                className={cn(
                  "text-xs font-medium transition-colors",
                  (isPast || isCurrent) ? "text-foreground" : "text-muted-foreground",
                  !disabled && isFuture && "group-hover:text-foreground"
                )}
              >
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
