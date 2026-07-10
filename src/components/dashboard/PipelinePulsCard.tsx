import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardStats, HealthConfig } from '@/hooks/useClientDashboard';
import { Activity, Briefcase, CalendarDays, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  stats?: DashboardStats;
  health?: HealthConfig;
  loading?: boolean;
}

const HEALTH_DOT: Record<HealthConfig['level'], string> = {
  excellent: 'bg-emerald-500',
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-destructive',
};

/** Kompakter Puls neben "Stelle ausschreiben": vier Kernzahlen + Health-Status.
 *  Nutzt stats/healthScore aus client-dashboard-data (werden ohnehin berechnet). */
export function PipelinePulsCard({ stats, health, loading }: Props) {
  const kpis = [
    { icon: Briefcase, label: 'Stellen live', value: stats?.activeJobs },
    {
      icon: Users,
      label: 'Kandidaten',
      value: stats?.totalCandidates,
      hint: stats && stats.newCandidatesLast7Days > 0 ? `+${stats.newCandidatesLast7Days} diese Woche` : undefined,
    },
    { icon: CalendarDays, label: 'Interviews offen', value: stats?.pendingInterviews },
    { icon: Trophy, label: 'Einstellungen', value: stats?.placements },
  ];

  return (
    <Card className="h-full border-border/30 shadow-sm">
      <CardContent className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Pipeline-Puls</h3>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
          {kpis.map(({ icon: Icon, label, value, hint }) => (
            <div key={label} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                {loading ? (
                  <Skeleton className="mb-1 h-6 w-10" />
                ) : (
                  <p className="text-xl font-bold leading-6 tabular-nums">{value ?? 0}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">{label}</p>
                {hint && !loading && (
                  <p className="text-[11px] font-medium text-emerald-600">{hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
          {loading || !health ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <>
              <span className={cn('h-2 w-2 shrink-0 rounded-full', HEALTH_DOT[health.level])} />
              <span className="truncate">{health.message}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
