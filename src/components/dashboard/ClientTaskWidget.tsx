import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientTasks, ClientTask } from '@/hooks/useClientTasks';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { 
  Users, 
  Calendar, 
  Gift, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  CheckCircle2,
  X,
  Eye
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientTaskWidgetProps {
  maxTasks?: number;
}

export function ClientTaskWidget({ maxTasks = 5 }: ClientTaskWidgetProps) {
  const navigate = useNavigate();
  const { tasks, stats, loading, refetch } = useClientTasks();
  
  // Dialog states
  const [interviewDialog, setInterviewDialog] = useState<{
    open: boolean;
    submissionId: string;
    candidateAnonymousId: string;
    jobTitle: string;
    jobIndustry: string;
  } | null>(null);
  
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    submissionId: string;
    candidateName: string;
  } | null>(null);

  const getTaskIcon = (type: ClientTask['type']) => {
    switch (type) {
      case 'decision':
        return <Users className="h-4 w-4" />;
      case 'interview':
        return <Calendar className="h-4 w-4" />;
      case 'offer':
        return <Gift className="h-4 w-4" />;
    }
  };

  const getUrgencyStyles = (urgency: ClientTask['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'border-destructive/50 bg-destructive/5';
      case 'warning':
        return 'border-warning/50 bg-warning/5';
      default:
        return 'border-border/50 bg-card';
    }
  };

  const getUrgencyBadge = (urgency: ClientTask['urgency'], hours?: number) => {
    if (urgency === 'critical') {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {hours ? `${hours}h` : 'Kritisch'}
        </Badge>
      );
    }
    if (urgency === 'warning') {
      return (
        <Badge variant="outline" className="text-xs border-warning text-warning">
          <Clock className="h-3 w-3 mr-1" />
          {hours ? `${hours}h` : 'Warnung'}
        </Badge>
      );
    }
    return null;
  };

  const handleInterviewRequest = (task: ClientTask) => {
    if (!task.submissionId) return;
    
    setInterviewDialog({
      open: true,
      submissionId: task.submissionId,
      candidateAnonymousId: task.candidateAnonymousId || `Kandidat #${task.submissionId.slice(0, 6)}`,
      jobTitle: task.jobTitle || 'Position',
      jobIndustry: task.jobIndustry || 'IT',
    });
  };

  const handleReject = (task: ClientTask) => {
    if (!task.submissionId) return;
    
    setRejectDialog({
      open: true,
      submissionId: task.submissionId,
      candidateName: task.candidateName || 'Kandidat',
    });
  };

  const confirmReject = async () => {
    if (!rejectDialog) return;
    
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          status: 'rejected',
          stage: 'rejected',
        })
        .eq('id', rejectDialog.submissionId);

      if (error) throw error;
      
      toast.success('Kandidat wurde abgelehnt');
      refetch();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Fehler beim Ablehnen');
    } finally {
      setRejectDialog(null);
    }
  };

  const handleViewOffer = (task: ClientTask) => {
    if (task.offerId) {
      navigate(`/dashboard/offers?highlight=${task.offerId}`);
    } else if (task.submissionId) {
      navigate(`/dashboard/candidates/${task.submissionId}`);
    }
  };

  const handleViewDetails = (task: ClientTask) => {
    if (task.submissionId) {
      navigate(`/dashboard/candidates/${task.submissionId}`);
    }
  };

  const totalTasks = stats.pendingDecisions + stats.pendingInterviews + stats.pendingOffers;

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (totalTasks === 0) {
    return (
      <Card className="border-border/50 border-success/30 bg-success/5">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="p-3 rounded-full bg-success/10">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-success">Alles erledigt!</h3>
            <p className="text-sm text-muted-foreground">Keine offenen Aufgaben vorhanden.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`border-border/50 ${stats.criticalCount > 0 ? 'border-destructive/30' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Was ist heute zu tun?</CardTitle>
            <Badge variant={stats.criticalCount > 0 ? 'destructive' : 'secondary'}>
              {totalTasks} {totalTasks === 1 ? 'Aufgabe' : 'Aufgaben'}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/candidates">
              Alle anzeigen
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Quick Stats */}
          <div className="flex gap-4 pb-3 border-b border-border/50">
            {stats.pendingDecisions > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{stats.pendingDecisions}</span>
                <span className="text-muted-foreground">Entscheidungen</span>
              </div>
            )}
            {stats.pendingInterviews > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-warning" />
                <span className="font-medium">{stats.pendingInterviews}</span>
                <span className="text-muted-foreground">Interviews</span>
              </div>
            )}
            {stats.pendingOffers > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Gift className="h-4 w-4 text-success" />
                <span className="font-medium">{stats.pendingOffers}</span>
                <span className="text-muted-foreground">Angebote</span>
              </div>
            )}
          </div>

          {/* Task List */}
          {tasks.slice(0, maxTasks).map((task) => (
            <div
              key={task.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${getUrgencyStyles(task.urgency)}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  task.type === 'decision' ? 'bg-primary/10 text-primary' :
                  task.type === 'interview' ? 'bg-warning/10 text-warning' :
                  'bg-success/10 text-success'
                }`}>
                  {getTaskIcon(task.type)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {getUrgencyBadge(task.urgency, task.hoursWaiting)}
                
                {/* Direct Action Buttons */}
                {task.type === 'decision' && (
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="default"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleInterviewRequest(task)}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Interview
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleReject(task)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {task.type === 'interview' && (
                  <Button 
                    size="sm" 
                    variant="default"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleInterviewRequest(task)}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Termine
                  </Button>
                )}
                
                {task.type === 'offer' && (
                  <Button 
                    size="sm" 
                    variant="default"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleViewOffer(task)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Prüfen
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleViewDetails(task)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {tasks.length > maxTasks && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              + {tasks.length - maxTasks} weitere Aufgaben
            </p>
          )}
        </CardContent>
      </Card>

      {/* Interview Request Dialog */}
      {interviewDialog && (
        <InterviewRequestWithOptInDialog
          open={interviewDialog.open}
          onOpenChange={(open) => !open && setInterviewDialog(null)}
          submissionId={interviewDialog.submissionId}
          candidateAnonymousId={interviewDialog.candidateAnonymousId}
          jobTitle={interviewDialog.jobTitle}
          jobIndustry={interviewDialog.jobIndustry}
          onSuccess={refetch}
        />
      )}

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kandidat ablehnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie {rejectDialog?.candidateName} wirklich ablehnen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
