import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';
import { 
  Phone, 
  Mail, 
  Check, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactTaskListProps {
  alerts: InfluenceAlert[];
  loading: boolean;
  onMarkDone: (alertId: string) => void;
  onViewCandidate?: (submissionId: string, alertId?: string) => void;
  candidateMap?: Record<string, { name: string; email: string; phone?: string; jobTitle?: string; companyName?: string }>;
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

const priorityConfig = {
  critical: { 
    icon: AlertCircle, 
    label: 'Kritisch', 
    borderColor: 'border-l-destructive',
    bgColor: 'bg-destructive/5',
    textColor: 'text-destructive',
  },
  high: { 
    icon: AlertTriangle, 
    label: 'Hoch', 
    borderColor: 'border-l-amber-500',
    bgColor: 'bg-amber-500/5',
    textColor: 'text-amber-600',
  },
  medium: { 
    icon: Clock, 
    label: 'Mittel', 
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-500/5',
    textColor: 'text-blue-600',
  },
  low: { 
    icon: Clock, 
    label: 'Normal', 
    borderColor: 'border-l-muted-foreground',
    bgColor: 'bg-muted/50',
    textColor: 'text-muted-foreground',
  },
};

const getShortAction = (alertType: string): string => {
  const actionMap: Record<string, string> = {
    'opt_in_pending': 'Nachfassen',
    'opt_in_pending_48h': 'Dringend nachfassen',
    'opt_in_pending_24h': 'Sofort nachfassen',
    'interview_prep_missing': 'Vorbereitung senden',
    'interview_reminder': 'Interview bestätigen',
    'salary_mismatch': 'Gehalt klären',
    'ghosting_risk': 'Kontaktieren',
    'engagement_drop': 'Reaktivieren',
    'high_closing_probability': 'Closing nutzen',
    'closing_opportunity': 'Closing vorbereiten',
    'candidate_response': 'Antworten',
    'no_activity': 'Aktivität prüfen',
    'sla_warning': 'SLA beachten',
    'follow_up_needed': 'Follow-up',
  };
  return actionMap[alertType] || 'Bearbeiten';
};

interface TaskCardProps {
  alert: InfluenceAlert;
  candidate?: { name: string; email: string; phone?: string; jobTitle?: string; companyName?: string };
  onMarkDone: (alertId: string) => void;
  onViewCandidate?: (submissionId: string, alertId?: string) => void;
}

function TaskCard({ alert, candidate, onMarkDone, onViewCandidate }: TaskCardProps) {
  const config = priorityConfig[alert.priority];
  const PriorityIcon = config.icon;

  return (
    <Card 
      className={cn(
        "flex-shrink-0 w-[200px] border-l-4 transition-all hover:shadow-md",
        config.borderColor,
        config.bgColor
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Priority Icon + Name */}
        <div className="flex items-start gap-2">
          <PriorityIcon className={cn("h-4 w-4 mt-0.5 shrink-0", config.textColor)} />
          <button
            onClick={() => onViewCandidate?.(alert.submission_id, alert.id)}
            className="font-medium text-sm leading-tight hover:underline text-left line-clamp-2"
          >
            {candidate?.name || 'Kandidat'}
          </button>
        </div>

        {/* Job Context */}
        {(candidate?.jobTitle || candidate?.companyName) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {candidate?.jobTitle && (
              <p className="line-clamp-1">{candidate.jobTitle}</p>
            )}
            {candidate?.companyName && (
              <p className="line-clamp-1">@ {candidate.companyName}</p>
            )}
          </div>
        )}

        {/* Action Badge */}
        <Badge variant="outline" className="text-xs w-full justify-center">
          {getShortAction(alert.alert_type)}
        </Badge>

        {/* Quick Actions */}
        <div className="flex items-center justify-between gap-1 pt-1 border-t">
          <div className="flex items-center gap-1">
            {candidate?.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.location.href = `tel:${candidate.phone}`}
                title="Anrufen"
              >
                <Phone className="h-3.5 w-3.5" />
              </Button>
            )}
            {candidate?.email && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => window.location.href = `mailto:${candidate.email}`}
                title="Email"
              >
                <Mail className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={() => onMarkDone(alert.id)}
            title="Erledigt"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompactTaskList({
  alerts,
  loading,
  onMarkDone,
  onViewCandidate,
  candidateMap = {},
  maxItems = 10,
  showViewAll = true,
  onViewAll,
}: CompactTaskListProps) {
  // Group alerts by priority
  const criticalAlerts = alerts.filter(a => a.priority === 'critical' && !a.action_taken);
  const highAlerts = alerts.filter(a => a.priority === 'high' && !a.action_taken);
  const otherAlerts = alerts.filter(a => (a.priority === 'medium' || a.priority === 'low') && !a.action_taken);
  
  const totalPending = criticalAlerts.length + highAlerts.length + otherAlerts.length;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-8" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[160px] w-[200px] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0 || totalPending === 0) {
    return (
      <div className="py-8 text-center">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
        <p className="font-medium">Alles erledigt!</p>
        <p className="text-sm text-muted-foreground">Keine offenen Aufgaben</p>
      </div>
    );
  }

  const displayedAlerts = [...criticalAlerts, ...highAlerts, ...otherAlerts].slice(0, maxItems);
  const hasMore = totalPending > maxItems;

  const renderPrioritySection = (
    sectionAlerts: InfluenceAlert[],
    label: string,
    Icon: typeof AlertCircle,
    colorClass: string
  ) => {
    if (sectionAlerts.length === 0) return null;
    
    const displayedInSection = displayedAlerts.filter(a => sectionAlerts.some(sa => sa.id === a.id));
    if (displayedInSection.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className={cn("text-xs font-medium uppercase tracking-wide flex items-center gap-1", colorClass)}>
          <Icon className="h-3 w-3" />
          {label} ({sectionAlerts.length})
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-3">
            {displayedInSection.map(alert => (
              <TaskCard
                key={alert.id}
                alert={alert}
                candidate={candidateMap[alert.submission_id]}
                onMarkDone={onMarkDone}
                onViewCandidate={onViewCandidate}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          Heute zu tun
          <Badge variant="secondary" className="text-xs">
            {totalPending}
          </Badge>
        </h3>
        <div className="flex items-center gap-2">
          {criticalAlerts.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalAlerts.length} kritisch
            </Badge>
          )}
          {highAlerts.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 text-xs hover:bg-amber-100">
              {highAlerts.length} hoch
            </Badge>
          )}
        </div>
      </div>

      {/* Priority sections with horizontal cards */}
      <div className="space-y-4">
        {renderPrioritySection(criticalAlerts, 'Kritisch', AlertCircle, 'text-destructive')}
        {renderPrioritySection(highAlerts, 'Hoch', AlertTriangle, 'text-amber-600')}
        {renderPrioritySection(otherAlerts, 'Weitere', Clock, 'text-muted-foreground')}
      </div>

      {/* View all button */}
      {showViewAll && hasMore && onViewAll && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onViewAll}
        >
          Alle {totalPending} Aufgaben anzeigen →
        </Button>
      )}
    </div>
  );
}
