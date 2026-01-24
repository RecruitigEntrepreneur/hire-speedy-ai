import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  UserCheck, 
  Calendar, 
  Gift, 
  MessageSquare,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X
} from 'lucide-react';
import { UnifiedAction } from '@/hooks/useClientDashboard';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

interface UnifiedActionCenterProps {
  actions: UnifiedAction[];
  loading?: boolean;
  onActionComplete?: () => void;
  maxActions?: number;
}

const ACTION_ICONS = {
  review_candidate: UserCheck,
  schedule_interview: Calendar,
  give_feedback: MessageSquare,
  make_offer: Gift,
  respond_to_question: MessageSquare,
};

const URGENCY_CONFIG = {
  critical: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    badge: 'bg-destructive text-destructive-foreground',
    icon: AlertCircle,
    label: 'Kritisch',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    badge: 'bg-warning text-warning-foreground',
    icon: AlertTriangle,
    label: 'Bald fällig',
  },
  normal: {
    bg: 'bg-muted/50',
    border: 'border-border',
    badge: 'bg-secondary text-secondary-foreground',
    icon: Clock,
    label: 'Normal',
  },
};

export function UnifiedActionCenter({ 
  actions, 
  loading = false,
  onActionComplete,
  maxActions = 8 
}: UnifiedActionCenterProps) {
  const navigate = useNavigate();
  const [interviewDialog, setInterviewDialog] = useState<{
    open: boolean;
    submissionId: string;
    candidateAnonymousId: string;
    jobTitle: string;
  } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    submissionId: string;
    candidateAnonymousId: string;
  } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const groupedActions = {
    critical: actions.filter(a => a.urgency === 'critical'),
    warning: actions.filter(a => a.urgency === 'warning'),
    normal: actions.filter(a => a.urgency === 'normal'),
  };

  const displayActions = actions.slice(0, maxActions);
  const hasMore = actions.length > maxActions;

  const handleRequestInterview = (action: UnifiedAction) => {
    if (!action.submissionId) return;
    setInterviewDialog({
      open: true,
      submissionId: action.submissionId,
      candidateAnonymousId: action.candidateAnonymousId || 'Kandidat',
      jobTitle: action.jobTitle || 'Job',
    });
  };

  const handleReject = (action: UnifiedAction) => {
    if (!action.submissionId) return;
    setRejectDialog({
      open: true,
      submissionId: action.submissionId,
      candidateAnonymousId: action.candidateAnonymousId || 'Kandidat',
    });
  };

  const confirmReject = async () => {
    if (!rejectDialog?.submissionId) return;
    
    setProcessingId(rejectDialog.submissionId);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          status: 'client_rejected',
          rejection_reason: 'Nicht passend'
        })
        .eq('id', rejectDialog.submissionId);

      if (error) throw error;
      
      toast.success('Kandidat abgelehnt');
      onActionComplete?.();
    } catch (error) {
      console.error('Error rejecting candidate:', error);
      toast.error('Fehler beim Ablehnen');
    } finally {
      setProcessingId(null);
      setRejectDialog(null);
    }
  };

  const handleViewDetails = (action: UnifiedAction) => {
    if (action.type === 'make_offer' && action.offerId) {
      navigate(`/dashboard/offers`);
    } else if (action.submissionId) {
      navigate(`/dashboard/candidates/${action.submissionId}`);
    } else if (action.jobId) {
      navigate(`/dashboard/jobs/${action.jobId}`);
    }
  };

  const handleScheduleInterview = (action: UnifiedAction) => {
    if (action.interviewId) {
      navigate(`/dashboard/interviews`);
    }
  };

  const formatWaitingTime = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Keine offenen Aufgaben
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Alles erledigt! Warten Sie auf neue Kandidatenvorschläge.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderActionItem = (action: UnifiedAction) => {
    const config = URGENCY_CONFIG[action.urgency];
    const Icon = ACTION_ICONS[action.type];
    const isProcessing = processingId === action.submissionId;

    return (
      <div
        key={action.id}
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border transition-colors',
          config.bg,
          config.border,
          'hover:bg-accent/50'
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
            action.urgency === 'critical' ? 'bg-destructive/20' :
            action.urgency === 'warning' ? 'bg-warning/20' : 'bg-muted'
          )}>
            <Icon className={cn(
              'h-4 w-4',
              action.urgency === 'critical' ? 'text-destructive' :
              action.urgency === 'warning' ? 'text-warning' : 'text-muted-foreground'
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">
                {action.candidateAnonymousId || action.title}
              </span>
              {action.waitingHours >= 24 && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatWaitingTime(action.waitingHours)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {action.title} · {action.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {action.type === 'review_candidate' && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => handleRequestInterview(action)}
                disabled={isProcessing}
              >
                Interview
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleReject(action)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {action.type === 'schedule_interview' && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={() => handleScheduleInterview(action)}
            >
              Planen
            </Button>
          )}
          {action.type === 'make_offer' && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={() => handleViewDetails(action)}
            >
              Prüfen
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => handleViewDetails(action)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              Was ist zu tun?
              <Badge variant="secondary" className="ml-1">
                {actions.length}
              </Badge>
            </CardTitle>
            {(groupedActions.critical.length > 0 || groupedActions.warning.length > 0) && (
              <div className="flex items-center gap-2">
                {groupedActions.critical.length > 0 && (
                  <Badge className={URGENCY_CONFIG.critical.badge}>
                    {groupedActions.critical.length} kritisch
                  </Badge>
                )}
                {groupedActions.warning.length > 0 && (
                  <Badge className={URGENCY_CONFIG.warning.badge}>
                    {groupedActions.warning.length} bald fällig
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {displayActions.map(renderActionItem)}
          
          {hasMore && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate('/dashboard/talent-hub')}
            >
              {actions.length - maxActions} weitere anzeigen
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Interview Dialog */}
      {interviewDialog && (
        <InterviewRequestWithOptInDialog
          open={interviewDialog.open}
          onOpenChange={(open) => !open && setInterviewDialog(null)}
          submissionId={interviewDialog.submissionId}
          candidateAnonymousId={interviewDialog.candidateAnonymousId}
          jobTitle={interviewDialog.jobTitle}
          onSuccess={() => {
            setInterviewDialog(null);
            onActionComplete?.();
          }}
        />
      )}

      {/* Reject Confirmation Dialog */}
      <AlertDialog 
        open={rejectDialog?.open || false} 
        onOpenChange={(open) => !open && setRejectDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kandidat ablehnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie {rejectDialog?.candidateAnonymousId} wirklich ablehnen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
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
