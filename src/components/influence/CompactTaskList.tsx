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
    'opt_in_pending': { label: 'Interview-Anfrage', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'opt_in_pending_48h': { label: 'Opt-In überfällig', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'opt_in_pending_24h': { label: 'Opt-In dringend', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'interview_prep_missing': { label: 'Vorbereitung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'interview_reminder': { label: 'Interview-Erinnerung', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'salary_mismatch': { label: 'Gehaltsabweichung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'ghosting_risk': { label: 'Ghosting-Risiko', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    'engagement_drop': { label: 'Engagement gesunken', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'high_closing_probability': { label: 'Closing-Chance', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'closing_opportunity': { label: 'Closing vorbereiten', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'candidate_response': { label: 'Antwort erhalten', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'no_activity': { label: 'Keine Aktivität', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    'sla_warning': { label: 'SLA-Warnung', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    'follow_up_needed': { label: 'Follow-up', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  };
  return map[alertType] || { label: 'Aufgabe', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
};

const getRelativeTime = (dateStr: string): string => {
  try {
    return formatDistanceToNow(new Date(dateStr), { locale: de, addSuffix: false });
  } catch {
    return '';
  }
};

interface TaskRowProps {
  alert: InfluenceAlert;
  candidate?: { name: string; email: string; phone?: string; jobTitle?: string; companyName?: string };
  onMarkDone: (alertId: string) => void;
  onViewCandidate?: (submissionId: string, alertId?: string) => void;
  isUrgent: boolean;
}

function TaskRow({ alert, candidate, onMarkDone, onViewCandidate, isUrgent }: TaskRowProps) {
  const typeInfo = getAlertTypeLabel(alert.alert_type);
  const timeAgo = getRelativeTime(alert.created_at);

  return (
    <div
      className={cn(
        "border-l-4 rounded-lg px-4 py-3 transition-colors hover:bg-accent/50",
        isUrgent
          ? "border-l-destructive bg-destructive/5"
          : "border-l-muted-foreground/30 bg-muted/30"
      )}
    >
      {/* Row 1: Name + Type Badge + Time */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isUrgent ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <button
            onClick={() => onViewCandidate?.(alert.submission_id, alert.id)}
            className="font-semibold text-sm hover:underline truncate text-foreground"
          >
            {candidate?.name || 'Kandidat'}
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={cn("text-[10px] font-medium px-2 py-0.5 border-0", typeInfo.color)}>
            {typeInfo.label}
          </Badge>
          {timeAgo && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo}</span>
          )}
        </div>
      </div>

      {/* Row 2: Job context */}
      {(candidate?.jobTitle || candidate?.companyName) && (
        <p className="text-xs text-muted-foreground mt-1 ml-6 truncate">
          {candidate?.jobTitle}{candidate?.jobTitle && candidate?.companyName ? ' @ ' : ''}{candidate?.companyName}
        </p>
      )}

      {/* Row 3: Message / reason */}
      {alert.message && (
        <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-1 italic">
          „{alert.message}"
        </p>
      )}

      {/* Row 4: Actions */}
      <div className="flex items-center justify-between mt-2 ml-6">
        <div className="flex items-center gap-1">
          {candidate?.phone && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => window.location.href = `tel:${candidate.phone}`}
            >
              <Phone className="h-3 w-3 mr-1" />
              Anrufen
            </Button>
          )}
          {candidate?.email && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => window.location.href = `mailto:${candidate.email}`}
            >
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          onClick={() => onMarkDone(alert.id)}
        >
          <Check className="h-3 w-3 mr-1" />
          Erledigt
        </Button>
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
  maxItems = 10,
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
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
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
          <Badge variant="destructive" className="text-xs">
            {urgentAlerts.length} dringend
          </Badge>
        )}
      </div>

      {/* Urgent section */}
      {displayedUrgent.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Dringend ({urgentAlerts.length})
          </p>
          <div className="space-y-2">
            {displayedUrgent.map(alert => (
              <TaskRow
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

      {/* Open section */}
      {displayedOpen.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Offen ({openAlerts.length})
          </p>
          <div className="space-y-2">
            {displayedOpen.map(alert => (
              <TaskRow
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
