import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { UnifiedAction } from '@/hooks/useClientDashboard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertCircle, 
  Clock, 
  Calendar, 
  X, 
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PremiumActionCenterProps {
  actions: UnifiedAction[];
  loading?: boolean;
  onActionComplete?: () => void;
  maxActions?: number;
}

const URGENCY_STYLES = {
  critical: {
    border: 'border-l-4 border-l-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: 'text-destructive',
  },
  warning: {
    border: 'border-l-4 border-l-warning',
    badge: 'bg-warning/10 text-warning border-warning/20',
    icon: 'text-warning',
  },
  normal: {
    border: 'border-l-4 border-l-muted',
    badge: 'bg-muted text-muted-foreground border-muted',
    icon: 'text-muted-foreground',
  },
};

export function PremiumActionCenter({ 
  actions, 
  loading = false, 
  onActionComplete,
  maxActions = 6 
}: PremiumActionCenterProps) {
  const [interviewDialog, setInterviewDialog] = useState<{ open: boolean; action: UnifiedAction | null }>({
    open: false,
    action: null,
  });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; action: UnifiedAction | null }>({
    open: false,
    action: null,
  });
  const [processingId, setProcessingId] = useState<string | null>(null);

  const criticalCount = actions.filter(a => a.urgency === 'critical').length;
  const displayActions = actions.slice(0, maxActions);
  const hasMore = actions.length > maxActions;

  const handleRequestInterview = (action: UnifiedAction) => {
    setInterviewDialog({ open: true, action });
  };

  const handleReject = (action: UnifiedAction) => {
    setRejectDialog({ open: true, action });
  };

  const confirmReject = async () => {
    if (!rejectDialog.action?.submissionId) return;

    setProcessingId(rejectDialog.action.id);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ stage: 'client_rejected' })
        .eq('id', rejectDialog.action.submissionId);

      if (error) throw error;

      toast.success('Kandidat abgelehnt');
      onActionComplete?.();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Fehler beim Ablehnen');
    } finally {
      setProcessingId(null);
      setRejectDialog({ open: false, action: null });
    }
  };

  const formatWaitingTime = (hours: number): string => {
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-success/20 mb-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Alles erledigt!</h3>
          <p className="text-sm text-muted-foreground">
            Keine ausstehenden Entscheidungen. Ihre Recruiter arbeiten für Sie.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {criticalCount > 0 && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-destructive/10">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Entscheidungen ausstehend</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {criticalCount > 0 
                    ? `${criticalCount} dringend, ${actions.length - criticalCount} weitere`
                    : `${actions.length} Kandidaten warten auf Ihre Entscheidung`
                  }
                </p>
              </div>
            </div>
            {hasMore && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/talent-hub">
                  Alle anzeigen
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayActions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onRequestInterview={() => handleRequestInterview(action)}
                onReject={() => handleReject(action)}
                isProcessing={processingId === action.id}
                formatWaitingTime={formatWaitingTime}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interview Request Dialog */}
      {interviewDialog.action?.submissionId && (
        <InterviewRequestWithOptInDialog
          open={interviewDialog.open}
          onOpenChange={(open) => setInterviewDialog({ open, action: open ? interviewDialog.action : null })}
          submissionId={interviewDialog.action.submissionId}
          candidateAnonymousId={interviewDialog.action.candidateAnonymousId || 'Kandidat'}
          jobTitle={interviewDialog.action.jobTitle || 'Position'}
          onSuccess={() => {
            setInterviewDialog({ open: false, action: null });
            onActionComplete?.();
          }}
        />
      )}

      {/* Reject Confirmation Dialog */}
      <AlertDialog 
        open={rejectDialog.open} 
        onOpenChange={(open) => setRejectDialog({ open, action: open ? rejectDialog.action : null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kandidat ablehnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie {rejectDialog.action?.candidateAnonymousId || 'diesen Kandidaten'} für die Position 
              "{rejectDialog.action?.jobTitle}" ablehnen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface ActionCardProps {
  action: UnifiedAction;
  onRequestInterview: () => void;
  onReject: () => void;
  isProcessing: boolean;
  formatWaitingTime: (hours: number) => string;
}

function ActionCard({ action, onRequestInterview, onReject, isProcessing, formatWaitingTime }: ActionCardProps) {
  const styles = URGENCY_STYLES[action.urgency];
  
  // Extract match score from title if available (format: "92% Match")
  const matchScoreMatch = action.title.match(/(\d+)%/);
  const matchScore = matchScoreMatch ? parseInt(matchScoreMatch[1]) : null;

  return (
    <div 
      className={cn(
        "relative rounded-lg border bg-card p-4 transition-all hover:shadow-md",
        styles.border
      )}
    >
      {/* Header with ID and Match Score */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="font-mono font-semibold text-sm">
              {action.candidateAnonymousId || 'Kandidat'}
            </span>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {action.jobTitle}
            </p>
          </div>
        </div>
        {matchScore && (
          <Badge 
            variant="outline" 
            className={cn(
              "font-semibold",
              matchScore >= 85 ? "bg-success/10 text-success border-success/30" :
              matchScore >= 70 ? "bg-primary/10 text-primary border-primary/30" :
              "bg-muted text-muted-foreground"
            )}
          >
            {matchScore}%
          </Badge>
        )}
      </div>

      {/* Waiting Time */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
        <Clock className={cn("h-3 w-3", styles.icon)} />
        <span>wartet seit {formatWaitingTime(action.waitingHours)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="flex-1"
          onClick={onRequestInterview}
          disabled={isProcessing}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Interview
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          onClick={onReject}
          disabled={isProcessing}
          className="text-muted-foreground hover:text-destructive hover:border-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* View Details Link */}
      {action.submissionId && (
        <Link 
          to={`/dashboard/candidates/${action.submissionId}`}
          className="absolute inset-0 z-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="sr-only">Details anzeigen</span>
        </Link>
      )}
    </div>
  );
}
