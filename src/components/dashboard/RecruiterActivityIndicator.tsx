import { Badge } from '@/components/ui/badge';
import { Activity, Clock } from 'lucide-react';

/** Ab wann eine Einreichung nicht mehr als laufende Arbeit gilt. */
const FRESH_DAYS = 14;

interface RecruiterActivityIndicatorProps {
  activeRecruiters: number;
  /** Juengste Einreichung. Fehlt sie, hat noch niemand eingereicht. */
  lastSubmittedAt?: string | null;
  className?: string;
}

const daysSince = (iso: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/**
 * Zeigt, ob an einer Stelle tatsaechlich gearbeitet wird.
 *
 * Vorher stand hier ein pulsierendes gruenes "1 Recruiter arbeitet", sobald es
 * ueberhaupt je eine Einreichung gab — auch wenn sie ein halbes Jahr alt und
 * abgelehnt war. Gruen gilt jetzt nur noch fuer frische Aktivitaet; danach
 * nennt die Kachel das Datum, statt Betrieb zu behaupten.
 */
export function RecruiterActivityIndicator({
  activeRecruiters,
  lastSubmittedAt,
  className = ''
}: RecruiterActivityIndicatorProps) {
  if (!lastSubmittedAt || activeRecruiters === 0) {
    return (
      <Badge variant="outline" className={`text-muted-foreground border-muted ${className}`}>
        Noch keine Einreichung
      </Badge>
    );
  }

  const days = daysSince(lastSubmittedAt);

  if (days > FRESH_DAYS) {
    return (
      <Badge
        variant="outline"
        className={`border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400 ${className}`}
      >
        <Clock className="h-3 w-3 mr-1" />
        Zuletzt eingereicht vor {days} Tagen
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400 ${className}`}
    >
      <Activity className="h-3 w-3 mr-1" />
      {activeRecruiters} Recruiter {activeRecruiters === 1 ? 'arbeitet' : 'arbeiten'}
    </Badge>
  );
}
