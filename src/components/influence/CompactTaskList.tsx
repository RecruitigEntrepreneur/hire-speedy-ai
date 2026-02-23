import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';
import { 
  Phone, 
  Mail, 
  Check, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

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

const getAlertTypeLabel = (alertType: string): { label: string; color: string } => {
  const map: Record<string, { label: string; color: string }> = {
    'opt_in_pending': { label: 'Interview-Anfrage', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'opt_in_pending_48h': { label: 'Opt-In überfällig', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'opt_in_pending_24h': { label: 'Opt-In dringend', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'interview_prep_missing': { label: 'Vorbereitung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'interview_reminder': { label: 'Interview', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'salary_mismatch': { label: 'Gehalt', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'ghosting_risk': { label: 'Ghosting', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    'engagement_drop': { label: 'Engagement', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'high_closing_probability': { label: 'Closing', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'closing_opportunity': { label: 'Closing', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'candidate_response': { label: 'Antwort', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'no_activity': { label: 'Inaktiv', color: 'bg-muted text-muted-foreground' },
    'sla_warning': { label: 'SLA', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'follow_up_needed': { label: 'Follow-up', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };
  return map[alertType] || { label: 'Aufgabe', color: 'bg-muted text-muted-foreground' };
};

interface TicketCardProps {
  alert: InfluenceAlert;
  candidate?: { name: string; email: string; phone?: string; jobTitle?: string; companyName?: string };
  onMarkDone: (alertId: string) => void;
  onViewCandidate?: (submissionId: string, alertId?: string) => void;
  isUrgent: boolean;
}

function TicketCard({ alert, candidate, onMarkDone, onViewCandidate, isUrgent }: TicketCardProps) {
  const typeInfo = getAlertTypeLabel(alert.alert_type);

  return (
    <div
      className={cn(
        "border rounded-lg p-2.5 flex flex-col justify-between min-h-[88px] transition-colors",
        isUrgent
          ? "border-l-2 border-l-amber-500 bg-amber-500/5"
          : "border-border bg-card"
      )}
    >
      {/* Row 1: Badge + Done */}
      <div className="flex items-center justify-between gap-1">
        <Badge className={cn("text-[10px] font-medium px-1.5 py-0 h-4 border-0", typeInfo.color)}>
          {typeInfo.label}
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0"
              onClick={() => onMarkDone(alert.id)}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Erledigt</TooltipContent>
        </Tooltip>
      </div>

      {/* Row 2: Name */}
      <button
        onClick={() => onViewCandidate?.(alert.submission_id, alert.id)}
        className="font-medium text-sm text-left hover:underline truncate mt-1"
      >
        {candidate?.name || 'Kandidat'}
      </button>

      {/* Row 3: Job @ Company */}
      {(candidate?.jobTitle || candidate?.companyName) && (
        <p className="text-xs text-muted-foreground truncate">
          {candidate?.jobTitle}{candidate?.jobTitle && candidate?.companyName ? ' @ ' : ''}{candidate?.companyName}
        </p>
      )}

      {/* Row 4: Icon actions */}
      <div className="flex items-center gap-1 mt-1.5">
        {candidate?.phone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => window.location.href = `tel:${candidate.phone}`}
              >
                <Phone className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Anrufen</TooltipContent>
          </Tooltip>
        )}
        {candidate?.email && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => window.location.href = `mailto:${candidate.email}`}
              >
                <Mail className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Email</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function CompactTaskList({
  alerts,
  loading,
  onMarkDone,
  onViewCandidate,
  candidateMap = {},
  maxItems = 12,
  showViewAll = true,
  onViewAll,
}: CompactTaskListProps) {
  const pendingAlerts = alerts.filter(a => !a.action_taken);
  const urgentAlerts = pendingAlerts.filter(a => a.priority === 'critical');
  const openAlerts = pendingAlerts.filter(a => a.priority !== 'critical');
  const totalPending = pendingAlerts.length;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (totalPending === 0) {
    return (
      <div className="py-8 text-center">
        <CheckCircle className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
        <p className="font-medium">Alles erledigt!</p>
        <p className="text-sm text-muted-foreground">Keine offenen Aufgaben</p>
      </div>
    );
  }

  const displayedUrgent = urgentAlerts.slice(0, maxItems);
  const remainingSlots = Math.max(0, maxItems - displayedUrgent.length);
  const displayedOpen = openAlerts.slice(0, remainingSlots);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          Aufgaben
          <Badge variant="secondary" className="text-xs">{totalPending}</Badge>
        </h3>
        {urgentAlerts.length > 0 && (
          <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
            {urgentAlerts.length} dringend
          </Badge>
        )}
      </div>

      {/* Urgent grid */}
      {displayedUrgent.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Dringend ({urgentAlerts.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {displayedUrgent.map(alert => (
              <TicketCard
                key={alert.id}
                alert={alert}
                candidate={candidateMap[alert.submission_id]}
                onMarkDone={onMarkDone}
                onViewCandidate={onViewCandidate}
                isUrgent
              />
            ))}
          </div>
        </div>
      )}

      {/* Open grid */}
      {displayedOpen.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Offen ({openAlerts.length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {displayedOpen.map(alert => (
              <TicketCard
                key={alert.id}
                alert={alert}
                candidate={candidateMap[alert.submission_id]}
                onMarkDone={onMarkDone}
                onViewCandidate={onViewCandidate}
                isUrgent={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* View all */}
      {showViewAll && totalPending > maxItems && onViewAll && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={onViewAll}
        >
          Alle {totalPending} Aufgaben anzeigen
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
