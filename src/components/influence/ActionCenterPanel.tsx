import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InfluenceAlertCard } from './InfluenceAlertCard';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';
import { 
  Zap, 
  ChevronRight, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ActionCenterPanelProps {
  alerts: InfluenceAlert[];
  loading: boolean;
  onMarkDone: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onOpenPlaybook: (playbookId: string) => void;
  onViewCandidate?: (submissionId: string) => void;
  maxAlerts?: number;
  candidateMap?: Record<string, { name: string; email: string; phone?: string }>;
}

export function ActionCenterPanel({
  alerts,
  loading,
  onMarkDone,
  onDismiss,
  onOpenPlaybook,
  onViewCandidate,
  maxAlerts = 3,
  candidateMap = {},
}: ActionCenterPanelProps) {
  const criticalCount = alerts.filter(a => a.priority === 'critical').length;
  const highCount = alerts.filter(a => a.priority === 'high').length;
  const pendingCount = alerts.filter(a => !a.action_taken).length;

  // Sort by priority and show top alerts
  const sortedAlerts = [...alerts].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const displayAlerts = sortedAlerts.slice(0, maxAlerts);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
          <h3 className="font-semibold text-lg">Alles erledigt!</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Keine offenen Aktionen für deine Kandidaten
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Action Center
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {criticalCount} kritisch
              </Badge>
            )}
            {highCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-amber-100 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {highCount} hoch
              </Badge>
            )}
            <Badge variant="outline">
              {pendingCount} offen
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayAlerts.map(alert => {
          const candidate = candidateMap[alert.submission_id];
          return (
            <InfluenceAlertCard
              key={alert.id}
              alert={alert}
              onMarkDone={onMarkDone}
              onDismiss={onDismiss}
              onOpenPlaybook={onOpenPlaybook}
              onViewCandidate={onViewCandidate}
              candidateName={candidate?.name}
              candidateEmail={candidate?.email}
              candidatePhone={candidate?.phone}
            />
          );
        })}

        {alerts.length > maxAlerts && (
          <Link to="/recruiter/influence">
            <Button variant="ghost" className="w-full">
              Alle {alerts.length} Alerts anzeigen
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
