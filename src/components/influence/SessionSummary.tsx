import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  SkipForward,
  Clock,
  Timer,
  Trophy,
  ArrowLeft,
  Play,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecruiterInfluenceScore } from '@/hooks/useRecruiterInfluenceScore';
import { SessionOutcome } from '@/hooks/useActionSession';

interface SessionSummaryProps {
  session: {
    outcomes: SessionOutcome[];
    completedCount: number;
    skippedCount: number;
    snoozedCount: number;
    totalDuration: number;
    queueLength: number;
    isFinished: boolean;
  };
  score: RecruiterInfluenceScore | null;
  onClose: () => void;
  onNewSession: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function getOutcomeIcon(action: SessionOutcome['action']) {
  switch (action) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case 'skipped':
      return <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'snoozed':
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
  }
}

function getOutcomeLabel(action: SessionOutcome['action']): string {
  switch (action) {
    case 'completed': return 'Erledigt';
    case 'skipped': return 'Übersprungen';
    case 'snoozed': return 'Gesnoozed';
  }
}

export function SessionSummary({
  session,
  score,
  onClose,
  onNewSession,
}: SessionSummaryProps) {
  const { outcomes, completedCount, skippedCount, snoozedCount, totalDuration, queueLength } = session;
  const completionRate = queueLength > 0 ? Math.round((completedCount / queueLength) * 100) : 0;
  const avgDuration = outcomes.length > 0 ? Math.round(totalDuration / outcomes.length) : 0;

  return (
    <Dialog open={session.isFinished} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            Session abgeschlossen
          </DialogTitle>
        </DialogHeader>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Erledigt</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{skippedCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Übersprungen</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-amber-500">{snoozedCount}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Gesnoozed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{formatDuration(totalDuration)}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Dauer</div>
            </CardContent>
          </Card>
        </div>

        {/* Completion Rate + Avg Duration */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-sm">
            <Zap className={cn('h-4 w-4', completionRate >= 70 ? 'text-emerald-500' : 'text-muted-foreground')} />
            <span className="text-muted-foreground">Erledigungsrate:</span>
            <span className="font-medium">{completionRate}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ø pro Aufgabe:</span>
            <span className="font-medium">{formatDuration(avgDuration)}</span>
          </div>
        </div>

        {/* Influence Score */}
        {score && (
          <Card className="bg-primary/[0.03] border-primary/20">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-medium">Influence Score</div>
                  <div className="text-xs text-muted-foreground">
                    {score.alerts_actioned} Aufgaben insgesamt erledigt
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-primary">
                {score.influence_score}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outcome List */}
        {outcomes.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              Aufgaben
            </div>
            {outcomes.map((outcome, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 text-sm"
              >
                {getOutcomeIcon(outcome.action)}
                <div className="flex-1 min-w-0">
                  <span className="truncate block">
                    {outcome.item.candidateName || outcome.item.title}
                  </span>
                  {outcome.note && (
                    <span className="text-xs text-muted-foreground truncate block">
                      📝 {outcome.note}
                    </span>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] shrink-0',
                    outcome.action === 'completed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                    outcome.action === 'snoozed' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}
                >
                  {getOutcomeLabel(outcome.action)}
                </Badge>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDuration(outcome.duration)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" className="flex-1 gap-1.5" onClick={onClose}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zu Aufgaben
          </Button>
          <Button className="flex-1 gap-1.5" onClick={onNewSession}>
            <Play className="h-3.5 w-3.5" />
            Neue Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
