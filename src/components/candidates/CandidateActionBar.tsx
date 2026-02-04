import { Button } from '@/components/ui/button';
import { FileText, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateActionBarProps {
  onViewExpose: () => void;
  onStartInterview: () => void;
  onSubmitToJob: () => void;
  exposeReady?: boolean;
  className?: string;
}

export function CandidateActionBar({ 
  onViewExpose, 
  onStartInterview, 
  onSubmitToJob,
  exposeReady = false,
  className 
}: CandidateActionBarProps) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg",
      "lg:left-64", // Account for sidebar on desktop
      className
    )}>
      <div className="container max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={onViewExpose}
            disabled={!exposeReady}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Exposé ansehen</span>
            <span className="sm:hidden">Exposé</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={onStartInterview}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Interview starten</span>
            <span className="sm:hidden">Interview</span>
          </Button>
          
          <Button
            onClick={onSubmitToJob}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Auf Job einreichen</span>
            <span className="sm:hidden">Einreichen</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
