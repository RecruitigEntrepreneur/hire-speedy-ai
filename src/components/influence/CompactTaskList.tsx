import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';
import { 
  Phone, 
  Mail, 
  Check, 
  AlertCircle, 
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactTaskListProps {
  alerts: InfluenceAlert[];
  loading: boolean;
  onMarkDone: (alertId: string) => void;
  onViewCandidate?: (submissionId: string) => void;
  candidateMap?: Record<string, { name: string; email: string; phone?: string; jobTitle?: string; companyName?: string }>;
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

const priorityConfig = {
  critical: { 
    icon: AlertCircle, 
    label: 'Kritisch', 
    bgColor: 'bg-destructive/10',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/20'
  },
  high: { 
    icon: AlertTriangle, 
    label: 'Hoch', 
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/20'
  },
  medium: { 
    icon: Clock, 
    label: 'Mittel', 
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/20'
  },
  low: { 
    icon: Clock, 
    label: 'Normal', 
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    borderColor: 'border-border'
  },
};

export function CompactTaskList({
  alerts,
  loading,
  onMarkDone,
  onViewCandidate,
  candidateMap = {},
  maxItems = 5,
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
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
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

  const renderTaskRow = (alert: InfluenceAlert) => {
    const candidate = candidateMap[alert.submission_id];
    const config = priorityConfig[alert.priority];
    const PriorityIcon = config.icon;
    
    // Extract action from alert
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

    // Build job context string
    const jobContext = candidate?.jobTitle && candidate?.companyName 
      ? `${candidate.jobTitle} @ ${candidate.companyName}`
      : candidate?.jobTitle || candidate?.companyName || null;

    return (
      <div 
        key={alert.id}
        className={cn(
          "flex items-center justify-between gap-2 p-2 rounded-md border transition-colors hover:bg-accent/50",
          config.borderColor
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PriorityIcon className={cn("h-4 w-4 shrink-0", config.textColor)} />
          <button
            onClick={() => onViewCandidate?.(alert.submission_id)}
            className="font-medium text-sm truncate hover:underline text-left"
          >
            {candidate?.name || 'Kandidat'}
          </button>
          {jobContext && (
            <>
              <span className="text-muted-foreground text-sm hidden sm:inline">·</span>
              <span className="text-xs text-muted-foreground truncate hidden sm:inline max-w-[150px]">
                {jobContext}
              </span>
            </>
          )}
          <Badge variant="outline" className="text-xs shrink-0 ml-auto sm:ml-0">
            {getShortAction(alert.alert_type)}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {candidate?.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => window.location.href = `tel:${candidate.phone}`}
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
            >
              <Mail className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={() => onMarkDone(alert.id)}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const displayedAlerts = [...criticalAlerts, ...highAlerts, ...otherAlerts].slice(0, maxItems);
  const hasMore = totalPending > maxItems;

  return (
    <div className="space-y-3">
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

      {/* Task list */}
      <div className="space-y-1.5">
        {/* Critical section */}
        {criticalAlerts.length > 0 && displayedAlerts.some(a => a.priority === 'critical') && (
          <div className="text-xs font-medium text-destructive uppercase tracking-wide pt-1 pb-0.5 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Kritisch
          </div>
        )}
        {displayedAlerts.filter(a => a.priority === 'critical').map(renderTaskRow)}
        
        {/* High section */}
        {highAlerts.length > 0 && displayedAlerts.some(a => a.priority === 'high') && (
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wide pt-2 pb-0.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Hoch
          </div>
        )}
        {displayedAlerts.filter(a => a.priority === 'high').map(renderTaskRow)}
        
        {/* Other section */}
        {otherAlerts.length > 0 && displayedAlerts.some(a => a.priority === 'medium' || a.priority === 'low') && (
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 pb-0.5">
            Weitere
          </div>
        )}
        {displayedAlerts.filter(a => a.priority === 'medium' || a.priority === 'low').map(renderTaskRow)}
      </div>

      {/* View all */}
      {showViewAll && hasMore && onViewAll && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onViewAll}
        >
          Alle {totalPending} Aufgaben anzeigen
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
