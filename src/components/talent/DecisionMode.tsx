import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DecisionCard, DecisionCandidate } from './DecisionCard';
import { 
  X as XIcon, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DecisionModeProps {
  candidates: DecisionCandidate[];
  onInterview: (submissionId: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

export function DecisionMode({ 
  candidates, 
  onInterview, 
  onReject,
  isProcessing 
}: DecisionModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [showKeyboardHint, setShowKeyboardHint] = useState(true);

  // Sort candidates: "submitted" first, then by waiting time > 48h, then by match score
  const sortedCandidates = [...candidates].sort((a, b) => {
    // Priority 1: submitted stage first
    if (a.hoursInStage >= 48 && b.hoursInStage < 48) return -1;
    if (b.hoursInStage >= 48 && a.hoursInStage < 48) return 1;
    
    // Priority 2: Match score descending
    return (b.matchScore || 0) - (a.matchScore || 0);
  });

  const currentCandidate = sortedCandidates[currentIndex];
  const hasNext = currentIndex < sortedCandidates.length - 1;
  const hasPrev = currentIndex > 0;

  const handleDecision = useCallback((decision: 'interview' | 'reject') => {
    if (!currentCandidate || isProcessing) return;

    setDirection(decision === 'interview' ? 'right' : 'left');
    
    setTimeout(() => {
      if (decision === 'interview') {
        onInterview(currentCandidate.submissionId);
      } else {
        onReject(currentCandidate.submissionId);
      }
      
      // Move to next candidate or stay at same index (list will shrink)
      setDirection(null);
    }, 300);
  }, [currentCandidate, isProcessing, onInterview, onReject]);

  const goNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [hasNext]);

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [hasPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          handleDecision('interview');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleDecision('reject');
          break;
        case 'ArrowUp':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecision, goNext, goPrev]);

  // Hide keyboard hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowKeyboardHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Adjust index if candidates list changes
  useEffect(() => {
    if (currentIndex >= sortedCandidates.length && sortedCandidates.length > 0) {
      setCurrentIndex(sortedCandidates.length - 1);
    }
  }, [sortedCandidates.length, currentIndex]);

  if (sortedCandidates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Alles erledigt!</h3>
          <p className="text-muted-foreground text-sm">
            Keine Kandidaten zum Entscheiden übrig.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Progress Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goPrev}
          disabled={!hasPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground font-medium">
          Kandidat {currentIndex + 1} von {sortedCandidates.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goNext}
          disabled={!hasNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Card Container with Animation */}
      <div 
        className={cn(
          "w-full max-w-lg transition-all duration-300 ease-out",
          direction === 'left' && "-translate-x-full opacity-0 rotate-[-10deg]",
          direction === 'right' && "translate-x-full opacity-0 rotate-[10deg]"
        )}
      >
        <DecisionCard candidate={currentCandidate} isActive />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-6 mt-8">
        <Button
          variant="outline"
          size="lg"
          className="h-14 px-8 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all"
          onClick={() => handleDecision('reject')}
          disabled={isProcessing}
        >
          <XIcon className="h-5 w-5 mr-2" />
          Nein
        </Button>
        
        <Button
          size="lg"
          className="h-14 px-8 bg-primary hover:bg-primary/90 transition-all"
          onClick={() => handleDecision('interview')}
          disabled={isProcessing}
        >
          <Calendar className="h-5 w-5 mr-2" />
          Interview
        </Button>
      </div>

      {/* Keyboard Hint */}
      {showKeyboardHint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <Keyboard className="h-3 w-3" />
          <span>← Nein | Interview →</span>
        </div>
      )}

      {/* Remaining Counter */}
      <div className="absolute bottom-4 right-4 text-sm text-muted-foreground">
        {sortedCandidates.length} noch offen
      </div>
    </div>
  );
}
