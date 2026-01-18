import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InterviewTimerProps {
  formattedTime: string;
  isRunning: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export function InterviewTimer({
  formattedTime,
  isRunning,
  hasStarted,
  hasEnded,
  onStart,
  onPause,
  onResume,
  onEnd,
}: InterviewTimerProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Live indicator */}
      {isRunning && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
          </span>
          <span className="text-xs font-medium text-destructive">LIVE</span>
        </div>
      )}

      {/* Timer display */}
      <div className={cn(
        "font-mono text-lg font-semibold px-3 py-1 rounded-md",
        isRunning ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
      )}>
        ⏱ {formattedTime}
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {!hasStarted && !hasEnded && (
          <Button
            size="sm"
            variant="outline"
            onClick={onStart}
            className="gap-1"
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
        )}

        {hasStarted && !hasEnded && isRunning && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPause}
          >
            <Pause className="h-3.5 w-3.5" />
          </Button>
        )}

        {hasStarted && !hasEnded && !isRunning && (
          <Button
            size="sm"
            variant="outline"
            onClick={onResume}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}

        {hasStarted && !hasEnded && (
          <Button
            size="sm"
            variant="destructive"
            onClick={onEnd}
            className="gap-1"
          >
            <Square className="h-3.5 w-3.5" />
            Beenden
          </Button>
        )}
      </div>
    </div>
  );
}
