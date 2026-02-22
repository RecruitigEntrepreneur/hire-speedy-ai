import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Mic, Send, Calendar, FileEdit, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateActionBarProps {
  onViewExpose: () => void;
  onStartInterview: () => void;
  onSubmitToJob: () => void;
  onEnterNotes?: () => void;
  exposeReady?: boolean;
  currentStatus?: string;
  className?: string;
}

export function CandidateActionBar({ 
  onViewExpose, 
  onStartInterview, 
  onSubmitToJob,
  onEnterNotes,
  exposeReady = false,
  currentStatus = 'new',
  className 
}: CandidateActionBarProps) {
  if (currentStatus === 'placed') {
    return (
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg",
        "lg:left-64",
        className
      )}>
        <div className="container max-w-7xl mx-auto px-4 py-3 flex justify-center">
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-sm py-1.5 px-4">
            <CheckCircle className="h-4 w-4 mr-2" />
            Erfolgreich platziert
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg",
      "lg:left-64",
      className
    )}>
      <div className="container max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3">
          {/* Always show Exposé */}
          <Button
            variant="outline"
            size="sm"
            onClick={onViewExpose}
            disabled={!exposeReady}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Exposé</span>
          </Button>

          {/* Context-dependent primary action */}
          {(currentStatus === 'new' || currentStatus === 'contacted') && (
            <Button
              onClick={onSubmitToJob}
              size="sm"
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Auf Job einreichen</span>
              <span className="sm:hidden">Einreichen</span>
            </Button>
          )}

          {currentStatus === 'new' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartInterview}
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Interview</span>
            </Button>
          )}

          {currentStatus === 'contacted' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartInterview}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Interview planen</span>
              <span className="sm:hidden">Interview</span>
            </Button>
          )}

          {currentStatus === 'interview' && (
            <>
              <Button
                onClick={onEnterNotes || onStartInterview}
                size="sm"
                className="gap-2"
              >
                <FileEdit className="h-4 w-4" />
                <span className="hidden sm:inline">Notizen eintragen</span>
                <span className="sm:hidden">Notizen</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onStartInterview}
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">Interview</span>
              </Button>
            </>
          )}

          {currentStatus === 'offer' && (
            <Button
              onClick={onSubmitToJob}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Angebot verfolgen</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
